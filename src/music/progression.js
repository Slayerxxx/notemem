/**
 * progression.js
 * 和弦进行识别训练：MIDI 文件名解析、token hash 与速度分桶纯函数。
 *
 * 文件名格式（严格规整）：
 *   <Key> - <Progression tokens> - <Mood tags>.mid
 * - Key 12 个，使用降号拼写：A Ab B Bb C D Db E Eb F G Gb
 * - Progression tokens 3-9 个空格分隔的罗马数字 token（大小写区分大/小和弦），
 *   可带 7/M7/m7/dom7/sus2/sus4/add9/6/69/dim/5/M-5 等后缀；
 *   Modal 类额外含 #/b 前缀（如 #IVdim、bVIIM）。
 * - Mood tags 1-3 个英文形容词，与玩法无关，仅作元数据保留。
 *
 * 目录结构（public/midi 下）：
 *   Major/ Minor/ Modal/ 三个顶层目录，各含 N 个顶层 baseline 副本 .mid
 *   以及 4 个 style 子目录（pop style / pop2 style / hiphop2 style / soul style）。
 *
 * 全部为纯函数、无 Vue / 无副作用，可在 Node 单测中直接运行。
 */

/** 12 个调性（降号拼写，与项目既有规范一致） */
export const PROGRESSION_KEYS = [
  'A', 'Ab', 'B', 'Bb', 'C', 'D', 'Db', 'E', 'Eb', 'F', 'G', 'Gb',
]

const KEY_SET = new Set(PROGRESSION_KEYS)

/**
 * MIDI 包中 Minor 类使用了升号拼写（C#/F#/G#），按项目硬约束
 * 「所有升降号一律用降号显示」在解析时归一化为等音调。
 */
const SHARP_TO_FLAT_KEY = {
  'C#': 'Db',
  'F#': 'Gb',
  'G#': 'Ab',
}

/** 文件名中允许出现的原始调性拼写（降号集 + Minor 包中的 3 个升号） */
const RAW_KEY_SET = new Set([...PROGRESSION_KEYS, ...Object.keys(SHARP_TO_FLAT_KEY)])

/** 顶层目录名 → mode */
const DIR_TO_MODE = {
  Major: 'major',
  Minor: 'minor',
  Modal: 'modal',
}

/** mode 中文名（用于题干与反馈文案） */
export const MODE_NAMES = {
  major: '大调',
  minor: '小调',
  modal: 'Modal 进行',
}

/**
 * token 宽松合法性正则：
 * - 可选 #/b 前缀（Modal 借用）；
 * - 罗马数字主体（大小写敏感的 I/V 组合，如 I、ii、VII、vii）；
 * - 可选后缀序列（数字、M/m、dom7、sus、add、dim、#、=、- 等字符）。
 */
const TOKEN_RE = /^[#b]?[ivIV]+[A-Za-z0-9#=-]*$/

/**
 * 将 style 子目录名规整为 style 标识。
 * `pop style` → 'pop'、`pop2 style` → 'pop2'、
 * `hiphop2 style` → 'hiphop2'、`soul style` → 'soul'。
 * @param {string} dirName
 * @returns {string}
 */
export function normalizeStyleDir(dirName) {
  return String(dirName).replace(/\s*style$/i, '').trim()
}

/**
 * 解析和弦进行 MIDI 文件名。
 *
 * @param {string} name 文件名或相对路径，如
 *   `A - I I7 Idom7 I7 - Relaxed Playful.mid`（裸文件名，mode 默认 major）
 *   或 `Major/pop style/A - I V vi IV - Hopeful.mid`（相对路径，
 *   从路径首段推断 mode、从次级目录推断 style）。
 * @param {'major'|'minor'|'modal'} [modeHint] 裸文件名无路径信息时的 mode
 *   兜底（构建脚本始终传相对路径，不会用到）；默认 'major'。
 * @returns {{key:string, mode:string, progressionTokens:string[], mood:string[], style:string}}
 *   key 始终为降号拼写（Minor 包原始 C#/F#/G# 归一化为 Db/Gb/Ab）。
 */
export function parseProgressionFilename(name, modeHint = 'major') {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`Invalid progression filename: ${name}`)
  }

  // 统一斜杠并拆分目录与文件名
  const normalized = name.replace(/\\/g, '/')
  const slashIdx = normalized.lastIndexOf('/')
  const dirPart = slashIdx >= 0 ? normalized.slice(0, slashIdx) : ''
  const base = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized

  let mode = modeHint
  let style = 'baseline'
  if (dirPart) {
    const segs = dirPart.split('/').filter(Boolean)
    const topMode = DIR_TO_MODE[segs[0]]
    if (topMode) mode = topMode
    if (segs.length >= 2 && segs[1]) {
      style = normalizeStyleDir(segs[1])
    }
  }
  if (mode !== 'major' && mode !== 'minor' && mode !== 'modal') {
    throw new Error(`Invalid progression filename: ${name}`)
  }

  // 去扩展名后按 ` - ` 切三段：Key / Tokens / Mood
  const stem = base.replace(/\.mid$/i, '').trim()
  const parts = stem.split(' - ').map((s) => s.trim())
  if (parts.length !== 3 || parts.some((p) => p === '')) {
    throw new Error(`Invalid progression filename: ${name}`)
  }

  const [rawKey, tokenPart, moodPart] = parts
  if (!RAW_KEY_SET.has(rawKey)) {
    throw new Error(`Invalid progression filename: ${name}`)
  }
  // 归一化为降号拼写（Minor 包 C#/F#/G# → Db/Gb/Ab）
  const key = SHARP_TO_FLAT_KEY[rawKey] ?? rawKey

  const progressionTokens = tokenPart.split(/\s+/).filter(Boolean)
  if (
    progressionTokens.length < 3 ||
    progressionTokens.length > 16 ||
    !progressionTokens.every((t) => TOKEN_RE.test(t))
  ) {
    throw new Error(`Invalid progression filename: ${name}`)
  }

  const mood = moodPart.split(/\s+/).filter(Boolean)
  if (mood.length === 0) {
    throw new Error(`Invalid progression filename: ${name}`)
  }

  return { key, mode, progressionTokens, mood, style }
}

