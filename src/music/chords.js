/**
 * chords.js
 * 三和弦组成音计算
 *
 * 乐理规则：
 * - 大三和弦 = 根音 + 大三度(+4 半音) + 纯五度(+7 半音)
 * - 小三和弦 = 根音 + 小三度(+3 半音) + 纯五度(+7 半音)
 * - 三和弦一律按「三度叠置」拼写：根音/三音/五音的音名字母依次
 *   相隔一个字母（C 和弦的三音字母必为 E、五音字母必为 G），
 *   等音不能随意替换。例如：
 *   · C 小三和弦拼写为 C-E♭-G（三音是 E♭，不能写等音 D♯）
 *   · C♯ 大三和弦拼写为 C♯-E♯-G♯（三音是 E♯，不能写 F）
 *   · A♭ 小三和弦拼写为 A♭-C♭-E♭（三音是 C♭，不能写 B）
 */

import { normalizeNoteName, NOTE_TO_POSITION } from './scales.js'

// 音名字母顺序（三度叠置时按此循环取字母）
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/**
 * 每个音名字母可表达的半音位置（0-11）与对应拼写。
 * 用于按「三度叠置字母原则」确定音名：
 * 先确定目标音应使用的字母（根音字母 + letterOffset），
 * 再按半音位置选择该字母下的升降号拼写。
 */
const SPELLINGS_BY_LETTER = {
  // 含重升(𝄪)/重降(𝄫)拼写，覆盖减三和弦等边界情况
  // （如 E♭ 减三的减五度为 B𝄫、A♭ 减三的减五度为 E𝄫）
  A: { 7: 'A𝄫', 8: 'A♭', 9: 'A', 10: 'A♯', 11: 'A𝄪' },
  B: { 9: 'B𝄫', 10: 'B♭', 11: 'B', 0: 'B♯' },
  C: { 10: 'C𝄫', 11: 'C♭', 0: 'C', 1: 'C♯', 2: 'C𝄪' },
  D: { 0: 'D𝄫', 1: 'D♭', 2: 'D', 3: 'D♯', 4: 'D𝄪' },
  E: { 2: 'E𝄫', 3: 'E♭', 4: 'E', 5: 'E♯', 6: 'E𝄪' },
  F: { 3: 'F𝄫', 4: 'F♭', 5: 'F', 6: 'F♯', 7: 'F𝄪' },
  G: { 5: 'G𝄫', 6: 'G♭', 7: 'G', 8: 'G♯', 9: 'G𝄪' },
}

/**
 * 和弦训练使用的 12 个根音（混合升降号，符合常见和弦命名习惯）。
 */
export const CHORD_ROOTS = [
  'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'
]

/**
 * 按三度叠置原则拼写和弦音。
 *
 * @param {string} rootName 根音（如 'C'、'B♭'）
 * @param {number} semitones 目标音相对根音的半音距离（0-11）
 * @param {number} letterOffset 目标音相对根音的音名字母步数
 *   （二度=1、三度=2、四度=3、五度=4、六度=5、七度=6）
 * @returns {string} 规范拼写的音名
 */
export function spellChordTone(rootName, semitones, letterOffset) {
  const root = normalizeNoteName(rootName)
  const rootPos = NOTE_TO_POSITION[root]
  if (rootPos === undefined) {
    throw new Error(`Unknown root note: ${rootName}`)
  }
  const rootLetter = root.charAt(0)
  const rootLetterIdx = LETTERS.indexOf(rootLetter)
  if (rootLetterIdx < 0) {
    throw new Error(`Invalid root letter: ${rootName}`)
  }
  const targetLetter = LETTERS[(rootLetterIdx + letterOffset) % 7]
  const targetPos = ((rootPos + semitones) % 12 + 12) % 12
  const name = SPELLINGS_BY_LETTER[targetLetter][targetPos]
  if (!name) {
    throw new Error(
      `No valid spelling for root ${rootName} + ${semitones} semitones (letter offset ${letterOffset})`
    )
  }
  return name
}

/**
 * 获取某根音的大三和弦组成音（从低到高排列）。
 * @param {string} rootName 如 'C', 'B♭', 'F♯'
 * @returns {Array<{name: string, interval: string}>}
 */
export function getMajorTriad(rootName) {
  const root = normalizeNoteName(rootName)
  if (NOTE_TO_POSITION[root] === undefined) {
    throw new Error(`Unknown root note: ${rootName}`)
  }
  return [
    { name: root, interval: '根音' },
    // 大三度 = +4 半音，三音字母 = 根音字母 +2
    { name: spellChordTone(root, 4, 2), interval: '大三度' },
    // 纯五度 = +7 半音，五音字母 = 根音字母 +4
    { name: spellChordTone(root, 7, 4), interval: '纯五度' },
  ]
}

/**
 * 获取某根音的小三和弦组成音（从低到高排列）。
 * 小三和弦 = 根音 + 小三度(+3 半音) + 纯五度(+7 半音)，
 * 拼写同样遵循三度叠置原则（如 C 小三 = C-E♭-G）。
 * @param {string} rootName 如 'C', 'B♭', 'A♭'
 * @returns {Array<{name: string, interval: string}>}
 */
export function getMinorTriad(rootName) {
  const root = normalizeNoteName(rootName)
  if (NOTE_TO_POSITION[root] === undefined) {
    throw new Error(`Unknown root note: ${rootName}`)
  }
  return [
    { name: root, interval: '根音' },
    // 小三度 = +3 半音，三音字母 = 根音字母 +2
    { name: spellChordTone(root, 3, 2), interval: '小三度' },
    // 纯五度 = +7 半音，五音字母 = 根音字母 +4
    { name: spellChordTone(root, 7, 4), interval: '纯五度' },
  ]
}
