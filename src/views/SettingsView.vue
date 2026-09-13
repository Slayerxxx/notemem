<template>
  <div class="settings">
    <!-- 顶部导航 -->
    <header class="page-header">
      <button type="button" class="back-btn" aria-label="返回首页" @click="goHome">
        ‹
      </button>
      <h1 class="page-title">设置</h1>
    </header>

    <!-- 默认难度 -->
    <section class="setting-card">
      <h2 class="card-title">默认难度</h2>

      <p class="group-label">音级训练</p>
      <div class="chip-scroll">
        <button
          v-for="d in SCALE_DIFFICULTIES"
          :key="d.level"
          type="button"
          class="chip"
          :class="{ active: settings.settings.scaleLevel === d.level }"
          @click="update({ scaleLevel: d.level })"
        >
          <span class="chip-main">L{{ d.level }}</span>
          <span class="chip-sub">{{ d.key }}</span>
        </button>
      </div>

      <p class="group-label">和弦训练</p>
      <div class="chip-scroll">
        <button
          v-for="d in CHORD_DIFFICULTIES"
          :key="d.level"
          type="button"
          class="chip"
          :class="{ active: settings.settings.chordLevel === d.level }"
          @click="update({ chordLevel: d.level })"
        >
          <span class="chip-main">L{{ d.level }}</span>
          <span class="chip-sub">{{ d.label.split('·')[1]?.trim() }}</span>
        </button>
      </div>

      <p class="group-label">五度圈训练</p>
      <div class="chip-scroll">
        <button
          v-for="d in CIRCLE_DIFFICULTIES"
          :key="d.level"
          type="button"
          class="chip"
          :class="{ active: settings.settings.circleLevel === d.level }"
          @click="update({ circleLevel: d.level })"
        >
          <span class="chip-main">L{{ d.level }}</span>
          <span class="chip-sub">{{ d.label.split('·')[1]?.trim() }}</span>
        </button>
      </div>

      <p class="group-label">和弦进行识别</p>
      <div class="chip-scroll">
        <button
          v-for="d in PROGRESSION_DIFFICULTIES"
          :key="d.level"
          type="button"
          class="chip"
          :class="{ active: settings.settings.progressionLevel === d.level }"
          @click="update({ progressionLevel: d.level })"
        >
          <span class="chip-main">L{{ d.level }}</span>
          <span class="chip-sub">{{ d.name }}</span>
        </button>
      </div>
    </section>

    <!-- 默认训练模式 -->
    <section class="setting-card">
      <h2 class="card-title">默认训练模式</h2>

      <p class="group-label">音级训练</p>
      <div class="mode-row">
        <button
          v-for="m in MODE_OPTIONS"
          :key="m.value"
          type="button"
          class="mode-btn"
          :class="{ active: settings.settings.scaleTrainMode === m.value }"
          @click="update({ scaleTrainMode: m.value })"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="group-label">和弦训练</p>
      <div class="mode-row">
        <button
          v-for="m in MODE_OPTIONS"
          :key="m.value"
          type="button"
          class="mode-btn"
          :class="{ active: settings.settings.chordTrainMode === m.value }"
          @click="update({ chordTrainMode: m.value })"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="group-label">五度圈训练</p>
      <div class="mode-row">
        <button
          v-for="m in MODE_OPTIONS"
          :key="m.value"
          type="button"
          class="mode-btn"
          :class="{ active: settings.settings.circleTrainMode === m.value }"
          @click="update({ circleTrainMode: m.value })"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="group-label">和弦进行识别</p>
      <div class="mode-row">
        <button
          v-for="m in MODE_OPTIONS"
          :key="m.value"
          type="button"
          class="mode-btn"
          :class="{ active: settings.settings.progressionTrainMode === m.value }"
          @click="update({ progressionTrainMode: m.value })"
        >
          {{ m.label }}
        </button>
      </div>
    </section>

    <!-- 音效 -->
    <section class="setting-card">
      <div class="toggle-row">
        <div>
          <h2 class="card-title">音效反馈</h2>
          <p class="card-desc">答题正确 / 错误时播放提示音</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ on: settings.settings.soundEnabled }"
          role="switch"
          :aria-checked="settings.settings.soundEnabled"
          @click="toggleSound"
        >
          <span class="switch-knob" />
        </button>
      </div>
    </section>

    <!-- 数据管理 -->
    <section class="setting-card">
      <h2 class="card-title">数据管理</h2>
      <div class="danger-list">
        <template v-if="confirming === 'wrongbook'">
          <p class="confirm-tip">确认清空全部错题？此操作不可恢复</p>
          <div class="confirm-row">
            <button type="button" class="danger-btn solid" @click="doClearWrongbook">
              确认清空
            </button>
            <button type="button" class="danger-btn ghost" @click="confirming = null">
              取消
            </button>
          </div>
        </template>
        <button
          v-else
          type="button"
          class="danger-btn ghost"
          :disabled="wrongbook.count === 0"
          @click="confirming = 'wrongbook'"
        >
          清空错题本（{{ wrongbook.count }}）
        </button>

        <template v-if="confirming === 'stats'">
          <p class="confirm-tip">确认清空全部统计数据？此操作不可恢复</p>
          <div class="confirm-row">
            <button type="button" class="danger-btn solid" @click="doClearStats">
              确认清空
            </button>
            <button type="button" class="danger-btn ghost" @click="confirming = null">
              取消
            </button>
          </div>
        </template>
        <button
          v-else
          type="button"
          class="danger-btn ghost"
          @click="confirming = 'stats'"
        >
          清空统计数据
        </button>

        <template v-if="confirming === 'settings'">
          <p class="confirm-tip">确认恢复默认设置？自定义预设将一并清除</p>
          <div class="confirm-row">
            <button type="button" class="danger-btn solid" @click="doResetSettings">
              确认重置
            </button>
            <button type="button" class="danger-btn ghost" @click="confirming = null">
              取消
            </button>
          </div>
        </template>
        <button
          v-else
          type="button"
          class="danger-btn ghost"
          @click="confirming = 'settings'"
        >
          重置所有设置
        </button>
      </div>
    </section>

    <!-- 关于 -->
    <section class="setting-card">
      <h2 class="card-title">关于</h2>
      <p class="about-line">NoteMem · 固定音名记忆训练</p>
      <p class="about-line">版本 v0.1.0</p>
    </section>
  </div>
