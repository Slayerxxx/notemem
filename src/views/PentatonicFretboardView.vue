<template>
  <div class="penta-page">
    <header class="page-header">
      <router-link to="/" class="back-btn" aria-label="返回主页">‹</router-link>
      <div class="header-text">
        <h1 class="page-title">五声音阶指板速查</h1>
        <p class="page-subtitle">{{ keyName }} {{ modeLabel }}五声音阶 · 全指板</p>
      </div>
    </header>

    <!-- 调选择 -->
    <section class="cfg-card">
      <p class="cfg-label">选择调</p>
      <div class="chip-scroll">
        <button
          v-for="k in MAJOR_KEYS"
          :key="k"
          type="button"
          class="chip key-chip"
          :class="{ active: keyName === k }"
          @click="selectKey(k)"
        >
          {{ k }}
        </button>
      </div>
    </section>

    <!-- 音阶类型 + 标注模式 -->
    <section class="cfg-card">
      <div class="cfg-row">
        <div class="cfg-block">
          <p class="cfg-label">音阶类型</p>
          <div class="seg-row">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mode === 'major' }"
              @click="selectMode('major')"
            >大调五声</button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: mode === 'minor' }"
              @click="selectMode('minor')"
            >小调五声</button>
          </div>
        </div>
        <div class="cfg-block">
          <p class="cfg-label">标注</p>
          <div class="seg-row">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: labelMode === 'degree' }"
              @click="selectLabelMode('degree')"
            >数字</button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: labelMode === 'note' }"
              @click="selectLabelMode('note')"
            >音名</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 指板 -->
    <section class="board-area">
      <div class="board-toolbar">
        <span class="board-toolbar-label">指板</span>
        <button
          type="button"
          class="fs-toggle"
          aria-label="全屏查看指板"
          @click="enterFullscreen"
        >
          <span class="fs-toggle-icon" aria-hidden="true">⤢</span>
          <span>全屏</span>
        </button>
      </div>
      <PentatonicFretboardDiagram
        :key-name="keyName"
        :mode="mode"
        :label-mode="labelMode"
      />
    </section>

    <!-- 图例 -->
    <section class="legend">
      <div class="legend-item">
        <span class="legend-dot root" />
        <span class="legend-text">根音 1</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" />
        <span class="legend-text">其他音级</span>
      </div>
      <span class="legend-divider" />
      <div class="legend-scale">
        <span v-for="n in scaleNotes" :key="n.degree" class="scale-chip">
          <span class="scale-degree">{{ n.degree }}</span>
          <span class="scale-name">{{ n.name }}</span>
        </span>
      </div>
    </section>

    <!-- 全屏覆盖层：放大指板并锁定横屏 -->
    <Teleport to="body">
      <div
        v-if="fullscreen"
        ref="fsOverlay"
        class="fs-overlay"
        :class="{ 'is-browser-fullscreen': browserFullscreen }"
      >
        <button
          type="button"
          class="fs-close"
          aria-label="退出全屏"
          @click="exitFullscreen"
        >✕</button>
        <div class="fs-board-wrap">
          <PentatonicFretboardDiagram
            :key-name="keyName"
            :mode="mode"
            :label-mode="labelMode"
            fullscreen
          />
        </div>
        <p v-if="showRotateHint" class="fs-rotate-hint">
          请将设备横置以获得更好体验
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { MAJOR_KEYS, getPentatonicScale } from '../music/index.js'
import PentatonicFretboardDiagram from '../components/PentatonicFretboardDiagram.vue'

const settingsStore = useSettingsStore()

const keyName = ref(settingsStore.settings.pentatonicKey ?? 'A')
const mode = ref(settingsStore.settings.pentatonicMode ?? 'minor')
const labelMode = ref(settingsStore.settings.pentatonicLabelMode ?? 'degree')

const modeLabel = computed(() => (mode.value === 'major' ? '大调' : '小调'))

const scaleNotes = computed(() => getPentatonicScale(keyName.value, mode.value))

function selectKey(k) {
  keyName.value = k
  settingsStore.update({ pentatonicKey: k })
}

function selectMode(m) {
  mode.value = m
  settingsStore.update({ pentatonicMode: m })
}

function selectLabelMode(lm) {
  labelMode.value = lm
  settingsStore.update({ pentatonicLabelMode: lm })
}

// ============== 全屏 + 横屏 ==============
const fsOverlay = ref(null)
/** 是否展示全屏覆盖层（应用层状态，与浏览器 Fullscreen API 解耦） */
const fullscreen = ref(false)
/** 是否成功进入了浏览器原生 Fullscreen 状态 */
const browserFullscreen = ref(false)
/** 浏览器不支持横屏锁定时提示用户手动横置 */
const showRotateHint = ref(false)

function getOrientation() {
  return window.screen?.orientation
}

