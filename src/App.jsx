import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { setTheme as setAppTheme } from '@tauri-apps/api/app'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Zap, Search, X, FolderOpen, FileText, Pencil, Trash2, Plus, RotateCw, Sun, Moon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ImportModal } from './components/ImportModal'
import { EditModal }   from './components/EditModal'
import { ConfirmModal } from './components/ConfirmModal'
import { Toast }       from './components/Toast'
import { useToast }    from './hooks/useToast'
import './index.css'

const AGENT_COLORS = {
  'agents-shared':   '#5856d6',
  'cursor':          '#7c3aed',
  'claude-dev':      '#d97706',
  'windsurf':        '#059669',
  'continue':        '#e11d48',
  'claude-code':     '#c9460a',
  'opencode':        '#0ea5e9',
  'codex':           '#059669',
  'aider':           '#7c3aed',
  'gemini-cli':      '#1a73e8',
  'copilot':         '#238636',
  'zed':             '#084c8d',
}

const THEME_STORAGE_KEY = 'skills-manager-theme'
const THEME_WINDOW_BG = {
  light: '#dedbd2',
  dark: '#23231f',
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function Avatar({ name, agentId, size = 32, radius = 4 }) {
  const color = AGENT_COLORS[agentId] || '#5856d6'
  return (
    <div className="agent-avatar" style={{
      '--agent-color': color,
      width: size, height: size, borderRadius: radius,
      fontSize: size * 0.42, fontWeight: 800, flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function App() {
  const [skills, setSkills]           = useState([])
  const [agentSources, setAgentSources] = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected]       = useState(null)
  const debounceRef = useRef(null)
  const [sidebarW, setSidebarW]       = useState(248)
  const resizerRef = useRef(null)
  const sidebarRef = useRef(null)
  const [showImport, setShowImport]   = useState(false)
  const [editSkill, setEditSkill]     = useState(null)
  const [deleteSkill, setDeleteSkill] = useState(null)
  const [theme, setTheme]             = useState(getInitialTheme)
  const { toasts, addToast }          = useToast()

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch {}
    setAppTheme(theme).catch(() => {})
    getCurrentWindow().setBackgroundColor(THEME_WINDOW_BG[theme]).catch(() => {})
  }, [theme])

  const load = async () => {
    try {
      const [skillList, sources] = await Promise.all([
        invoke('get_skills'),
        invoke('get_agent_sources'),
      ])
      setSkills(skillList)
      setAgentSources(sources)
      if (skillList.length > 0 && !selected) setSelected(skillList[0])
    } catch (err) {
      addToast('加载失败: ' + err, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const handleDelete = async () => {
    try {
      await invoke('delete_skill', { dirPath: deleteSkill.dirPath })
      addToast(`已删除「${deleteSkill.name}」`, 'success')
      if (selected?.dirPath === deleteSkill.dirPath) setSelected(null)
      setDeleteSkill(null)
      load()
    } catch (err) { addToast(String(err), 'error') }
  }

  const handleOpenDir = async (path) => {
    try { await invoke('open_dir', { path }) }
    catch (err) { addToast(String(err), 'error') }
  }

  const handleStartResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarW
    const onMove = (ev) => {
      const w = Math.min(400, Math.max(180, startW + ev.clientX - startX))
      setSidebarW(w)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (resizerRef.current) resizerRef.current.classList.remove('dragging')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    if (resizerRef.current) resizerRef.current.classList.add('dragging')
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 150)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  const grouped = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    const filtered = skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
    const map = new Map()
    for (const s of filtered) {
      if (!map.has(s.agentId)) map.set(s.agentId, { name: s.agentName, id: s.agentId, skills: [] })
      map.get(s.agentId).skills.push(s)
    }
    return [...map.values()]
  }, [skills, debouncedSearch])

  const cur = selected ? (skills.find(s => s.dirPath === selected.dirPath) || selected) : null

  return (
    <div className="layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar" ref={sidebarRef} style={{ '--sidebar-w': sidebarW + 'px', width: sidebarW }}>
        <div className="sidebar-resizer" ref={resizerRef} onMouseDown={handleStartResize} />

        {/* Top bar */}
        <div className="sidebar-top">
          <div className="brand">
            <Zap size={15} color="var(--accent)" fill="var(--accent)" />
            Skills
            {skills.length > 0 && <span className="brand-count">{skills.length}</span>}
            <span className="brand-underline" />
          </div>
          <div className="sidebar-actions">
            <button className="btn btn-ghost btn-sm btn-icon-only"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
              aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}>
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button className="btn btn-ghost btn-sm btn-icon-only"
              onClick={handleRefresh} title="刷新"
              style={{ opacity: refreshing ? 0.5 : 1 }}>
              <RotateCw size={13} style={{
                animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
              }} />
            </button>
            <button className="btn btn-primary btn-sm" style={{ gap: 4 }}
              onClick={() => setShowImport(true)}>
              <Plus size={12} />
              导入
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <div className="search-field">
            <Search size={13} color="var(--text-quaternary)" style={{ flexShrink: 0 }} />
            <input
              placeholder="搜索…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="skill-list">
          {loading ? (
            [1,2,3,4,5].map(i => <div key={i} className="skeleton" />)
          ) : grouped.length === 0 ? (
            <div className="empty">
              <Search size={36} color="var(--text-quaternary)" style={{ opacity: .3 }} />
              <div className="empty-title">{search ? '无匹配结果' : '暂无 Skills'}</div>
              {!search && <div className="empty-sub">点击「导入」添加</div>}
            </div>
          ) : grouped.map(group => (
            <div key={group.id}>
              <div className="group-header">
                <span className="group-dot"
                  style={{ background: AGENT_COLORS[group.id] || 'var(--text-quaternary)' }} />
                {group.name}
                <span className="group-count">{group.skills.length}</span>
                <span className="group-accent-line"
                  style={{ background: `linear-gradient(90deg, ${AGENT_COLORS[group.id] || 'var(--text-quaternary)'}, transparent)` }} />
              </div>
              {group.skills.map(skill => {
                const isActive = cur?.dirPath === skill.dirPath
                return (
                  <button key={skill.dirPath}
                    className={`skill-row${isActive ? ' active' : ''}`}
                    onClick={() => setSelected(skill)}>
                    <Avatar name={skill.name} agentId={skill.agentId} size={30} radius={4} />
                    <div className="skill-info">
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-desc">{skill.description || '暂无描述'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-footer-btn"
            onClick={() => {
              if (cur) {
                // 打开当前选中 skill 的目录
                handleOpenDir(cur.dirPath)
              } else {
                // 没有选中时，打开第一个存在的 agent 目录
                const s = agentSources.find(a => a.exists)
                if (s) handleOpenDir(s.path)
              }
            }}>
            <FolderOpen size={13} style={{ opacity: .5 }} />
            {cur ? '在 Finder 中打开' : '打开 Skills 目录'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        {!cur ? (
          <div className="empty" style={{ height: '100%' }}>
            <div className="empty-icon-pulse" style={{
              width: 64, height: 64, borderRadius: 6,
              background: 'var(--hover-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={28} color="var(--text-quaternary)" />
            </div>
            <div className="empty-title">选择一个 Skill</div>
            <div className="empty-sub">或点击「导入」安装新 Skill</div>
          </div>
        ) : (
          <div className="detail">
            {/* Hero Header */}
            <div className="detail-hero">
              <div className="detail-head">
                <div className="detail-title-row">
                  <Avatar name={cur.name} agentId={cur.agentId} size={52} radius={6} />
                  <div>
                    <div className="detail-name">{cur.name}</div>
                    <div className="detail-tags">
                      <span className="badge badge-blue" style={{
                        background: `${AGENT_COLORS[cur.agentId] || '#5856d6'}18`,
                        color: AGENT_COLORS[cur.agentId] || '#5856d6',
                      }}>
                        {cur.agentName}
                      </span>
                      <span className="badge badge-gray">
                        <FileText size={9} />
                        {cur.files?.length || 0} 文件
                      </span>
                      {cur.license && (
                        <span className="badge badge-gray">{cur.license}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="detail-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditSkill(cur)}>
                    <Pencil size={12} /> 编辑
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteSkill(cur)}>
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            {cur.description && (
              <div className="section">
                <div className="section-label">描述</div>
                <p className="desc-text">{cur.description}</p>
              </div>
            )}

            {/* Body */}
            {cur.body && (
              <div className="section">
                <div className="section-label">文档内容</div>
                <div className="body-block markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{cur.body}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Files */}
            {cur.files?.length > 0 && (
              <div className="section">
                <div className="section-label">文件列表</div>
                <div className="file-list">
                  {cur.files.map(f => (
                    <div key={f} className="file-item">
                      <FileText size={12} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Path */}
            <div className="section">
              <div className="section-label">路径</div>
              <div className="path-box" onClick={() => handleOpenDir(cur.dirPath)} title="点击在 Finder 中打开">
                {cur.dirPath}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showImport && (
        <ImportModal agentSources={agentSources}
          onClose={() => setShowImport(false)}
          onInstalled={load} addToast={addToast} />
      )}
      {editSkill && (
        <EditModal skill={editSkill}
          theme={theme}
          onClose={() => setEditSkill(null)} onSaved={load} addToast={addToast} />
      )}
      {deleteSkill && (
        <ConfirmModal
          title="删除 Skill"
          message={`确定删除「${deleteSkill.name}」吗？此操作将永久删除文件夹，不可恢复。`}
          danger onConfirm={handleDelete} onClose={() => setDeleteSkill(null)} />
      )}
      <Toast toasts={toasts} />
    </div>
  )
}
