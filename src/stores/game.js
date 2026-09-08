/**
 * game.js
 * 游戏核心状态管理 Store（Pinia setup 风格）
 *
 * 职责：
 * - 单题流程状态机：idle → answering → feedback →（answering / finished）
 *   作答或超时后停留在 feedback 态，等待用户主动点击「下一题」，不自动跳转。
 * - 分数 / 连击 / 正确率 / 反应时长 / 错题记录等本轮统计。
 * - 计时管理：单题倒计时（100ms tick，驱动 UI 进度条）与限时模式总会话
 *   倒计时（1s tick）。计时器 id 存放在模块级普通变量中（非响应式），
 *   在 answer / timeout / finish / reset 时统一清理。
 *
 * 可测试性设计：
 * - 反应时间默认由 performance.now() 计算，answerQuestion 支持第二参
 *   reactionMs 注入（测试用），不依赖真实等待。
 * - 超时判定抽为 handleQuestionTimeout()、会话结束判定抽为
 *   handleSessionEnd()，测试可直接调用模拟超时/倒计时归零。
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { generateQuestion, degreeToRoman } from '../quiz/generator.js'
import { DEFAULT_TIME_LIMIT } from '../music/difficulty.js'

// ============== 模块级非响应式变量（不放入响应式 state） ==============

/** 单题倒计时 interval id（100ms tick） */
let questionTimerId = null
/** 限时模式总会话倒计时 interval id（1s tick） */
let sessionTimerId = null
/** 当前题目的开始时间戳（performance.now() 基准，毫秒） */
let questionStartTime = 0
/** 错题强化池（错题模式 start 时透传进来的错题记录，交给生成器加权） */
let wrongQuestionsPool = []
/** 错题记录自增序号，保证错题条目 id 唯一 */
let wrongRecordSeq = 0

/** 单题计时器 tick 间隔（毫秒） */
const QUESTION_TICK_MS = 100
/** 会话计时器 tick 间隔（毫秒） */
const SESSION_TICK_MS = 1000

/** 训练模式枚举 */
const TRAIN_MODES = ['time', 'count', 'wrong', 'custom']

/**
 * 从错题记录中提取涉及的调名（音级错题）、根音（和弦错题）或中心音（五度圈错题）。
 * 支持完整错题对象（含 keyName/root/center 或 questionId）与字符串 id 形态。
 * @param {Array} wrongQuestions
 * @param {'scale'|'chord'|'circle'} type
 * @returns {string[]}
 */
function extractScopeFromWrong(wrongQuestions, type) {
  const set = new Set()
  const prefix =
    type === 'scale' ? 'scale:' : type === 'chord' ? 'chord:' : 'circle:'
  for (const w of wrongQuestions ?? []) {
    if (w == null) continue
    if (typeof w === 'object') {
      if (type === 'scale' && w.keyName) {
        set.add(w.keyName)
        continue
      }
      if (type === 'chord' && w.root) {
        set.add(w.root)
        continue
      }
      if (type === 'circle' && w.center) {
        set.add(w.center)
        continue
      }
    }
    // 从 questionId / id / 字符串 id 中解析
    // （格式 'scale:调:音级'、'chord:根音' 或 'circle:中心音'）
    const raw = typeof w === 'string' ? w : (w.questionId ?? w.id ?? '')
    if (typeof raw === 'string' && raw.startsWith(prefix)) {
      const parts = raw.split(':')
      if (parts[1]) set.add(parts[1])
    }
  }
  return [...set]
}

