<template>
  <div class="home">
    <!-- 顶部标题 -->
    <header class="home-header">
      <h1 class="app-name">NoteMem</h1>
      <p class="app-subtitle">固定音名记忆训练</p>
    </header>

    <!-- 训练配置卡片 -->
    <div class="card-list">
      <section
        v-for="card in CARDS"
        :key="card.type"
        class="train-card"
        :class="{ expanded: expanded === card.type }"
      >
        <header class="card-head" @click="toggleCard(card.type)">
          <div class="card-head-main">
            <h2 class="card-title">
              {{ card.title }}
              <span class="card-tagline">{{ card.tagline }}</span>
            </h2>
            <p class="card-desc">{{ card.desc }}</p>
            <p v-if="expanded !== card.type" class="card-summary">
              {{ summaryOf(card) }}
            </p>
          </div>
          <span class="card-chevron" :class="{ open: expanded === card.type }">⌄</span>
        </header>

        <div v-show="expanded === card.type" class="card-body">
          <!-- 难度选择 -->
          <div class="config-block">
            <p class="config-label">难度</p>
            <div class="chip-scroll">
              <button
                v-for="d in card.difficulties"
                :key="d.level"
                type="button"
                class="chip level-chip"
                :class="{ active: levelOf(card) === d.level }"
                @click="selectLevel(card, d.level)"
              >
                <span class="chip-main">L{{ d.level }}</span>
                <span class="chip-sub">{{ chipSub(d, card.type) }}</span>
              </button>
            </div>
          </div>

          <!-- 训练模式选择 -->
          <div class="config-block">
            <p class="config-label">训练模式</p>
            <div class="mode-row">
              <button
                v-for="m in MODES"
                :key="m.value"
                type="button"
                class="mode-btn"
                :class="{ active: modeOf(card) === m.value }"
                :disabled="m.value === 'wrong' && wrongCountOf(card.type) === 0"
                @click="selectMode(card, m.value)"
              >
                <span class="mode-icon">{{ m.icon }}</span>
                <span>{{ m.label }}</span>
              </button>
            </div>

            <!-- 题量模式：题量选择 -->
            <div v-if="modeOf(card) === 'count'" class="sub-options">
              <button
                v-for="n in COUNT_OPTIONS"
                :key="n"
                type="button"
                class="chip sub-chip"
                :class="{ active: totalQuestions === n }"
                @click="totalQuestions = n"
              >
                {{ n }} 题
              </button>
            </div>

            <!-- 限时模式：时长选择 -->
            <div v-else-if="modeOf(card) === 'time'" class="sub-options">
              <button
                v-for="s in SESSION_OPTIONS"
                :key="s.value"
                type="button"
                class="chip sub-chip"
                :class="{ active: sessionTime === s.value }"
                @click="sessionTime = s.value"
              >
                {{ s.label }}
              </button>
            </div>

            <!-- 错题模式：提示 -->
            <div v-else class="wrong-tip">
              <template v-if="wrongCountOf(card.type) > 0">
                将练习错题本中的 <strong>{{ wrongCountOf(card.type) }}</strong> 道错题
              </template>
              <span v-else class="disabled-tip">暂无错题，完成训练后自动收集</span>
            </div>
          </div>

          <!-- 开始训练 -->
          <button
            type="button"
            class="start-btn"
            :disabled="modeOf(card) === 'wrong' && wrongCountOf(card.type) === 0"
            @click="startTraining(card)"
          >
            开始训练
          </button>
        </div>
      </section>
    </div>

    <!-- 练习工具栏目（与训练模块分区，独立于出题训练） -->
    <section class="tools-section">
      <h2 class="tools-title">练习工具</h2>
      <div class="tool-card" @click="openFretboardTool">
        <span class="tool-icon">🎸</span>
        <div class="tool-info">
          <h3 class="tool-name">吉他指板记忆</h3>
          <p class="tool-desc">听语音报音，在指板上找位置</p>
        </div>
        <span class="tool-arrow">›</span>
      </div>
    </section>

    <!-- 底部功能入口 -->
    <nav class="bottom-nav">
      <router-link to="/wrongbook" class="nav-item">
        <span class="nav-icon">
          📕
          <span v-if="wrongbook.count > 0" class="nav-badge">
            {{ wrongbook.count > 99 ? '99+' : wrongbook.count }}
          </span>
        </span>
        <span class="nav-label">错题本</span>
      </router-link>
      <router-link to="/stats" class="nav-item">
        <span class="nav-icon">📊</span>
        <span class="nav-label">统计</span>
      </router-link>
      <router-link to="/settings" class="nav-item">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings.js'
