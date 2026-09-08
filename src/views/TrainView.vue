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
          <template v-else-if="isCircle">
            五度圈中，<span class="note-em">{{ game.currentQuestion.center }}</span>
            左右相邻的音是？
          </template>
          <template v-else>
            <span class="note-em">{{ game.currentQuestion.root }}</span>
            大三和弦的组成音是？
          </template>
        </p>

        <!-- 五度圈题：左空（下行五度）← 中心音 → 右空（上行五度） -->
        <div v-if="isCircle" class="circle-board">
          <button
            type="button"
            class="circle-slot"
            :class="slotClass(0)"
            :disabled="game.phase !== 'answering'"
            @click="activateSlot(0)"
          >
            <span class="slot-label">下行五度</span>
            <span class="slot-note">{{ slotNote(0) }}</span>
            <span v-if="slotCorrectNote(0)" class="slot-correct">
              ✓ {{ slotCorrectNote(0) }}
            </span>
          </button>
          <span class="circle-arrow" aria-hidden="true">←</span>
          <div class="circle-center">
            <span class="note-em">{{ game.currentQuestion.center }}</span>
          </div>
          <span class="circle-arrow" aria-hidden="true">→</span>
          <button
            type="button"
            class="circle-slot"
            :class="slotClass(1)"
            :disabled="game.phase !== 'answering'"
            @click="activateSlot(1)"
          >
            <span class="slot-label">上行五度</span>
            <span class="slot-note">{{ slotNote(1) }}</span>
            <span v-if="slotCorrectNote(1)" class="slot-correct">
              ✓ {{ slotCorrectNote(1) }}
            </span>
          </button>
        </div>
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

      <!-- 五度圈题：6 个音名选项，3 列 × 2 行 -->
      <div v-else-if="isCircle" class="circle-grid">
        <button
          v-for="(note, idx) in game.currentQuestion.options"
          :key="note"
          type="button"
          class="option-btn circle-btn"
          :class="circleOptionClass(idx)"
          :disabled="circleOptionDisabled(idx)"
          @click="pickOption(idx)"
        >
          {{ note }}
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
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
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
const isCircle = computed(() => game.currentQuestion?.type === 'circle')

// ============== 五度圈题：两空填选本地状态 ==============

/** 两空已选选项索引：[左空(下行五度), 右空(上行五度)]，null 表示未填 */
const slotPicks = ref([null, null])
/** 当前等待填写的空位（0=左空，1=右空） */
const activeSlot = ref(0)

/**
 * 题目切换时重置两空与焦点。
 * 注意监听题目对象引用而非 id：错题模式下单一中心音可能连续重复 id，
 * 但每题都是新对象（选项重新洗牌），监听引用保证本地状态必然重置。
 */
watch(
  () => game.currentQuestion,
  () => {
    slotPicks.value = [null, null]
    activeSlot.value = 0
  }
)

/** 两空选择实时同步给 store（超时判定时可记录半填答案） */
watch(
  slotPicks,
  (picks) => {
    game.setCircleSlots(picks)
  },
  { deep: true }
)

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
  if (q.type === 'circle') {
    // 两空分别展示，未填空位标注「未填」；文案与错题本一致（下行 X · 上行 Y）
    return q.slots
      .map((s, i) => {
        const pick = slotPicks.value[i]
        const dir = i === 0 ? '下行' : '上行'
        return `${dir} ${pick != null ? q.options[pick] : '未填'}`
      })
      .join(' · ')
  }
  const idx = game.selectedIndex
  if (idx == null || idx < 0 || idx >= q.options.length) return ''
  return optionLabel(idx)
})

// ============== 工具函数 ==============

function romanOf(degree) {
  return degreeToRoman(degree)
}

/** 选项展示文本：音级题「第 N 级」，五度圈题音名，和弦题音名组合 */
function optionLabel(idx) {
  const q = game.currentQuestion
  if (!q) return ''
  if (isScale.value) return `第 ${degreeToRoman(q.options[idx])} 级`
  if (isCircle.value) return q.options[idx] ?? ''
  return q.options[idx]?.text ?? ''
}

// ============== 五度圈题：两空填选交互 ==============

/** 空位展示音名：作答中显示已选/「？」；反馈态未填则显示正确答案 */
function slotNote(slot) {
  const q = game.currentQuestion
  if (!q) return ''
  const pick = slotPicks.value[slot]
  if (pick != null) return q.options[pick]
  if (game.phase === 'feedback') return q.options[q.correctIndices[slot]]
  return '？'
}

/** 反馈态错空（已填但选错）追加展示的正确音名；其余情况为空 */
function slotCorrectNote(slot) {
  const q = game.currentQuestion
  if (!q || game.phase !== 'feedback') return ''
  const pick = slotPicks.value[slot]
  if (pick == null || pick === q.correctIndices[slot]) return ''
  return q.options[q.correctIndices[slot]]
}

