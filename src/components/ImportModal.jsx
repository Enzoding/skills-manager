import { useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Upload, FileText, ChevronLeft, X, Check } from 'lucide-react'

const AGENT_COLORS = {
  'agents-shared':'#5856d6',
  'cursor':'#7c3aed','claude-dev':'#d97706','windsurf':'#059669',
  'continue':'#e11d48','claude-code':'#c9460a','opencode':'#0ea5e9',
  'codex':'#059669','aider':'#7c3aed','gemini-cli':'#1a73e8',
  'copilot':'#238636','zed':'#084c8d',
}

export function ImportModal({ agentSources, onClose, onInstalled, addToast }) {
  const [step, setStep]             = useState('pick')
  const [preview, setPreview]       = useState(null)
  const [checkedIds, setCheckedIds] = useState([])   // 用数组，避免 Set 闭包问题
  const [loading, setLoading]       = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dragging, setDragging]     = useState(false)

  const available = agentSources.filter(a => a.exists)

  const toggleAgent = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const loadFile = async (path) => {
    setLoading(true)
    try {
      const result = await invoke('preview_skill_zip', { zipPath: path })
      setPreview(result)
      setStep('preview')
      if (available.length > 0) setCheckedIds([available[0].id])
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
    if (checkedIds.length === 0) { addToast('请至少选择一个安装目标', 'error'); return }
    setInstalling(true)
    try {
      const results = await invoke('install_skill', {
        zipPath: preview.zipPath,
        agentIds: checkedIds,
      })
      const names = results.map(s => s.name).join('、')
      addToast(`已安装「${names}」到 ${results.length} 个 Agent`, 'success')
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
                      onClick={() => setCheckedIds(
                        checkedIds.length === available.length
                          ? []
                          : available.map(a => a.id)
                      )}
                    >
                      {checkedIds.length === available.length ? '取消全选' : '全选'}
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
                      const isSel = checkedIds.includes(agent.id)
                      const color = AGENT_COLORS[agent.id] || '#5856d6'
                      return (
                        <div key={agent.id}
                          className={`agent-option${isSel ? ' selected' : ''}`}
                          onClick={() => toggleAgent(agent.id)}
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
              onClick={() => { setStep('pick'); setPreview(null); setCheckedIds([]) }}>
              <ChevronLeft size={13} /> 重新选择
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          {step === 'preview' && (
            <button className="btn btn-primary btn-sm" onClick={handleInstall}
              disabled={checkedIds.length === 0 || installing || available.length === 0}>
              {installing
                ? '安装中…'
                : checkedIds.length > 1
                  ? `安装到 ${checkedIds.length} 个 Agent`
                  : '确认安装'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
