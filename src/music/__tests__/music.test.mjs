/**
 * music.test.mjs
 * 乐理核心模块单元测试（使用 Node 原生 assert）。
 *
 * 运行：node src/music/__tests__/music.test.mjs
 */

import assert from 'node:assert/strict'

import {
  MAJOR_KEYS,
  getMajorScale,
  getNoteByDegree,
  getDegreeOfNote,
  normalizeNoteName,
  NOTE_TO_POSITION,
} from '../scales.js'

import {
  CHORD_ROOTS,
  getMajorTriad,
  getMinorTriad,
  spellChordTone,
} from '../chords.js'

import {
  SCALE_DIFFICULTIES,
  CHORD_DIFFICULTIES,
  CIRCLE_DIFFICULTIES,
  DEFAULT_TIME_LIMIT,
  getScaleKeyByLevel,
  getChordRootsByLevel,
  getCircleNotesByLevel,
} from '../difficulty.js'

import {
  CIRCLE_NOTES_FLAT,
  CIRCLE_OF_FIFTHS,
  getFifthNeighbors,
  stepAlongCircle,
} from '../circle.js'

// 提取音阶的纯音名数组，便于断言
function names(scale) {
  return scale.map((n) => n.name)
}

// ============== 1. C 大调音阶 ==============
{
  const scale = getMajorScale('C')
  assert.deepEqual(names(scale), ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'C 大调音阶应为 C D E F G A B')
  assert.deepEqual(scale.map((n) => n.degree), [1, 2, 3, 4, 5, 6, 7],
    'C 大调音级应为 1-7')
}

// ============== 2. A 大调音阶（升号） ==============
{
  assert.deepEqual(names(getMajorScale('A')),
    ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'],
    'A 大调音阶应为 A B C♯ D E F♯ G♯')
}

// ============== 3. F 大调音阶（降号） ==============
{
  assert.deepEqual(names(getMajorScale('F')),
    ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
    'F 大调音阶应为 F G A B♭ C D E')
}

// ============== 4. F♯ 大调含 E♯ ==============
{
  const fSharp = names(getMajorScale('F♯'))
  assert.deepEqual(fSharp,
    ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'],
    'F♯ 大调音阶应为 F♯ G♯ A♯ B C♯ D♯ E♯')
  assert.ok(fSharp.includes('E♯'), 'F♯ 大调应包含 E♯')
  assert.ok(!fSharp.includes('F'), 'F♯ 大调不应包含 F（应为 E♯）')
}

// ============== 5. 全部 12 大调均能生成且无重复 ==============
{
  assert.equal(MAJOR_KEYS.length, 12, '应有 12 个大调')
  for (const key of MAJOR_KEYS) {
    const scale = getMajorScale(key)
    assert.equal(scale.length, 7, `${key} 大调应有 7 个音`)
    const set = new Set(names(scale))
    assert.equal(set.size, 7, `${key} 大调 7 个音名不应重复`)
  }
}

// 额外校验规范中给出的 12 个大调拼写
const EXPECTED_SCALES = {
  C:  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  G:  ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'],
  D:  ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'],
  A:  ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'],
  E:  ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'],
  B:  ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'],
  'F♯': ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'],
  F:  ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
  'B♭': ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
  'E♭': ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
  'A♭': ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
  'D♭': ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
}
for (const [key, expected] of Object.entries(EXPECTED_SCALES)) {
  assert.deepEqual(names(getMajorScale(key)), expected, `${key} 大调拼写错误`)
}

// ============== 6. getDegreeOfNote ==============
{
  assert.equal(getDegreeOfNote('A', 'F♯'), 6, 'A 大调中 F♯ 是第 6 级')
  assert.equal(getDegreeOfNote('C', 'B'), 7, 'C 大调中 B 是第 7 级')
  assert.equal(getDegreeOfNote('C', 'F♯'), null, 'C 大调中 F♯ 不在调内')
  assert.equal(getNoteByDegree('C', 1), 'C', 'C 大调 I 级为 C')
  assert.equal(getNoteByDegree('A', 6), 'F♯', 'A 大调 VI 级为 F♯')
}

