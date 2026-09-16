/**
 * fretboard.js
 * 吉他指板（标准调弦）纯函数模块：
 * - 6 弦调弦定义、0–12 品半音位置推算；
 * - 按调性（大调）或降号体系拼写音名；
 * - 调性候选品位过滤、随机音符组生成；
 * - 字母音名 → 英文 TTS 朗读文本映射。
 *
 * 本模块不依赖任何 DOM / window / localStorage，可直接在 Node 测试中运行。
 * 调性数据复用 scales.js，不重复定义音阶。
 */

import {
  getMajorScale,
  NOTE_TO_POSITION,
  SHARP,
  FLAT,
} from './scales.js'

/** 指板最大品位（含 12 品） */
export const MAX_FRET = 12

/** 每组音符个数 */
export const GROUP_SIZE = 4

/** 调性选项中表示「不限调」的常量 */
export const ANY_KEY = null

/**
 * 12 个半音位置的降号体系拼写，索引即半音位置（0 = C）。
 * 无调性语境（不限调模式）统一使用降号，遵循项目既有约定。
 */
const CHROMATIC_FLAT = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
]

/**
 * 标准调弦的 6 根弦。
 * 索引 0 = ⑥弦（最粗，低音 E2）… 索引 5 = ①弦（最细，高音 E4）。
 * openPitch 为空弦音的半音位置（0 = C）。
 * @type {ReadonlyArray<{index:number, number:number, short:string, openName:string, octave:number, openPitch:number}>}
 */
export const GUITAR_STRINGS = [
  { index: 0, number: 6, short: '⑥', openName: 'E', octave: 2, openPitch: NOTE_TO_POSITION.E },
  { index: 1, number: 5, short: '⑤', openName: 'A', octave: 2, openPitch: NOTE_TO_POSITION.A },
  { index: 2, number: 4, short: '④', openName: 'D', octave: 3, openPitch: NOTE_TO_POSITION.D },
  { index: 3, number: 3, short: '③', openName: 'G', octave: 3, openPitch: NOTE_TO_POSITION.G },
  { index: 4, number: 2, short: '②', openName: 'B', octave: 3, openPitch: NOTE_TO_POSITION.B },
  { index: 5, number: 1, short: '①', openName: 'E', octave: 4, openPitch: NOTE_TO_POSITION.E },
]

/** 调式拼写缓存：keyName → Map<半音位置, 音名> */
const keySpellCache = new Map()

/**
 * 半音位置归一化到 0-11。
 * @param {number} position
 * @returns {number}
 */
function normalizePitch(position) {
  return ((Number(position) % 12) + 12) % 12
}

/**
 * 半音位置 → 降号体系音名。
 * @param {number} position 0-11（越界自动归一化）
 * @returns {string}
 */
export function spellFlatNote(position) {
  return CHROMATIC_FLAT[normalizePitch(position)]
}

/**
 * 获取某大调「半音位置 → 调式拼写音名」的映射（带缓存）。
 * @param {string} keyName
 * @returns {Map<number, string>}
 */
function keySpellMap(keyName) {
  const cached = keySpellCache.get(keyName)
  if (cached) return cached
  const scale = getMajorScale(keyName)
  const map = new Map(
    scale.map((n) => [NOTE_TO_POSITION[n.name], n.name])
  )
  keySpellCache.set(keyName, map)
  return map
}

/**
 * 校验弦索引，返回弦元数据。
 * @param {number} stringIndex 0-5
 * @returns {(typeof GUITAR_STRINGS)[number]}
 */
function getString(stringIndex) {
  const s = GUITAR_STRINGS[stringIndex]
  if (!s) {
    throw new Error(`Invalid string index: ${stringIndex} (expected 0-5)`)
  }
  return s
}

/**
 * 校验品位。
 * @param {number} fret
 */
function assertFret(fret) {
  if (!Number.isInteger(fret) || fret < 0 || fret > MAX_FRET) {
    throw new Error(`Invalid fret: ${fret} (expected integer 0-${MAX_FRET})`)
  }
}

/**
 * 指定弦、指定品位的半音位置：(空弦位置 + 品数) mod 12。
 * @param {number} stringIndex 0=⑥弦 … 5=①弦
 * @param {number} fret 0-12
 * @returns {number} 0-11
 */
export function getFretPitch(stringIndex, fret) {
  const s = getString(stringIndex)
  assertFret(fret)
  return normalizePitch(s.openPitch + fret)
}

/**
 * 指定弦、指定品位在指定调性语境下的音名拼写。
 * @param {number} stringIndex 0-5
 * @param {number} fret 0-12
 * @param {string|null} [keyName] 大调名；null（不限调）时使用降号拼写
 * @returns {string}
 */
export function getFretNote(stringIndex, fret, keyName = ANY_KEY) {
  const pitch = getFretPitch(stringIndex, fret)
  if (keyName == null) return spellFlatNote(pitch)
  const map = keySpellMap(keyName)
  // 候选品位保证为调内音；map 未命中时兜底降号拼写，绝不抛错
  return map.get(pitch) ?? spellFlatNote(pitch)
}

/**
 * 获取指定弦在指定调性下的候选品位（0–12 品内）。
 * - 调内模式：只保留音名属于该大调音阶的品位（7 或 8 个）；
 * - 不限调：13 个品位全部候选。
 * @param {number} stringIndex 0-5
 * @param {string|null} [keyName] 大调名；null 表示不限调
 * @returns {number[]}
 */
export function getCandidateFrets(stringIndex, keyName = ANY_KEY) {
  const s = getString(stringIndex)
  const map = keyName == null ? null : keySpellMap(keyName)
  const frets = []
  for (let fret = 0; fret <= MAX_FRET; fret += 1) {
    const pitch = normalizePitch(s.openPitch + fret)
    if (map === null || map.has(pitch)) {
      frets.push(fret)
    }
  }
  return frets
}

/**
 * 生成一组随机音符：从候选品位中无放回抽取 GROUP_SIZE 个。
 * 组内品位互不相同（保证 4 个答案对应指板上 4 个不同位置）；
 * 音名仍可能因八度重复（如空弦与 12 品同音名），答案以实际抽中品位为准。
 * @param {number} stringIndex 0-5
 * @param {string|null} [keyName] 大调名；null 表示不限调
 * @param {() => number} [rng] 可注入随机源（[0,1)），默认 Math.random
 * @returns {Array<{fret:number, name:string}>} 长度恒为 GROUP_SIZE
 */
export function generateNoteGroup(
  stringIndex,
  keyName = ANY_KEY,
  rng = Math.random
) {
  const candidates = getCandidateFrets(stringIndex, keyName)
  // Fisher–Yates 洗牌取前 GROUP_SIZE 个，实现无放回抽样
  const pool = candidates.slice()
  const n = Math.min(GROUP_SIZE, pool.length)
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const group = []
  for (let i = 0; i < n; i += 1) {
    const fret = pool[i]
    group.push({ fret, name: getFretNote(stringIndex, fret, keyName) })
  }
  return group
}

/**
 * 字母音名 → 英文 TTS 朗读文本。
 * 升号后缀读作 sharp，降号后缀读作 flat。
 * 示例：C → "C"；F♯ → "F sharp"；B♭ → "B flat"；E♯ → "E sharp"。
 * @param {string} noteName
 * @returns {string}
 */
export function toSpokenName(noteName) {
  const letter = String(noteName).charAt(0)
  if (String(noteName).includes(SHARP)) return `${letter} sharp`
  if (String(noteName).includes(FLAT)) return `${letter} flat`
  return letter
}
