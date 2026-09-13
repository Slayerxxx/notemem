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
 * - 五度圈题（circle）：
 *   · 固定等级模式从 getCircleNotesByLevel（L1 白键 7 音 / L2 全 12 音）随机
 *     选中心音，自定义模式从 customNotes 随机；候选 id 为 `circle:<中心音>`。
 *   · 两空答案：左空 = 下行五度（逆时针，+5 半音），右空 = 上行五度
 *     （顺时针，+7 半音），均降号拼写。
 *   · 选项共 6 个音：2 个正确答案 + 2 个「两步外」音（顺/逆时针各再走一步）
 *     + 2 个其余随机音；两两不同且不含中心音，顺序随机打乱。
 * - 错题强化：候选题在错题本中出现过时，以 WRONG_BOOST_PROBABILITY（50%）
 *   的概率优先从错题相关候选中抽取，否则正常随机。
 *     · 音级题候选粒度：调内 7 个音级；
 *     · 和弦题候选粒度：根音；
 *     · 五度圈题候选粒度：中心音。
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
  getCircleNotesByLevel,
  getFifthNeighbors,
  stepAlongCircle,
  toFlatName,
  CIRCLE_NOTES_FLAT,
  getProgressionPoolByLevel,
  hashProgression,
  progressionQuestionId,
  buildProgressionPrompt,
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
 * 错题元素支持三种形态：
 * - 字符串题目 id（如 'scale:C:3'）；
 * - 简写对象 { id: 题目id }；
 * - 完整错题记录 { id: 错题记录id('wrong:...'), questionId: 题目id }。
 * 完整记录中题目 id 在 questionId 字段，故优先取 questionId，回退 id。
 * @param {Array<string|{id?: string, questionId?: string}>} wrongQuestions
 * @returns {string[]}
 */
