<template>
  <div class="stats">
    <!-- 顶部导航 -->
    <header class="page-header">
      <button type="button" class="back-btn" aria-label="返回首页" @click="goHome">
        ‹
      </button>
      <h1 class="page-title">训练统计</h1>
    </header>

    <!-- 模块 Tab -->
    <nav class="tab-row">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="tab-btn"
        :class="{ active: currentType === t.value }"
        @click="switchType(t.value)"
      >
        {{ t.label }}
      </button>
    </nav>

    <!-- 难度选择（有数据的等级高亮圆点） -->
    <div class="chip-scroll">
      <button
        v-for="d in difficulties"
        :key="d.level"
        type="button"
        class="chip"
        :class="{ active: currentLevel === d.level }"
        @click="currentLevel = d.level"
      >
        <span class="chip-main">L{{ d.level }}</span>
        <span class="chip-sub">
          {{ chipSub(d) }}<i v-if="hasData(d.level)" class="data-dot" />
        </span>
      </button>
    </div>

    <!-- 统计详情 -->
    <template v-if="record">
      <section class="stat-card">
        <h2 class="stat-card-title">{{ heading }}</h2>
        <div class="stat-grid">
          <div class="stat-cell">
            <p class="stat-num highlight">{{ record.bestScore }}</p>
            <p class="stat-label">历史最高分</p>
          </div>
          <div class="stat-cell">
            <p class="stat-num">{{ accuracyText }}</p>
            <p class="stat-label">累计正确率</p>
          </div>
          <div class="stat-cell">
            <p class="stat-num">{{ avgReactionText }}</p>
            <p class="stat-label">平均反应</p>
          </div>
          <div class="stat-cell">
            <p class="stat-num">{{ record.totalAnswered }}</p>
            <p class="stat-label">累计答题</p>
          </div>
          <div class="stat-cell">
            <p class="stat-num">{{ record.sessions }}</p>
            <p class="stat-label">训练轮次</p>
          </div>
          <div class="stat-cell">
            <p class="stat-num">{{ record.totalCorrect }}</p>
            <p class="stat-label">答对题数</p>
          </div>
        </div>
      </section>

      <!-- 最近 10 轮得分趋势 -->
      <section class="stat-card">
        <h2 class="stat-card-title">最近 {{ record.recentScores.length }} 轮得分</h2>
        <div class="bar-chart">
          <div
            v-for="(s, i) in record.recentScores"
            :key="i"
            class="bar-col"
          >
            <span class="bar-value">{{ s }}</span>
            <div
              class="bar"
              :style="{ height: barHeight(s) + '%' }"
            />
            <span class="bar-index">{{ i + 1 }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- 无数据空态 -->
    <div v-else class="empty-state">
      <p class="empty-icon">📊</p>
      <p class="empty-text">该难度还没有训练记录，去首页开始第一轮吧</p>
      <button type="button" class="empty-btn" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<script setup>
/**
 * StatsView.vue
 * 统计页：模块 Tab + 难度选择 + 累计数据 + 最近 10 轮得分柱状趋势。
 * 数据来源 stats store（按 `${type}_${level}` 维度累积）。
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStatsStore } from '../stores/stats.js'
import { SCALE_DIFFICULTIES, CHORD_DIFFICULTIES } from '../music/difficulty.js'

const router = useRouter()
const stats = useStatsStore()

const TABS = [
  { value: 'scale', label: '音级训练' },
  { value: 'chord', label: '和弦训练' },
]

/** 首次进入时默认定位到有数据的难度（无数据则 L1） */
function defaultLevel(type) {
  const pool = type === 'scale' ? SCALE_DIFFICULTIES : CHORD_DIFFICULTIES
  const withData = pool.find((d) => stats.getRecord(type, d.level))
  return withData?.level ?? 1
}

const currentType = ref('scale')
const currentLevel = ref(defaultLevel('scale'))

const difficulties = computed(() =>
  currentType.value === 'scale' ? SCALE_DIFFICULTIES : CHORD_DIFFICULTIES
)

const record = computed(() => stats.getRecord(currentType.value, currentLevel.value))

const heading = computed(() => {
  const pool = difficulties.value
  const d = pool.find((x) => x.level === currentLevel.value)
  return currentType.value === 'scale'
    ? `${d?.key ?? ''} 大调 · ${d?.label ?? ''}`
    : (d?.label ?? '')
})

const accuracyText = computed(() => {
  const a = stats.accuracyOf(currentType.value, currentLevel.value)
  return `${Math.round(a * 100)}%`
})

const avgReactionText = computed(() => {
  const ms = stats.avgReactionOf(currentType.value, currentLevel.value)
  if (!ms) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
})

/** 该难度是否有历史数据（chip 上亮圆点） */
function hasData(level) {
  return stats.getRecord(currentType.value, level) != null
}

function chipSub(d) {
  if (currentType.value !== 'scale') return d.label.split('·')[1]?.trim() ?? ''
  return d.key
}

/** 柱高按近 10 轮最大得分归一化 */
function barHeight(score) {
  const scores = record.value?.recentScores ?? []
  const max = Math.max(...scores, 1)
  return Math.max(6, Math.round((score / max) * 100))
}

function switchType(type) {
  currentType.value = type
  currentLevel.value = defaultLevel(type)
}

function goHome() {
  router.replace('/')
}
</script>

<style scoped>
.stats {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

/* ============== 顶部 ============== */
.page-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
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

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-color);
}

/* ============== Tab ============== */
.tab-row {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.tab-btn {
  flex: 1;
  min-height: 40px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.tab-btn.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-dark);
}

/* ============== 难度 chips ============== */
.chip-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  margin-top: 14px;
  padding-bottom: 4px;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  min-width: 54px;
  height: 50px;
  padding: 0 10px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.chip.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.chip-main {
  font-size: 14px;
  font-weight: 800;
}

.chip-sub {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 3px;
}

.chip.active .chip-sub {
  color: rgba(255, 255, 255, 0.85);
}

.data-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--ok-color);
}

/* ============== 统计卡片 ============== */
.stat-card {
  margin-top: 14px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.stat-card-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
}

.stat-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 8px;
}

.stat-cell {
  text-align: center;
}

.stat-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-color);
  font-variant-numeric: tabular-nums;
}

.stat-num.highlight {
  color: var(--combo-color);
}

.stat-label {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* ============== 得分柱状图 ============== */
.bar-chart {
  margin-top: 14px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 140px;
}

.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.bar-value {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.bar {
  width: 100%;
  max-width: 28px;
  border-radius: 4px 4px 0 0;
  background: var(--primary-color);
  opacity: 0.85;
  min-height: 4px;
}

.bar-col:last-child .bar {
  background: var(--ok-color);
  opacity: 1;
}

.bar-index {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ============== 空状态 ============== */
.empty-state {
  margin-top: 80px;
  text-align: center;
}

.empty-icon {
  font-size: 56px;
  line-height: 1;
}

.empty-text {
  margin-top: 14px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.empty-btn {
  margin-top: 20px;
  min-height: 44px;
  padding: 0 24px;
  border-radius: var(--radius-md);
  background: var(--primary-color);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
}
</style>
