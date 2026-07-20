use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::{Manager, WindowEvent};
use walkdir::WalkDir;

// =================== Agent 注册表 ===================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentSource {
    pub id: String,
    pub name: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Deserialize, Clone)]
struct AgentDef {
    id: String,
    name: String,
    #[serde(rename = "globalPath")]
    global_path: Option<String>,
}

const AGENTS_JSON: &str = include_str!("../resources/agents.json");

fn agent_registry() -> &'static Vec<AgentDef> {
    static REGISTRY: std::sync::OnceLock<Vec<AgentDef>> = std::sync::OnceLock::new();
    REGISTRY.get_or_init(|| {
        serde_json::from_str(AGENTS_JSON).expect("agents.json 格式错误")
    })
}

fn expand_home(p: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    match p.strip_prefix("~/") {
        Some(rest) => Some(home.join(rest)),
        None => Some(PathBuf::from(p)),
    }
}

fn resolve_agent_global_path(agent: &AgentDef) -> Option<PathBuf> {
    expand_home(agent.global_path.as_deref()?)
}

/// 按物理路径去重分组，一个路径可能对应多个 agent（如 ~/.agents/skills/）。
/// 用线性 Vec 保留 registry 中的原始出现顺序，避免 HashMap 迭代顺序不稳定。
fn group_agents_by_path() -> Vec<(PathBuf, Vec<AgentDef>)> {
    let mut groups: Vec<(PathBuf, Vec<AgentDef>)> = Vec::new();
    for agent in agent_registry() {
        let Some(path) = resolve_agent_global_path(agent) else { continue };
        match groups.iter_mut().find(|(p, _)| *p == path) {
            Some(entry) => entry.1.push(agent.clone()),
            None => groups.push((path, vec![agent.clone()])),
        }
    }
    groups
}

// =================== Skill 数据结构 ===================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRef {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub license: String,
    pub body: String,
    #[serde(rename = "dirName")]
    pub dir_name: String,
    #[serde(rename = "dirPath")]
    pub dir_path: String,
    pub files: Vec<String>,
    pub agents: Vec<AgentRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillPreview {
    pub name: String,
    pub description: String,
    pub license: String,
    pub body: String,
    pub files: Vec<String>,
    #[serde(rename = "zipPath")]
    pub zip_path: String,
}

fn parse_skill_meta(skill_dir: &Path, agents: &[AgentRef]) -> Option<Skill> {
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.exists() { return None; }

    let content = fs::read_to_string(&skill_md).ok()?;
    let mut name = skill_dir.file_name()?.to_string_lossy().to_string();
    let mut description = String::new();
    let mut license = String::new();
    let mut body = content.clone();

    if content.starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            let fm = &content[3..end + 3];
            body = content[end + 7..].trim_start_matches('\n').to_string();
            for line in fm.lines() {
                if let Some(v) = line.strip_prefix("name:") {
                    name = v.trim().to_string();
                } else if let Some(v) = line.strip_prefix("description:") {
                    description = v.trim().to_string();
                } else if let Some(v) = line.strip_prefix("license:") {
                    license = v.trim().to_string();
                }
            }
        }
    }

    Some(Skill {
        name,
        description,
        license,
        body,
        dir_name: skill_dir.file_name()?.to_string_lossy().to_string(),
        dir_path: skill_dir.to_string_lossy().to_string(),
        files: collect_files(skill_dir),
        agents: agents.to_vec(),
    })
}

fn collect_files(base: &Path) -> Vec<String> {
    WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            e.path().strip_prefix(base).ok()
                .map(|p| p.to_string_lossy().to_string())
        })
        .collect()
}

// =================== Tauri Commands ===================

#[tauri::command]
fn get_agent_sources() -> Vec<AgentSource> {
    agent_registry().iter().map(|a| {
        let path = resolve_agent_global_path(a);
        let exists = path.as_ref().map(|p| p.exists()).unwrap_or(false);
        AgentSource {
            id: a.id.clone(),
            name: a.name.clone(),
            path: path.map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
            exists,
        }
    }).collect()
}

#[tauri::command]
fn get_skills() -> Result<Vec<Skill>, String> {
    let mut skills = Vec::new();
    for (dir, agent_defs) in group_agents_by_path() {
        if !dir.exists() { continue; }
        // 规范化扫描根目录，用于判断 skill 是否真正落在此路径下（排除指向别处的软链）
        let canonical_dir = match fs::canonicalize(&dir) {
            Ok(p) => p,
            Err(_) => continue,
        };
        let agents: Vec<AgentRef> = agent_defs.iter()
            .map(|a| AgentRef { id: a.id.clone(), name: a.name.clone() })
            .collect();
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() { continue; }
            // 软链到其他 agent 目录的 skill（如 ~/.adal/skills/camoufox-cli → ~/.agents/...）跳过，
            // 只在真实所在路径下展示一次，避免侧栏被 symlink 副本撑爆。
            let Ok(canonical_skill) = fs::canonicalize(&path) else { continue };
            if !canonical_skill.starts_with(&canonical_dir) { continue; }
            if let Some(skill) = parse_skill_meta(&canonical_skill, &agents) {
                skills.push(skill);
            }
        }
    }
    Ok(skills)
}

