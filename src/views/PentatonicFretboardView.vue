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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
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
