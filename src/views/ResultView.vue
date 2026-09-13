<template>
  <div v-if="cfg" class="result">
    <!-- ============== 成绩概览 ============== -->
    <section class="overview-card">
      <p class="grade-label">本轮评价</p>
      <p class="grade-text" :class="gradeClass">{{ grade }}</p>
      <p class="score-line">
        得分 <strong class="score-num">{{ sum.score }}</strong> 分
      </p>

      <!-- 正确率圆环 -->
      <svg class="accuracy-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="ring-bg" cx="60" cy="60" r="52" />
        <circle
          class="ring-fg"
          cx="60"
          cy="60"
          r="52"
          :style="{ strokeDashoffset: ringOffset }"
        />
        <text class="ring-num" x="60" y="66" text-anchor="middle">
          {{ accuracyPercent }}%
        </text>
      </svg>
      <p class="ring-caption">正确率（{{ sum.correct }}/{{ sum.total }}）</p>
    </section>

    <!-- ============== 详细数据 ============== -->
    <section class="detail-card">
      <h2 class="detail-title">训练详情</h2>
      <ul class="detail-list">
        <li class="detail-item">
          <span class="detail-label">平均反应</span>
          <span class="detail-value">{{ avgReactionText }}</span>
        </li>
        <li class="detail-item">
          <span class="detail-label">最快反应</span>
          <span class="detail-value">{{ fastestText }}</span>
        </li>
        <li class="detail-item">
          <span class="detail-label">最长连击</span>
          <span class="detail-value">🔥 {{ sum.maxCombo }}</span>
        </li>
        <li class="detail-item">
          <span class="detail-label">错题数量</span>
          <span class="detail-value" :class="{ 'has-wrong': sum.wrongCount > 0 }">
            {{ sum.wrongCount }}
          </span>
        </li>
      </ul>
      <p class="scope-line">{{ scopeText }}</p>
    </section>

    <!-- ============== 操作按钮 ============== -->
    <section class="action-area">
      <button type="button" class="action-btn primary" @click="replay">
        再练一轮
      </button>
      <button
        v-if="sum.wrongCount > 0"
        type="button"
        class="action-btn secondary"
        @click="goWrongBook"
      >
        查看错题（{{ sum.wrongCount }}）
      </button>
      <button type="button" class="action-btn secondary" @click="goHome">
        返回首页
      </button>
    </section>
  </div>
</template>

<script setup>
/**
 * ResultView.vue
 * 结算页：成绩概览 + 详细数据 + 操作按钮。
 *
 * 数据来源：game store（训练结束时 TrainView 已完成统计落库，
 * 此处只负责展示与再次发起训练）。
 * 直接访问且无本轮数据时回首页。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { useWrongBookStore } from '../stores/wrongbook.js'
import {
  SCALE_DIFFICULTIES,
  CHORD_DIFFICULTIES,
  CIRCLE_DIFFICULTIES,
} from '../music/difficulty.js'
import { PROGRESSION_DIFFICULTIES } from '../music/progression.js'

const router = useRouter()
const game = useGameStore()
const wrongbook = useWrongBookStore()

const cfg = computed(() => game.config)
const sum = computed(() => game.summary)

// ============== 展示计算 ==============

const accuracyPercent = computed(() => Math.round(sum.value.accuracy * 100))

/** 圆环进度：周长 2πr ≈ 326.7，按正确率裁剪 */
const RING_LEN = 2 * Math.PI * 52
const ringOffset = computed(
  () => RING_LEN * (1 - Math.min(1, Math.max(0, sum.value.accuracy)))
)

/** 评价等级：按正确率 S/A/B/C/D */
const grade = computed(() => {
  const a = sum.value.accuracy
  if (sum.value.total === 0) return '-'
  if (a >= 0.95) return 'S'
  if (a >= 0.85) return 'A'
  if (a >= 0.7) return 'B'
  if (a >= 0.5) return 'C'
  return 'D'
})

