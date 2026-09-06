<template>
  <div class="train">
    <!-- ============== 顶部状态栏 ============== -->
    <header class="train-header">
      <button type="button" class="back-btn" aria-label="返回首页" @click="goHome">
        ‹
      </button>
      <div class="stat-block">
        <span class="stat-label">分数</span>
        <span class="stat-value">{{ game.score }}</span>
      </div>
      <div class="stat-block" :class="{ 'combo-lit': game.combo > 0 }">
        <span class="stat-label">连击</span>
        <span class="stat-value">🔥{{ game.combo }}</span>
      </div>
      <span class="progress-text">{{ game.progressText }}</span>
    </header>

    <!-- 单题倒计时进度条 -->
    <div class="timer-track" aria-hidden="true">
      <div
        class="timer-fill"
        :class="{ urgent: isUrgent, frozen: game.phase !== 'answering' }"
        :style="{ width: timerPercent + '%' }"
      />
    </div>

    <!-- ============== 题干区 ============== -->
    <main class="question-area">
      <div
        v-if="game.currentQuestion"
        :key="game.currentQuestion.id"
        class="question-card animate-fade-up"
      >
        <p class="question-prompt">
          <template v-if="isScale">
            {{ game.currentQuestion.keyName }} 大调中，<span
              class="note-em"
            >{{ game.currentQuestion.promptNote }}</span
            > 是第几级？
          </template>
          <template v-else>
            <span class="note-em">{{ game.currentQuestion.root }}</span>
            大三和弦的组成音是？
          </template>
        </p>
        <p
          v-if="game.phase === 'answering'"
          class="timer-seconds"
          :class="{ 'urgent-text': isUrgent }"
        >
          {{ remainingSeconds }} 秒
        </p>
      </div>
      <p v-else class="question-placeholder">正在出题…</p>

      <!-- 得分飘字（key 变化重新触发动画） -->
      <span
        v-if="showScoreFloat"
        :key="'float-' + game.answeredCount"
        class="score-float animate-score-float"
      >
        +{{ game.lastResult.gainedScore }}
      </span>
    </main>

    <!-- ============== 选项区 ============== -->
    <section v-if="game.currentQuestion" class="options-area">
      <!-- 音级题：I-VII 固定顺序，4 + 3 两行 -->
      <div v-if="isScale" class="scale-grid">
        <button
          v-for="(deg, idx) in game.currentQuestion.options"
          :key="deg"
          type="button"
          class="option-btn roman-btn"
          :class="optionClass(idx)"
          :disabled="game.phase !== 'answering'"
          @click="answer(idx)"
        >
          {{ romanOf(deg) }}
        </button>
      </div>

      <!-- 和弦题：4 个竖向大选项 -->
      <div v-else class="chord-list">
        <button
          v-for="(opt, idx) in game.currentQuestion.options"
          :key="idx"
          type="button"
          class="option-btn chord-btn"
          :class="optionClass(idx)"
          :disabled="game.phase !== 'answering'"
          @click="answer(idx)"
        >
          <span v-for="n in opt.notes" :key="n" class="chord-note">{{ n }}</span>
        </button>
      </div>
    </section>

    <!-- ============== 反馈区（不自动跳转，等待用户点击「下一题」） ============== -->
    <footer v-if="game.phase === 'feedback'" class="feedback-area animate-fade-up">
      <div class="feedback-banner" :class="game.lastResult?.isCorrect ? 'ok' : 'err'">
        <p class="feedback-title">
          <template v-if="game.lastResult?.isCorrect">
            答对了 +{{ game.lastResult.gainedScore }} 分<template
              v-if="game.combo >= 5"
            >
              · 🔥{{ game.combo }} 连击</template
            >
          </template>
          <template v-else-if="game.selectedIndex === -1">超时未答</template>
          <template v-else>答错了</template>
        </p>
        <p v-if="wrongAnswerText" class="feedback-user-answer">
          你的答案：{{ wrongAnswerText }}
        </p>
        <p v-if="game.currentQuestion" class="feedback-explain">
          {{ game.currentQuestion.explanation }}
        </p>
      </div>
      <button type="button" class="next-btn" @click="onNext">下一题</button>
    </footer>
  </div>
</template>

<script setup>
/**
 * TrainView.vue
 * 统一训练页：顶部状态栏 + 题干区 + 选项区 + 反馈区。
 *
 * 流程对接 game store 状态机：
 * - onMounted 解析路由 query 并 start(config)；
 * - 作答 / 超时后进入 feedback 态，页面停留在反馈展示，
 *   用户点击「下一题」才调用 nextQuestion()（不自动跳转）；
 * - phase 变为 finished 时写入错题本与历史统计，然后 replace 到结算页；
 * - 未结束就离开页面时 reset() 清理计时器，防止后台泄漏。
 */
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { useWrongBookStore } from '../stores/wrongbook.js'
import { useStatsStore } from '../stores/stats.js'
import { useSettingsStore } from '../stores/settings.js'
import { degreeToRoman } from '../quiz/generator.js'
import { unlockAudio, playCorrect, playWrong, playCombo } from '../sound/index.js'

