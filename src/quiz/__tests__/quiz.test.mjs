/**
 * quiz.test.mjs
 * 题目生成器单元测试（使用 Node 原生 assert）。
 *
 * 运行：node src/quiz/__tests__/quiz.test.mjs
 *
 * 覆盖：TR-3.1 音级题生成与等级调式 / TR-3.2 和弦正确答案
 *       TR-3.3 干扰项策略与选项合法性 / TR-3.4 错题强化权重
 */

import assert from 'node:assert/strict'

import {
  degreeToRoman,
  ROMAN_NUMERALS,
  generateScaleQuestion,
  generateChordQuestion,
  generateCircleQuestion,
  generateQuestion,
  pickWeighted,
  CHORD_DISTRACTOR_STRATEGIES,
  DISTRACTOR_ADJACENT,
  DISTRACTOR_MINOR,
  DISTRACTOR_INTERVAL,
} from '../generator.js'

import {
  getScaleKeyByLevel,
  getChordRootsByLevel,
  getCircleNotesByLevel,
  getDegreeOfNote,
  getNoteByDegree,
  getMajorTriad,
  getMinorTriad,
  getFifthNeighbors,
  stepAlongCircle,
  NOTE_TO_POSITION,
} from '../../music/index.js'

// 统计数组中各值出现次数
function countBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return map
}

// 半音距离（0-11）
function semitoneDistance(fromName, toName) {
  return (NOTE_TO_POSITION[toName] - NOTE_TO_POSITION[fromName] + 12) % 12
}

// ============== 0. degreeToRoman 罗马数字工具 ==============
{
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map(degreeToRoman),
    ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
    'degreeToRoman 应正确映射 1-7'
  )
  assert.equal(ROMAN_NUMERALS.length, 7)
  assert.throws(() => degreeToRoman(0), /Invalid degree/)
  assert.throws(() => degreeToRoman(8), /Invalid degree/)
}

// ============== TR-3.1: L1 音级题（C 大调）分布与结构 ==============
{
  const N = 100
  const questions = Array.from({ length: N }, () => generateScaleQuestion({ level: 1 }))

  // 全部为 C 大调，绝不混调
  assert.ok(questions.every((q) => q.keyName === 'C'),
    'L1 音级题 keyName 应全部为 C')
  assert.ok(questions.every((q) => q.type === 'scale'))

  // 选项恒为 [1..7]
  assert.ok(questions.every((q) =>
    q.options.length === 7 && q.options.every((o, i) => o === i + 1)),
    '音级题 options 应恒为 [1..7]')

  // 音级分布大致均匀：每个音级出现 5~25 次
  const degreeCounts = countBy(questions, (q) => q.degree)
  for (let d = 1; d <= 7; d++) {
    const c = degreeCounts.get(d) || 0
    assert.ok(c >= 5 && c <= 25,
      `C 大调第 ${d} 级出现 ${c} 次，应在 5~25 之间（大致均匀）`)
  }

  // 正确答案与 music 模块一致
  for (const q of questions) {
    assert.equal(q.correctIndex, q.degree - 1, 'correctIndex 应为 degree - 1')
    assert.equal(getDegreeOfNote(q.keyName, q.promptNote), q.degree,
      'promptNote 对应的音级应与 degree 一致')
    assert.equal(q.promptNote, getNoteByDegree(q.keyName, q.degree),
      'promptNote 应为该调该音级的音名')
    assert.equal(q.id, `scale:${q.keyName}:${q.degree}`, 'id 格式应为 scale:调:音级')
    assert.ok(q.explanation.includes(q.promptNote), '解析应包含被问音名')
    assert.ok(q.explanation.includes(degreeToRoman(q.degree)), '解析应包含罗马数字音级')
  }
}