/**
 * 对 progressionTokens 计算稳定 hash（djb2，join 空格后哈希）。
 * 用于选项去重、题目 id 与错题粒度。
 * @param {string[]} tokens
 * @returns {string} 36 进制非负整数字符串
 */
export function hashProgression(tokens) {
  const str = Array.isArray(tokens) ? tokens.join(' ') : String(tokens ?? '')
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    // >>> 0 保证为非负 32 位整数
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

/**
 * 速度分桶：按 style 返回 BPM（纯函数，可单测）。
 * - soul → 慢桶 70
 * - baseline / pop / pop2 → 中桶 90
 * - hiphop2 → 快桶 115
 * - 未知 style 默认中桶 90
 * @param {string} style
 * @returns {number}
 */
export function getBpmForStyle(style) {
  switch (style) {
    case 'soul':
      return 70
    case 'hiphop2':
      return 115
    case 'baseline':
    case 'pop':
    case 'pop2':
      return 90
    default:
      return 90
  }
}

// ============== 难度分级 ==============

/**
 * 和弦进行训练难度（L1-L4），按调性范围 + 和弦复杂度递增。
 * 同一难度内不混合 mode；各难度仅出现 baseline style。
 * 字段与 SCALE/CHORD/CIRCLE_DIFFICULTIES 保持同构（level + label），
 * 额外携带 mode/style/timeLimit 供出题与游戏 store 使用。
 */
export const PROGRESSION_DIFFICULTIES = [
  {
    level: 1,
    name: '大调三和弦',
    mode: 'major',
    style: 'baseline',
    pureTriadOnly: true,
    optionCount: 4,
    timeLimit: 20,
    label: 'L1 · 大调三和弦',
  },
  {
    level: 2,
    name: '大调七和弦',
    mode: 'major',
    style: 'baseline',
    hasExtendedChord: true,
    optionCount: 4,
    timeLimit: 18,
    label: 'L2 · 大调七和弦',
  },
  {
    level: 3,
    name: '小调进行',
    mode: 'minor',
    style: 'baseline',
    optionCount: 4,
    timeLimit: 16,
    label: 'L3 · 小调进行',
  },
  {
    level: 4,
    name: 'Modal 进行',
    mode: 'modal',
    style: 'baseline',
    optionCount: 4,
    timeLimit: 14,
    label: 'L4 · Modal 进行',
  },
]

/** 纯三和弦 token：无任何后缀的罗马数字（如 I、ii、iii、IV、V、vi、vii） */
const PURE_TRIAD_RE = /^[ivIV]+$/

/**
 * 判断单个 token 是否为无后缀纯三和弦。
 * @param {string} token
 * @returns {boolean}
 */
export function isPureTriadToken(token) {
  return PURE_TRIAD_RE.test(String(token))
}

/**
 * 判断 token 序列中是否至少含 1 个扩展和弦 token
 * （七和弦 / 9 和弦 / dom7 / sus / add9 / 数字后缀等）。
 * @param {string[]} tokens
 * @returns {boolean}
 */
export function hasExtendedToken(tokens) {
  return Array.isArray(tokens) && tokens.some((t) => !isPureTriadToken(t))
}

/**
 * 按难度等级从已加载 manifest 中过滤候选进行池。
 * - L1：major + baseline + tokens 全为无后缀纯三和弦；
 * - L2：major + baseline + 至少含 1 个扩展和弦 token；
 * - L3：minor + baseline；
 * - L4：modal + baseline。
 * @param {number} level 1-4
 * @param {{major?:object[], minor?:object[], modal?:object[]}} manifest
 * @returns {object[]} manifest 记录数组
 */
export function getProgressionPoolByLevel(level, manifest) {
  const conf = PROGRESSION_DIFFICULTIES.find((d) => d.level === level)
  if (!conf) {
    throw new Error(`Invalid progression difficulty level: ${level}`)
  }
  const records = Array.isArray(manifest?.[conf.mode]) ? manifest[conf.mode] : []
  const pool = records.filter(
    (r) => r && r.mode === conf.mode && r.style === conf.style
  )
  if (conf.pureTriadOnly) {
    return pool.filter((r) => r.progressionTokens.every(isPureTriadToken))
  }
  if (conf.hasExtendedChord) {
    return pool.filter((r) => hasExtendedToken(r.progressionTokens))
  }
  return pool
}

/**
 * 构造进行题目的稳定 id：`progression:<mode>:<key>:<tokenHash>`。
 * @param {{mode:string, key:string, tokenHash:string}} record
 * @returns {string}
 */
export function progressionQuestionId({ mode, key, tokenHash }) {
  return `progression:${mode}:${key}:${tokenHash}`
}

/**
 * 构造题干文案：
 * - major：请听这段大调和弦进行，调性：C 大调
 * - minor：请听这段小调和弦进行，调性：A 小调
 * - modal：请听这段 Modal 和弦进行，调性：A
 * @param {string} mode
 * @param {string} key
 * @returns {string}
 */
export function buildProgressionPrompt(mode, key) {
  if (mode === 'minor') return `请听这段小调和弦进行，调性：${key} 小调`
  if (mode === 'modal') return `请听这段 Modal 和弦进行，调性：${key}`
  return `请听这段大调和弦进行，调性：${key} 大调`
}
