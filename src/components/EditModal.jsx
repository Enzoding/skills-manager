import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { FileText, Save, X } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

const lightTheme = EditorView.theme({
  '&': {
    fontFamily: '"SF Mono", "Menlo", monospace',
    fontSize: '12.5px',
    background: '#ffffff',
    flex: '1',
    height: '100%',
  },
  '.cm-content': { padding: '14px 16px', lineHeight: '1.75' },
  '.cm-focused': { outline: 'none' },
  '.cm-line': { paddingLeft: 0 },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
  '.cm-gutters': { display: 'none' },
  '.cm-cursor': { borderLeftColor: '#007aff' },
  '.cm-selectionBackground': { background: 'rgba(0,122,255,.15) !important' },
})

export function EditModal({ skill, onClose, onSaved, addToast }) {
  const [selectedFile, setFile] = useState('SKILL.md')
  const [content, setContent]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)

  const textFiles = (skill.files || []).filter(f =>
    /\.(md|txt|yaml|yml|json|js|ts|py|sh|toml|ini|cfg|xml|html|css)$/i.test(f)
  )
  const allFiles = ['SKILL.md', ...textFiles.filter(f => f !== 'SKILL.md')]

  useEffect(() => { loadFile(selectedFile) }, [selectedFile])

  const loadFile = async (fp) => {
    setLoading(true); setDirty(false)
    try {
      setContent(await invoke('read_skill_file', { dirPath: skill.dirPath, filePath: fp }))
    } catch (err) { addToast(String(err), 'error'); setContent('') }
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await invoke('write_skill_file', { dirPath: skill.dirPath, filePath: selectedFile, content })
      addToast('已保存', 'success')
      setDirty(false); onSaved()
    } catch (err) { addToast(String(err), 'error') }
    finally { setSaving(false) }
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (dirty) handleSave()
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-title">编辑 — {skill.name}</span>
            {dirty && <span className="badge badge-warn">未保存</span>}
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="edit-layout">
          <aside className="edit-files">
            <div className="edit-files-label">文件</div>
            {allFiles.map(f => (
              <button key={f} className={`edit-file-btn${selectedFile === f ? ' active' : ''}`}
                onClick={() => setFile(f)} title={f}>
                <FileText size={11} style={{ flexShrink: 0, opacity: .5 }} />
                <span>{f}</span>
              </button>
            ))}
          </aside>

          <div className="edit-editor">
            {loading
              ? <div className="edit-loading">加载中…</div>
              : <CodeMirror
                  value={content}
                  extensions={[markdown(), lightTheme]}
                  onChange={(val) => { setContent(val); setDirty(true) }}
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: false,
                    rectangularSelection: false,
                    crosshairCursor: false,
                    highlightActiveLine: false,
                    highlightSelectionMatches: false,
                    closeBracketsKeymap: false,
                    searchKeymap: false,
                  }}
                  style={{ flex: 1, minHeight: 380, maxHeight: '58vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                />
            }
          </div>
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: 12, color: 'var(--text-quaternary)', flex: 1 }}>⌘S 快速保存</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>关闭</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!dirty || saving}
            style={{ gap: 5 }}>
            <Save size={12} />
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