// ============== TR-3.1: 12 个等级各 50 题，调式与等级严格一致 ==============
{
  for (let level = 1; level <= 12; level++) {
    const expectedKey = getScaleKeyByLevel(level)
    const questions = Array.from({ length: 50 }, () => generateScaleQuestion({ level }))
    assert.ok(questions.every((q) => q.keyName === expectedKey),
      `L${level} 音级题 keyName 应全部为 ${expectedKey}`)
    // 每个调的 7 个音级都应出现过
    const degrees = new Set(questions.map((q) => q.degree))
    assert.equal(degrees.size, 7, `L${level} 50 题应覆盖全部 7 个音级`)
    // 音名与音级对应关系恒成立（含 F♯ 大调 E♯ 等特殊拼写）
    for (const q of questions) {
      assert.equal(getDegreeOfNote(expectedKey, q.promptNote), q.degree,
        `L${level}(${expectedKey}) 中 ${q.promptNote} 应为第 ${q.degree} 级`)
    }
  }
  // 明确抽查规格中的关键等级
  assert.equal(getScaleKeyByLevel(1), 'C')
  assert.equal(getScaleKeyByLevel(6), 'A')
  assert.equal(getScaleKeyByLevel(12), 'F♯')
}

// ============== TR-3.2: 和弦题正确答案与 getMajorTriad 一致 ==============
{
  for (let level = 1; level <= 3; level++) {
    const pool = getChordRootsByLevel(level)
    const questions = Array.from({ length: 80 }, () => generateChordQuestion({ level }))

    for (const q of questions) {
      assert.equal(q.type, 'chord')
      assert.ok(pool.includes(q.root), `L${level} 根音 ${q.root} 应在根音池中`)
      assert.equal(q.id, `chord:${q.root}`)
      assert.equal(q.chordLabel, `${q.root} 大三和弦`)

      const expected = getMajorTriad(q.root).map((t) => t.name)
      // correctNotes 与 getMajorTriad 音名数组完全一致
      assert.deepEqual(q.correctNotes, expected,
        `${q.root} 和弦 correctNotes 应与 getMajorTriad 一致`)
      // correctIndex 指向的选项即正确答案
      assert.deepEqual(q.options[q.correctIndex].notes, expected,
        `${q.root} 和弦 correctIndex 应指向正确选项`)
      // 正确选项音程解析来自 getMajorTriad
      assert.deepEqual(
        q.intervals.map((t) => t.interval),
        ['根音', '大三度', '纯五度'],
        `${q.root} 和弦音程解析应为 根音/大三度/纯五度`)
      assert.deepEqual(q.intervals.map((t) => t.name), expected)
      // 解析文案包含三个音名
      for (const name of expected) {
        assert.ok(q.explanation.includes(name),
          `${q.root} 和弦解析应包含音名 ${name}`)
      }
    }
  }
}