// ============== 7-11. 大三和弦 ==============
{
  assert.deepEqual(names(getMajorTriad('C')), ['C', 'E', 'G'],
    'C 大三和弦 = C E G')
  assert.deepEqual(names(getMajorTriad('B♭')), ['B♭', 'D', 'F'],
    'B♭ 大三和弦 = B♭ D F')
  assert.deepEqual(names(getMajorTriad('B')), ['B', 'D♯', 'F♯'],
    'B 大三和弦 = B D♯ F♯')
  assert.deepEqual(names(getMajorTriad('F♯')), ['F♯', 'A♯', 'C♯'],
    'F♯ 大三和弦 = F♯ A♯ C♯')
  assert.deepEqual(names(getMajorTriad('E♭')), ['E♭', 'G', 'B♭'],
    'E♭ 大三和弦 = E♭ G B♭')
  assert.deepEqual(names(getMajorTriad('C♯')), ['C♯', 'E♯', 'G♯'],
    'C♯ 大三和弦 = C♯ E♯ G♯（三度叠置拼写，E♯ 不可写为 F）')

  // interval 字段校验
  const cTriad = getMajorTriad('C')
  assert.deepEqual(cTriad.map((t) => t.interval),
    ['根音', '大三度', '纯五度'],
    '和弦音程名称应为 根音/大三度/纯五度')
}

// ============== 12. 半音距离校验 ==============
{
  for (const root of CHORD_ROOTS) {
    const triad = getMajorTriad(root)
    const [r, third, fifth] = triad
    const rootPos = NOTE_TO_POSITION[r.name]
    const thirdPos = NOTE_TO_POSITION[third.name]
    const fifthPos = NOTE_TO_POSITION[fifth.name]
    const thirdDist = (thirdPos - rootPos + 12) % 12
    const fifthDist = (fifthPos - rootPos + 12) % 12
    assert.equal(thirdDist, 4, `${root} 和弦大三度应为 4 半音，实际 ${thirdDist}`)
    assert.equal(fifthDist, 7, `${root} 和弦纯五度应为 7 半音，实际 ${fifthDist}`)
  }
}

// ============== 12b. 小三和弦（三度叠置拼写） ==============
{
  // 关键拼写：小三度音必须按三度叠置书写，不可用等音
  assert.deepEqual(names(getMinorTriad('C')), ['C', 'E♭', 'G'],
    'C 小三和弦 = C E♭ G（三音是 E♭，不能写 D♯）')
  assert.deepEqual(names(getMinorTriad('G')), ['G', 'B♭', 'D'],
    'G 小三和弦 = G B♭ D（三音是 B♭，不能写 A♯）')
  assert.deepEqual(names(getMinorTriad('F')), ['F', 'A♭', 'C'],
    'F 小三和弦 = F A♭ C')
  assert.deepEqual(names(getMinorTriad('B♭')), ['B♭', 'D♭', 'F'],
    'B♭ 小三和弦 = B♭ D♭ F')
  assert.deepEqual(names(getMinorTriad('E♭')), ['E♭', 'G♭', 'B♭'],
    'E♭ 小三和弦 = E♭ G♭ B♭')
  assert.deepEqual(names(getMinorTriad('A♭')), ['A♭', 'C♭', 'E♭'],
    'A♭ 小三和弦 = A♭ C♭ E♭（三音是 C♭，不能写 B）')
  assert.deepEqual(names(getMinorTriad('C♯')), ['C♯', 'E', 'G♯'],
    'C♯ 小三和弦 = C♯ E G♯')
  assert.deepEqual(names(getMinorTriad('F♯')), ['F♯', 'A', 'C♯'],
    'F♯ 小三和弦 = F♯ A C♯')
  assert.deepEqual(names(getMinorTriad('B')), ['B', 'D', 'F♯'],
    'B 小三和弦 = B D F♯')

  // interval 标签
  assert.deepEqual(getMinorTriad('C').map((t) => t.interval),
    ['根音', '小三度', '纯五度'],
    '小三和弦音程名称应为 根音/小三度/纯五度')

  // 全部 12 根音：小三度 +3 半音、纯五度 +7 半音，且音名全部合法
  for (const root of CHORD_ROOTS) {
    const triad = getMinorTriad(root)
    const [r, third, fifth] = triad
    const rootPos = NOTE_TO_POSITION[r.name]
    const thirdDist = (NOTE_TO_POSITION[third.name] - rootPos + 12) % 12
    const fifthDist = (NOTE_TO_POSITION[fifth.name] - rootPos + 12) % 12
    assert.equal(thirdDist, 3, `${root} 小三和弦三音应为 +3 半音，实际 ${thirdDist}`)
    assert.equal(fifthDist, 7, `${root} 小三和弦五音应为 +7 半音，实际 ${fifthDist}`)
    for (const t of triad) {
      assert.ok(NOTE_TO_POSITION[t.name] !== undefined,
        `${root} 小三和弦音名 ${t.name} 应在半音体系中合法`)
    }
  }
}