#[tauri::command]
fn read_skill_file(dir_path: String, file_path: String) -> Result<String, String> {
    let skill_path = PathBuf::from(&dir_path);
    let full_path = skill_path.join(&file_path);
    let canonical_skill = fs::canonicalize(&skill_path).map_err(|e| e.to_string())?;
    let canonical_full = fs::canonicalize(&full_path).map_err(|e| e.to_string())?;
    if !canonical_full.starts_with(&canonical_skill) {
        return Err("Access denied".to_string());
    }
    fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_skill_file(dir_path: String, file_path: String, content: String) -> Result<(), String> {
    let skill_path = PathBuf::from(&dir_path);
    let full_path = skill_path.join(&file_path);
    let parent = full_path.parent().ok_or("Invalid path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let canonical_skill = fs::canonicalize(&skill_path).map_err(|e| e.to_string())?;
    let canonical_parent = fs::canonicalize(parent).map_err(|e| e.to_string())?;
    if !canonical_parent.starts_with(&canonical_skill) {
        return Err("Access denied".to_string());
    }
    fs::write(&full_path, content).map_err(|e| e.to_string())
}

// =================== 归档处理工具 ===================

/// 判断文件格式
fn archive_kind(path: &str) -> &'static str {
    let p = path.to_lowercase();
    if p.ends_with(".tar.gz") || p.ends_with(".tgz") { "tar.gz" }
    else if p.ends_with(".tar") { "tar" }
    else { "zip" } // .zip / .skill / 其他均当 zip 处理
}

/// 从归档中读取所有文件列表 + SKILL.md 内容
fn scan_archive(path: &str) -> Result<(Vec<String>, Option<String>, Option<String>), String> {
    match archive_kind(path) {
        "tar.gz" => scan_tar(path, true),
        "tar"    => scan_tar(path, false),
        _        => scan_zip(path),
    }
}

fn scan_zip(path: &str) -> Result<(Vec<String>, Option<String>, Option<String>), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut skill_md: Option<String> = None;
    let mut raw_names = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();
        if entry.is_dir() { continue; }
        // Skip macOS resource fork entries
        if entry_name.starts_with("__MACOSX") || entry_name.contains("/__MACOSX/") { continue; }

        raw_names.push(entry_name.clone());

        if entry_name == "SKILL.md" || entry_name.ends_with("/SKILL.md") {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
            skill_md = Some(content);
        }
    }

    // Determine if all files share a single top-level directory
    let top_dir = detect_single_top_dir(&raw_names);

    let files = if let Some(ref top) = top_dir {
        let prefix = format!("{}/", top);
        raw_names.iter()
            .filter_map(|n| n.strip_prefix(&prefix).map(|s| s.to_string()))
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        raw_names
    };

    Ok((files, skill_md, top_dir))
}

/// Check if all file paths share a single common top-level directory.
/// Returns Some(dir_name) only if ALL files are under the same top dir.
fn detect_single_top_dir(names: &[String]) -> Option<String> {
    if names.is_empty() { return None; }
    let mut candidate: Option<&str> = None;
    for name in names {
        let parts: Vec<&str> = name.splitn(2, '/').collect();
        if parts.len() < 2 || parts[0].is_empty() {
            // File at root level → no single top dir
            return None;
        }
        match candidate {
            None => candidate = Some(parts[0]),
            Some(c) if c != parts[0] => return None, // multiple top dirs
            _ => {}
        }
    }
    candidate.map(|s| s.to_string())
}

fn scan_tar(path: &str, gzipped: bool) -> Result<(Vec<String>, Option<String>, Option<String>), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut skill_md: Option<String> = None;
    let mut raw_names = Vec::new();

    let mut read_archive = |reader: &mut dyn Read| -> Result<(), String> {
        let mut archive = tar::Archive::new(reader);
        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path().map_err(|e| e.to_string())?.to_string_lossy().to_string();
            if entry_path.ends_with('/') { continue; }
            raw_names.push(entry_path.clone());
            if entry_path == "SKILL.md" || entry_path.ends_with("/SKILL.md") {
                let mut content = String::new();
                entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
                skill_md = Some(content);
            }
        }
        Ok(())
    };

    if gzipped {
        let mut gz = flate2::read::GzDecoder::new(file);
        read_archive(&mut gz)?;
    } else {
        let mut f = file;
        read_archive(&mut f)?;
    }

    let top_dir = detect_single_top_dir(&raw_names);
    let files = if let Some(ref top) = top_dir {
        let prefix = format!("{}/", top);
        raw_names.iter()
            .filter_map(|n| n.strip_prefix(&prefix).map(|s| s.to_string()))
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        raw_names
    };

    Ok((files, skill_md, top_dir))
}

