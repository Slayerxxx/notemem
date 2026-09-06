/**
 * generator.js
 * 题目生成器：音级题（scale）与和弦题（chord）的纯函数生成逻辑
 *
 * 出题规则：
 * - 音级题（scale）：
 *   · 固定等级模式下，每个等级只练一个调（getScaleKeyByLevel），
 *     绝不混合多个调；自定义模式从 customKeys 调名数组中随机选调。
 *   · 从该调 7 个音级中随机选 1 个音名作为提问对象，
 *     选项固定为 I-VII（数据中用 degree 1-7），正确答案为该音名对应的音级。
 *   · 题目稳定唯一 id：`scale:${调}:${音级}`，供错题强化使用。
 * - 和弦题（chord）：
 *   · 从等级根音池（getChordRootsByLevel）或 customRoots 中随机选根音，
 *     正确答案为该根音的大三和弦（getMajorTriad，从低到高排列）。
 *   · 另生成 3 个干扰项，共 4 个选项后随机打乱：
 *     1) adjacent 相邻根音大三和弦：CHORD_ROOTS 中前/后相邻，
 *        或五度圈相邻（上方纯五 +7 / 下方纯五 +5 半音）的大三和弦；
 *     2) minor    同根音小三和弦变体：根音 + 小三度(+3) + 纯五度(+7)；
 *     3) interval 同根音音程错误组合：如三音换大二度(+2)、
 *        五音换大六度(+9)、减五度(+6) 等，音名合法且与正确答案不同。
 *   · 4 个选项两两不重复（音符集合不同），干扰项尽量来自不同策略。
 * - 错题强化：候选题在错题本中出现过时，以 WRONG_BOOST_PROBABILITY（50%）
 *   的概率优先从错题相关候选中抽取，否则正常随机。
 *     · 音级题候选粒度：调内 7 个音级；
 *     · 和弦题候选粒度：根音。
 * - 全部为纯函数、无副作用、无 Vue 依赖；随机仅使用 Math.random。
 */

import {
  getMajorScale,
  getNoteByDegree,
  normalizeNoteName,
  NOTE_TO_POSITION,
  getMajorTriad,
  getMinorTriad,
  spellChordTone,
  CHORD_ROOTS,
  getScaleKeyByLevel,
  getChordRootsByLevel,
} from '../music/index.js'

// ============== 通用常量与工具 ==============

/** 音级 1-7 对应的罗马数字 */
export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/**
 * 音级数字转罗马数字。
 * @param {number} degree 1-7
 * @returns {string} 'I' - 'VII'
 */
export function degreeToRoman(degree) {
  const d = Number(degree)
  if (!Number.isInteger(d) || d < 1 || d > 7) {
    throw new Error(`Invalid degree for roman numeral: ${degree}`)
  }
  return ROMAN_NUMERALS[d - 1]
}

/** 错题强化时，从错题相关候选中抽取的概率 */
export const WRONG_BOOST_PROBABILITY = 0.5

/** 干扰项策略标记：相邻根音大三和弦 */
export const DISTRACTOR_ADJACENT = 'adjacent'
/** 干扰项策略标记：同根音小三和弦变体 */
export const DISTRACTOR_MINOR = 'minor'
/** 干扰项策略标记：同根音音程错误组合 */
export const DISTRACTOR_INTERVAL = 'interval'

/** 和弦题全部干扰项策略（便于测试做覆盖率统计） */
export const CHORD_DISTRACTOR_STRATEGIES = [
  DISTRACTOR_ADJACENT,
  DISTRACTOR_MINOR,
  DISTRACTOR_INTERVAL,
]

/** [0, n) 随机整数 */
function randomInt(n) {
  return Math.floor(Math.random() * n)
}

/** Fisher-Yates 洗牌，返回新数组 */
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/**
 * 从错题记录中提取题目 id 集合。
 * 错题元素支持两种形态：字符串 id，或带 id/questionId 字段的对象。
 * @param {Array<string|{id?: string, questionId?: string}>} wrongQuestions
 * @returns {string[]}
 */