import { useWrongBookStore } from '../stores/wrongbook.js'
import { SCALE_DIFFICULTIES, CHORD_DIFFICULTIES, CIRCLE_DIFFICULTIES } from '../music/difficulty.js'
import { PROGRESSION_DIFFICULTIES } from '../music/progression.js'

const router = useRouter()
const settingsStore = useSettingsStore()
const wrongbook = useWrongBookStore()

/** 当前展开的卡片，默认展开第一张（音级训练） */
const expanded = ref('scale')

/** 题量模式可选题数 */
const COUNT_OPTIONS = [20, 50, 100]
/** 限时模式可选时长（秒） */
const SESSION_OPTIONS = [
  { label: '1 分钟', value: 60 },
  { label: '3 分钟', value: 180 },
  { label: '5 分钟', value: 300 },
]
/** 题量 / 时长为本机临时偏好（settings 仅持久化难度与模式） */
const totalQuestions = ref(20)
const sessionTime = ref(60)

/** 训练模式元数据 */
const MODES = [
  { value: 'count', label: '题量模式', icon: '📝' },
  { value: 'time', label: '限时模式', icon: '⏱️' },
  { value: 'wrong', label: '错题模式', icon: '🔁' },
]

/** 训练卡片配置 */
const CARDS = [
  {
    type: 'scale',
    title: '音级训练',
    tagline: '大调音级反应',
    desc: '看到音名，快速判断它在大调中是第几级',
    difficulties: SCALE_DIFFICULTIES,
    levelKey: 'scaleLevel',
    modeKey: 'scaleTrainMode',
  },
  {
    type: 'chord',
    title: '和弦训练',
    tagline: '和弦组成音训练',
    desc: '看到和弦名称，选出它的三个组成音',
    difficulties: CHORD_DIFFICULTIES,
    levelKey: 'chordLevel',
    modeKey: 'chordTrainMode',
  },
  {
    type: 'circle',
    title: '五度圈训练',
    tagline: '上下五度反应',
    desc: '看到中心音，选出五度圈上左右相邻的两个音',
    difficulties: CIRCLE_DIFFICULTIES,
    levelKey: 'circleLevel',
    modeKey: 'circleTrainMode',
  },
  {
    type: 'progression',
    title: '和弦进行识别',
    tagline: '听辨罗马数字进行',
    desc: '听一段真实钢琴演奏的和弦进行，选出对应的罗马数字序列',
    difficulties: PROGRESSION_DIFFICULTIES,
    levelKey: 'progressionLevel',
    modeKey: 'progressionTrainMode',
  },
]

/** 卡片展开 / 收起 */
function toggleCard(type) {
  expanded.value = expanded.value === type ? '' : type
}

/** 读取卡片当前难度（持久化偏好） */
function levelOf(card) {
  return settingsStore.settings[card.levelKey]
}

/** 读取卡片当前训练模式（持久化偏好） */
function modeOf(card) {
  return settingsStore.settings[card.modeKey]
}

/** 选择难度并持久化 */
function selectLevel(card, level) {
  settingsStore.update({ [card.levelKey]: level })
}

/** 选择训练模式并持久化（错题模式无错题时忽略） */
function selectMode(card, mode) {
  if (mode === 'wrong' && wrongCountOf(card.type) === 0) return
  settingsStore.update({ [card.modeKey]: mode })
}

/** 该模块错题数 */
function wrongCountOf(type) {
  if (type === 'scale') return wrongbook.scaleCount
  if (type === 'chord') return wrongbook.chordCount
  if (type === 'progression') return wrongbook.progressionCount
  return wrongbook.circleCount
}

/** 难度 chip 副文案：音级显示调名，和弦显示段位名 */
function chipSub(d, type) {
  if (type === 'scale') return d.key
  return d.label.split('·')[1]?.trim() ?? ''
}