const route = useRoute()
const router = useRouter()
const game = useGameStore()
const wrongbook = useWrongBookStore()
const stats = useStatsStore()
const settings = useSettingsStore()

// ============== 计算属性 ==============

const isScale = computed(() => game.currentQuestion?.type === 'scale')

/** 时间不足 30% 时进入紧迫态（进度条变红 + 抖动） */
const isUrgent = computed(() => {
  const limitMs = (game.config?.timeLimit ?? 0) * 1000
  return (
    game.phase === 'answering' &&
    limitMs > 0 &&
    game.questionRemainingMs <= limitMs * 0.3
  )
})

/** 单题倒计时进度条百分比（0-100） */
const timerPercent = computed(() => {
  const limitMs = (game.config?.timeLimit ?? 0) * 1000
  if (limitMs <= 0) return 0
  return Math.max(0, Math.min(100, (game.questionRemainingMs / limitMs) * 100))
})

/** 剩余秒数（保留 1 位小数） */
const remainingSeconds = computed(() =>
  (Math.max(0, game.questionRemainingMs) / 1000).toFixed(1)
)

/** 是否展示得分飘字 */
const showScoreFloat = computed(
  () =>
    game.lastResult?.isCorrect === true && (game.lastResult.gainedScore ?? 0) > 0
)

/** 答错时用户所选答案文本（超时未答 / 无选中则为空） */
const wrongAnswerText = computed(() => {
  const q = game.currentQuestion
  if (!q || game.lastResult?.isCorrect !== false) return ''
  const idx = game.selectedIndex
  if (idx == null || idx < 0 || idx >= q.options.length) return ''
  return optionLabel(idx)
})

// ============== 工具函数 ==============

function romanOf(degree) {
  return degreeToRoman(degree)
}

/** 选项展示文本：音级题「第 N 级」，和弦题音名组合 */
function optionLabel(idx) {
  const q = game.currentQuestion
  if (!q) return ''
  return isScale.value
    ? `第 ${degreeToRoman(q.options[idx])} 级`
    : (q.options[idx]?.text ?? '')
}

/** 选项反馈样式：正确绿色（答错时闪烁高亮）、错选红色、其余置灰 */
function optionClass(idx) {
  const q = game.currentQuestion
  if (!q || game.phase !== 'feedback') return {}
  if (idx === q.correctIndex) {
    // 用户答对时常亮绿色；答错/超时则闪烁高亮正确答案
    return game.selectedIndex === idx
      ? { correct: true }
      : { correct: true, 'animate-correct': true }
  }
  if (idx === game.selectedIndex) return { wrong: true }
  return { dim: true }
}

// ============== 流程控制 ==============

const VALID_TYPES = ['scale', 'chord']
const VALID_MODES = ['time', 'count', 'wrong', 'custom']

/** 解析路由 query 为训练配置；非法或缺错题时返回 null（回首页） */
function parseQuery() {
  const q = route.query
  if (!VALID_TYPES.includes(q.type)) return null
  const maxLevel = q.type === 'scale' ? 12 : 3
  const level = Number.parseInt(q.level, 10)
  if (!Number.isInteger(level) || level < 1 || level > maxLevel) return null

  const trainMode = VALID_MODES.includes(q.trainMode) ? q.trainMode : 'count'
  const cfg = { type: q.type, level, trainMode }

  if (trainMode === 'count') {
    const n = Number.parseInt(q.totalQuestions, 10)
    if (Number.isInteger(n) && n > 0) cfg.totalQuestions = n
  } else if (trainMode === 'time') {
    const s = Number.parseInt(q.sessionTime, 10)
    if (Number.isInteger(s) && s > 0) cfg.sessionTime = s
  } else if (trainMode === 'wrong') {
    // 错题模式依赖错题本，空时直接回首页（首页入口已禁用，防御直达 URL）
    if (wrongbook.count === 0) return null
    cfg.wrongQuestions = wrongbook.getWrongQuestions(q.type)
  }
  return cfg
}

/** 本轮结果是否已落库（防止重复记录） */
let recorded = false

onMounted(() => {
  const cfg = parseQuery()
  if (!cfg) {
    router.replace('/')
    return
  }
  recorded = false
  game.start(cfg)
})