const gradeClass = computed(() => `grade-${grade.value.toLowerCase()}`)

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} 秒` : `${Math.round(ms)} 毫秒`
}

const avgReactionText = computed(() => formatMs(sum.value.avgReactionMs))
const fastestText = computed(() =>
  sum.value.fastestReactionMs == null ? '—' : formatMs(sum.value.fastestReactionMs)
)

/** 本轮训练范围描述（模块 + 难度 + 模式） */
const scopeText = computed(() => {
  const c = cfg.value
  if (!c) return ''
  const diffPool =
    c.type === 'scale'
      ? SCALE_DIFFICULTIES
      : c.type === 'circle'
        ? CIRCLE_DIFFICULTIES
        : c.type === 'progression'
          ? PROGRESSION_DIFFICULTIES
          : CHORD_DIFFICULTIES
  const diff = diffPool.find((d) => d.level === c.level)
  const typeText =
    c.type === 'scale'
      ? `${diff?.key ?? ''} 大调音级`
      : c.type === 'circle'
        ? '五度圈相邻音'
        : c.type === 'progression'
          ? '和弦进行识别'
          : '和弦组成音'
  const modeText =
    c.trainMode === 'time'
      ? `限时 ${c.sessionTime / 60} 分钟`
      : c.trainMode === 'wrong'
        ? '错题强化'
        : c.trainMode === 'custom'
          ? '自定义'
          : `题量 ${c.totalQuestions} 题`
  return `本轮：${typeText} · ${diff?.label ?? `L${c.level}`} · ${modeText}`
})

// ============== 操作 ==============

/** 再练一轮：以相同配置重新开始（错题模式重新取错题本） */
function replay() {
  const c = cfg.value
  if (!c) return
  const next = {
    type: c.type,
    level: c.level,
    trainMode: c.trainMode,
    timeLimit: c.timeLimit,
  }
  // 进行题出题依赖 manifest（config 中已持有本轮加载的实例）
  if (c.type === 'progression') {
    next.manifest = c.manifest
  }
  if (c.trainMode === 'count') next.totalQuestions = c.totalQuestions
  if (c.trainMode === 'time') next.sessionTime = c.sessionTime
  if (c.trainMode === 'custom') {
    next.customKeys = c.customKeys
    next.customRoots = c.customRoots
    next.customNotes = c.customNotes
    next.totalQuestions = c.totalQuestions
  }
  if (c.trainMode === 'wrong') {
    // 错题模式按当前模块重新取数；该模块错题已清空则回首页
    const wrongList = wrongbook.getWrongQuestions(c.type)
    if (wrongList.length === 0) {
      router.replace('/')
      return
    }
    next.wrongQuestions = wrongList
  }
  game.start(next)
  router.replace('/train')
}

function goWrongBook() {
  router.push({ path: '/wrongbook', query: { type: cfg.value?.type } })
}

function goHome() {
  router.replace('/')
}

// 无本轮数据（如刷新 / 直达）时回首页
if (!game.config) {
  router.replace('/')
}
</script>

<style scoped>
.result {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ============== 成绩概览 ============== */
.overview-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 24px 16px;
  text-align: center;
}

.grade-label {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.grade-text {
  font-size: 56px;
  font-weight: 800;
  line-height: 1.2;
}

.grade-s {
  color: var(--combo-color);
}

.grade-a {
  color: var(--ok-color);
}

.grade-b {
  color: var(--primary-color);
}

.grade-c {
  color: var(--warning-color);
}

.grade-d {
  color: var(--err-color);
}

.score-line {
  margin-top: 6px;
  font-size: var(--font-size-md);
  color: var(--text-secondary);
}

.score-num {
  font-size: 28px;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
}

/* 正确率圆环 */
.accuracy-ring {
  width: 132px;
  height: 132px;
  margin: 12px auto 0;
  display: block;
  transform: rotate(-90deg);
}

.ring-bg,
.ring-fg {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}

.ring-bg {
  stroke: var(--border-color);
}

.ring-fg {
  stroke: var(--ok-color);
  /* 周长 2πr ≈ 326.7 */
  stroke-dasharray: 326.7;
  transition: stroke-dashoffset 0.6s ease-out;
}

.ring-num {
  font-size: 24px;
  font-weight: 800;
  fill: var(--text-color);
  transform: rotate(90deg);
  transform-origin: 60px 60px;
}

.ring-caption {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

/* ============== 详细数据 ============== */
.detail-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.detail-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
}

.detail-list {
  margin-top: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  border-bottom: 1px solid var(--border-color);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.detail-value {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
  font-variant-numeric: tabular-nums;
}

.detail-value.has-wrong {
  color: var(--err-color);
}

.scope-line {
  margin-top: 10px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* ============== 操作按钮 ============== */
.action-area {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  width: 100%;
  min-height: 52px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 700;
}

.action-btn.primary {
  background: var(--primary-color);
  color: #fff;
  box-shadow: 0 4px 12px rgba(79, 124, 255, 0.3);
  letter-spacing: 2px;
}

.action-btn.primary:active:not(:disabled) {
  background: var(--primary-dark);
}

.action-btn.secondary {
  background: var(--card-bg);
  border: 1.5px solid var(--border-color);
  color: var(--text-color);
}
</style>