/** 收起态卡片摘要 */
function summaryOf(card) {
  const level = levelOf(card)
  const mode = modeOf(card)
  const diff = card.difficulties.find((d) => d.level === level)
  const levelText =
    card.type === 'scale' ? `L${level} · ${diff.key} 大调` : diff.label
  let modeText
  if (mode === 'count') {
    modeText = `题量 ${totalQuestions.value} 题`
  } else if (mode === 'time') {
    modeText = `限时 ${sessionTime.value / 60} 分钟`
  } else {
    modeText = `错题 ${wrongCountOf(card.type)} 题`
  }
  return `${levelText} · ${modeText}`
}

/** 开始训练：携带 query 跳转训练页 */
function startTraining(card) {
  const mode = modeOf(card)
  if (mode === 'wrong' && wrongCountOf(card.type) === 0) return

  const query = {
    type: card.type,
    level: String(levelOf(card)),
    trainMode: mode,
  }
  if (mode === 'count') {
    query.totalQuestions = String(totalQuestions.value)
  } else if (mode === 'time') {
    query.sessionTime = String(sessionTime.value)
  }
  // 错题模式不带题量参数，训练页自行从 wrongbook store 取错题
  router.push({ path: '/train', query })
}

/** 进入吉他指板记忆工具 */
function openFretboardTool() {
  router.push('/tools/fretboard')
}
</script>

<style scoped>
.home {
  padding: 24px 16px 112px;
}

/* ============== 顶部标题 ============== */
.home-header {
  padding: 8px 4px 20px;
}

.app-name {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--primary-color);
}

.app-subtitle {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

/* ============== 训练卡片 ============== */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.train-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  min-height: 56px;
}

.card-head-main {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-color);
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.card-tagline {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--primary-color);
  background: var(--primary-light);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}

.card-desc {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.card-summary {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--primary-color);
}

.card-chevron {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
}

.card-chevron.open {
  transform: rotate(180deg);
}

.card-body {
  padding: 0 16px 16px;
}

/* ============== 配置区块 ============== */
.config-block {
  margin-top: 14px;
}

.config-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* 横向可滑动 chip 列表 */
.chip-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  border: 1.5px solid var(--border-color);
  background: var(--card-bg);
  border-radius: var(--radius-md);
  color: var(--text-color);
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.chip:active {
  transform: scale(0.95);
}

.level-chip {
  min-width: 58px;
  height: 52px;
  padding: 0 10px;
}

.level-chip .chip-main {
  font-size: 15px;
  font-weight: 800;
}

.level-chip .chip-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.chip.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.chip.active .chip-sub {
  color: rgba(255, 255, 255, 0.85);
}

/* 训练模式按钮 */
.mode-row {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  min-height: 44px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.mode-btn .mode-icon {
  font-size: 18px;
  line-height: 1;
}

.mode-btn.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-dark);
}

.mode-btn:disabled {
  opacity: 0.45;
  background: var(--bg-color);
}

/* 子选项（题量 / 时长） */
.sub-options {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.sub-chip {
  min-width: 64px;
  height: 38px;
  padding: 0 14px;
  font-size: var(--font-size-sm);
}

/* 错题模式提示 */
.wrong-tip {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.wrong-tip strong {
  font-size: var(--font-size-md);
}

.wrong-tip .disabled-tip {
  color: var(--text-tertiary);
}

/* 开始训练主按钮 */
.start-btn {
  margin-top: 18px;
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

.start-btn:active:not(:disabled) {
  background: var(--primary-dark);
}

.start-btn:disabled {
  background: var(--border-color);
  box-shadow: none;
  color: var(--text-tertiary);
}

/* ============== 练习工具栏目 ============== */
.tools-section {
  margin-top: 28px;
}

.tools-title {
  font-size: var(--font-size-md);
  font-weight: 800;
  color: var(--text-color);
  margin: 0 4px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tools-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  cursor: pointer;
}

.tool-card:active {
  transform: scale(0.985);
}

.tool-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
}

.tool-desc {
  margin-top: 3px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.tool-arrow {
  flex-shrink: 0;
  font-size: 24px;
  color: var(--text-tertiary);
  line-height: 1;
}

/* ============== 底部功能入口 ============== */
.bottom-nav {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  background: var(--card-bg);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 48px;
  justify-content: center;
  color: var(--text-secondary);
}

.nav-icon {
  position: relative;
  font-size: 22px;
  line-height: 1.2;
}

.nav-label {
  font-size: 12px;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -14px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--err-color, #ff3b30);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--card-bg);
  box-sizing: content-box;
}
</style>