// ============== 12c. spellChordTone 叠置拼写工具 ==============
{
  // C 大三度 = E、纯五度 = G
  assert.equal(spellChordTone('C', 4, 2), 'E')
  assert.equal(spellChordTone('C', 7, 4), 'G')
  // C 减五度 = G♭（不能写 F♯）
  assert.equal(spellChordTone('C', 6, 4), 'G♭')
  // C♯ 大三度 = E♯（不能写 F）
  assert.equal(spellChordTone('C♯', 4, 2), 'E♯')
  // E♭ 减五度 = B𝄫（重降，等音 A）
  assert.equal(spellChordTone('E♭', 6, 4), 'B𝄫')
  // A♭ 减五度 = E𝄫（重降，等音 D）
  assert.equal(spellChordTone('A♭', 6, 4), 'E𝄫')
}

// ============== 13. 难度配置 ==============
{
  assert.equal(SCALE_DIFFICULTIES.length, 12, 'SCALE_DIFFICULTIES 应有 12 项')
  assert.equal(SCALE_DIFFICULTIES[0].key, 'C', 'L1 应为 C 大调')
  assert.equal(SCALE_DIFFICULTIES[11].key, 'F♯', 'L12 应为 F♯ 大调')

  assert.equal(CHORD_DIFFICULTIES.length, 3, 'CHORD_DIFFICULTIES 应有 3 项')
  assert.equal(DEFAULT_TIME_LIMIT, 15, '默认限时应为 15 秒')
}

// ============== 14. 难度查询函数 ==============
{
  assert.equal(getScaleKeyByLevel(6), 'A', 'L6 应为 A 大调')
  assert.equal(getChordRootsByLevel(1).length, 3, 'L1 和弦根音池应有 3 个')
  assert.deepEqual(getChordRootsByLevel(1), ['C', 'F', 'G'])
  assert.equal(getChordRootsByLevel(3).length, 12, 'L3 和弦根音池应有 12 个')
}

// ============== 附加：normalizeNoteName 归一化 ==============
{
  assert.equal(normalizeNoteName('C#'), 'C♯')
  assert.equal(normalizeNoteName('c#'), 'C♯')
  assert.equal(normalizeNoteName('C♯'), 'C♯')
  assert.equal(normalizeNoteName('Bb'), 'B♭')
  assert.equal(normalizeNoteName('bb'), 'B♭')
  assert.equal(normalizeNoteName('B♭'), 'B♭')
  assert.equal(normalizeNoteName('Eb'), 'E♭')
}