</template>

<script setup>
/**
 * SettingsView.vue
 * 设置页：默认难度 / 默认训练模式 / 音效开关 / 数据管理（均带二次确认）/ 关于。
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings.js'
import { useWrongBookStore } from '../stores/wrongbook.js'
import { useStatsStore } from '../stores/stats.js'
import {
  SCALE_DIFFICULTIES,
  CHORD_DIFFICULTIES,
  CIRCLE_DIFFICULTIES,
} from '../music/difficulty.js'
import { PROGRESSION_DIFFICULTIES } from '../music/progression.js'

const router = useRouter()
const settings = useSettingsStore()
const wrongbook = useWrongBookStore()
const stats = useStatsStore()

/** 默认训练模式可选项（错题模式由错题本驱动，不作为默认项） */
const MODE_OPTIONS = [
  { value: 'count', label: '题量模式' },
  { value: 'time', label: '限时模式' },
]

/** 当前二次确认目标：wrongbook | stats | settings | null */
const confirming = ref(null)

function update(partial) {
  settings.update(partial)
}

function toggleSound() {
  update({ soundEnabled: !settings.settings.soundEnabled })
}

function doClearWrongbook() {
  wrongbook.clearAll()
  confirming.value = null
}

function doClearStats() {
  stats.clearAll()
  confirming.value = null
}

function doResetSettings() {
  settings.reset()
  confirming.value = null
}

function goHome() {
  router.replace('/')
}
</script>

<style scoped>
.settings {
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

/* ============== 设置卡片 ============== */
.setting-card {
  margin-top: 14px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}

.card-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
}

.card-desc {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.group-label {
  margin-top: 12px;
  margin-bottom: 6px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

/* ============== 难度 chips ============== */
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
}

.chip.active .chip-sub {
  color: rgba(255, 255, 255, 0.85);
}

/* ============== 模式按钮 ============== */
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
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.mode-btn.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-dark);
}

/* ============== 音效开关 ============== */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.switch {
  flex-shrink: 0;
  width: 52px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--border-color);
  position: relative;
  transition: background-color 0.2s ease;
}

.switch.on {
  background: var(--ok-color);
}

.switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.switch.on .switch-knob {
  transform: translateX(20px);
}

/* ============== 数据管理 ============== */
.danger-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.danger-btn {
  width: 100%;
  min-height: 44px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.danger-btn.ghost {
  border: 1.5px solid var(--err-color);
  background: var(--card-bg);
  color: var(--err-color);
}

.danger-btn.ghost:disabled {
  border-color: var(--border-color);
  color: var(--text-tertiary);
  opacity: 0.6;
}

.danger-btn.solid {
  background: var(--err-color);
  color: #fff;
}

.confirm-tip {
  font-size: var(--font-size-sm);
  color: var(--err-dark);
  text-align: center;
  line-height: 1.4;
}

.confirm-row {
  display: flex;
  gap: 8px;
}

/* ============== 关于 ============== */
.about-line {
  margin-top: 6px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
</style>
