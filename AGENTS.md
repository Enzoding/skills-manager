# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview
Skills Manager is a macOS desktop app (Tauri 2 + React) that discovers, imports, edits, and deletes the `SKILL.md`-based skill packages used by ~12 AI coding agents (Claude Code, Cursor, Codex CLI, Copilot, etc.). All filesystem work happens against per-agent skills directories under the user's home (e.g. `~/.claude/skills/`, `~/.codex/skills/`).

## Commands
`package.json` is the source of truth for scripts (the README's `npm run tauri dev` / `npx tauri build` also work via the Tauri CLI but differ in name):
- `npm install` — install JS deps (Rust deps build automatically on first Tauri run).
- `npm run dev` — run the full desktop app in dev mode (`tauri dev`; spawns Vite via `beforeDevCommand`).
- `npm run dev:client` — Vite-only frontend on `http://localhost:5173` (no Rust backend; `invoke` calls will fail).
- `npm run build` — Vite build of the frontend into `dist/` only. This is NOT the app build; it's the `beforeBuildCommand` Tauri runs.
- `npm run tauri:build` — full release build, then strips the quarantine attribute (`xattr -cr`) so the `.app` opens locally. Output: `src-tauri/target/release/bundle/{dmg,macos}/`.

There is no test, lint, or formatter tooling configured (no ESLint/Prettier/Vitest, no Rust tests). Do not invent test commands; validate changes by building and running the app.

## Architecture
### Frontend ↔ backend contract (the core of the app)
The React frontend never touches the filesystem directly. It calls Rust via `invoke('<command>', { args })` from `@tauri-apps/api/core`, and opens the native file picker via `open()` from `@tauri-apps/plugin-dialog`. The full command surface is registered in the `invoke_handler!` macro in `src-tauri/src/lib.rs`:
`get_agent_sources`, `get_skills`, `read_skill_file`, `write_skill_file`, `preview_skill_zip`, `install_skill`, `delete_skill`, `open_dir`.

When adding or changing a command:
- Rust structs returned to JS use `#[serde(rename = "...")]` to expose camelCase fields (e.g. `dir_path` → `dirPath`, `agent_id` → `agentId`). The frontend depends on these camelCase names — keep them in sync.
- `invoke` arguments are passed camelCase from JS (`dirPath`, `zipPath`, `agentIds`) and received snake_case in Rust (`dir_path`, `zip_path`, `agent_ids`) via Tauri's default conversion.

### Agent registry (multi-file change)
The list of supported agents is hardcoded. Adding/removing an agent requires editing several places that must stay aligned:
1. `known_agent_dirs()` in `src-tauri/src/lib.rs` — id + display name.
2. `agent_skills_path()` in `src-tauri/src/lib.rs` — id → home-relative skills path.
3. `AGENT_COLORS` in BOTH `src/App.jsx` and `src/components/ImportModal.jsx` — keyed by the same id (duplicated map).

`claude-dev` (Cline) is the special case: its path is glob-resolved at runtime in `resolve_agent_path()` by scanning `~/.vscode/extensions/saoudrizwan.claude-dev*`, so it returns `None` from `agent_skills_path()`.

### Skill discovery & SKILL.md parsing
`get_skills()` scans every existing agent directory, treating each immediate subdirectory containing a `SKILL.md` as a skill. Frontmatter is parsed by hand in Rust (`parse_skill_meta_with_agent`), not with a YAML library, and only `name`, `description`, and `license` are extracted; everything after the `---` block is the markdown `body`. This Rust parser is the source of truth for the running app.

### Import / install pipeline
`preview_skill_zip` (preview) and `install_skill` (extract to selected agents) handle `.zip` / `.skill` / `.tar` / `.tar.gz` / `.tgz` (format chosen by `archive_kind`). `detect_single_top_dir()` decides the extraction layout: if every archive entry shares one top-level directory, it extracts directly into the agent dir; otherwise it wraps contents in a folder named after the archive stem. `__MACOSX` entries are skipped, and a `SKILL.md` must be present or install fails. `read_skill_file` / `write_skill_file` canonicalize paths and reject anything resolving outside the skill directory (path-traversal guard).

### Permissions
Filesystem and dialog access are gated by `src-tauri/capabilities/default.json` (`fs:allow-home-read-recursive`, `fs:allow-home-write-recursive`, `dialog:*`). New plugins or broader filesystem access must be granted here or `invoke` calls will be denied at runtime.

### macOS-only assumptions
`open_dir` shells out to the macOS `open` command, the build targets Apple Silicon DMG, and `tauri:build` runs `xattr`. Porting to other platforms means revisiting these.

### Frontend structure & styling
Entry is `src/main.jsx` → `src/App.jsx` (single-screen: sidebar list grouped by agent + detail pane + modals). Modals: `ImportModal`, `EditModal` (CodeMirror editor, ⌘S to save), `ConfirmModal`, `Toast` (driven by the `useToast` hook). The `@` import alias maps to `src/` (see `vite.config.js`). Styling is a hybrid: Tailwind v4 is imported via `@tailwindcss/vite`, but most of the app is styled by a large hand-written `src/index.css` using CSS-variable design tokens (macOS look). The shadcn-style primitives in `src/components/ui/` use the `cn()` helper (`src/lib/utils.js`), while the main views use semantic CSS classes plus inline styles.

## Gotchas
- UI copy and code comments are primarily in Chinese; match the existing language when editing user-facing strings.
