<template>
  <div class="fretboard-page">
    <!-- ============ 配置态 ============ -->
    <div v-if="phase === 'idle'" class="config">
      <header class="page-header">
        <router-link to="/" class="back-btn" aria-label="返回主页">‹</router-link>
        <div class="header-text">
          <h1 class="page-title">吉他指板记忆</h1>
          <p class="page-subtitle">听语音报音，在指板上找位置</p>
        </div>
      </header>

      <!-- 弦选择 -->
      <section class="cfg-card">
        <p class="cfg-label">练习弦（单弦）</p>
        <div class="string-grid">
          <button
            v-for="s in GUITAR_STRINGS"
            :key="s.index"
            type="button"
            class="string-chip"
            :class="{ active: configString === s.index }"
            @click="configString = s.index"
          >
            <span class="string-mark">{{ s.short }}</span>
            <span class="string-note">{{ s.openName }}{{ s.octave }}</span>
          </button>
        </div>
      </section>

      <!-- 调性选择 -->
      <section class="cfg-card">
        <p class="cfg-label">调性范围</p>
        <div class="chip-scroll">
          <button
            type="button"
            class="chip key-chip"
            :class="{ active: configKey === null }"
            @click="configKey = null"
          >
            不限调
          </button>
          <button
            v-for="k in MAJOR_KEYS"
            :key="k"
            type="button"
            class="chip key-chip"
            :class="{ active: configKey === k }"
            @click="configKey = k"
          >
            {{ k }} 大调
          </button>
        </div>
      </section>

      <!-- 节奏说明 -->
      <section class="rhythm-hint">
        <span class="hint-dot" />
        固定节奏 ♩=60：4 拍听题 → 4 拍思考 → 自动揭示答案，每组 4 个音，可随时暂停
      </section>

      <button type="button" class="start-btn" @click="startDrill">
        开始练习
      </button>
    </div>

    <!-- ============ 练习态 ============ -->
    <div v-else class="drill">
      <header class="drill-header">
        <button type="button" class="exit-btn" @click="exitDrill">✕ 结束</button>
        <div class="group-name">
          第 {{ groupIndex }} 组
          <span class="key-tag">{{ drill.selectedKey.value ?? '不限调' }} · {{ currentStringName }}</span>
        </div>
        <span class="header-placeholder" />
      </header>

      <!-- 阶段指示 -->
      <div class="phase-bar">
        <div class="phase-cell" :class="{ on: phase === 'recite' }">
          <span class="phase-title">听题</span>
          <span class="phase-dots">
            <i v-for="n in 4" :key="n" :class="{ lit: n <= revealedCount }" />
          </span>
        </div>
        <div class="phase-cell" :class="{ on: phase === 'think' }">
          <span class="phase-title">思考</span>
          <span class="phase-count">
            <span v-if="phase === 'think'" :key="'t' + flashTick" class="beat-pulse" />
            {{ phase === 'think' ? thinkRemaining : '4' }} 拍
          </span>
        </div>
        <div class="phase-cell" :class="{ on: phase === 'reveal' }">
          <span class="phase-title">答案</span>
          <span class="phase-count">
            <span v-if="phase === 'reveal'" :key="'r' + flashTick" class="beat-pulse" />
            {{ phase === 'reveal' ? revealRemaining : '4' }} 拍
          </span>
        </div>
      </div>

      <!-- 音符槽位 -->
      <div class="note-slots">
        <div
          v-for="i in 4"
          :key="i"
          class="note-slot"
          :class="{
            revealed: i - 1 < revealedCount,
            current: phase === 'recite' && beatInGroup === i - 1,
          }"
        >
          <template v-if="group[i - 1] && i - 1 < revealedCount">{{ group[i - 1].name }}</template>
          <template v-else>?</template>
          <span class="slot-order">{{ i }}</span>
        </div>
      </div>

      <!-- 指板 / 等待区 -->
      <div class="board-area">
        <FretboardDiagram
          v-if="phase === 'reveal' && group.length === 4"
          :selected-string="drill.selectedString.value"
          :answers="group"
          :reveal="true"
        />
        <div v-else class="board-waiting">
          <p class="waiting-main">
            {{ phase === 'recite' ? '听清每个音名…' : '在脑中找到指板位置' }}
          </p>
          <p class="waiting-sub">答案将在思考结束后自动显示</p>
        </div>
      </div>

      <!-- 暂停按钮（抱琴盲操作：全宽大按钮） -->
      <button
        v-if="!paused"
        type="button"
        class="pause-btn"
        @click="pauseDrill"
      >
        ⏸ 暂停
      </button>

      <!-- 暂停遮罩 -->
      <div v-if="paused" class="pause-overlay">
        <div class="pause-card">
          <p class="pause-title">已暂停</p>
          <p class="pause-sub">检查好位置后继续节奏</p>
          <button type="button" class="resume-btn" @click="resumeDrill">
            ▶ 继续
          </button>
          <button type="button" class="quit-btn" @click="exitDrill">
            退出练习
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { GUITAR_STRINGS, MAJOR_KEYS } from '../music/index.js'
import { useFretboardDrill } from '../composables/useFretboardDrill.js'
import FretboardDiagram from '../components/FretboardDiagram.vue'