// ============== TR-3.3: 干扰项两两不同、策略覆盖、选项合法 ==============
{
  const N = 200
  const questions = Array.from({ length: N }, () => generateChordQuestion({ level: 3 }))
  const strategyOccurred = new Set()

  for (const q of questions) {
    assert.equal(q.options.length, 4, '和弦题应有 4 个选项')
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4)

    // 4 个选项两两音符集合不同（排序后比较）
    const keys = q.options.map((o) => o.notes.slice().sort().join('|'))
    assert.equal(new Set(keys).size, 4,
      `${q.root} 和弦题 4 个选项应两两不重复`)

    // 每题 3 个干扰项应分别来自 3 种不同策略
    const distractorStrategies = q.options
      .filter((o) => o.strategy !== 'correct')
      .map((o) => o.strategy)
    assert.equal(distractorStrategies.length, 3)
    assert.deepEqual(
      distractorStrategies.slice().sort(),
      CHORD_DISTRACTOR_STRATEGIES.slice().sort(),
      `${q.root} 和弦题 3 个干扰项应覆盖 adjacent/minor/interval 三种策略`)
    distractorStrategies.forEach((s) => strategyOccurred.add(s))

    for (const opt of q.options) {
      assert.equal(opt.notes.length, 3, '每个和弦选项应有 3 个音')
      assert.equal(opt.text, opt.notes.join(' · '), 'text 应由音名拼接')

      // 音名合法性：全部能在半音体系中找到
      for (const note of opt.notes) {
        assert.ok(NOTE_TO_POSITION[note] !== undefined,
          `音名 ${note} 应是合法的半音体系拼写（${q.root} 题，策略 ${opt.strategy}）`)
      }

      // 音名按音高从低到高排列（相对最低音的半音偏移严格递增）
      const offsets = opt.notes.map((n) => semitoneDistance(opt.notes[0], n))
      assert.equal(offsets[0], 0)
      assert.ok(offsets[1] > 0 && offsets[2] > offsets[1],
        `${q.root} 题选项 ${opt.text} 应按半音位置从低到高排序`)
    }

    // 小三变体：三音确为根音 +3 半音、五音为 +7 半音
    const minorOpt = q.options.find((o) => o.strategy === DISTRACTOR_MINOR)
    assert.ok(minorOpt, '每题应有 minor 策略干扰项')
    assert.equal(minorOpt.notes[0], q.root, '小三变体低音应为根音')
    assert.equal(semitoneDistance(q.root, minorOpt.notes[1]), 3,
      '小三变体三音应为根音 +3 半音')
    assert.equal(semitoneDistance(q.root, minorOpt.notes[2]), 7,
      '小三变体五音应为根音 +7 半音')
    // 小三变体拼写必须与 getMinorTriad 严格一致（三度叠置，如 C 小三 = C E♭ G）
    assert.deepEqual(minorOpt.notes, getMinorTriad(q.root).map((t) => t.name),
      `${q.root} 小三变体拼写应与 getMinorTriad 一致（三度叠置原则）`)

    // 相邻根音变体：低音（根音）必须不同于题目根音
    const adjOpt = q.options.find((o) => o.strategy === DISTRACTOR_ADJACENT)
    assert.ok(adjOpt, '每题应有 adjacent 策略干扰项')
    assert.notEqual(adjOpt.notes[0], q.root, '相邻根音变体的根音应不同')
    // 且其本身必须是一个合法的大三和弦（4/7 半音结构）
    assert.equal(semitoneDistance(adjOpt.notes[0], adjOpt.notes[1]), 4)
    assert.equal(semitoneDistance(adjOpt.notes[0], adjOpt.notes[2]), 7)

    // 音程错误变体：根音相同但整体音程结构不同于大三和弦
    const intOpt = q.options.find((o) => o.strategy === DISTRACTOR_INTERVAL)
    assert.ok(intOpt, '每题应有 interval 策略干扰项')
    assert.equal(intOpt.notes[0], q.root, '音程错误变体低音应为根音')
    const isMajorTriad =
      semitoneDistance(q.root, intOpt.notes[1]) === 4 &&
      semitoneDistance(q.root, intOpt.notes[2]) === 7
    assert.ok(!isMajorTriad, '音程错误变体不应恰好是大三和弦')
  }

  // 200 题样本中三类策略都应出现
  for (const s of CHORD_DISTRACTOR_STRATEGIES) {
    assert.ok(strategyOccurred.has(s), `样本中应出现过干扰项策略 ${s}`)
  }
}

// ============== TR-3.4: 错题强化权重 ==============
{
  // 音级题：错题 'scale:C:3'（C 大调 III 级 = E）加权后出现率应显著提高
  {
    const N = 200
    const wrong = Array.from({ length: 100 }, () => ({ id: 'scale:C:3' }))
    const questions = Array.from({ length: N },
      () => generateScaleQuestion({ level: 1, wrongQuestions: wrong }))
    const hit = questions.filter((q) => q.promptNote === 'E').length
    const ratio = hit / N
    assert.ok(ratio > 0.35,
      `加权后 C 大调 III 级(E) 出现率 ${ratio.toFixed(2)} 应 > 0.35（无权重约 0.14）`)
  }

  // 和弦题：错题 'chord:C' 加权后根音 C 出现率 > 50%
  {
    const N = 200
    const wrong = Array.from({ length: 100 }, () => ({ id: 'chord:C' }))
    const questions = Array.from({ length: N },
      () => generateChordQuestion({ level: 1, wrongQuestions: wrong }))
    const hit = questions.filter((q) => q.root === 'C').length
    const ratio = hit / N
    assert.ok(ratio > 0.5,
      `加权后根音 C 出现率 ${ratio.toFixed(2)} 应 > 0.5（L1 无权重约 0.33）`)
  }

  // 错题记录为字符串 id 形态时同样生效
  {
    const picked = pickWeighted(
      [{ id: 'a' }, { id: 'b' }],
      ['b'],
      'id'
    )
    // 统计层面验证：1000 次抽取中 b 占比应接近 0.75（0.5 + 0.5*0.5）
    let bCount = 0
    for (let i = 0; i < 1000; i++) {
      if (pickWeighted([{ id: 'a' }, { id: 'b' }], ['b'], 'id').id === 'b') bCount++
    }
    assert.ok(bCount > 600, `字符串形态错题权重应生效，b 命中 ${bCount}/1000`)
    assert.ok(picked.id === 'a' || picked.id === 'b')
  }
}