watch(
  () => game.phase,
  (phase) => {
    // 反馈态播放音效（作答与超时统一在此触发，受设置开关控制）
    if (phase === 'feedback' && settings.settings.soundEnabled) {
      const correct = game.lastResult?.isCorrect === true
      if (correct && (game.combo === 5 || game.combo === 10)) {
        // 连击里程碑（5 连 / 10 连）播放特殊提示音
        playCombo()
      } else if (correct) {
        playCorrect()
      } else {
        playWrong()
      }
    }

    if (phase !== 'finished' || recorded) return
    recorded = true

    // 结束即落库：错题入错题本，本轮成绩入历史统计
    const cfg = game.config
    if (cfg) {
      if (game.wrongItems.length > 0) {
        wrongbook.addItems(game.wrongItems)
      }
      stats.recordSession({
        type: cfg.type,
        level: cfg.level,
        score: game.summary.score,
        total: game.summary.total,
        correct: game.summary.correct,
        reactionTimes: game.reactionTimes,
      })
    }
    router.replace('/result')
  }
)

onBeforeUnmount(() => {
  // 正常结束（跳结算页）时保留数据供结算页展示；否则清理计时器与状态
  if (game.phase !== 'finished') game.reset()
})

// ============== 交互动作 ==============

function answer(idx) {
  if (game.phase !== 'answering') return
  unlockAudio() // 首次用户手势时创建 AudioContext（浏览器自动播放策略）
  game.answerQuestion(idx)
}

function onNext() {
  unlockAudio()
  game.nextQuestion()
}

function goHome() {
  router.replace('/')
}
</script>

<style scoped>
.train {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}

/* ============== 顶部状态栏 ============== */
.train-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.stat-value {
  font-size: var(--font-size-md);
  font-weight: 800;
  color: var(--text-color);
  font-variant-numeric: tabular-nums;
}

.combo-lit .stat-value {
  color: var(--combo-color);
}

.progress-text {
  margin-left: auto;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* ============== 单题倒计时进度条 ============== */
.timer-track {
  margin-top: 10px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--border-color);
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--primary-color);
  transition: width 0.1s linear;
}

.timer-fill.urgent {
  background: var(--err-color);
}

.timer-fill.frozen {
  background: var(--text-tertiary);
}

/* ============== 题干区 ============== */
.question-area {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 12px 0;
}

.question-card {
  text-align: center;
}

.question-prompt {
  font-size: var(--font-size-lg);
  color: var(--text-secondary);
  line-height: 1.6;
}

.note-em {
  display: inline-block;
  margin: 0 2px;
  font-size: 40px;
  font-weight: 800;
  color: var(--primary-color);
  vertical-align: middle;
  line-height: 1.2;
}

.timer-seconds {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.timer-seconds.urgent-text {
  color: var(--err-color);
  animation: urgent-shake 0.3s ease-in-out infinite;
}

.question-placeholder {
  font-size: var(--font-size-md);
  color: var(--text-tertiary);
}

/* 得分飘字 */
.score-float {
  position: absolute;
  top: 6px;
  right: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--ok-color);
  pointer-events: none;
}

/* ============== 选项区 ============== */
.options-area {
  margin-top: 8px;
}

/* 音级题：4 + 3 两行网格 */
.scale-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.roman-btn {
  min-height: 64px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 22px;
  font-weight: 800;
}

/* 和弦题：竖向 4 选项 */
.chord-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chord-btn {
  min-height: 56px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.chord-note {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-color);
  font-variant-numeric: tabular-nums;
}

/* 选项反馈态 */
.option-btn.correct {
  border-color: var(--ok-color);
  background: var(--ok-light);
}

.option-btn.correct .chord-note {
  color: var(--ok-dark);
}

.option-btn.wrong {
  border-color: var(--err-color);
  background: var(--err-light);
}

.option-btn.wrong .chord-note {
  color: var(--err-dark);
}

.option-btn.dim {
  opacity: 0.45;
}

.option-btn:disabled {
  cursor: default;
}

/* ============== 反馈区 ============== */
.feedback-area {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feedback-banner {
  border-radius: var(--radius-md);
  padding: 12px 14px;
  line-height: 1.5;
}

.feedback-banner.ok {
  background: var(--ok-light);
}

.feedback-banner.err {
  background: var(--err-light);
}

.feedback-title {
  font-size: var(--font-size-md);
  font-weight: 800;
}

.feedback-banner.ok .feedback-title {
  color: var(--ok-dark);
}

.feedback-banner.err .feedback-title {
  color: var(--err-dark);
}

.feedback-user-answer {
  margin-top: 2px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.feedback-explain {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.next-btn {
  width: 100%;
  min-height: 52px;
  border-radius: var(--radius-md);
  background: var(--primary-color);
  color: #fff;
  font-size: var(--font-size-lg);
  font-weight: 700;
  letter-spacing: 2px;
  box-shadow: 0 4px 12px rgba(79, 124, 255, 0.3);
}

.next-btn:active:not(:disabled) {
  background: var(--primary-dark);
}
</style>
