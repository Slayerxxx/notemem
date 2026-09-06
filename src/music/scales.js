/**
 * scales.js
 * 12 个大调的定义与音阶生成
 *
 * 乐理规则：
 * - 大调音程结构：全全半全全全半（W W H W W W H）
 *   即各音级相对根音的半音距离：[0, 2, 4, 5, 7, 9, 11]
 * - 12 个半音位置，每个位置用「自然音名 + 升降号」表示。
 *   等音（如 C♯ 与 D♭）在不同调中拼写不同，需按调式选择正确写法。
 * - 升号调：C、G、D、A、E、B、F♯（按五度相生依次加入升号）
 * - 降号调：F、B♭、E♭、A♭、D♭（按五度相生依次加入降号）
 * - 特殊：F♯ 大调的 VII 级是 E♯（而非等音 F），以保证每个自然音名
 *   A-G 在音阶中恰好出现一次。
 */

// Unicode 升降号字符
export const SHARP = '♯' // U+266F
export const FLAT = '♭' // U+266D

/**
 * 归一化音名：把常见的 ASCII 写法统一为 Unicode 升降号写法。
 * 示例：
 *   'C#'  -> 'C♯'
 *   'c#'  -> 'C♯'
 *   'Bb'  -> 'B♭'
 *   'bb'  -> 'B♭'
 *   'C♯'  -> 'C♯'（已归一化则原样返回）
 * @param {string} name
 * @returns {string}
 */
export function normalizeNoteName(name) {
  if (name == null) return name
  let s = String(name).trim()
  if (!s) return s
  // 首字母大写
  s = s.charAt(0).toUpperCase() + s.slice(1)
  // 把 # 替换为 ♯
  s = s.replace(/#/g, SHARP)
  // 把小写字母 b 开头的音名的 b 视为降号；但不能把 B 音名本身改坏。
  // 规则：长度 >= 2 且第二个字符是 'b' -> 视为降号（如 'Bb','Ab','eb'）
  // 注意 'B' 本身是一个合法音名；'Bb' 才是降 B。
  s = s.replace(/^([A-G])b$/i, (_m, letter) => letter.toUpperCase() + FLAT)
  // 处理可能的小写尾缀 b（如 'Ab'）——上面正则已覆盖单字母+b 的情形
  // 再处理 'bb' 等：第二个字符若是 b 且整体是 "Xb" 形式
  s = s.replace(/^([A-G])b$/, (_m, letter) => letter + FLAT)
  return s
}

/**
 * 12 个半音位置的两套拼写（升号体系 / 降号体系）。
 * 索引即半音位置（0 = C）。
 */
const CHROMATIC_SHARP = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'
]
const CHROMATIC_FLAT = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'
]

/**
 * 音名 -> 半音位置（0-11）。
 * 升号与降号的等音映射到同一位置。
 */
export const NOTE_TO_POSITION = {
  C: 0, 'C♯': 1, 'D♭': 1,
  D: 2, 'D♯': 3, 'E♭': 3,
  E: 4,
  F: 5, 'F♯': 6, 'G♭': 6,
  G: 7, 'G♯': 8, 'A♭': 8,
  A: 9, 'A♯': 10, 'B♭': 10,
  B: 11,
  // 特殊：E♯ = F（位置 5），仅 F♯ 大调 VII 级使用
  'E♯': 5,
  // 降号音名补全：C♭ = B（位置 11，A♭ 小三和弦三音）、
  // F♭ = E（位置 4，B♭ 减三和弦减五度）
  'C♭': 11,
  'F♭': 4,
  // 重升(𝄪)/重降(𝄫)音名：用于减三和弦等严格拼写场景（如 E𝄫=D）
  'A𝄫': 7, 'A𝄪': 11,
  'B𝄫': 9, 'B♯': 0,
  'C𝄫': 10, 'C𝄪': 2,
  'D𝄫': 0, 'D𝄪': 4,
  'E𝄫': 2,
  'F𝄫': 3, 'F𝄪': 7,
  'G𝄫': 5, 'G𝄪': 9,
}

/**
 * 12 个大调主音（按升降号数量升序、常用度排序）
 */
export const MAJOR_KEYS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F♯',
  'F', 'B♭', 'E♭', 'A♭', 'D♭'
]

// 大调音程：各音级相对根音的半音距离（I - VII）
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

/**
 * 判断一个调是升号调还是降号调。
 * C 为中性，这里归为升号体系（实际不出现升降号）。
 * @param {string} keyName
 * @returns {'sharp'|'flat'}
 */
function keyAccidentalSystem(keyName) {
  const flatKeys = new Set(['F', 'B♭', 'E♭', 'A♭', 'D♭'])
  return flatKeys.has(keyName) ? 'flat' : 'sharp'
}

/**
 * 根据半音位置与调式体系获取音名拼写。
 * @param {number} position 0-11
 * @param {'sharp'|'flat'} system
 * @returns {string}
 */
function noteNameByPosition(position, system) {
  const idx = ((position % 12) + 12) % 12
  return system === 'flat' ? CHROMATIC_FLAT[idx] : CHROMATIC_SHARP[idx]
}

/**
 * 获取某大调的 7 个音级数组（按 I - VII 顺序）。
 * @param {string} keyName 如 'C', 'A', 'B♭', 'F♯'
 * @returns {Array<{name: string, degree: number}>}
 */
export function getMajorScale(keyName) {
  const key = normalizeNoteName(keyName)
  if (!MAJOR_KEYS.includes(key)) {
    throw new Error(`Unsupported major key: ${keyName}`)
  }
  const rootPos = NOTE_TO_POSITION[key]
  const system = keyAccidentalSystem(key)

  const scale = MAJOR_INTERVALS.map((interval, idx) => {
    const pos = (rootPos + interval) % 12
    let name = noteNameByPosition(pos, system)
    // 特殊处理：F♯ 大调的 VII 级必须是 E♯（等音于 F），
    // 以保证 A-G 每个自然音名在音阶中恰好出现一次。
    if (key === 'F♯' && idx === 6) {
      name = 'E♯'
    }
    return { name, degree: idx + 1 }
  })

  return scale
}

/**
 * 获取某大调中某个音级的音名。
 * @param {string} keyName
 * @param {number} degree 1-7
 * @returns {string}
 */
export function getNoteByDegree(keyName, degree) {
  const scale = getMajorScale(keyName)
  const item = scale.find((n) => n.degree === degree)
  if (!item) {
    throw new Error(`Invalid degree ${degree} for key ${keyName}`)
  }
  return item.name
}

/**
 * 获取某大调中某个音名是第几级。
 * @param {string} keyName
 * @param {string} noteName
 * @returns {number|null} 1-7，若不在调中返回 null
 */
export function getDegreeOfNote(keyName, noteName) {
  const scale = getMajorScale(keyName)
  const target = normalizeNoteName(noteName)
  const item = scale.find((n) => n.name === target)
  return item ? item.degree : null
}
