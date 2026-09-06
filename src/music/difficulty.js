/**
 * difficulty.js
 * 音级训练与和弦训练的难度等级配置
 *
 * 音级训练 L1-L12：每个等级对应一个大调，按升降号数量升序（常用度排序）。
 * 和弦训练 L1-L3：逐级扩大根音池。
 */

import { CHORD_ROOTS } from './chords.js'

/**
 * 音级训练难度（L1-L12）。
 * 排序原则：升降号数量由少到多；相同数量时升号调在前（更常用）。
 */
export const SCALE_DIFFICULTIES = [
  { level: 1,  key: 'C',  accidentals: 0, label: 'L1 · C 大调' },
  { level: 2,  key: 'G',  accidentals: 1, label: 'L2 · G 大调' },
  { level: 3,  key: 'F',  accidentals: 1, label: 'L3 · F 大调' },
  { level: 4,  key: 'D',  accidentals: 2, label: 'L4 · D 大调' },
  { level: 5,  key: 'B♭', accidentals: 2, label: 'L5 · B♭ 大调' },
  { level: 6,  key: 'A',  accidentals: 3, label: 'L6 · A 大调' },
  { level: 7,  key: 'E♭', accidentals: 3, label: 'L7 · E♭ 大调' },
  { level: 8,  key: 'E',  accidentals: 4, label: 'L8 · E 大调' },
  { level: 9,  key: 'A♭', accidentals: 4, label: 'L9 · A♭ 大调' },
  { level: 10, key: 'B',  accidentals: 5, label: 'L10 · B 大调' },
  { level: 11, key: 'D♭', accidentals: 5, label: 'L11 · D♭ 大调' },
  { level: 12, key: 'F♯', accidentals: 6, label: 'L12 · F♯ 大调' },
]

/**
 * 和弦训练难度（L1-L3）。
 */
export const CHORD_DIFFICULTIES = [
  { level: 1, roots: ['C', 'F', 'G'], label: 'L1 · 入门' },
  { level: 2, roots: ['C', 'G', 'D', 'A', 'F', 'B♭'], label: 'L2 · 进阶' },
  { level: 3, roots: CHORD_ROOTS, label: 'L3 · 大师' },
]

// 单题默认限时（秒），音级训练与和弦训练统一
export const DEFAULT_TIME_LIMIT = 15

/**
 * 根据等级获取音级训练的调。
 * @param {number} level 1-12
 * @returns {string} 调名，如 'C'
 */
export function getScaleKeyByLevel(level) {
  const item = SCALE_DIFFICULTIES.find((d) => d.level === level)
  if (!item) {
    throw new Error(`Invalid scale difficulty level: ${level}`)
  }
  return item.key
}

/**
 * 根据等级获取和弦训练的根音池。
 * @param {number} level 1-3
 * @returns {string[]} 根音数组
 */
export function getChordRootsByLevel(level) {
  const item = CHORD_DIFFICULTIES.find((d) => d.level === level)
  if (!item) {
    throw new Error(`Invalid chord difficulty level: ${level}`)
  }
  return item.roots
}
