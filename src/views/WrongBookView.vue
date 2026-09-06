<template>
  <div class="wrongbook">
    <!-- 顶部导航 -->
    <header class="page-header">
      <button type="button" class="back-btn" aria-label="返回首页" @click="goHome">
        ‹
      </button>
      <h1 class="page-title">错题本</h1>
      <span class="total-badge">{{ wrongbook.count }}</span>
    </header>

    <!-- Tab 切换 -->
    <nav class="tab-row">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="tab-btn"
        :class="{ active: currentTab === t.value }"
        @click="switchTab(t.value)"
      >
        {{ t.label }}
      </button>
    </nav>

    <!-- 错题列表 -->
    <div v-if="filteredList.length > 0" class="wrong-list">
      <article
        v-for="item in filteredList"
        :key="item.id"
        class="wrong-card animate-fade-up"
      >
        <div class="wrong-main">
          <p class="wrong-prompt">{{ item.promptText }}</p>
          <p class="wrong-line correct-line">
            正确答案：{{ item.correctAnswer }}
          </p>
          <p class="wrong-line user-line">你的答案：{{ item.userAnswer }}</p>
          <p class="wrong-date">{{ formatDate(item.timestamp) }}</p>
        </div>
        <button
          type="button"
          class="remove-btn"
          aria-label="移除该错题"
          @click="wrongbook.removeItem(item.id)"
        >
          移除
        </button>
      </article>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p class="empty-icon">📕</p>
      <p class="empty-text">
        {{ currentTab === 'all' ? '还没有错题，完成一轮训练后自动收集' : '该模块暂无错题' }}
      </p>
      <button type="button" class="empty-btn" @click="goHome">返回首页训练</button>
    </div>

    <!-- 底部操作栏 -->
    <footer v-if="filteredList.length > 0" class="bottom-bar">
      <template v-if="!confirmingClear">
        <button type="button" class="bar-btn danger-ghost" @click="confirmingClear = true">
          清空{{ tabLabel }}
        </button>
        <button
          v-for="t in trainableTabs"
          :key="t.value"
          type="button"
          class="bar-btn primary"
          @click="startWrongTraining(t.value)"
        >
          练{{ t.short }}错题（{{ typeCount(t.value) }}）
        </button>
      </template>
      <template v-else>
        <p class="confirm-text">确认清空{{ tabLabel }}？此操作不可恢复</p>
        <div class="confirm-row">
          <button type="button" class="bar-btn danger" @click="doClear">确认清空</button>
          <button type="button" class="bar-btn secondary" @click="confirmingClear = false">
            取消
          </button>
        </div>
      </template>
    </footer>
  </div>
</template>

<script setup>
/**
 * WrongBookView.vue
 * 错题本页：Tab 筛选 + 错题列表 + 单条移除 + 清空（二次确认）+ 错题模式训练入口。
 * 支持 query.type 预选 Tab（结算页「查看错题」跳转携带）。
 */
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWrongBookStore } from '../stores/wrongbook.js'
import { useSettingsStore } from '../stores/settings.js'

const route = useRoute()
const router = useRouter()
const wrongbook = useWrongBookStore()
const settings = useSettingsStore()

const TABS = [
  { value: 'all', label: '全部', short: '全部' },
  { value: 'scale', label: '音级训练', short: '音级' },
  { value: 'chord', label: '和弦训练', short: '和弦' },
]

/** Tab 预选：query.type 合法时使用，否则「全部」 */
const currentTab = ref(TABS.some((t) => t.value === route.query.type) ? route.query.type : 'all')

/** 清空二次确认态 */
const confirmingClear = ref(false)

const tabLabel = computed(() => {
  if (currentTab.value === 'all') return '全部错题'
  return currentTab.value === 'scale' ? '音级错题' : '和弦错题'
})

/** 当前 Tab 的错题列表 */
const filteredList = computed(() => {
  if (currentTab.value === 'all') return wrongbook.items
  return wrongbook.getByType(currentTab.value)
})

/** 当前视野内可发起错题训练的类型（有错题才显示） */
const trainableTabs = computed(() => {
  if (currentTab.value !== 'all') {
    return typeCount(currentTab.value) > 0
      ? [TABS.find((t) => t.value === currentTab.value)]
      : []
  }
  return TABS.slice(1).filter((t) => typeCount(t.value) > 0)
})

function typeCount(type) {
  return type === 'scale' ? wrongbook.scaleCount : wrongbook.chordCount
}

function switchTab(value) {
  currentTab.value = value
  confirmingClear.value = false
}

function formatDate(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function doClear() {
  wrongbook.clearAll(currentTab.value === 'all' ? undefined : currentTab.value)
  confirmingClear.value = false
}

/** 发起对应模块的错题模式训练（难度取用户默认设置） */
function startWrongTraining(type) {
  const levelKey = type === 'scale' ? 'scaleLevel' : 'chordLevel'
  router.push({
    path: '/train',
    query: {
      type,
      level: String(settings.settings[levelKey] ?? 1),
      trainMode: 'wrong',
    },
  })
}

function goHome() {
  router.replace('/')
}
</script>

<style scoped>
.wrongbook {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 12px 16px calc(96px + env(safe-area-inset-bottom, 0px));
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

.total-badge {
  margin-left: auto;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  background: var(--err-light);
  color: var(--err-dark);
  font-size: var(--font-size-sm);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* ============== 错题列表 ============== */
.wrong-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wrong-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 12px 14px;
}

.wrong-main {
  flex: 1;
  min-width: 0;
}

.wrong-prompt {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.4;
}

.wrong-line {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.correct-line {
  color: var(--ok-dark);
}

.user-line {
  color: var(--err-dark);
}

.wrong-date {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.remove-btn {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
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
  line-height: 1.5;
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

/* ============== 底部操作栏 ============== */
.bottom-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--card-bg);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
}

.bar-btn {
  width: 100%;
  min-height: 44px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.bar-btn.primary {
  background: var(--primary-color);
  color: #fff;
}

.bar-btn.primary:active:not(:disabled) {
  background: var(--primary-dark);
}

.bar-btn.danger {
  background: var(--err-color);
  color: #fff;
}

.bar-btn.danger-ghost {
  background: var(--card-bg);
  border: 1.5px solid var(--err-color);
  color: var(--err-color);
}

.bar-btn.secondary {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.confirm-text {
  font-size: var(--font-size-sm);
  color: var(--err-dark);
  text-align: center;
  line-height: 1.4;
}

.confirm-row {
  display: flex;
  gap: 8px;
}
</style>
