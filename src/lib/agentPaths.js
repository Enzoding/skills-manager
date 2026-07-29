/** 将绝对路径转为 ~/ 相对形式（无法识别 home 时原样返回） */
export function toHomeRelativePath(absPath) {
  const p = String(absPath || '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (!p) return ''
  // 匹配 /Users/xxx/... 或 /home/xxx/...
  const m = p.match(/^\/(?:Users|home)\/[^/]+(\/.*)?$/)
  if (m) return `~${m[1] || ''}`
  return p
}

/**
 * 共享目录的展示名：用真实路径片段，而不是「Cline 等 6 个」。
 * 例：~/.agents/skills → .agents
 *     ~/.zencoder/skills → .zencoder
 *     ~/.config/agents/skills → .config/agents
 */
export function formatSharedPathLabel(absPath) {
  const rel = toHomeRelativePath(absPath).replace(/\/+$/, '')
  const m = rel.match(/^~\/(.+)\/skills$/)
  if (m) return m[1].startsWith('.') ? m[1] : `.${m[1]}`
  if (rel.startsWith('~/')) return rel.slice(2)
  return rel || '共享'
}

/** 单 agent 用其名称；多 agent 共享路径用真实路径标签 */
export function formatPathGroupName(absPath, agents) {
  if (!agents?.length) return formatSharedPathLabel(absPath)
  if (agents.length === 1) return agents[0].name
  return formatSharedPathLabel(absPath)
}
