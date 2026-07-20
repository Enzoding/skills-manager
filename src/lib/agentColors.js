const PRESET_COLORS = {
  'claude-code': '#c9460a',
  'cursor': '#7c3aed',
  'cline': '#d97706',
  'windsurf': '#059669',
  'opencode': '#0ea5e9',
  'codex': '#10b981',
  'gemini-cli': '#1a73e8',
  'github-copilot': '#238636',
  'zed': '#084c8d',
  'continue': '#e11d48',
  'amp': '#6366f1',
  'roo': '#ea580c',
  'goose': '#0d9488',
  'warp': '#01a4ff',
  'kilo': '#7c3aed',
  'droid': '#f59e0b',
  'antigravity': '#4285f4',
  'qwen-code': '#6366f1',
  'trae': '#0ea5e9',
  'zencoder': '#8b5cf6',
}

function hashColor(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 55%, 45%)`
}

export function getAgentColor(id) {
  return PRESET_COLORS[id] || hashColor(id)
}