export const useGameStore = defineStore('game', () => {
  // ============== State ==============

  /** 单题流程状态机：'idle' | 'answering' | 'feedback' | 'finished' */
  const phase = ref('idle')
  /** 训练配置（start 时写入，reset 后为 null） */
  const config = ref(null)
  /** 当前题目对象（来自 quiz/generator） */
  const currentQuestion = ref(null)
  /** 用户已选选项索引；null=未作答，-1=超时未答（scale/chord 单选题使用） */
  const selectedIndex = ref(null)
  /** 五度圈题两空作答结果 [左空选项索引, 右空选项索引]；null=该空未填 */
  const selectedSlots = ref([null, null])
  /** 上一题判定结果 { isCorrect, reactionMs, gainedScore } */
  const lastResult = ref(null)
  /** 本轮总分 */
  const score = ref(0)
  /** 当前连击数 */
  const combo = ref(0)
  /** 本轮最长连击 */
  const maxCombo = ref(0)
  /** 已答题数（含答错与超时） */
  const answeredCount = ref(0)
  /** 答对题数 */
  const correctCount = ref(0)
  /** 每题反应毫秒数（含答错/超时，超时记为整题限时） */
  const reactionTimes = ref([])
  /** 本轮错题记录 */
  const wrongItems = ref([])
  /** 限时模式剩余总秒数；非限时模式为 null */
  const sessionRemaining = ref(null)
  /** 当前单题剩余毫秒（供 UI 进度条） */
  const questionRemainingMs = ref(0)
  /** 上一题 id（传给生成器避免连续重复） */
  const prevQuestionId = ref(null)

  // ============== Getters ==============

  /** 本轮汇总数据 */
  const summary = computed(() => {
    const total = answeredCount.value
    const times = reactionTimes.value
    return {
      score: score.value,
      total,
      correct: correctCount.value,
      /** 正确率 0-1 */
      accuracy: total > 0 ? correctCount.value / total : 0,
      avgReactionMs:
        times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
      fastestReactionMs: times.length > 0 ? Math.min(...times) : null,
      wrongCount: wrongItems.value.length,
      maxCombo: maxCombo.value,
    }
  })

  /** 顶部进度文案：题量模式「已答 x/total」，限时模式「剩余 n 秒」 */
  const progressText = computed(() => {
    if (!config.value || phase.value === 'idle') return ''
    if (config.value.trainMode === 'time') {
      return `剩余 ${sessionRemaining.value ?? 0} 秒`
    }
    if (config.value.totalQuestions != null) {
      return `已答 ${answeredCount.value}/${config.value.totalQuestions}`
    }
    return `已答 ${answeredCount.value}`
  })

  // ============== 内部工具：计时器 ==============

  function stopQuestionTimer() {
    if (questionTimerId !== null) {
      clearInterval(questionTimerId)
      questionTimerId = null
    }
  }

  function stopSessionTimer() {
    if (sessionTimerId !== null) {
      clearInterval(sessionTimerId)
      sessionTimerId = null
    }
  }

  /** 启动单题倒计时：100ms tick 更新 questionRemainingMs，归零时自动判超时 */
  function startQuestionTimer() {
    stopQuestionTimer()
    questionStartTime = performance.now()
    questionRemainingMs.value = config.value.timeLimit * 1000
    questionTimerId = setInterval(() => {
      const elapsed = performance.now() - questionStartTime
      const remaining = config.value.timeLimit * 1000 - elapsed
      if (remaining <= 0) {
        questionRemainingMs.value = 0
        stopQuestionTimer() // 先清理 interval，避免重复触发
        handleQuestionTimeout()
        return
      }
      questionRemainingMs.value = remaining
    }, QUESTION_TICK_MS)
  }

  /** 启动限时模式总会话倒计时：1s tick，归零走会话结束判定 */
  function startSessionTimer() {
    stopSessionTimer()
    sessionTimerId = setInterval(() => {
      if (phase.value === 'finished' || phase.value === 'idle') return
      if ((sessionRemaining.value ?? 0) <= 0) return
      sessionRemaining.value = Math.max(0, sessionRemaining.value - 1)
      if (sessionRemaining.value <= 0) {
        handleSessionEnd()
      }
    }, SESSION_TICK_MS)
  }

  // ============== 内部工具：出题 / 计分 / 错题 ==============

  /** 调用题目生成器产出下一题，并记录 prevQuestionId */
  function generateNextQuestion() {
    // 错题模式：只从错题中出题（boostProbability=1）；
    // 其余模式：错题仅作加权强化（默认 0.5 概率）
    const boostProbability = config.value.trainMode === 'wrong' ? 1 : undefined
    const question = generateQuestion({
      type: config.value.type,
      level: config.value.level,
      customKeys: config.value.customKeys,
      customRoots: config.value.customRoots,
      customNotes: config.value.customNotes,
      wrongQuestions: wrongQuestionsPool,
      prevQuestionId: prevQuestionId.value,
      boostProbability,
    })
    currentQuestion.value = question
    prevQuestionId.value = question.id
    return question
  }

  /**
   * 计算本题得分（答对方调用）。
   * 规则：基础 10 分；
   * 速度奖励 reactionMs < 30% 限时 → +10，< 50% → +5；
   * 连击加成（用答对此题后的新 combo 判断档位）：
   *   5-9 连 → +2，≥10 连 → +5。
   * @param {number} reactionMs 反应毫秒
   * @param {number} newCombo 答对后新的连击数
   * @returns {number}
   */
  function calcGainedScore(reactionMs, newCombo) {
    const limitMs = config.value.timeLimit * 1000
    let gained = 10 // 基础分
    if (reactionMs < limitMs * 0.3) {
      gained += 10
    } else if (reactionMs < limitMs * 0.5) {
      gained += 5
    }
    if (newCombo >= 10) {
      gained += 5
    } else if (newCombo >= 5) {
      gained += 2
    }
    return gained
  }

  /** 取某选项的展示文本：音级题显示罗马数字音级，和弦题显示音名组合 */
  function optionText(question, index) {
    if (question.type === 'scale') {
      return `第 ${degreeToRoman(question.options[index])} 级`
    }
    if (question.type === 'circle') {
      // index 参数对五度圈题无意义，正确答案固定取两空答案
      return `下行 ${question.slots[0].answer} · 上行 ${question.slots[1].answer}`
    }
    return question.options[index]?.text ?? '未知选项'
  }

  /**
   * 五度圈题用户作答文本：把 [左空索引, 右空索引] 转为
   * 「下行 X · 上行 Y」形式；未填（null/-1）显示「未填」。
   */
  function circleAnswerText(question, slots) {
    const name = (i) =>
      i == null || i < 0 || i >= question.options.length
        ? '未填'
        : question.options[i]
    return `下行 ${name(slots?.[0])} · 上行 ${name(slots?.[1])}`
  }

  /** 构造一条错题记录 */
  function buildWrongItem(userAnswer, reactionMs) {
    const q = currentQuestion.value
    wrongRecordSeq += 1
    return {
      id: `wrong:${q.id}:${Date.now()}:${wrongRecordSeq}`,
      type: q.type,
      questionId: q.id,
      // 音级题记 keyName，和弦题记 root，五度圈题记 center，便于错题本筛选
      ...(q.type === 'scale'
        ? { keyName: q.keyName }
        : q.type === 'chord'
          ? { root: q.root }
          : { center: q.center }),
      promptText:
        q.type === 'scale'
          ? `${q.keyName} 大调中，${q.promptNote} 是第几级？`
          : q.type === 'chord'
            ? `${q.root} 大三和弦的组成音是？`
            : `五度圈中，${q.center} 左右相邻的音是？`,
      correctAnswer: optionText(q, q.correctIndex ?? q.correctIndices?.[0]),
      userAnswer,
      reactionMs,
      timestamp: Date.now(),
    }
  }

  /** 清零本轮全部统计/题目状态（config 与 phase 由调用方处理） */
  function resetRoundState() {
    score.value = 0
    combo.value = 0
    maxCombo.value = 0
    answeredCount.value = 0
    correctCount.value = 0
    reactionTimes.value = []
    wrongItems.value = []
    selectedIndex.value = null
    selectedSlots.value = [null, null]
    lastResult.value = null
    currentQuestion.value = null
    sessionRemaining.value = null
    questionRemainingMs.value = 0
    prevQuestionId.value = null
  }

  // ============== 内部动作：超时 / 会话结束判定（亦可被测试直接调用） ==============

  /**
   * 单题超时判定（内部方法）：
   * 视为答错——selectedIndex 记 -1，0 分，连击清零，加入错题
   * （userAnswer 为「超时未答」），进入 feedback 态等待用户点「下一题」。
   * 幂等：非 answering 态调用直接忽略，防止 timer 重复触发。
   */
  function handleQuestionTimeout() {
    if (phase.value !== 'answering' || !currentQuestion.value) return
    stopQuestionTimer()
    questionRemainingMs.value = 0

    const reactionMs = config.value.timeLimit * 1000
    selectedIndex.value = -1
    combo.value = 0
    wrongItems.value.push(buildWrongItem('超时未答', reactionMs))

    answeredCount.value += 1
    reactionTimes.value.push(reactionMs)
    lastResult.value = { isCorrect: false, reactionMs, gainedScore: 0 }
    phase.value = 'feedback'
  }

  /**
   * 限时模式总会话倒计时归零判定（内部方法）：
   * - answering 态：本题按超时计错后直接 finish（用户不再看到该题反馈）；
   * - feedback 态：保持反馈态，等 nextQuestion 时检测剩余时间再 finish。
   */
  function handleSessionEnd() {
    stopSessionTimer()
    sessionRemaining.value = 0
    if (phase.value === 'answering') {
      handleQuestionTimeout()
      finish()
    }
  }

  // ============== Actions ==============

  /**
   * 开始一轮训练。
   * @param {object} trainConfig
   * @param {'scale'|'chord'|'circle'} trainConfig.type 训练类型
   * @param {number} [trainConfig.level=1] 难度等级
   * @param {'time'|'count'|'wrong'|'custom'} [trainConfig.trainMode='count'] 训练模式
   * @param {number} [trainConfig.timeLimit] 单题限时秒（自定义模式可覆盖，默认 15）
   * @param {number} [trainConfig.sessionTime] 限时模式总秒数（默认 60）
   * @param {number} [trainConfig.totalQuestions] 题量模式题数（默认 20）
   * @param {string[]|null} [trainConfig.customKeys] 自定义调名
   * @param {string[]|null} [trainConfig.customRoots] 自定义根音
   * @param {string[]|null} [trainConfig.customNotes] 五度圈自定义中心音
   * @param {Array} [trainConfig.wrongQuestions] 错题模式的错题记录（透传生成器）
   */
  function start(trainConfig = {}) {
    const {
      type,
      level = 1,
      trainMode = 'count',
      timeLimit,
      sessionTime,
      totalQuestions,
      customKeys = null,
      customRoots = null,
      customNotes = null,
      wrongQuestions = null,
    } = trainConfig

    // 配置校验
    if (type !== 'scale' && type !== 'chord' && type !== 'circle') {
      throw new Error(`start: 未知训练类型 type=${type}`)
    }
    if (!TRAIN_MODES.includes(trainMode)) {
      throw new Error(`start: 未知训练模式 trainMode=${trainMode}`)
    }

    // 清理上一轮计时器与统计状态
    stopQuestionTimer()
    stopSessionTimer()
    resetRoundState()

    const isTimeMode = trainMode === 'time'
    const resolvedTimeLimit =
      Number(timeLimit) > 0 ? Number(timeLimit) : DEFAULT_TIME_LIMIT

    config.value = {
      type,
      level,
      trainMode,
      timeLimit: resolvedTimeLimit,
      sessionTime: isTimeMode
        ? Number(sessionTime) > 0 ? Number(sessionTime) : 60
        : null,
      // 限时模式按总秒数结束；其余模式按题量结束：
      // 题量模式默认 20 题；错题模式以错题总数为题量（练完即结束）；
      // 自定义模式未传 totalQuestions 时为 null（不设上限、可随时退出）
      totalQuestions: isTimeMode
        ? null
        : Number(totalQuestions) > 0
          ? Number(totalQuestions)
          : trainMode === 'count'
            ? 20
            : trainMode === 'wrong'
              ? (Array.isArray(wrongQuestions) ? wrongQuestions.length : 0) || null
              : null,
      customKeys:
        Array.isArray(customKeys) && customKeys.length > 0 ? customKeys : null,
      customRoots:
        Array.isArray(customRoots) && customRoots.length > 0 ? customRoots : null,
      customNotes:
        Array.isArray(customNotes) && customNotes.length > 0 ? customNotes : null,
    }

    wrongQuestionsPool = Array.isArray(wrongQuestions) ? wrongQuestions : []

    // 错题模式：出题范围限定为错题涉及的调/根音/中心音（错题可能跨多个），
    // 由生成器在该范围内按 boostProbability=1 只出错题
    if (trainMode === 'wrong' && wrongQuestionsPool.length > 0) {
      const scope = extractScopeFromWrong(wrongQuestionsPool, type)
      if (type === 'scale' && scope.length > 0) {
        config.value.customKeys = scope
      } else if (type === 'chord' && scope.length > 0) {
        config.value.customRoots = scope
      } else if (type === 'circle' && scope.length > 0) {
        config.value.customNotes = scope
      }
    }

    sessionRemaining.value = isTimeMode ? config.value.sessionTime : null
    questionRemainingMs.value = resolvedTimeLimit * 1000

    // 出第一题并启动计时
    phase.value = 'answering'
    generateNextQuestion()
    startQuestionTimer()
    if (isTimeMode) startSessionTimer()
  }

  /**
   * 作答。
   * 防抖：仅 phase==='answering' 有效，feedback/finished/idle 态调用直接忽略。
   * @param {number|number[]} answer scale/chord 为单选选项索引；
   *   circle 五度圈题为两空索引数组 [左空(下行五度), 右空(上行五度)]，
   *   两空全部填对方判正确。
   * @param {number} [injectedReactionMs] 测试注入的反应毫秒；默认真实计时
   */
  function answerQuestion(answer, injectedReactionMs) {
    if (phase.value !== 'answering' || !currentQuestion.value) return
    stopQuestionTimer()
    questionRemainingMs.value = 0

    const q = currentQuestion.value
    const reactionMs = Number.isFinite(injectedReactionMs)
      ? Math.max(0, injectedReactionMs)
      : Math.max(0, performance.now() - questionStartTime)

    let isCorrect
    let userAnswerText
    if (q.type === 'circle') {
      // 两空作答：[左空选项索引, 右空选项索引]，缺一即判错
      const slots = Array.isArray(answer) ? answer : [null, null]
      selectedSlots.value = [
        Number.isInteger(slots[0]) ? slots[0] : null,
        Number.isInteger(slots[1]) ? slots[1] : null,
      ]
      isCorrect =
        selectedSlots.value[0] === q.correctIndices[0] &&
        selectedSlots.value[1] === q.correctIndices[1]
      userAnswerText = circleAnswerText(q, selectedSlots.value)
    } else {
      isCorrect = answer === q.correctIndex
      selectedIndex.value = answer
      userAnswerText = optionText(q, answer)
    }

    let gainedScore = 0
    if (isCorrect) {
      // 先累加连击，再用新 combo 判断连击加成档位
      combo.value += 1
      maxCombo.value = Math.max(maxCombo.value, combo.value)
      gainedScore = calcGainedScore(reactionMs, combo.value)
      score.value += gainedScore
      correctCount.value += 1
    } else {
      combo.value = 0
      wrongItems.value.push(buildWrongItem(userAnswerText, reactionMs))
    }

    answeredCount.value += 1
    reactionTimes.value.push(reactionMs)
    lastResult.value = { isCorrect, reactionMs, gainedScore }
    phase.value = 'feedback'
  }

  /** 单题超时（对外 action，内部走 handleQuestionTimeout） */
  function timeoutQuestion() {
    handleQuestionTimeout()
  }

  /**
   * 「下一题」按钮：feedback 态调用。
   * 先判断训练是否结束（题量模式答满 / 限时模式时间耗尽），
   * 结束则 finish；否则生成下一题并重新计时。
   */
  function nextQuestion() {
    if (phase.value !== 'feedback') return

    if (config.value.trainMode === 'time') {
      if ((sessionRemaining.value ?? 0) <= 0) {
        finish()
        return
      }
    } else if (
      config.value.totalQuestions != null &&
      answeredCount.value >= config.value.totalQuestions
    ) {
      finish()
      return
    }

    selectedIndex.value = null
    selectedSlots.value = [null, null]
    lastResult.value = null
    generateNextQuestion()
    phase.value = 'answering'
    startQuestionTimer()
  }

  /** 结束本轮：停止所有计时器，进入 finished 态，返回汇总数据 */
  function finish() {
    stopQuestionTimer()
    stopSessionTimer()
    questionRemainingMs.value = 0
    phase.value = 'finished'
    return summary.value
  }

  /** 重置：回到 idle，清理计时器与全部状态 */
  function reset() {
    stopQuestionTimer()
    stopSessionTimer()
    resetRoundState()
    config.value = null
    phase.value = 'idle'
  }

  return {
    // state
    phase,
    config,
    currentQuestion,
    selectedIndex,
    selectedSlots,
    lastResult,
    score,
    combo,
    maxCombo,
    answeredCount,
    correctCount,
    reactionTimes,
    wrongItems,
    sessionRemaining,
    questionRemainingMs,
    prevQuestionId,
    // getters
    summary,
    progressText,
    // actions
    start,
    answerQuestion,
    timeoutQuestion,
    nextQuestion,
    finish,
    reset,
    // 暴露内部判定方法，便于测试与 UI 复用
    handleQuestionTimeout,
    handleSessionEnd,
  }
})
