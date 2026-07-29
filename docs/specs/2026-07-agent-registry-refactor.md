# Spec: Agent 注册表数据驱动化重构

- **状态**：草案，待评审
- **日期**：2026-07-15
- **范围**：`src-tauri/src/lib.rs`、`src/App.jsx`、`src/components/ImportModal.jsx`，新增 `src-tauri/resources/agents.json`、`src/lib/agentColors.js`

## 1. Context / 问题背景

当前应用把 12 个 agent 的 skills 扫描路径硬编码在 `src-tauri/src/lib.rs` 里（`known_agent_dirs()` / `agent_skills_path()` / `resolve_agent_path()`）。两轮调研（agentskills.io 官方 Showcase + [vercel-labs/skills](https://github.com/vercel-labs/skills) 项目）发现：

1. **半数以上路径已经过时或错误**：`opencode` 应为 `~/.config/opencode/skills`（不是 `~/.opencode/skills`）；Cline 靠脆弱的 VSCode 扩展目录 glob 猜测路径，而不是固定路径；`codex` 等路径与社区实际约定不符。
2. **SKILL.md 已是跨厂商开放标准**，采用者已达 69+，硬编码 12 个远不能覆盖现状。
3. **架构缺陷**：现有数据模型假设"一个 skill 只属于一个 agent"，但社区实际约定里大量 agent（Cline / Dexto / Kimi Code CLI / Loaf / Warp / Zed 等）共享同一物理路径 `~/.agents/skills/`——当前逻辑会把同一份 skill 按 agent 重复扫描、重复展示，语义不正确。
4. **路径写死在 Rust 编译产物里**，任何路径变化都要走一次完整发版才能修，无法快速响应生态变化。

## 2. 目标与非目标

**目标**：
- agent 注册表改为**打包内置的 JSON 数据**（`include_str!` 编译期嵌入），全量纳入 vercel-labs/skills README 收录的 69 个 agent 的 Global Path。
- 数据模型支持"一个物理路径 → 多个 agent 归属"的正确语义，避免重复扫描/重复展示。
- 去掉 Cline 的脆弱 VSCode 扩展 glob 特判，改为固定路径。

**非目标（本轮不做）**：
- 不做项目级路径扫描（不选文件夹、不扫 `.claude/skills` 等相对路径），只重构用户级 `~/.xxx/skills` 扫描。
- 不支持运行期用户可覆盖的外部配置文件，agent 注册表只随应用发版更新。
- 不改 `tauri.conf.json` 的 `bundle.resources`、不改 `capabilities/default.json` 权限——`include_str!` 方案不需要。

## 3. 数据设计

### 3.1 `src-tauri/resources/agents.json`（新建）

数组，69 条（Eve、PromptScript 因无 Global Path 不纳入——它们只支持项目级扫描，加进来只会在 UI 上产生一条 `exists:false` 的死记录）：

```json
[
  { "id": "claude-code", "name": "Claude Code", "globalPath": "~/.claude/skills" },
  { "id": "cursor", "name": "Cursor", "globalPath": "~/.cursor/skills" },
  { "id": "cline", "name": "Cline", "globalPath": "~/.agents/skills" }
]
```

`id` 沿用 vercel-labs 的 `--agent` flag 命名（与旧的 12 个 id 不完全对应，例如 `claude-dev`→`cline`、`copilot`→`github-copilot`）。`globalPath` 保留 `~/` 前缀字符串，不在 JSON 里展开成绝对路径（不同用户 home 目录不同，必须留到运行期展开）。

**完整 69 条数据**（Agent 名 | id | Global Path，来自 vercel-labs/skills README，实现时逐行转录进 JSON，注意校验 JSON 语法）：

| Agent | id | Global Path |
|---|---|---|
| AiderDesk | aider-desk | ~/.aider-desk/skills/ |
| Amp | amp | ~/.config/agents/skills/ |
| Replit | replit | ~/.config/agents/skills/ |
| Universal | universal | ~/.config/agents/skills/ |
| Antigravity | antigravity | ~/.gemini/antigravity/skills/ |
| Antigravity CLI | antigravity-cli | ~/.gemini/antigravity-cli/skills/ |
| AstrBot | astrbot | ~/.astrbot/data/skills/ |
| Autohand Code CLI | autohand-code | ~/.autohand/skills/ |
| Augment | augment | ~/.augment/skills/ |
| IBM Bob | bob | ~/.bob/skills/ |
| Claude Code | claude-code | ~/.claude/skills/ |
| OpenClaw | openclaw | ~/.openclaw/skills/ |
| Cline | cline | ~/.agents/skills/ |
| Dexto | dexto | ~/.agents/skills/ |
| Kimi Code CLI | kimi-code-cli | ~/.agents/skills/ |
| Loaf | loaf | ~/.agents/skills/ |
| Warp | warp | ~/.agents/skills/ |
| Zed | zed | ~/.agents/skills/ |
| CodeArts Agent | codearts-agent | ~/.codeartsdoer/skills/ |
| CodeBuddy | codebuddy | ~/.codebuddy/skills/ |
| Codemaker | codemaker | ~/.codemaker/skills/ |
| Code Studio | codestudio | ~/.codestudio/skills/ |
| Codex | codex | ~/.codex/skills/ |
| Command Code | command-code | ~/.commandcode/skills/ |
| Continue | continue | ~/.continue/skills/ |
| Cortex Code | cortex | ~/.snowflake/cortex/skills/ |
| Crush | crush | ~/.config/crush/skills/ |
| Cursor | cursor | ~/.cursor/skills/ |
| Deep Agents | deepagents | ~/.deepagents/agent/skills/ |
| Devin for Terminal | devin | ~/.config/devin/skills/ |
| Droid | droid | ~/.factory/skills/ |
| Firebender | firebender | ~/.firebender/skills/ |
| ForgeCode | forgecode | ~/.forge/skills/ |
| Gemini CLI | gemini-cli | ~/.gemini/skills/ |
| GitHub Copilot | github-copilot | ~/.copilot/skills/ |
| Goose | goose | ~/.config/goose/skills/ |
| Hermes Agent | hermes-agent | ~/.hermes/skills/ |
| inference.sh | inference-sh | ~/.inferencesh/skills/ |
| Jazz | jazz | ~/.jazz/skills/ |
| Junie | junie | ~/.junie/skills/ |
| iFlow CLI | iflow-cli | ~/.iflow/skills/ |
| Kilo Code | kilo | ~/.kilocode/skills/ |
| Kiro CLI | kiro-cli | ~/.kiro/skills/ |
| Kode | kode | ~/.kode/skills/ |
| Lingma | lingma | ~/.lingma/skills/ |
| MCPJam | mcpjam | ~/.mcpjam/skills/ |
| Mistral Vibe | mistral-vibe | ~/.vibe/skills/ |
| Moxby | moxby | ~/.moxby/skills/ |
| Mux | mux | ~/.mux/skills/ |
| OpenCode | opencode | ~/.config/opencode/skills/ |
| OpenHands | openhands | ~/.openhands/skills/ |
| Ona | ona | ~/.ona/skills/ |
| Pi | pi | ~/.pi/agent/skills/ |
| Qoder | qoder | ~/.qoder/skills/ |
| Qoder CN | qoder-cn | ~/.qoder-cn/skills/ |
| Qwen Code | qwen-code | ~/.qwen/skills/ |
| Reasonix | reasonix | ~/.reasonix/skills/ |
| Rovo Dev | rovodev | ~/.rovodev/skills/ |
| Roo Code | roo | ~/.roo/skills/ |
| Tabnine CLI | tabnine-cli | ~/.tabnine/agent/skills/ |
| Terramind | terramind | ~/.terramind/skills/ |
| Tinycloud | tinycloud | ~/.tinycloud/skills/ |
| Trae | trae | ~/.trae/skills/ |
| Trae CN | trae-cn | ~/.trae-cn/skills/ |
| Windsurf | windsurf | ~/.codeium/windsurf/skills/ |
| ZCode | zcode | ~/.zcode/skills/ |
| Zencoder | zencoder | ~/.zencoder/skills/ |
| Zenflow | zenflow | ~/.zencoder/skills/ |
| Neovate | neovate | ~/.neovate/skills/ |
| Pochi | pochi | ~/.pochi/skills/ |
| AdaL | adal | ~/.adal/skills/ |

注意事项：
- `~/.config/agents/skills/`（Amp/Replit/Universal）与 `~/.agents/skills/`（Cline/Dexto/Kimi Code CLI/Loaf/Warp/Zed）是两个**不同**路径，转录时不要混淆。
- Qoder 与 Qoder CN 路径不同（`~/.qoder/skills/` vs `~/.qoder-cn/skills/`），Trae 与 Trae CN 同理。
- Zencoder 与 Zenflow 共享同一路径 `~/.zencoder/skills/`。

## 4. Rust 后端改造（`src-tauri/src/lib.rs`）

### 4.1 删除

`known_agent_dirs()`、`agent_skills_path()`、`resolve_agent_path()`（含 Cline 的 VSCode 扩展 glob 特判逻辑，第 35-71 行整段）。

### 4.2 新增注册表加载

```rust
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
```

### 4.3 按路径去重分组（核心变更点）

```rust
/// 按物理路径去重分组，一个路径可能对应多个 agent（如 ~/.agents/skills/）。
/// 用线性 Vec（数据量小，去重后约 15-20 条不同路径）保留 registry 中的原始出现顺序，
/// 避免 HashMap 迭代顺序不稳定导致 UI 分组顺序每次刷新都抖动。
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
```

### 4.4 `Skill` 结构体（破坏性变更，无兼容字段）

```rust
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
    pub agents: Vec<AgentRef>,   // 替换原 agent_id: String, agent_name: String
}
```

`parse_skill_meta_with_agent(dir, agent_id, agent_name)` → `parse_skill_meta(dir, agents: &[AgentRef])`，一次解析挂载全部同路径 agent。

已核实调用点无遗漏：仅 `src/App.jsx`、`src/components/ImportModal.jsx` 两个前端文件引用 `agentId/agentName`；Rust 侧仅 `parse_skill_meta_with_agent`、`get_skills`、`install_skill` 构造/使用该字段。`EditModal.jsx`、`ConfirmModal.jsx`、`Toast.jsx` 不涉及。

### 4.5 `get_skills()` 改造

```rust
#[tauri::command]
fn get_skills() -> Result<Vec<Skill>, String> {
    let mut skills = Vec::new();
    for (dir, agent_defs) in group_agents_by_path() {
        if !dir.exists() { continue; }
        let agents: Vec<AgentRef> = agent_defs.iter()
            .map(|a| AgentRef { id: a.id.clone(), name: a.name.clone() })
            .collect();
        let entries = match fs::read_dir(&dir) { Ok(e) => e, Err(_) => continue };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                if let Some(skill) = parse_skill_meta(&path, &agents) {
                    skills.push(skill);
                }
            }
        }
    }
    Ok(skills)
}
```

每个物理路径只 `fs::read_dir` 一次、每个 skill 子目录只 `parse_skill_meta`（含 `collect_files` 的 `WalkDir`）一次，无论被多少 agent 共享。这是本次重构最核心的去重点。

### 4.6 `get_agent_sources()` 改造

```rust
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
```

`AgentSource{id,name,path,exists}` 结构不变——ImportModal 需要"一个 agent 一行"的扁平多选列表，不按路径聚合。

### 4.7 `install_skill(zip_path, agent_ids)` 改造

签名不变。内部查表从线性数组换成 `agent_registry().iter().find(|a| &a.id == agent_id)`。新增按目标路径去重：若 `agent_ids` 里多个 agent 共享同一物理路径（如同时选中 Cline 和 Dexto），只解压一次，返回结果按路径合并 `agents` 字段，避免重复解压和返回重复的几乎相同记录。

```rust
#[tauri::command]
fn install_skill(zip_path: String, agent_ids: Vec<String>) -> Result<Vec<Skill>, String> {
    let (_, skill_md, top_dirs_raw) = scan_archive(&zip_path)?;
    if skill_md.is_none() { return Err("包内未找到 SKILL.md".to_string()); }
    let stem = { /* 不变，见原实现 */ };

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
        let skill_dir = if let Some(ref top) = top_dirs_raw { extract_to.join(top) } else { extract_to };
        if let Some(skill) = parse_skill_meta(&skill_dir, &agents) {
            results.push(skill);
        }
    }
    if results.is_empty() { Err("安装完成，但无法读取 SKILL.md".to_string()) } else { Ok(results) }
}
```

### 4.8 不改动的函数

`collect_files`、`preview_skill_zip`、`delete_skill`、`read_skill_file`、`write_skill_file`、`archive_kind`/`scan_zip`/`scan_tar`/`scan_archive`/`detect_single_top_dir`/`extract_zip`/`extract_tar`/`extract_archive`、`open_dir`——均与 agent 数据模型无关。

### 4.9 不改动的配置

`Cargo.toml`、`tauri.conf.json`、`capabilities/default.json`——`include_str!` 编译期嵌入不需要 `bundle.resources`，不需要给任何 command 加 `AppHandle` 参数，不需要新增权限（已核实 `dirs`、`serde_json` 已在依赖里）。

## 5. 前端改造

### 5.1 新建 `src/lib/agentColors.js`

```js
const PRESET_COLORS = {
  // 核对后保留仍存在于新 69 条注册表里的旧 id 映射，
  // 加上最主流 agent 的手工配色：
  // claude-code / cursor / cline / windsurf / opencode / codex /
  // gemini-cli / github-copilot / zed 等
}

function hashColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 55%, 45%)`   // 固定饱和度/亮度，保证浅色/深色主题下文字对比度可读
}