function extractWrongIds(wrongQuestions) {
  if (!Array.isArray(wrongQuestions)) return []
  return wrongQuestions
    .map((w) => {
      if (w == null) return null
      if (typeof w === 'string') return w
      return w.questionId ?? w.id ?? null
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

// ============== 五度圈题 ==============

/**
 * 解析五度圈题中心音池：自定义模式用 customNotes，否则用等级音池。
 * @returns {string[]}
 */
function resolveNotePool(customNotes, level) {
  if (Array.isArray(customNotes) && customNotes.length > 0) {
    // 统一转降号拼写：五度圈模块所有音名一律用降号显示（如 F# → G♭）
    return customNotes.map(toFlatName)
  }
  return getCircleNotesByLevel(level)
}

/**
 * 生成一道五度圈题。
 * @param {object} config
 * @param {number} [config.level=1] 难度等级 1-2（固定等级模式）
 * @param {string[]|null} [config.customNotes] 自定义中心音数组（非空时启用）
 * @param {Array<string|object>} [config.wrongQuestions] 错题记录（错题强化）
 * @param {string|null} [config.prevQuestionId] 上一题 id（尽量避免连续重复）
 * @returns {object} 题目对象：
 *   { id, type:'circle', center, slots:[左/右], options(6 音名),
 *     correctIndices:[leftIdx, rightIdx], explanation }
 */
export function generateCircleQuestion({
  level = 1,
  customNotes = null,
  wrongQuestions = [],
  prevQuestionId = null,
  boostProbability = WRONG_BOOST_PROBABILITY,
} = {}) {
  // 1. 确定中心音（候选粒度：中心音），错题加权抽取
  const pool = resolveNotePool(customNotes, level)
  const candidates = pool.map((n) => ({ id: `circle:${n}`, center: n }))
  const picked = pickWeighted(
    candidates,
    wrongQuestions,
    (item) => item.id,
    prevQuestionId,
    boostProbability
  )
  const center = picked.center

  // 2. 正确答案：左空 = 下行五度（逆时针），右空 = 上行五度（顺时针）
  const { up, down } = getFifthNeighbors(center)
  // 两步外音（顺/逆时针各再走一步），必入干扰项
  const up2 = stepAlongCircle(center, 2)
  const down2 = stepAlongCircle(center, -2)

  // 3. 其余干扰音：从 12 音中排除中心音/答案/两步外音后随机选 2 个
  const excluded = new Set([center, up, down, up2, down2])
  const rest = CIRCLE_NOTES_FLAT.filter((n) => !excluded.has(n))
  const extras = shuffle(rest).slice(0, 2)

  // 4. 6 个选项打乱并记录两个正确答案位置
  const options = shuffle([down, up, up2, down2, extras[0], extras[1]])
  const leftIdx = options.indexOf(down)
  const rightIdx = options.indexOf(up)

  return {
    id: `circle:${center}`,
    type: 'circle',
    center,
    slots: [
      { side: 'left', direction: '下行五度', answer: down },
      { side: 'right', direction: '上行五度', answer: up },
    ],
    options,
    correctIndices: [leftIdx, rightIdx],
    explanation: `${center} 的上行五度是 ${up}，下行五度是 ${down}`,
  }
}

// ============== 和弦进行题 ==============

/** 进行题干扰项策略标记 */
export const DISTRACTOR_SWAP = 'swap'
export const DISTRACTOR_REPLACE = 'replace'
export const DISTRACTOR_OTHER = 'other'

/** 罗马数字序列选项连接符（展示用，如 `I · V · vi · IV`） */
export const PROGRESSION_OPTION_SEP = ' · '

/**
 * 解析错题模式下的进行错题范围（mode+key+tokenHash 三元组集合）。
 * 支持对象 { mode, key, tokenHash }、题目 id 字符串
 * `progression:<mode>:<key>:<tokenHash>` 与完整错题记录。
 * @param {Array<object|string>} customProgressions
 * @returns {Set<string>} 题目 id 集合
 */
function extractProgressionScope(customProgressions) {
  const ids = new Set()
  for (const w of customProgressions ?? []) {
    if (w == null) continue
    if (typeof w === 'string') {
      if (w.startsWith('progression:')) ids.add(w)
      continue
    }
    if (w.mode && w.key && w.tokenHash) {
      ids.add(progressionQuestionId(w))
    } else {
      const raw = w.questionId ?? w.id
      if (typeof raw === 'string' && raw.startsWith('progression:')) ids.add(raw)
    }
  }
  return ids
}

/**
 * 策略 1：相邻交换。对 tokens 随机交换一对相邻位置，返回新 token 数组；
 * 交换后序列与原序列相同（相邻为重复 token）时重试。
 * @returns {string[]|null}
 */
function buildSwapTokens(tokens) {
  const positions = shuffle(tokens.map((_, i) => i).slice(0, -1))
  for (const i of positions) {
    if (tokens[i] === tokens[i + 1]) continue
    const next = tokens.slice()
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    if (hashProgression(next) !== hashProgression(tokens)) return next
  }
  return null
}

/**
 * 策略 2：token 替换。替换 1-2 个位置为同难度池内其他合法 token，
 * 优先取另一条进行同位置的 token（保持节奏/和弦复杂度风格）。
 * @returns {string[]|null}
 */
function buildReplaceTokens(tokens, pool, correctHash) {
  // 同位置可选 token 表（来自池中其他记录），保证替换值合法
  const byPosition = tokens.map(() => new Set())
  for (const rec of pool) {
    rec.progressionTokens.forEach((t, i) => {
      if (i < byPosition.length && t !== tokens[i]) byPosition[i].add(t)
    })
  }
  const replaceable = byPosition
    .map((set, i) => ({ i, options: [...set] }))
    .filter((x) => x.options.length > 0)
  if (replaceable.length === 0) return null

  for (let attempt = 0; attempt < 12; attempt++) {
    const next = tokens.slice()
    const shuffled = shuffle(replaceable)
    const count = Math.min(shuffled.length, Math.random() < 0.5 ? 1 : 2)
    for (let k = 0; k < count; k++) {
      const { i, options } = shuffled[k]
      next[i] = options[randomInt(options.length)]
    }
    if (hashProgression(next) !== correctHash) return next
  }
  return null
}

/**
 * 生成一道和弦进行识别题。
 * @param {object} config
 * @param {number} [config.level=1] 难度等级 1-4
 * @param {object} config.manifest build-midi-manifest 生成的清单
 *   { major:[], minor:[], modal:[] }
 * @param {Array<string|object>} [config.wrongQuestions] 错题记录（错题强化）
 * @param {Array<object|string>} [config.customProgressions] 错题模式范围
 *   （mode/key/tokenHash 三元组），非空时只从该范围出题
 * @param {string|null} [config.prevQuestionId] 上一题 id（避免连续重复）
 * @returns {object} 题目对象：
 *   { id, type:'progression', mode, key, tokenHash, style, midiUrl,
 *     options(4 个序列字符串), correctIndex, promptText, correctAnswer,
 *     explanation, optionStrategies }
 */
export function generateProgressionQuestion({
  level = 1,
  manifest,
  wrongQuestions = [],
  customProgressions = null,
  prevQuestionId = null,
  boostProbability = WRONG_BOOST_PROBABILITY,
} = {}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('generateProgressionQuestion: 缺少 manifest')
  }

  // 1. 完整难度池（同难度内 mode 唯一、仅 baseline）——干扰项始终取自该池
  const levelPool = getProgressionPoolByLevel(level, manifest)

  // 2. 错题模式：正确答案限定在错题三元组集合内（干扰项仍取自完整难度池）
  const scopeIds =
    Array.isArray(customProgressions) && customProgressions.length > 0
      ? extractProgressionScope(customProgressions)
      : null
  let pickPool = levelPool
  if (scopeIds && scopeIds.size > 0) {
    const scoped = levelPool.filter((r) =>
      scopeIds.has(
        progressionQuestionId({ mode: r.mode, key: r.key, tokenHash: r.tokenHash })
      )
    )
    if (scoped.length > 0) pickPool = scoped
  }
  if (pickPool.length === 0) {
    throw new Error('generateProgressionQuestion: 当前难度候选池为空')
  }

  // 3. 候选粒度 progression:<mode>:<key>:<tokenHash>，错题加权抽 1 条
  const candidates = pickPool.map((r) => ({
    id: progressionQuestionId(r),
    record: r,
  }))
  const picked = pickWeighted(
    candidates,
    wrongQuestions,
    (item) => item.id,
    prevQuestionId,
    scopeIds && scopeIds.size > 0 ? 1 : boostProbability
  )
  const rec = picked.record
  const correctTokens = rec.progressionTokens
  const correctHash = rec.tokenHash
  const correctAnswer = correctTokens.join(PROGRESSION_OPTION_SEP)

  // 4. 生成干扰项，按 tokenHash 去重
  const usedHashes = new Set([correctHash])
  /** @type {Array<{tokens:string[], strategy:string}>} */
  const distractorBuilders = []

  const swap = buildSwapTokens(correctTokens)
  if (swap) distractorBuilders.push({ tokens: swap, strategy: DISTRACTOR_SWAP })

  const replace = buildReplaceTokens(correctTokens, levelPool, correctHash)
  if (replace) {
    distractorBuilders.push({ tokens: replace, strategy: DISTRACTOR_REPLACE })
  }

  // 策略 3：同难度池内 tokenHash 不同的其他进行
  const otherPool = levelPool.filter(
    (r) =>
      r.tokenHash !== correctHash &&
      // 也排除与前两种干扰序列同 hash 的记录
      !distractorBuilders.some(
        (d) => hashProgression(d.tokens) === r.tokenHash
      )
  )
  const shuffledOthers = shuffle(otherPool)

  // 5. 凑齐 3 个两两不同的干扰项（必要时用其他进行兜底）
  const distractors = []
  for (const builder of distractorBuilders) {
    const h = hashProgression(builder.tokens)
    if (!usedHashes.has(h)) {
      usedHashes.add(h)
      distractors.push({
        text: builder.tokens.join(PROGRESSION_OPTION_SEP),
        strategy: builder.strategy,
      })
    }
  }
  for (const other of shuffledOthers) {
    if (distractors.length >= 3) break
    if (!usedHashes.has(other.tokenHash)) {
      usedHashes.add(other.tokenHash)
      distractors.push({
        text: other.progressionTokens.join(PROGRESSION_OPTION_SEP),
        strategy: DISTRACTOR_OTHER,
      })
    }
  }
  if (distractors.length < 3) {
    throw new Error('generateProgressionQuestion: 无法生成 3 个合法干扰项')
  }

  // 6. 4 选项打乱并记录正确位置
  const correctOption = { text: correctAnswer, strategy: 'correct' }
  const shuffledOptions = shuffle([correctOption, ...distractors.slice(0, 3)])
  const options = shuffledOptions.map((o) => o.text)
  const optionStrategies = shuffledOptions.map((o) => o.strategy)
  const correctIndex = options.indexOf(correctAnswer)

  return {
    id: progressionQuestionId(rec),
    type: 'progression',
    mode: rec.mode,
    key: rec.key,
    tokenHash: rec.tokenHash,
    style: rec.style,
    midiUrl: rec.url,
    options,
    correctIndex,
    optionStrategies,
    promptText: buildProgressionPrompt(rec.mode, rec.key),
    correctAnswer,
    explanation: `正确进行：${correctAnswer}`,
  }
}

// ============== 统一入口 ==============

/**
 * 统一题目生成入口，按 config.type 分发，便于后续扩展新题型。
 * @param {object} config 必须含 type: 'scale' | 'chord' | 'circle' | 'progression'
 * @returns {object} 题目对象
 */
export function generateQuestion(config = {}) {
  if (config.type === 'scale') return generateScaleQuestion(config)
  if (config.type === 'chord') return generateChordQuestion(config)
  if (config.type === 'circle') return generateCircleQuestion(config)
  if (config.type === 'progression') return generateProgressionQuestion(config)
  throw new Error(`Unknown question type: ${config.type}`)
}