/** 空位样式：作答中激活/已填；反馈态对绿错红，未填显示正确答案（绿色闪烁） */
function slotClass(slot) {
  const q = game.currentQuestion
  if (!q) return {}
  if (game.phase === 'feedback') {
    const pick = slotPicks.value[slot]
    if (pick === q.correctIndices[slot]) return { correct: true }
    if (pick == null) return { correct: true, 'animate-correct': true, miss: true }
    return { wrong: true }
  }
  return {
    active: activeSlot.value === slot,
    filled: slotPicks.value[slot] != null,
  }
}

/** 点击空位：激活该空；点击已填空位则清空改选（原选项恢复可选） */
function activateSlot(slot) {
  if (game.phase !== 'answering') return
  unlockAudio()
  if (slotPicks.value[slot] != null) {
    slotPicks.value[slot] = null
  }
  activeSlot.value = slot
}

/** 点击选项：填入当前空位；另一空为空则焦点跳转，两空填满立即判定 */
function pickOption(idx) {
  if (game.phase !== 'answering') return
  const q = game.currentQuestion
  if (!q || q.type !== 'circle') return
  // 已被选用的选项不可重复选择（按钮已禁用，双保险）
  if (slotPicks.value[0] === idx || slotPicks.value[1] === idx) return
  unlockAudio()
  const target = activeSlot.value
  slotPicks.value[target] = idx
  const other = target === 0 ? 1 : 0
  if (slotPicks.value[other] == null) {
    activeSlot.value = other
  } else {
    game.answerQuestion([slotPicks.value[0], slotPicks.value[1]])
  }
}

/** 五度圈选项是否禁用：反馈态全禁用；作答中已选用的选项禁用 */
function circleOptionDisabled(idx) {
  if (game.phase !== 'answering') return true
  return slotPicks.value[0] === idx || slotPicks.value[1] === idx
}

/** 五度圈选项反馈样式：正确答案绿色（未选中闪烁）、错选红色、其余置灰 */
function circleOptionClass(idx) {
  const q = game.currentQuestion
  if (!q || game.phase !== 'feedback') return {}
  const [leftIdx, rightIdx] = q.correctIndices
  const [pickedLeft, pickedRight] = slotPicks.value
  if (idx === leftIdx) {
    return pickedLeft === leftIdx
      ? { correct: true }
      : { correct: true, 'animate-correct': true }
  }
  if (idx === rightIdx) {
    return pickedRight === rightIdx
      ? { correct: true }
      : { correct: true, 'animate-correct': true }
  }
  if (idx === pickedLeft || idx === pickedRight) return { wrong: true }
  return { dim: true }
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

const VALID_TYPES = ['scale', 'chord', 'circle']
const VALID_MODES = ['time', 'count', 'wrong', 'custom']

/** 解析路由 query 为训练配置；非法或缺错题时返回 null（回首页） */
function parseQuery() {
  const q = route.query
  if (!VALID_TYPES.includes(q.type)) return null
  const maxLevel = q.type === 'scale' ? 12 : q.type === 'circle' ? 2 : 3
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
    // 错题模式依赖错题本：该模块无错题时直接回首页（首页入口已禁用，防御直达 URL）
    const wrongList = wrongbook.getWrongQuestions(q.type)
    if (wrongList.length === 0) return null
    cfg.wrongQuestions = wrongList
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

/* 五度圈题：空位板（左空 ← 中心 → 右空） */
.circle-board {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.circle-slot {
  flex-shrink: 0;
  width: 76px;
  min-height: 72px;
  padding: 8px 6px;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.circle-slot .slot-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.circle-slot .slot-note {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-tertiary);
  line-height: 1.1;
}

/* 作答中：当前激活空位高亮 */
.circle-slot.active {
  border-style: solid;
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.circle-slot.active .slot-label,
.circle-slot.active .slot-note {
  color: var(--primary-dark);
}

/* 作答中：已填入音名的空位 */
.circle-slot.filled {
  border-style: solid;
  border-color: var(--primary-color);
}

.circle-slot.filled .slot-note {
  color: var(--primary-color);
}

.circle-arrow {
  flex-shrink: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-tertiary);
}

.circle-center {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle-center .note-em {
  font-size: 44px;
}

/* 反馈态空位配色 */
.circle-slot.correct {
  border-style: solid;
  border-color: var(--ok-color);
  background: var(--ok-light);
}

.circle-slot.correct .slot-note {
  color: var(--ok-dark);
}

.circle-slot.wrong {
  border-style: solid;
  border-color: var(--err-color);
  background: var(--err-light);
}

.circle-slot.wrong .slot-note {
  color: var(--err-dark);
}

/* 错空下方追加的正确音名提示 */
.slot-correct {
  font-size: 11px;
  font-weight: 700;
  color: var(--ok-dark);
  line-height: 1.2;
  white-space: nowrap;
}

/* 五度圈题：6 选项 3 列 × 2 行 */
.circle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.circle-btn {
  min-height: 60px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 26px;
  font-weight: 800;
}

.circle-btn:disabled:not(.correct):not(.wrong):not(.dim) {
  opacity: 0.45;
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