/// 解压归档到目标目录
fn extract_archive(path: &str, target: &Path) -> Result<(), String> {
    match archive_kind(path) {
        "tar.gz" => extract_tar(path, target, true),
        "tar"    => extract_tar(path, target, false),
        _        => extract_zip(path, target),
    }
}

fn extract_zip(path: &str, target: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    archive.extract(target).map_err(|e| e.to_string())
}

fn extract_tar(path: &str, target: &Path, gzipped: bool) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    if gzipped {
        let gz = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(gz);
        archive.unpack(target).map_err(|e| e.to_string())
    } else {
        let mut archive = tar::Archive::new(file);
        archive.unpack(target).map_err(|e| e.to_string())
    }
}

// =================== Tauri Commands (归档相关) ===================

/// 预览归档包内容，不安装
#[tauri::command]
fn preview_skill_zip(zip_path: String) -> Result<SkillPreview, String> {
    let (mut files, skill_md_content, top_dir) = scan_archive(&zip_path)?;
    let content = skill_md_content.ok_or_else(|| "包内未找到 SKILL.md".to_string())?;

    // 解析 frontmatter
    let mut name = top_dir.clone().unwrap_or_else(|| {
        Path::new(&zip_path).file_stem()
            .unwrap_or_default().to_string_lossy().to_string()
    });
    // 去掉 .tar 后缀（处理 .tar.gz 文件名）
    if name.ends_with(".tar") { name = name[..name.len()-4].to_string(); }

    let mut description = String::new();
    let mut license = String::new();
    let mut body = content.clone();

    if content.starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            let fm = &content[3..end + 3];
            body = content[end + 7..].trim_start_matches('\n').to_string();
            for line in fm.lines() {
                if let Some(v) = line.strip_prefix("name:") { name = v.trim().to_string(); }
                else if let Some(v) = line.strip_prefix("description:") { description = v.trim().to_string(); }
                else if let Some(v) = line.strip_prefix("license:") { license = v.trim().to_string(); }
            }
        }
    }

    files.sort(); files.dedup();
    let files = files.into_iter().filter(|f| !f.is_empty()).collect();
    Ok(SkillPreview { name, description, license, body, files, zip_path })
}

/// 批量安装：将归档解压到多个 agent 目录（共享路径只解压一次）
#[tauri::command]
fn install_skill(zip_path: String, agent_ids: Vec<String>) -> Result<Vec<Skill>, String> {
    let (_, skill_md, top_dirs_raw) = scan_archive(&zip_path)?;
    if skill_md.is_none() { return Err("包内未找到 SKILL.md".to_string()); }

    let stem = {
        let mut s = Path::new(&zip_path).file_stem()
            .unwrap_or_default().to_string_lossy().to_string();
        if s.ends_with(".tar") { s = s[..s.len()-4].to_string(); }
        s
    };

    let mut by_path: Vec<(PathBuf, Vec<AgentRef>)> = Vec::new();
    for agent_id in &agent_ids {
        let agent = agent_registry().iter().find(|a| &a.id == agent_id)
            .ok_or_else(|| format!("未知 agent: {}", agent_id))?;
        let target_dir = resolve_agent_global_path(agent)
            .ok_or_else(|| format!("无法解析路径: {}", agent_id))?;
        let aref = AgentRef { id: agent.id.clone(), name: agent.name.clone() };
        match by_path.iter_mut().find(|(p, _)| *p == target_dir) {
            Some(entry) => entry.1.push(aref),
            None => by_path.push((target_dir, vec![aref])),
        }
    }

    let mut results = Vec::new();
    for (target_dir, agents) in by_path {
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

        let extract_to = if top_dirs_raw.is_some() {
            target_dir.clone()
        } else {
            let p = target_dir.join(&stem);
            fs::create_dir_all(&p).map_err(|e| e.to_string())?;
            p
        };

        extract_archive(&zip_path, &extract_to)?;

        let skill_dir = if let Some(ref top) = top_dirs_raw {
            extract_to.join(top)
        } else {
            extract_to
        };

        if let Some(skill) = parse_skill_meta(&skill_dir, &agents) {
            results.push(skill);
        }
    }

    if results.is_empty() {
        Err("安装完成，但无法读取 SKILL.md".to_string())
    } else {
        Ok(results)
    }
}

#[tauri::command]
fn delete_skill(dir_path: String) -> Result<(), String> {
    let p = PathBuf::from(&dir_path);
    if p.exists() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())
    } else {
        Err("Skill not found".to_string())
    }
}

#[tauri::command]
fn open_dir(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_agent_sources,
            get_skills,
            read_skill_file,
            write_skill_file,
            preview_skill_zip,
            install_skill,
            delete_skill,
            open_dir,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = event
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
