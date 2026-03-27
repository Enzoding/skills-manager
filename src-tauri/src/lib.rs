use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

// =================== Agent 预设目录 ===================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentSource {
    pub id: String,
    pub name: String,
    pub path: String,
    pub exists: bool,
}

fn known_agent_dirs() -> Vec<(String, String)> {
    vec![
        ("codeflicker".into(),     "CodeFlicker".into()),
        ("codeflicker-cli".into(), "CodeFlicker CLI".into()),
        ("agents-shared".into(),   "Agents (Shared)".into()),
        ("cursor".into(),          "Cursor".into()),
        ("claude-dev".into(),      "Cline (Claude Dev)".into()),
        ("windsurf".into(),        "Windsurf".into()),
        ("continue".into(),        "Continue".into()),
        ("claude-code".into(),     "Claude Code".into()),
        ("opencode".into(),        "OpenCode".into()),
        ("codex".into(),           "Codex CLI".into()),
        ("aider".into(),           "Aider".into()),
        ("gemini-cli".into(),      "Gemini CLI".into()),
        ("copilot".into(),         "GitHub Copilot".into()),
        ("zed".into(),             "Zed".into()),
    ]
}

fn agent_skills_path(agent_id: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    match agent_id {
        "codeflicker"     => Some(home.join(".codeflicker").join("skills")),
        "codeflicker-cli" => Some(home.join(".codeflicker").join("cli").join("skills")),
        "agents-shared"   => Some(home.join(".agents").join("skills")),
        "cursor"          => Some(home.join(".cursor").join("skills")),
        "claude-dev"      => None, // glob, handled in resolve_agent_path
        "windsurf"        => Some(home.join(".windsurf").join("skills")),
        "continue"        => Some(home.join(".continue").join("skills")),
        "claude-code"     => Some(home.join(".claude").join("skills")),
        "opencode"        => Some(home.join(".opencode").join("skills")),
        "codex"           => Some(home.join(".codex").join("skills")),
        "aider"           => Some(home.join(".aider").join("skills")),
        "gemini-cli"      => Some(home.join(".gemini").join("skills")),
        "copilot"         => Some(home.join(".copilot").join("skills")),
        "zed"             => Some(home.join(".config").join("zed").join("skills")),
        _                 => None,
    }
}

fn resolve_agent_path(agent_id: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    // claude-dev 需要 glob 扩展，特殊处理
    if agent_id == "claude-dev" {
        let base = home.join(".vscode").join("extensions");
        if let Ok(entries) = fs::read_dir(&base) {
            for e in entries.filter_map(|e| e.ok()) {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("saoudrizwan.claude-dev") {
                    let p = e.path().join("skills");
                    if p.exists() { return Some(p); }
                }
            }
        }
        return None;
    }
    agent_skills_path(agent_id)
}

// =================== Skill 数据结构 ===================

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
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentName")]
    pub agent_name: String,
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

fn parse_skill_meta_with_agent(skill_dir: &Path, agent_id: &str, agent_name: &str) -> Option<Skill> {
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
        agent_id: agent_id.to_string(),
        agent_name: agent_name.to_string(),
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
    known_agent_dirs().into_iter().map(|(id, name)| {
        let path = resolve_agent_path(&id);
        let exists = path.as_ref().map(|p| p.exists()).unwrap_or(false);
        AgentSource {
            path: path.map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
            exists,
            id,
            name,
        }
    }).collect()
}

#[tauri::command]
fn get_skills() -> Result<Vec<Skill>, String> {
    let mut skills = Vec::new();
    for (id, name) in known_agent_dirs() {
        if let Some(dir) = resolve_agent_path(&id) {
            if !dir.exists() { continue; }
            let entries = match fs::read_dir(&dir) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(skill) = parse_skill_meta_with_agent(&path, &id, &name) {
                        skills.push(skill);
                    }
                }
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
    let mut files = Vec::new();
    let mut top_dir: Option<String> = None;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();
        if entry.is_dir() { continue; }

        let parts: Vec<&str> = entry_name.splitn(2, '/').collect();
        if parts.len() == 2 && !parts[0].is_empty() {
            top_dir = Some(parts[0].to_string());
            files.push(parts[1].to_string());
        } else {
            files.push(entry_name.clone());
        }

        if entry_name == "SKILL.md" || entry_name.ends_with("/SKILL.md") {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
            skill_md = Some(content);
        }
    }
    Ok((files, skill_md, top_dir))
}

fn scan_tar(path: &str, gzipped: bool) -> Result<(Vec<String>, Option<String>, Option<String>), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut skill_md: Option<String> = None;
    let mut files = Vec::new();
    let mut top_dir: Option<String> = None;

    let mut read_archive = |reader: &mut dyn Read| -> Result<(), String> {
        let mut archive = tar::Archive::new(reader);
        for entry in archive.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path().map_err(|e| e.to_string())?.to_string_lossy().to_string();
            let parts: Vec<&str> = entry_path.splitn(2, '/').collect();
            if parts.len() == 2 && !parts[0].is_empty() {
                top_dir = Some(parts[0].to_string());
                files.push(parts[1].to_string());
            } else {
                files.push(entry_path.clone());
            }
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

/// 批量安装：将归档解压到多个 agent 目录
#[tauri::command]
fn install_skill(zip_path: String, agent_ids: Vec<String>) -> Result<Vec<Skill>, String> {
    // 先扫描归档，确认有 SKILL.md 并获取顶层目录名
    let (_, skill_md, top_dirs_raw) = scan_archive(&zip_path)?;
    if skill_md.is_none() { return Err("包内未找到 SKILL.md".to_string()); }

    let stem = {
        let mut s = Path::new(&zip_path).file_stem()
            .unwrap_or_default().to_string_lossy().to_string();
        if s.ends_with(".tar") { s = s[..s.len()-4].to_string(); }
        s
    };

    let known = known_agent_dirs();
    let mut results = Vec::new();

    for agent_id in &agent_ids {
        let target_dir = resolve_agent_path(agent_id)
            .ok_or_else(|| format!("未知 agent: {}", agent_id))?;
        let agent_name = known.iter().find(|(id, _)| id == agent_id)
            .map(|(_, n)| n.clone())
            .unwrap_or_else(|| agent_id.clone());

        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

        // 如果归档有单个顶层目录，直接解压到 target_dir；否则解压到 target_dir/<stem>/
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
            extract_to.clone()
        };

        if let Some(skill) = parse_skill_meta_with_agent(&skill_dir, agent_id, &agent_name) {
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