export function getAgentColor(id) {
  return PRESET_COLORS[id] || hashColor(id)
}
```

69 个手工配色不现实：主流 agent 走预设表，其余走确定性 hash 兜底（同一 id 每次运行结果一致）。

### 5.2 `src/App.jsx`

- 删除本地 `AGENT_COLORS` 常量（第 15-28 行），改为 `import { getAgentColor } from './lib/agentColors'`。所有 `AGENT_COLORS[x] || fallback` 替换为 `getAgentColor(x)`：`Avatar` 头像色、`group-dot`（247行）、`group-accent-line`（251行）、详情页 badge（314-319行）。
- `grouped` 分组逻辑（163-175行）从单键分组改为多键分组：
  ```js
  const map = new Map()
  for (const s of filtered) {
    for (const agent of s.agents) {
      if (!map.has(agent.id)) map.set(agent.id, { name: agent.name, id: agent.id, skills: [] })
      map.get(agent.id).skills.push(s)
    }
  }
  ```
  同一 skill 会出现在它归属的每个 agent 分组下。React key（分组内 `key={skill.dirPath}`，256行）作用域是分组内部，天然不冲突，不需要改成复合 key。
- `Avatar` 组件（49-60行）签名从 `{ agentId }` 改为 `{ agents }`，取色用 `getAgentColor(agents?.[0]?.id)`。
- 详情页 badge（314-319行）从单个 `<span>` 改为遍历 `cur.agents.map(a => <span key={a.id}>...)` 渲染多个 agent badge。
- 选中态高亮 `isActive = cur?.dirPath === skill.dirPath`（254行）**不改**——多分组下同一 skill 同时高亮是合理行为（用户选中的是这个 skill 本身），不引入复合判断。

### 5.3 `src/components/ImportModal.jsx`

- 删除本地 `AGENT_COLORS`（6-12行），改用 `getAgentColor`。
- `agentSources`/`checkedIds`/`install_skill` 调用逻辑不变——`AgentSource` 结构没变，多选安装不受多 agent 归属模型影响。
- 不新增搜索框/分组 UI：`available = agentSources.filter(a => a.exists)`（22行）已把列表收窄到本机实际存在的目录，可用性问题留给后续按需迭代。

## 6. 已知的用户可见影响（需在改动说明/CHANGELOG 里注明）

- **Cline**：扫描路径从 `~/.vscode/extensions/saoudrizwan.claude-dev*/skills/` 改为固定 `~/.agents/skills/`。之前通过旧版本装到 VSCode 插件目录下的 skill 不会再显示（文件仍在磁盘，只是新版本不扫那个路径）。
- **OpenCode**：路径修正为 `~/.config/opencode/skills/`（原 `~/.opencode/skills` 是错的，属于隐藏的正确性修复）。
- **Copilot**：id 从 `copilot` 改为 `github-copilot`，路径不变（`~/.copilot/skills`）。
- **Aider**：原 `aider` 路径（`~/.aider/skills`，本身也从未被证实存在）在新表里无直接对应项，将从列表消失。

## 7. 验证计划

1. **构建**：`cd src-tauri && cargo check`，确认 `include_str!` 路径、69 条 JSON 能正常反序列化无 panic；`grep -rn AGENT_COLORS src/` 应为空；前端 `npm run build` 通过。
2. **运行**（`npm run tauri dev`）：
   - 侧边栏分组数量应远多于原来 12 个（取决于本机实际存在的目录）。
   - **核心验收点**：若本机 `~/.agents/skills/` 存在且有 skill，该 skill 应同时出现在 Cline / Dexto / Kimi Code CLI / Loaf / Warp / Zed 六个分组下；点击任一处，其余五处应同步高亮；详情页应展示全部 6 个 agent badge。
   - 打开导入弹窗，确认列表按新注册表渲染（含 OpenCode 修正后的路径）。
   - 勾选多个共享路径的 agent（如 Cline+Dexto）执行安装，确认磁盘只解压一份，安装后重新扫描该 skill 正确挂载到两个分组。
   - 明暗主题切换下检查 hash 兜底色的文字对比度。
3. **回归**：编辑（EditModal 读写文件）、删除、Finder 打开路径等既有交互跑一遍确认无退化。

## 8. 风险点汇总

1. **JSON 数据转录准确性**：69 条数据手工转录容易出现路径拼写错误，尤其 `~/.config/agents/skills/` vs `~/.agents/skills/` 易混淆，实现时逐行核对。
2. **顺序稳定性**：坚持用线性 `Vec` 而非 `HashMap` 做路径分组，避免每次刷新分组顺序抖动。
3. **旧 id 变更导致数据"消失"**：Cline / OpenCode / Copilot 等 id 或路径变化会让老用户看到已安装的 skill 不再显示，需在发布说明中列出。
4. **hash 兜底颜色对比度**：需在浅色/深色两套主题下人工检查一遍，避免某些 hue 在某主题下不可辨认。
</content>