const settingsStore = useSettingsStore()

const drill = useFretboardDrill()
const {
  phase,
  paused,
  group,
  revealedCount,
  beatInGroup,
  groupIndex,
  flashTick,
  start,
  pause,
  resume,
  stop,
} = drill

/** 配置态选择（初始取持久化偏好） */
const configString = ref(settingsStore.settings.fretboardString ?? 0)
const configKey = ref(settingsStore.settings.fretboardKey ?? null)

/** 当前练习弦的展示名（如 ⑥ E2） */
const currentStringName = computed(() => {
  const s = GUITAR_STRINGS[drill.selectedString.value]
  return s ? `${s.short} ${s.openName}${s.octave}` : ''
})

/** 思考阶段剩余拍数（beat 4-7 → 4-1） */
const thinkRemaining = computed(() => 8 - beatInGroup.value)
/** 答案阶段剩余拍数（beat 8-11 → 4-1） */
const revealRemaining = computed(() => 12 - beatInGroup.value)

/** 开始：持久化选择并启动自动循环（用户手势内解锁音频/TTS） */
function startDrill() {
  settingsStore.update({
    fretboardString: configString.value,
    fretboardKey: configKey.value,
  })
  start(configString.value, configKey.value)
}

function pauseDrill() {
  pause()
}

function resumeDrill() {
  resume()
}

/** 退出：停止全部声音/计时，回到配置态 */
function exitDrill() {
  stop()
}
</script>

<style scoped>
.fretboard-page {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

/* ============== 配置态 ============== */
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

.string-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.string-chip {
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.string-chip.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
}

.string-chip .string-mark {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-color);
}

.string-chip .string-note {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.string-chip.active .string-mark,
.string-chip.active .string-note {
  color: #fff;
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

.chip.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.rhythm-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-secondary);
  padding: 2px 4px 18px;
}

.hint-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary-color);
  margin-top: 7px;
}

.start-btn {
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

.start-btn:active {
  background: var(--primary-dark);
}

/* ============== 练习态 ============== */
.drill {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 40px);
  min-height: calc(100dvh - 40px);
}

.drill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 14px;
}

.exit-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  padding: 6px 8px;
}

.exit-btn:active {
  color: var(--danger-color);
}

.group-name {
  font-size: var(--font-size-md);
  font-weight: 800;
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.key-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.header-placeholder {
  width: 52px;
}

/* 阶段指示 */
.phase-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.phase-cell {
  flex: 1;
  background: var(--card-bg);
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0.55;
  transition: opacity 0.2s ease, border-color 0.2s ease;
}

.phase-cell.on {
  opacity: 1;
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.phase-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.phase-cell.on .phase-title {
  color: var(--primary-dark);
}

.phase-dots {
  display: flex;
  gap: 5px;
}

.phase-dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
}

.phase-dots i.lit {
  background: var(--primary-color);
}

.phase-count {
  position: relative;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary-dark);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.beat-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-color);
  animation: beat-pulse 0.35s ease-out;
}

@keyframes beat-pulse {
  0% { transform: scale(1.9); opacity: 0.35; }
  100% { transform: scale(1); opacity: 1; }
}

/* 音符槽位 */
.note-slots {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.note-slot {
  position: relative;
  flex: 1;
  height: 86px;
  border-radius: var(--radius-md);
  border: 2px dashed var(--border-color);
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 800;
  color: var(--text-tertiary);
  transition: none;
}

.note-slot.revealed {
  border-style: solid;
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-dark);
}

.note-slot.current {
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.25);
  animation: slot-hit 0.3s ease-out;
}

@keyframes slot-hit {
  0% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.slot-order {
  position: absolute;
  top: 4px;
  left: 7px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-tertiary);
}

/* 指板区 */
.board-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 10px 8px;
  min-height: 190px;
  margin-bottom: 14px;
}

.board-waiting {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
}

.waiting-main {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 6px;
}

.waiting-sub {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* 暂停 */
.pause-btn {
  width: 100%;
  min-height: 60px;
  border-radius: var(--radius-md);
  background: var(--primary-color);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 4px;
  box-shadow: 0 6px 16px rgba(79, 124, 255, 0.32);
}

.pause-btn:active {
  background: var(--primary-dark);
}

.pause-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(20, 24, 33, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.pause-card {
  width: 100%;
  max-width: 320px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 24px 20px 20px;
  text-align: center;
}

.pause-title {
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--text-color);
}

.pause-sub {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 6px 0 18px;
}

.resume-btn {
  width: 100%;
  min-height: 52px;
  border-radius: var(--radius-md);
  background: var(--primary-color);
  color: #fff;
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: 10px;
}

.quit-btn {
  width: 100%;
  min-height: 44px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
</style>
