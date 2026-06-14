# Skills Manager

一个运行在 macOS 上的本地桌面应用，用于统一管理各 AI 编程助手（Coding Agent）的 Skill 技能包。

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" alt="Skills Manager" />
</p>

---

## 功能特性

- **多 Agent 支持** — 自动检测本机已安装的 12 个主流 AI 编程助手的 skills 目录：

  | Agent | 目录路径 |
  |---|---|
  | Agents (Shared) | `~/.agents/skills/` |
  | Cursor | `~/.cursor/skills/` |
  | Cline (Claude Dev) | `~/.vscode/extensions/saoudrizwan.claude-dev-*/skills/` |
  | Windsurf | `~/.windsurf/skills/` |
  | Continue | `~/.continue/skills/` |
  | Claude Code | `~/.claude/skills/` |
  | OpenCode | `~/.opencode/skills/` |
  | Codex CLI | `~/.codex/skills/` |
  | Aider | `~/.aider/skills/` |
  | Gemini CLI | `~/.gemini/skills/` |
  | GitHub Copilot | `~/.copilot/skills/` |
  | Zed | `~/.config/zed/skills/` |

- **浏览 & 搜索** — 按 Agent 分组展示所有已安装的 Skill，支持名称/描述实时搜索
- **导入安装** — 支持从本地文件导入技能包（`.zip` / `.skill` / `.tar.gz` / `.tgz` / `.tar`），安装前预览内容
- **多 Agent 同步安装** — 导入时可勾选多个 Agent，一次安装到多个目标目录
- **编辑 Skill** — 在 App 内直接编辑 `SKILL.md` 文件内容（含 YAML frontmatter 和 Markdown 正文）
- **删除 Skill** — 带二次确认的安全删除
- **在 Finder 中打开** — 一键在 Finder 打开当前选中 Skill 的目录（无选中时打开 skills 根目录）

---

## 安装

### 直接安装（推荐）

1. 下载 `Skills Manager_1.0.0_aarch64.dmg`
2. 双击打开 DMG，将 **Skills Manager** 拖入 `Applications` 文件夹
3. 打开 App（若 macOS 提示"已损坏"，在终端执行以下命令后重新打开）：
   ```bash
   xattr -cr "/Applications/Skills Manager.app"
   ```

> 当前仅支持 Apple Silicon (arm64) macOS。

---

## 使用指南

### 浏览 Skills

启动后左侧边栏自动加载本机所有已检测到的 Skill，按 Agent 分组显示。点击任一 Skill 可在右侧主区域查看详情（名称、描述、License、文件列表、SKILL.md 正文）。

### 搜索

在侧边栏顶部搜索框输入关键词，实时过滤匹配的 Skill（按名称或描述搜索）。

### 导入 Skill

1. 点击侧边栏右上角的「**+ 导入**」按钮
2. 在文件选择对话框中选择技能包文件（支持 `.zip` / `.skill` / `.tar.gz` / `.tgz` / `.tar`）
3. 预览页面展示 Skill 的名称、描述、License 以及包含的文件列表
4. 在「**安装到**」区域勾选目标 Agent（可多选，点击「全选」一键安装到全部检测到的 Agent）
5. 点击「**确认安装**」完成安装

### Skill 包结构

技能包应为以下目录结构的压缩文件：

```
<skill-name>/
└── SKILL.md          # 必须，技能描述文件
    ├── (可选其他文件)
    └── ...
```

`SKILL.md` 文件格式：

```markdown
---
name: 我的技能
description: 这个技能的用途描述
license: MIT
allowed-tools:
  - read_file
  - write_file
---

# 技能正文内容

这里写技能的具体指令、提示词等...
```

### 编辑 Skill

在右侧详情区点击「**编辑**」按钮，在弹出的编辑框中修改 `SKILL.md` 内容，点击「保存」写入磁盘。

### 删除 Skill

在右侧详情区点击「**删除**」按钮，二次确认后永久删除该 Skill 目录。

### 在 Finder 中打开

- **已选中 Skill 时**：点击左下角「**在 Finder 中打开**」，直接定位到该 Skill 所在目录
- **无选中时**：打开第一个检测到的 Agent 的 skills 根目录

---

## 本地开发

### 环境要求

- macOS（Apple Silicon 或 Intel）
- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://tauri.app/start/prerequisites/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建 DMG

```bash
npx tauri build
```

构建产物位于：
```
src-tauri/target/release/bundle/dmg/Skills Manager_1.0.0_aarch64.dmg
src-tauri/target/release/bundle/macos/Skills Manager.app
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri 2](https://tauri.app/) (Rust) |
| 前端 | React 18 + Vite |
| UI | 纯手写 CSS，macOS 风格 |
| 图标 | [Lucide React](https://lucide.dev/) |
| 归档解压 | `zip` + `tar` + `flate2` (Rust) |

---

## License

MIT