function extractWrongIds(wrongQuestions) {
  if (!Array.isArray(wrongQuestions)) return []
  return wrongQuestions
    .map((w) => {
      if (w == null) return null
      if (typeof w === 'string') return w
      return w.id ?? w.questionId ?? null
    })
    .filter(Boolean)
}

/**
 * 错题加权随机抽取。
 * 逻辑：候选中「id 出现在错题本」的条目权重提高——
 * 以 boostProbability 的概率只从错题候选中均匀抽取，
 * 否则从全部候选中均匀抽取。
 *
 * @param {Array<object>} items 候选数组
 * @param {Array<string|object>} wrongQuestions 错题记录
 * @param {string|((item: object) => string)} [idKey] 取 id 的字段名或函数
 * @param {string|null} [excludeId] 需要排除的 id（如避免与上一题重复）
 * @param {number} [boostProbability] 优先抽取错题的概率（0-1），
 *   默认 WRONG_BOOST_PROBABILITY(0.5)；错题模式可传 1 表示只从错题出题
 * @returns {object} 被抽中的候选
 */
export function pickWeighted(
  items,
  wrongQuestions,
  idKey = 'id',
  excludeId = null,
  boostProbability = WRONG_BOOST_PROBABILITY
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('pickWeighted: items 不能为空')
  }
  const getId = typeof idKey === 'function' ? idKey : (item) => item?.[idKey]
  const wrongIds = new Set(extractWrongIds(wrongQuestions))

  // 排除上一题（若排除后为空则仍用完整候选池）
  const pool = excludeId != null
    ? items.filter((it) => getId(it) !== excludeId)
    : items
  const effective = pool.length > 0 ? pool : items

  const wrongItems = effective.filter((it) => wrongIds.has(getId(it)))
  if (wrongItems.length > 0 && Math.random() < boostProbability) {
    return wrongItems[randomInt(wrongItems.length)]
  }
  return effective[randomInt(effective.length)]
}

// ============== 音名拼写 ==============
// 和弦音名拼写统一使用 music 模块的 spellChordTone（三度叠置原则），
// 保证 C 小三 = C-E♭-G（而非等音 C-D♯-G）等严格乐理写法。

// ============== 音级题 ==============

/**
 * 生成一道音级题。
 * @param {object} config
 * @param {number} [config.level] 难度等级 1-12（固定等级模式）
 * @param {string[]|null} [config.customKeys] 自定义调名数组（非空时启用自定义模式）
 * @param {Array<string|object>} [config.wrongQuestions] 错题记录（错题强化）
 * @param {string|null} [config.prevQuestionId] 上一题 id（尽量避免连续重复）
 * @returns {object} 题目对象
 */
export function generateScaleQuestion({
  level = 1,
  customKeys = null,
  wrongQuestions = [],
  prevQuestionId = null,
  boostProbability = WRONG_BOOST_PROBABILITY,
} = {}) {
  // 1. 确定调：自定义模式从 customKeys 随机选；否则等级对应唯一调
  let key
  if (Array.isArray(customKeys) && customKeys.length > 0) {
    const keys = customKeys.map(normalizeNoteName)
    key = keys[randomInt(keys.length)]
  } else {
    key = getScaleKeyByLevel(level)
  }

  // 2. 候选粒度：该调 7 个音级
  const scale = getMajorScale(key)
  const candidates = scale.map((n) => ({
    id: `scale:${key}:${n.degree}`,
    name: n.name,
    degree: n.degree,
  }))

  // 3. 错题加权抽取（同时避免与上一题完全相同）
  const picked = pickWeighted(
    candidates,
    wrongQuestions,
    (item) => item.id,
    prevQuestionId,
    boostProbability
  )

  const degree = picked.degree
  const noteName = picked.name

  return {
    id: `scale:${key}:${degree}`,
    type: 'scale',
    keyName: key,
    promptNote: noteName,
    options: [1, 2, 3, 4, 5, 6, 7], // 固定 7 个音级选项
    correctIndex: degree - 1, // 0-based
    degree,
    explanation: `${key} 大调第 ${degreeToRoman(degree)} 级是 ${noteName}`,
  }
}

// ============== 和弦题 ==============

