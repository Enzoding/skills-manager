import { useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Upload, FileText, ChevronLeft, X, Check } from 'lucide-react'
import { getAgentColor } from '@/lib/agentColors'
import { formatPathGroupName } from '@/lib/agentPaths'

/** 按物理路径去重：共享同一目录的多个 agent 合并成一个安装目标 */
function groupSourcesByPath(sources) {
  const map = new Map()
  for (const a of sources) {
    if (!a.exists) continue
    const key = String(a.path || '').replace(/\/+$/, '')
    if (!key) continue
    if (!map.has(key)) {
      map.set(key, {
        pathKey: key,
        path: a.path,
        id: a.id,
        agentIds: [a.id],
        names: [a.name],
        agents: [{ id: a.id, name: a.name }],
      })
    } else {
      const g = map.get(key)
      g.agentIds.push(a.id)
      g.names.push(a.name)
      g.agents.push({ id: a.id, name: a.name })
    }
  }
  return [...map.values()].map(g => ({
    ...g,
    name: formatPathGroupName(g.pathKey, g.agents),
  }))
}

export function ImportModal({ agentSources, onClose, onInstalled, addToast }) {
  const [step, setStep]             = useState('pick')
  const [preview, setPreview]       = useState(null)
  const [checkedPaths, setCheckedPaths] = useState([])   // 按路径去重后的 pathKey
  const [loading, setLoading]       = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dragging, setDragging]     = useState(false)

  const available = useMemo(() => groupSourcesByPath(agentSources), [agentSources])

  const togglePath = (pathKey) => {
    setCheckedPaths(prev =>
      prev.includes(pathKey) ? prev.filter(x => x !== pathKey) : [...prev, pathKey]
    )
  }

  const loadFile = async (path) => {
    setLoading(true)
    try {
      const result = await invoke('preview_skill_zip', { zipPath: path })
      setPreview(result)
      setStep('preview')
      if (available.length > 0) setCheckedPaths([available[0].pathKey])
    } catch (err) { addToast(String(err), 'error') }
    finally { setLoading(false) }
  }

  const handlePick = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{
          name: 'Skill Package',
          extensions: ['zip', 'skill', 'tar', 'gz', 'tgz'],
        }],
      })
      if (!path) return
      await loadFile(path)
    } catch (err) { addToast(String(err), 'error') }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const allowed = /\.(zip|skill|tar\.gz|tgz|tar)$/i
    if (!allowed.test(file.name)) {
      addToast('不支持的文件格式，请使用 .zip .skill .tar.gz .tgz .tar', 'error')
      return
    }
    // Tauri 中拖入文件可直接读取 path（macOS WebView 会暴露 webkitRelativePath 或 path 属性）
    const path = file.path || (window.__TAURI__ ? file.name : null)
    if (!path) { addToast('无法获取文件路径，请使用点击选择', 'error'); return }
    await loadFile(path)
  }

  const handleInstall = async () => {
    if (checkedPaths.length === 0) { addToast('请至少选择一个安装目标', 'error'); return }
    setInstalling(true)
    try {
      // 每个路径只传一个 agent id 即可（后端按路径去重）；保留首个代表 id
      const agentIds = available
        .filter(a => checkedPaths.includes(a.pathKey))
        .map(a => a.id)
      const results = await invoke('install_skill', {
        zipPath: preview.zipPath,
        agentIds,
      })
      const names = [...new Set(results.map(s => s.name))].join('、')
      addToast(`已安装「${names}」到 ${checkedPaths.length} 个目录`, 'success')
      onInstalled(); onClose()
    } catch (err) { addToast(String(err), 'error') }
    finally { setInstalling(false) }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{step === 'pick' ? '导入 Skill' : '预览与安装'}</span>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '65vh' }}>
          {step === 'pick' && (
            <div
              className={`upload-zone${dragging ? ' dragging' : ''}`}
              style={{ width: '100%' }}
              onClick={!loading ? handlePick : undefined}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={e => { e.preventDefault(); setDragging(false) }}
              onDrop={handleDrop}
            >
              <Upload size={32} color={dragging ? 'var(--accent)' : 'var(--text-quaternary)'} style={{ opacity: dragging ? 1 : .6 }} />
              <div>
                <div className="upload-zone-title">
                  {loading ? '读取中…' : dragging ? '松开以导入' : '点击选择或拖拽文件'}
                </div>
                <div className="upload-zone-sub" style={{ marginTop: 4 }}>
                  支持 .zip · .skill · .tar.gz · .tgz · .tar
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Skill 预览卡片 */}
              <div className="preview-card">
                <div className="preview-card-icon">
                  {preview.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="preview-name">{preview.name}</div>
                  {preview.description && (
                    <p className="preview-desc">{preview.description}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {preview.license && <span className="badge badge-gray">{preview.license}</span>}
                    <span style={{ fontSize: 11.5, color: 'var(--text-quaternary)' }}>
                      {preview.files.length} 个文件
                    </span>
                  </div>
                  {preview.files.length > 0 && (
                    <div className="file-chips">
                      {preview.files.slice(0, 6).map(f => (
                        <div key={f} className="file-chip">
                          <FileText size={10} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
                          {f}
                        </div>
                      ))}
                      {preview.files.length > 6 && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-quaternary)', paddingLeft: 9 }}>
                          +{preview.files.length - 6} 个更多文件
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 安装目标（多选） */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--text-quaternary)' }}>
                    安装到（可多选）
                  </div>
                  {available.length > 1 && (
                    <button
                      style={{ fontSize: 11.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                      onClick={() => setCheckedPaths(
                        checkedPaths.length === available.length
                          ? []
                          : available.map(a => a.pathKey)
                      )}
                    >
                      {checkedPaths.length === available.length ? '取消全选' : '全选'}
                    </button>
                  )}
                </div>

                {available.length === 0 ? (
                  <div style={{ padding: '10px 13px', borderRadius: 9, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13 }}>
                    未检测到可用的 Agent 目录
                  </div>
                ) : (
                  <div className="agent-options">
                    {available.map(agent => {
                      const isSel = checkedPaths.includes(agent.pathKey)
                      const color = getAgentColor(agent.id)
                      return (
                        <div key={agent.pathKey}
                          className={`agent-option${isSel ? ' selected' : ''}`}
                          onClick={() => togglePath(agent.pathKey)}
                          title={agent.names.join('、')}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                            border: isSel ? 'none' : '1.5px solid var(--border)',
                            background: isSel ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .14s',
                          }}>
                            {isSel && <Check size={10} color="#fff" strokeWidth={3} />}
                          </div>
                          <span className="group-dot" style={{ background: color, width: 7, height: 7 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="agent-option-name">{agent.name}</div>
                            <div className="agent-option-path">{agent.path}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'preview' && (
            <button className="btn btn-ghost btn-sm" style={{ marginRight: 'auto', gap: 4 }}
              onClick={() => { setStep('pick'); setPreview(null); setCheckedPaths([]) }}>
              <ChevronLeft size={13} /> 重新选择
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          {step === 'preview' && (
            <button className="btn btn-primary btn-sm" onClick={handleInstall}
              disabled={checkedPaths.length === 0 || installing || available.length === 0}>
              {installing
                ? '安装中…'
                : checkedPaths.length > 1
                  ? `安装到 ${checkedPaths.length} 个目录`
                  : '确认安装'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
