import express from 'express'
import cors from 'cors'
import multer from 'multer'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001

// Skills 目录：支持两个路径
const SKILLS_DIRS = [
  path.join(os.homedir(), '.codeflicker', 'skills'),
  path.join(os.homedir(), '.codeflicker', 'cli', 'skills')
]

app.use(cors())
app.use(express.json())

// 静态文件服务（生产模式）
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
}

// multer 配置：上传到临时目录
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.zip')) {
      cb(null, true)
    } else {
      cb(new Error('只支持 .zip 格式'))
    }
  }
})

// 解析 SKILL.md frontmatter
function parseSkillMeta(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) return null

  const content = fs.readFileSync(skillMdPath, 'utf-8')
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  let meta = {}
  if (match) {
    try {
      meta = yaml.load(match[1]) || {}
    } catch (e) {
      meta = {}
    }
  }

  // 提取正文内容（去掉 frontmatter）
  const body = content.replace(/^---[\s\S]*?---\n?/, '').trim()

  return {
    name: meta.name || path.basename(skillDir),
    description: meta.description || '',
    license: meta.license || '',
    body,
    rawMeta: meta
  }
}

// 获取所有 skills
function getAllSkills() {
  const skills = []
  for (const dir of SKILLS_DIRS) {
    if (!fs.existsSync(dir)) continue
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = path.join(dir, entry.name)
      const meta = parseSkillMeta(skillPath)
      if (meta) {
        skills.push({
          ...meta,
          dirName: entry.name,
          dirPath: skillPath,
          skillsDir: dir,
          files: getSkillFiles(skillPath)
        })
      }
    }
  }
  return skills
}

// 获取 skill 下的文件列表
function getSkillFiles(skillPath) {
  function walk(dir, base = '') {
    const result = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const relPath = base ? `${base}/${e.name}` : e.name
      if (e.isDirectory()) {
        result.push(...walk(path.join(dir, e.name), relPath))
      } else {
        result.push(relPath)
      }
    }
    return result
  }
  try {
    return walk(skillPath)
  } catch {
    return []
  }
}

// GET /api/skills - 获取所有 skills
app.get('/api/skills', (req, res) => {
  try {
    const skills = getAllSkills()
    res.json({ success: true, skills })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/skills/:name/file - 读取 skill 文件内容
app.get('/api/skills/:name/file', (req, res) => {
  const { name } = req.params
  const { filePath } = req.query
  if (!filePath) return res.status(400).json({ success: false, error: 'filePath required' })

  for (const dir of SKILLS_DIRS) {
    const skillPath = path.join(dir, name)
    if (!fs.existsSync(skillPath)) continue
    const fullPath = path.resolve(path.join(skillPath, filePath))
    // 安全检查：防止路径穿越
    if (!fullPath.startsWith(skillPath)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'File not found' })
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf-8')
      res.json({ success: true, content })
    } catch {
      res.status(400).json({ success: false, error: 'Cannot read binary file' })
    }
    return
  }
  res.status(404).json({ success: false, error: 'Skill not found' })
})

// PUT /api/skills/:name/file - 保存 skill 文件内容
app.put('/api/skills/:name/file', (req, res) => {
  const { name } = req.params
  const { filePath, content } = req.body
  if (!filePath || content === undefined) {
    return res.status(400).json({ success: false, error: 'filePath and content required' })
  }

  for (const dir of SKILLS_DIRS) {
    const skillPath = path.join(dir, name)
    if (!fs.existsSync(skillPath)) continue
    const fullPath = path.resolve(path.join(skillPath, filePath))
    if (!fullPath.startsWith(skillPath)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
    res.json({ success: true })
    return
  }
  res.status(404).json({ success: false, error: 'Skill not found' })
})

// POST /api/skills/install - 上传 zip 安装 skill
app.post('/api/skills/install', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: '请上传 .zip 文件' })

  const targetDir = SKILLS_DIRS[0]
  fs.mkdirSync(targetDir, { recursive: true })

  try {
    const zip = new AdmZip(req.file.path)
    const entries = zip.getEntries()

    // 检测 zip 内的顶层目录（skill 根目录）
    const topDirs = new Set()
    for (const entry of entries) {
      const parts = entry.entryName.split('/')
      if (parts[0]) topDirs.add(parts[0])
    }

    // 验证是否包含 SKILL.md
    const hasSkillMd = entries.some(e =>
      e.entryName === 'SKILL.md' ||
      (topDirs.size === 1 && e.entryName.endsWith('/SKILL.md'))
    )
    if (!hasSkillMd) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ success: false, error: 'zip 包内未找到 SKILL.md，请确认格式正确' })
    }

    // 如果 zip 顶层只有一个目录，解压到 targetDir；否则创建以 zip 文件名命名的目录
    let extractTo = targetDir
    if (topDirs.size !== 1) {
      const skillName = path.basename(req.file.originalname, '.zip')
      extractTo = path.join(targetDir, skillName)
      fs.mkdirSync(extractTo, { recursive: true })
    }

    zip.extractAllTo(extractTo, true)
    fs.unlinkSync(req.file.path)

    // 找到解压后的 skill 目录，读取 meta
    let installedName = topDirs.size === 1 ? [...topDirs][0] : path.basename(req.file.originalname, '.zip')
    const installedPath = path.join(extractTo, installedName === path.basename(extractTo) ? '' : installedName)
    const meta = parseSkillMeta(fs.existsSync(installedPath) ? installedPath : extractTo)

    res.json({ success: true, skill: meta || { name: installedName } })
  } catch (err) {
    try { fs.unlinkSync(req.file.path) } catch {}
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/skills/:name - 删除 skill
app.delete('/api/skills/:name', (req, res) => {
  const { name } = req.params
  for (const dir of SKILLS_DIRS) {
    const skillPath = path.join(dir, name)
    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true, force: true })
      res.json({ success: true })
      return
    }
  }
  res.status(404).json({ success: false, error: 'Skill not found' })
})

// 生产模式：所有非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (fs.existsSync(distPath)) {
    res.sendFile(path.join(distPath, 'index.html'))
  } else {
    res.status(404).send('Please run `npm run build` first or use `npm run dev`')
  }
})

app.listen(PORT, () => {
  console.log(`Skills Manager server running at http://localhost:${PORT}`)
})