/**
 * 解析和弦题根音池：自定义模式用 customRoots，否则用等级根音池。
 * @returns {string[]}
 */
function resolveRootPool(customRoots, level) {
  if (Array.isArray(customRoots) && customRoots.length > 0) {
    return customRoots.map(normalizeNoteName)
  }
  return getChordRootsByLevel(level)
}

/** 选项去重键：音符集合（排序后比较） */
function optionKey(option) {
  return option.notes.slice().sort().join('|')
}

/**
 * 由 {name, offset} 数组构造选项：offset 为相对根音的半音距离，
 * 按 offset 升序即得到从低到高的音名排列。
 */
function makeOption(noteOffsets, strategy) {
  const sorted = noteOffsets.slice().sort((a, b) => a.offset - b.offset)
  const notes = sorted.map((n) => n.name)
  return {
    notes,
    text: notes.join(' · '),
    strategy,
  }
}

/**
 * 策略 1：相邻根音大三和弦。
 * 相邻定义：CHORD_ROOTS 中前/后位置，或五度圈相邻（±7 半音）。
 * @returns {object} 选项
 */
function buildAdjacentOption(root) {
  const neighbors = new Set()
  const idx = CHORD_ROOTS.indexOf(root)
  if (idx >= 0) {
    neighbors.add(CHORD_ROOTS[(idx - 1 + CHORD_ROOTS.length) % CHORD_ROOTS.length])
    neighbors.add(CHORD_ROOTS[(idx + 1) % CHORD_ROOTS.length])
  }
  // 五度圈相邻：上方纯五 (+7) 与下方纯五 (-7，即 +5)
  const rootPos = NOTE_TO_POSITION[root]
  for (const target of [(rootPos + 7) % 12, (rootPos + 5) % 12]) {
    const found = CHORD_ROOTS.find((r) => NOTE_TO_POSITION[r] === target)
    if (found) neighbors.add(found)
  }
  neighbors.delete(root)

  const neighbor = [...neighbors][randomInt(neighbors.size)]
  const triad = getMajorTriad(neighbor)
  // getMajorTriad 按 根音/大三度/纯五度（offset 0/4/7）从低到高返回
  const offsets = [0, 4, 7]
  return makeOption(
    triad.map((t, i) => ({ name: t.name, offset: offsets[i] })),
    DISTRACTOR_ADJACENT
  )
}

/**
 * 策略 2：同根音小三和弦变体。
 * 根音 + 小三度(+3 半音) + 纯五度(+7 半音)，由 getMinorTriad 按
 * 三度叠置原则拼写（如 C 小三 = C-E♭-G）。
 * @returns {object} 选项
 */
function buildMinorOption(root) {
  const triad = getMinorTriad(root)
  const offsets = [0, 3, 7]
  return makeOption(
    triad.map((t, i) => ({ name: t.name, offset: offsets[i] })),
    DISTRACTOR_MINOR
  )
}

/**
 * 策略 3：同根音音程错误组合。
 * 随机选用一种错误音程搭配，音名通过 spellChordTone 按叠置字母拼写，
 * 保证乐理书写规范（如减五度拼写为 G♭ 而非等音 F♯）。
 * semi 为相对根音的半音距离，letter 为音名字母步数
 * （二度=1、三度=2、四度=3、五度=4、六度=5）。
 * @returns {object} 选项
 */
const INTERVAL_ERROR_PRESETS = [
  { thirdSemi: 2, thirdLetter: 1, fifthSemi: 7, fifthLetter: 4 }, // 三音换成大二度
  { thirdSemi: 4, thirdLetter: 2, fifthSemi: 9, fifthLetter: 5 }, // 五音换成大六度
  { thirdSemi: 3, thirdLetter: 2, fifthSemi: 6, fifthLetter: 4 }, // 减三和弦（小三度+减五度）
  { thirdSemi: 2, thirdLetter: 1, fifthSemi: 9, fifthLetter: 5 }, // 二度+六度
  { thirdSemi: 5, thirdLetter: 3, fifthSemi: 7, fifthLetter: 4 }, // 三音换成纯四度
  { thirdSemi: 4, thirdLetter: 2, fifthSemi: 6, fifthLetter: 4 }, // 大三度+减五度
]