// ============== 边界：自定义调式 / 自定义根音 ==============
{
  // customKeys=['C','G']：音级题只出现 C/G
  {
    const questions = Array.from({ length: 100 },
      () => generateScaleQuestion({ level: 12, customKeys: ['C', 'G'] }))
    assert.ok(questions.every((q) => q.keyName === 'C' || q.keyName === 'G'),
      'customKeys=[C,G] 时只应出现 C/G 大调')
    const keys = new Set(questions.map((q) => q.keyName))
    assert.equal(keys.size, 2, '100 题中 C 与 G 都应出现过')
  }

  // customRoots=['F']：和弦题根音全为 F
  {
    const questions = Array.from({ length: 100 },
      () => generateChordQuestion({ level: 3, customRoots: ['F'] }))
    assert.ok(questions.every((q) => q.root === 'F'),
      'customRoots=[F] 时根音应全部为 F')
    for (const q of questions) {
      assert.deepEqual(q.correctNotes, ['F', 'A', 'C'])
    }
  }

  // ASCII 写法的自定义输入应被归一化（Bb -> B♭）
  {
    const questions = Array.from({ length: 20 },
      () => generateChordQuestion({ level: 3, customRoots: ['Bb'] }))
    assert.ok(questions.every((q) => q.root === 'B♭'),
      "customRoots=['Bb'] 应归一化为 B♭")
  }
}

// ============== prevQuestionId：尽量避免与上一题完全相同 ==============
{
  let prevId = null
  for (let i = 0; i < 200; i++) {
    const q = generateScaleQuestion({ level: 1, prevQuestionId: prevId })
    assert.notEqual(q.id, prevId, '音级题不应与上一题 id 完全相同')
    prevId = q.id
  }
  prevId = null
  for (let i = 0; i < 200; i++) {
    const q = generateChordQuestion({ level: 1, prevQuestionId: prevId })
    assert.notEqual(q.id, prevId, '和弦题不应与上一题 id 完全相同')
    prevId = q.id
  }
}

// ============== 统一入口 generateQuestion 分发 ==============
{
  const sq = generateQuestion({ type: 'scale', level: 1 })
  assert.equal(sq.type, 'scale')
  assert.equal(sq.keyName, 'C')

  const cq = generateQuestion({ type: 'chord', level: 1 })
  assert.equal(cq.type, 'chord')
  assert.ok(getChordRootsByLevel(1).includes(cq.root))

  const circleQ = generateQuestion({ type: 'circle', level: 1 })
  assert.equal(circleQ.type, 'circle')

  assert.throws(() => generateQuestion({ type: 'unknown' }), /Unknown question type/)
}