// ============== 15. 五度圈邻居计算（降号拼写） ==============
{
  // 顺时针（上行五度）序列：C G D A E B G♭ D♭ A♭ E♭ B♭ F
  const clockwise = ['C', 'G', 'D', 'A', 'E', 'B', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F']
  assert.deepEqual(CIRCLE_OF_FIFTHS, clockwise, '五度圈顺时针序列应为 C G D A E B G♭ D♭ A♭ E♭ B♭ F')
  assert.equal(CIRCLE_NOTES_FLAT.length, 12, '降号拼写表应有 12 个音')

  for (let i = 0; i < 12; i++) {
    const note = clockwise[i]
    const expectedUp = clockwise[(i + 1) % 12]
    const expectedDown = clockwise[(i - 1 + 12) % 12]
    const { up, down } = getFifthNeighbors(note)
    assert.equal(up, expectedUp, `${note} 的上行五度应为 ${expectedUp}，实际 ${up}`)
    assert.equal(down, expectedDown, `${note} 的下行五度应为 ${expectedDown}，实际 ${down}`)
    // 所有返回值必须为降号拼写：不得包含升号 ♯
    assert.ok(!up.includes('♯'), `${note} 上行五度 ${up} 不应含升号`)
    assert.ok(!down.includes('♯'), `${note} 下行五度 ${down} 不应含升号`)
    // 邻居与中心音两两不同
    assert.notEqual(up, note)
    assert.notEqual(down, note)
    assert.notEqual(up, down)
  }

  // 关键拼写断言：B 的上行五度是 G♭（不是 F♯）；F 的下行五度是 B♭
  assert.equal(getFifthNeighbors('B').up, 'G♭', 'B 的上行五度应为 G♭（降号拼写）')
  assert.equal(getFifthNeighbors('F').down, 'B♭', 'F 的下行五度应为 B♭')
  // 升号输入也应归一化并返回降号拼写
  assert.equal(getFifthNeighbors('F#').up, 'D♭', 'F♯(=G♭) 的上行五度应为 D♭')
  // stepAlongCircle：+1 等价 up，-1 等价 down
  for (const note of CIRCLE_OF_FIFTHS) {
    assert.equal(stepAlongCircle(note, 1), getFifthNeighbors(note).up)
    assert.equal(stepAlongCircle(note, -1), getFifthNeighbors(note).down)
    assert.equal(stepAlongCircle(note, 12), note, '沿圈走 12 步应回到自身')
  }
  // 未知音名抛错
  assert.throws(() => getFifthNeighbors('H'), /Unknown note/)
  assert.throws(() => stepAlongCircle('X', 1), /Unknown note/)
}

// ============== 16. 五度圈难度配置 ==============
{
  assert.equal(CIRCLE_DIFFICULTIES.length, 2, 'CIRCLE_DIFFICULTIES 应有 2 项')

  const l1 = getCircleNotesByLevel(1)
  assert.deepEqual([...l1].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G'].sort(),
    'L1 应为 7 个白键音 C D E F G A B')
  assert.equal(l1.length, 7, 'L1 应有 7 个中心音')
  for (const n of l1) {
    assert.ok(!n.includes('♯') && !n.includes('♭'), `L1 中心音 ${n} 不应含升降号`)
  }

  const l2 = getCircleNotesByLevel(2)
  assert.equal(l2.length, 12, 'L2 应覆盖全部 12 个音')
  assert.deepEqual([...l2].sort(), [...CIRCLE_NOTES_FLAT].sort(),
    'L2 应与 12 音降号拼写表一致')
  for (const black of ['D♭', 'E♭', 'G♭', 'A♭', 'B♭']) {
    assert.ok(l2.includes(black), `L2 应包含黑键音 ${black}`)
    assert.ok(!l1.includes(black), `L1 不应包含黑键音 ${black}`)
  }

  // 非法等级抛错
  assert.throws(() => getCircleNotesByLevel(0), /Invalid circle difficulty level/)
  assert.throws(() => getCircleNotesByLevel(3), /Invalid circle difficulty level/)
}

console.log('All tests passed!')