function buildIntervalErrorOption(root) {
  const preset = INTERVAL_ERROR_PRESETS[randomInt(INTERVAL_ERROR_PRESETS.length)]
  return makeOption(
    [
      { name: root, offset: 0 },
      { name: spellChordTone(root, preset.thirdSemi, preset.thirdLetter), offset: preset.thirdSemi },
      { name: spellChordTone(root, preset.fifthSemi, preset.fifthLetter), offset: preset.fifthSemi },
    ],
    DISTRACTOR_INTERVAL
  )
}

/**
 * 生成一道和弦题。
 * @param {object} config
 * @param {number} [config.level] 难度等级 1-3（固定等级模式）
 * @param {string[]|null} [config.customRoots] 自定义根音数组（非空时启用自定义模式）
 * @param {Array<string|object>} [config.wrongQuestions] 错题记录（错题强化）
 * @param {string|null} [config.prevQuestionId] 上一题 id（尽量避免连续重复）
 * @returns {object} 题目对象
 */
export function generateChordQuestion({
  level = 1,
  customRoots = null,
  wrongQuestions = [],
  prevQuestionId = null,
  boostProbability = WRONG_BOOST_PROBABILITY,
} = {}) {
  // 1. 确定根音（候选粒度：根音），错题加权抽取
  const pool = resolveRootPool(customRoots, level)
  const candidates = pool.map((r) => ({ id: `chord:${r}`, root: r }))
  const picked = pickWeighted(
    candidates,
    wrongQuestions,
    (item) => item.id,
    prevQuestionId,
    boostProbability
  )
  const root = picked.root

  // 2. 正确答案：大三和弦（getMajorTriad 已按从低到高返回）
  const triad = getMajorTriad(root)
  const correctNotes = triad.map((t) => t.name)
  const correctOption = makeOption(
    triad.map((t, i) => ({ name: t.name, offset: [0, 4, 7][i] })),
    'correct'
  )

  // 3. 三种策略各生成 1 个干扰项，确保 4 个选项音符集合两两不同
  const usedKeys = new Set([optionKey(correctOption)])
  const builders = [buildAdjacentOption, buildMinorOption, buildIntervalErrorOption]
  const distractors = []
  for (const build of builders) {
    let option = null
    // 同策略多次尝试（相邻根音/错误音程均有随机性），跳过重复集合
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = build(root)
      if (!usedKeys.has(optionKey(candidate))) {
        option = candidate
        break
      }
    }
    // 兜底：极端情况下从任意策略补一个不重复选项
    if (!option) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const candidate = builders[randomInt(builders.length)](root)
        if (!usedKeys.has(optionKey(candidate))) {
          option = candidate
          break
        }
      }
    }
    if (option) {
      usedKeys.add(optionKey(option))
      distractors.push(option)
    }
  }

  // 4. 打乱选项顺序并记录正确答案位置
  const options = shuffle([correctOption, ...distractors])
  const correctIndex = options.findIndex((o) => optionKey(o) === optionKey(correctOption))

  const [rootNote, thirdNote, fifthNote] = triad

  return {
    id: `chord:${root}`,
    type: 'chord',
    root,
    chordLabel: `${root} 大三和弦`,
    options,
    correctIndex,
    correctNotes,
    intervals: triad.map((t) => ({ name: t.name, interval: t.interval })),
    explanation:
      `${root} 大三和弦：根音 ${rootNote.name}、` +
      `大三度 ${thirdNote.name}、纯五度 ${fifthNote.name}`,
  }
}

// ============== 统一入口 ==============

/**
 * 统一题目生成入口，按 config.type 分发，便于后续扩展新题型。
 * @param {object} config 必须含 type: 'scale' | 'chord'
 * @returns {object} 题目对象
 */
export function generateQuestion(config = {}) {
  if (config.type === 'scale') return generateScaleQuestion(config)
  if (config.type === 'chord') return generateChordQuestion(config)
  throw new Error(`Unknown question type: ${config.type}`)
}