/** 进入全屏：先渲染覆盖层，再尝试请求浏览器全屏 + 锁定横屏 */
async function enterFullscreen() {
  fullscreen.value = true
  await nextTick()
  const el = fsOverlay.value
  if (!el) return

  // 1) 请求浏览器原生全屏（部分浏览器需要以此作为锁屏前置条件）
  let inBrowserFs = false
  if (el.requestFullscreen) {
    try {
      await el.requestFullscreen()
      inBrowserFs = document.fullscreenElement === el
    } catch (e) {
      inBrowserFs = false
    }
  }
  browserFullscreen.value = inBrowserFs

  // 2) 尝试锁定横屏（Android Chrome 等在浏览器全屏后可用）
  const ori = getOrientation()
  if (inBrowserFs && typeof ori?.lock === 'function') {
    try {
      await ori.lock('landscape')
      showRotateHint.value = false
    } catch (e) {
      // 锁定失败（权限被拒或不支持），提示用户手动横置
      showRotateHint.value = true
    }
  } else if (typeof ori?.lock !== 'function') {
    // 浏览器根本不支持锁屏 API（如 iOS Safari），提示用户手动横置
    showRotateHint.value = true
  }
}

/** 退出全屏：释放横屏锁定 + 退出浏览器全屏 + 关闭覆盖层 */
async function exitFullscreen() {
  const ori = getOrientation()
  if (typeof ori?.unlock === 'function') {
    try { await ori.unlock() } catch (e) { /* 忽略 */ }
  }
  if (document.fullscreenElement) {
    try { await document.exitFullscreen() } catch (e) { /* 忽略 */ }
  }
  browserFullscreen.value = false
  showRotateHint.value = false
  fullscreen.value = false
}

/** 监听浏览器原生全屏状态变化：用户按 ESC 退出时同步关闭覆盖层 */
function onFullscreenChange() {
  if (!document.fullscreenElement && fullscreen.value) {
    browserFullscreen.value = false
    showRotateHint.value = false
    fullscreen.value = false
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // 兼容旧前缀
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  // 组件卸载前若仍处于全屏，主动清理
  if (fullscreen.value) {
    const ori = getOrientation()
    if (typeof ori?.unlock === 'function') {
      try { ori.unlock() } catch (e) { /* 忽略 */ }
    }
    if (document.fullscreenElement) {
      try { document.exitFullscreen() } catch (e) { /* 忽略 */ }
    }
    fullscreen.value = false
  }
})
</script>

<style scoped>
.penta-page {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 18px;
}

.back-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--text-color);
  text-decoration: none;
  line-height: 1;
}

.page-title {
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--text-color);
}

.page-subtitle {
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.cfg-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  margin-bottom: 14px;
}

.cfg-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.cfg-row {
  display: flex;
  gap: 16px;
}

.cfg-block {
  flex: 1;
  min-width: 0;
}

.chip-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  border: 1.5px solid var(--border-color);
  background: var(--card-bg);
  border-radius: var(--radius-full);
  color: var(--text-color);
  font-weight: 600;
  font-size: var(--font-size-sm);
  padding: 9px 16px;
}

.key-chip {
  min-width: 44px;
  text-align: center;
}

.chip.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.seg-row {
  display: flex;
  gap: 8px;
}

.seg-btn {
  flex: 1;
  min-height: 40px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
  padding: 0 10px;
}

.seg-btn.active {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-dark);
}

.board-area {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 10px 8px;
  margin-bottom: 14px;
}

.board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px 8px;
}

.board-toolbar-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-secondary);
}

.fs-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 6px 12px;
  cursor: pointer;
}

.fs-toggle-icon {
  font-size: 14px;
  line-height: 1;
}

/* 全屏覆盖层 */
.fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0c0a08;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  padding: 12px;
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-right: calc(12px + env(safe-area-inset-right, 0px));
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  padding-left: calc(12px + env(safe-area-inset-left, 0px));
  box-sizing: border-box;
  color: #fff;
}

.fs-close {
  position: absolute;
  top: calc(10px + env(safe-area-inset-top, 0px));
  right: calc(10px + env(safe-area-inset-right, 0px));
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.14);
  border: none;
  color: #fff;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
}

.fs-close:active {
  background: rgba(255, 255, 255, 0.24);
}

.fs-board-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fs-rotate-hint {
  margin: 10px 0 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.72);
  font-size: var(--font-size-xs);
  letter-spacing: 0.5px;
}

.legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  background: var(--card-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--primary-color);
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px var(--border-color);
}

.legend-dot.root {
  background: #ff9500;
}

.legend-text {
  font-weight: 600;
}

.legend-divider {
  flex: 1 1 100%;
  height: 1px;
  background: var(--border-color);
  margin: 2px 0;
}

.legend-scale {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.scale-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  min-width: 36px;
}

.scale-degree {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary-dark);
}

.scale-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-color);
}
</style>