// ============== 五度圈题：批量结构校验（200 题 × L1/L2） ==============
for (const level of [1, 2]) {
  const pool = getCircleNotesByLevel(level)
  const questions = Array.from({ length: 200 }, () => generateCircleQuestion({ level }))

  for (const q of questions) {
    // 基本结构
    assert.equal(q.type, 'circle')
    assert.equal(q.id, `circle:${q.center}`)
    assert.ok(pool.includes(q.center), `L${level} 中心音 ${q.center} 应在等级音池内`)

    // options：6 个两两不同的音，不含中心音
    assert.equal(q.options.length, 6, '五度圈题应有 6 个选项')
    assert.equal(new Set(q.options).size, 6, '6 个选项应两两不同')
    assert.ok(!q.options.includes(q.center), '选项不应包含中心音')

    // 全部降号拼写，无升号
    for (const n of q.options) {
      assert.ok(!n.includes('♯'), `选项 ${n} 不应含升号`)
    }

    // slots：左=下行五度，右=上行五度
    const { up, down } = getFifthNeighbors(q.center)
    assert.equal(q.slots[0].side, 'left')
    assert.equal(q.slots[0].direction, '下行五度')
    assert.equal(q.slots[0].answer, down, '左空答案应为下行五度')
    assert.equal(q.slots[1].side, 'right')
    assert.equal(q.slots[1].direction, '上行五度')
    assert.equal(q.slots[1].answer, up, '右空答案应为上行五度')

    // correctIndices 指向 options 中正确答案
    const [leftIdx, rightIdx] = q.correctIndices
    assert.equal(q.options[leftIdx], down, 'correctIndices[0] 应指向下行五度音')
    assert.equal(q.options[rightIdx], up, 'correctIndices[1] 应指向上行五度音')
    assert.notEqual(leftIdx, rightIdx, '两个正确答案位置不应相同')

    // 干扰项必含两个两步外音
    const up2 = stepAlongCircle(q.center, 2)
    const down2 = stepAlongCircle(q.center, -2)
    assert.ok(q.options.includes(up2), `选项应包含上行两步外音 ${up2}（中心 ${q.center}）`)
    assert.ok(q.options.includes(down2), `选项应包含下行两步外音 ${down2}（中心 ${q.center}）`)

    // explanation 含两个正确音名
    assert.ok(q.explanation.includes(up) && q.explanation.includes(down),
      'explanation 应包含上下五度两个音名')
  }

  // 中心音应覆盖音池（200 题随机性足够覆盖）
  const centers = new Set(questions.map((q) => q.center))
  for (const n of pool) {
    assert.ok(centers.has(n), `L${level} 200 题中应覆盖中心音 ${n}`)
  }
}

// ============== 五度圈题：customNotes / 错题加权 / 避免重复 ==============
{
  // customNotes 限定中心音
  const onlyC = Array.from({ length: 30 }, () => generateCircleQuestion({ customNotes: ['C'] }))
  assert.ok(onlyC.every((q) => q.center === 'C'), 'customNotes=[C] 时中心音应恒为 C')

  // ASCII 降号输入归一化（Bb -> B♭）
  const onlyBb = Array.from({ length: 20 },
    () => generateCircleQuestion({ customNotes: ['Bb'] }))
  assert.ok(onlyBb.every((q) => q.center === 'B♭'), "customNotes=['Bb'] 应归一化为 B♭")

  // 错题加权：boostProbability=1 时只出错过的中心音
  const boosted = Array.from({ length: 30 }, () =>
    generateCircleQuestion({ level: 2, wrongQuestions: ['circle:B♭'], boostProbability: 1 }))
  assert.ok(boosted.every((q) => q.center === 'B♭'),
    'boostProbability=1 且错题含 circle:B♭ 时中心音应恒为 B♭')

  // 错题对象形态（含 center 字段）也应识别
  const boostedObj = Array.from({ length: 20 }, () =>
    generateCircleQuestion({
      level: 2,
      wrongQuestions: [{ id: 'wrong:circle:A♭:1', questionId: 'circle:A♭', center: 'A♭' }],
      boostProbability: 1,
    }))
  assert.ok(boostedObj.every((q) => q.center === 'A♭'),
    '错题对象形态（questionId circle:A♭）应被加权识别')

  // prevQuestionId：不与上一题连续重复
  let prevId = null
  for (let i = 0; i < 200; i++) {
    const q = generateCircleQuestion({ level: 2, prevQuestionId: prevId })
    assert.notEqual(q.id, prevId, '五度圈题不应与上一题 id 完全相同')
    prevId = q.id
  }
}

console.log('All quiz tests passed!')
