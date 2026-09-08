/**
 * circle.js
 * 五度圈（Circle of Fifths）乐理计算
 *
 * 乐理规则：
 * - 五度圈把 12 个半音按纯五度关系排成圆环：
 *   · 顺时针每格 = 上行纯五度 = +7 半音
 *   · 逆时针每格 = 下行纯五度 = +5 半音（即上行纯四度）
 * - 顺时针序列（上行五度链）：
 *   C → G → D → A → E → B → G♭ → D♭ → A♭ → E♭ → B♭ → F → C
 * - 本模块所有音名一律使用降号拼写（等音取降号写法）：
 *   半音位置 0-11 对应 C、D♭、D、E♭、E、F、G♭、G、A♭、A、B♭、B
 *   （如 F♯ 位置写作 G♭，C♯ 写作 D♭）。
 */

import { normalizeNoteName, NOTE_TO_POSITION } from './scales.js'

/**
 * 12 个半音位置的降号拼写（索引即半音位置，0 = C）。
 */
export const CIRCLE_NOTES_FLAT = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'
]

/**
 * 五度圈顺时针序列（从 C 出发，每格上行纯五度），共 12 个音。
 */
export const CIRCLE_OF_FIFTHS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'
]

/** 上行纯五度的半音距离 */
export const PERFECT_FIFTH_UP = 7
/** 下行纯五度的半音距离（等价于上行纯四度） */
export const PERFECT_FIFTH_DOWN = 5

/** 归一化半音位置到 0-11 */
function mod12(n) {
  return ((n % 12) + 12) % 12
}

/** 按半音位置取降号拼写音名 */
function flatNameAt(position) {
  return CIRCLE_NOTES_FLAT[mod12(position)]
}

/**
 * 获取某音在五度圈上的左右邻居。
 * @param {string} note 中心音（如 'C'、'Bb'、'F#' 等会被归一化）
 * @returns {{ up: string, down: string }}
 *   up   = 上行纯五度（顺时针邻居，+7 半音）
 *   down = 下行纯五度（逆时针邻居，+5 半音）
 *   两个返回值均为降号拼写。
 */
export function getFifthNeighbors(note) {
  const name = normalizeNoteName(note)
  const pos = NOTE_TO_POSITION[name]
  if (pos === undefined) {
    throw new Error(`Unknown note for circle of fifths: ${note}`)
  }
  return {
    up: flatNameAt(pos + PERFECT_FIFTH_UP),
    down: flatNameAt(pos + PERFECT_FIFTH_DOWN),
  }
}

/**
 * 获取某音沿五度圈顺时针走 n 步的音（上行五度 n 次），降号拼写。
 * @param {string} note
 * @param {number} steps 步数（可为负，负表示逆时针）
 * @returns {string}
 */
export function stepAlongCircle(note, steps) {
  const name = normalizeNoteName(note)
  const pos = NOTE_TO_POSITION[name]
  if (pos === undefined) {
    throw new Error(`Unknown note for circle of fifths: ${note}`)
  }
  return flatNameAt(pos + PERFECT_FIFTH_UP * steps)
}

/**
 * 把任意合法音名归一化为降号拼写（等音取降号写法）。
 * 如 'F#' / 'F♯' → 'G♭'，'Bb' → 'B♭'，'C' → 'C'。
 * @param {string} note
 * @returns {string} 降号拼写音名
 */
export function toFlatName(note) {
  const name = normalizeNoteName(note)
  const pos = NOTE_TO_POSITION[name]
  if (pos === undefined) {
    throw new Error(`Unknown note for circle of fifths: ${note}`)
  }
  return flatNameAt(pos)
}
