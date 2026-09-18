<template>
  <div class="penta-page" :class="{ 'is-fullscreen': fullscreen }">
    <!-- ========== 普通模式 ========== -->
    <template v-if="!fullscreen">
      <header class="page-header">
        <router-link to="/" class="back-btn" aria-label="返回主页">‹</router-link>
        <div class="header-text">
          <h1 class="page-title">五声音阶指板速查</h1>
          <p class="page-subtitle">{{ keyName }} {{ modeLabel }}五声音阶 · 全指板</p>
        </div>
        <button type="button" class="fs-btn" aria-label="全屏" @click="enterFullscreen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          </svg>
        </button>
      </header>

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
          >{{ k }}</button>
        </div>
      </section>

      <section class="cfg-card">
        <div class="cfg-row">
          <div class="cfg-block">
            <p class="cfg-label">音阶类型</p>
            <div class="seg-row">
              <button type="button" class="seg-btn" :class="{ active: mode === 'major' }" @click="selectMode('major')">大调五声</button>
              <button type="button" class="seg-btn" :class="{ active: mode === 'minor' }" @click="selectMode('minor')">小调五声</button>
            </div>
          </div>
          <div class="cfg-block">
            <p class="cfg-label">标注</p>
            <div class="seg-row">
              <button type="button" class="seg-btn" :class="{ active: labelMode === 'degree' }" @click="selectLabelMode('degree')">数字</button>
              <button type="button" class="seg-btn" :class="{ active: labelMode === 'note' }" @click="selectLabelMode('note')">音名</button>
            </div>
          </div>
        </div>
      </section>

      <section class="board-area">
        <PentatonicFretboardDiagram
          :key-name="keyName"
          :mode="mode"
          :label-mode="labelMode"
        />
      </section>

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
    </template>

    <!-- ========== 全屏模式 ========== -->
    <template v-else>
      <header class="fs-header">
        <button type="button" class="fs-exit-btn" @click="exitFullscreen" aria-label="退出全屏">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
        <div class="fs-title">{{ keyName }} {{ modeLabel }}五声</div>
        <div class="fs-toolbar">
          <button type="button" class="fs-seg" :class="{ active: mode === 'major' }" @click="selectMode('major')">大调</button>
          <button type="button" class="fs-seg" :class="{ active: mode === 'minor' }" @click="selectMode('minor')">小调</button>
          <span class="fs-sep" />
          <button type="button" class="fs-seg" :class="{ active: labelMode === 'degree' }" @click="selectLabelMode('degree')">数字</button>
          <button type="button" class="fs-seg" :class="{ active: labelMode === 'note' }" @click="selectLabelMode('note')">音名</button>
        </div>
      </header>

      <div class="fs-board-area">
        <PentatonicFretboardDiagram
          :key-name="keyName"
          :mode="mode"
          :label-mode="labelMode"
          :fullscreen="true"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { MAJOR_KEYS, getPentatonicScale } from '../music/index.js'
import PentatonicFretboardDiagram from '../components/PentatonicFretboardDiagram.vue'

const settingsStore = useSettingsStore()

const keyName = ref(settingsStore.settings.pentatonicKey ?? 'A')
const mode = ref(settingsStore.settings.pentatonicMode ?? 'minor')
const labelMode = ref(settingsStore.settings.pentatonicLabelMode ?? 'degree')
const fullscreen = ref(false)

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

function enterFullscreen() {
  fullscreen.value = true
  // 请求设备横屏（移动端有效）
  if (screen.orientation?.lock) {
    screen.orientation.lock('landscape').catch(() => {})
  }
}
function exitFullscreen() {
  fullscreen.value = false
  // 解锁屏幕方向
  if (screen.orientation?.unlock) {
    screen.orientation.unlock().catch(() => {})
  }
}

// ESC 键退出全屏
function onKey(e) {
  if (e.key === 'Escape' && fullscreen.value) exitFullscreen()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
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

.penta-page.is-fullscreen {
  max-width: none;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg-color);
  display: flex;
  flex-direction: column;
}

/* ============== 普通模式 ============== */
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

.header-text {
  flex: 1;
  min-width: 0;
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

.fs-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
}

.fs-btn:active {
  color: var(--primary-color);
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

/* ============== 全屏模式 ============== */
.fs-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}

.fs-exit-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--bg-color);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
}

.fs-exit-btn:active {
  color: var(--primary-color);
}

.fs-title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-md);
  font-weight: 800;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fs-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.fs-seg {
  border: 1.5px solid var(--border-color);
  background: var(--bg-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
}

.fs-seg.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.fs-sep {
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

.fs-board-area {
  flex: 1;
  display: flex;
  align-items: stretch;
  padding: 8px;
  overflow: hidden;
}

.fs-board-area :deep(.penta-board.is-full) {
  height: 100%;
}

.fs-board-area :deep(.penta-scroll.is-full) {
  height: 100%;
  display: flex;
  align-items: center;
}
</style>
