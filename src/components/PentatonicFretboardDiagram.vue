<template>
  <div class="penta-board" :class="{ 'is-full': fullscreen }">
    <div ref="scrollEl" class="penta-scroll" :class="{ 'is-full': fullscreen }" @scroll="onScroll">
      <svg
        class="penta-svg"
        :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
        role="img"
        aria-label="五声音阶指板图"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="penta-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4b3327" />
            <stop offset="45%" stop-color="#3a261c" />
            <stop offset="100%" stop-color="#2b1c14" />
          </linearGradient>
          <linearGradient id="penta-grain" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#5d4030" stop-opacity="0" />
            <stop offset="50%" stop-color="#6d4a36" stop-opacity="0.16" />
            <stop offset="100%" stop-color="#5d4030" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="penta-wire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9aa0aa" />
            <stop offset="45%" stop-color="#f7f9fc" />
            <stop offset="55%" stop-color="#dfe3ea" />
            <stop offset="100%" stop-color="#8b909a" />
          </linearGradient>
          <linearGradient id="penta-nut" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#e7dcc4" />
            <stop offset="50%" stop-color="#f7f0dd" />
            <stop offset="100%" stop-color="#d3c7ac" />
          </linearGradient>
          <linearGradient id="penta-string" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c9cdd4" />
            <stop offset="45%" stop-color="#ffffff" />
            <stop offset="60%" stop-color="#b9bec8" />
            <stop offset="100%" stop-color="#8d939d" />
          </linearGradient>
          <radialGradient id="penta-note" cx="0.35" cy="0.3" r="0.85">
            <stop offset="0%" stop-color="#7ea0ff" />
            <stop offset="55%" stop-color="#4f7cff" />
            <stop offset="100%" stop-color="#3a5fd6" />
          </radialGradient>
          <radialGradient id="penta-root" cx="0.35" cy="0.3" r="0.85">
            <stop offset="0%" stop-color="#ffc070" />
            <stop offset="55%" stop-color="#ff9500" />
            <stop offset="100%" stop-color="#c47000" />
          </radialGradient>
        </defs>

        <!-- 指板主体 -->
        <rect
          :x="NUT_X"
          y="26"
          :width="fretWireX(MAX_FRET) - NUT_X + 8"
          height="136"
          rx="5"
          fill="url(#penta-wood)"
        />
        <rect :x="NUT_X + 14" y="26" width="10" height="136" fill="url(#penta-grain)" opacity="0.7" />
        <rect :x="NUT_X + 88" y="26" width="14" height="136" fill="url(#penta-grain)" opacity="0.55" />
        <rect :x="NUT_X + 176" y="26" width="8" height="136" fill="url(#penta-grain)" opacity="0.6" />
        <rect :x="NUT_X + 256" y="26" width="12" height="136" fill="url(#penta-grain)" opacity="0.5" />
        <rect :x="NUT_X + 540" y="26" width="14" height="136" fill="url(#penta-grain)" opacity="0.5" />
        <rect :x="NUT_X" y="26" :width="fretWireX(MAX_FRET) - NUT_X + 8" height="10" rx="5" fill="#ffffff" opacity="0.045" />

        <!-- 品丝（1-21 品） -->
        <g>
          <rect
            v-for="f in MAX_FRET"
            :key="'wire-shadow-' + f"
            :x="fretWireX(f) - 1"
            y="24"
            width="3"
            height="140"
            fill="#000000"
            opacity="0.28"
          />
          <rect
            v-for="f in MAX_FRET"
            :key="'wire-' + f"
            :x="fretWireX(f)"
            y="24"
            width="1.8"
            height="140"
            fill="url(#penta-wire)"
          />
        </g>

        <!-- 琴枕（骨质） -->
        <rect :x="NUT_X - 0.5" y="21" width="7" height="146" rx="2" fill="url(#penta-nut)" />
        <rect :x="NUT_X + 6.5" y="22" width="1.4" height="144" fill="#000000" opacity="0.22" />

        <!-- 琴弦 -->
        <g>
          <line
            v-for="(s, i) in GUITAR_STRINGS"
            :key="'string-' + s.number"
            :x1="6"
            :y1="stringY(i)"
            :x2="fretWireX(MAX_FRET) + 6"
            :y2="stringY(i)"
            stroke="url(#penta-string)"
            :stroke-width="stringWidth(i)"
            stroke-linecap="round"
          />
        </g>

        <!-- 弦名标签 -->
        <g v-for="(s, i) in GUITAR_STRINGS" :key="'label-' + s.number">
          <text
            :x="14"
            :y="stringY(i) + 3.5"
            text-anchor="middle"
            class="penta-string-name"
          >{{ s.openName }}</text>
        </g>

        <!-- 五声音阶标记点 -->
        <g>
          <template v-for="(m, i) in markers" :key="'m-' + i">
            <circle
              :cx="m.x"
              :cy="m.y"
              :r="m.isRoot ? 12.5 : 10.5"
              :fill="m.isRoot ? 'url(#penta-root)' : 'url(#penta-note)'"
              stroke="#ffffff"
              :stroke-width="m.isRoot ? 1.8 : 1.4"
            />
            <text
              :x="m.x"
              :y="m.y + (m.isRoot ? 4 : 3.4)"
              text-anchor="middle"
              class="penta-note-label"
            >{{ labelMode === 'note' ? m.name : m.degree }}</text>
          </template>
        </g>

        <!-- 品位数字 + 品记小点（品号下方） -->
        <g>
          <text x="14" :y="fretNumY" text-anchor="middle" class="penta-fret-num">0</text>
          <template v-for="f in MAX_FRET" :key="'fret-info-' + f">
            <text
              :x="fretCenterX(f)"
              :y="fretNumY"
              text-anchor="middle"
              class="penta-fret-num"
            >{{ f }}</text>
            <!-- 品记小点：3/5/7/9/15/17/19/21 单点，12 双点 -->
            <template v-if="FRET_MARKERS.includes(f)">
              <circle :cx="fretCenterX(f)" :cy="markerDotY" r="2.2" fill="#b0a890" opacity="0.85" />
            </template>
            <template v-if="f === 12">
              <circle :cx="fretCenterX(f)" :cy="markerDotY - 6" r="2.2" fill="#b0a890" opacity="0.85" />
              <circle :cx="fretCenterX(f)" :cy="markerDotY + 6" r="2.2" fill="#b0a890" opacity="0.85" />
            </template>
          </template>
        </g>
      </svg>
    </div>

    <p v-if="!fullscreen && showScrollHint" class="penta-hint">← 滑动查看高把位 →</p>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { GUITAR_STRINGS } from '../music/fretboard.js'
import { findPentatonicNote } from '../music/scales.js'

const props = defineProps({
  keyName: { type: String, required: true },
  mode: { type: String, default: 'minor', validator: (v) => ['major', 'minor'].includes(v) },
  labelMode: { type: String, default: 'degree', validator: (v) => ['note', 'degree'].includes(v) },
  /** 全屏模式：放大指板 */
  fullscreen: { type: Boolean, default: false },
})

const MAX_FRET = 21
const SCALE_LENGTH = 1400
const NUT_X = 30
const NUT_W = 6
const STRING_FIRST_Y = 41
const STRING_SPACING = 22
const SVG_W = 1050
const SVG_H = 210
/** 品记标记品：3/5/7/9/15/17/19/21 */
const FRET_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21]
/** 品号 y 坐标 */
const fretNumY = 180
/** 品记小点 y 坐标（品号下方） */
const markerDotY = 197

function fretWireX(f) {
  if (f <= 0) return NUT_X + NUT_W
  return NUT_X + NUT_W + SCALE_LENGTH * (1 - Math.pow(2, -f / 12))
}

function fretCenterX(f) {
  if (f === 0) return 14
  return (fretWireX(f - 1) + fretWireX(f)) / 2
}

function stringY(i) {
  return STRING_FIRST_Y + (5 - i) * STRING_SPACING
}

function stringWidth(i) {
  return [2.6, 2.3, 2, 1.7, 1.3, 1][i] ?? 1.2
}

function pitchAt(stringIndex, fret) {
  const s = GUITAR_STRINGS[stringIndex]
  return ((s.openPitch + fret) % 12 + 12) % 12
}

const markers = computed(() => {
  const result = []
  for (let si = 0; si < GUITAR_STRINGS.length; si += 1) {
    for (let fret = 0; fret <= MAX_FRET; fret += 1) {
      const pitch = pitchAt(si, fret)
      const note = findPentatonicNote(props.keyName, props.mode, pitch)
      if (note) {
        result.push({
          stringIndex: si,
          fret,
          x: fretCenterX(fret),
          y: stringY(si),
          name: note.name,
          degree: note.degree,
          isRoot: note.degree === '1',
        })
      }
    }
  }
  return result
})

const scrollEl = ref(null)
const showScrollHint = ref(true)

function onScroll() {
  showScrollHint.value = false
}

onMounted(async () => {
  await nextTick()
  if (!scrollEl.value) return
  if (scrollEl.value.scrollWidth <= scrollEl.value.clientWidth + 1) {
    showScrollHint.value = false
  }
})

onBeforeUnmount(() => {
  showScrollHint.value = true
})
</script>

<style scoped>
.penta-board {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.penta-board.is-full {
  height: 100%;
}

.penta-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 4px 0;
}

.penta-scroll::-webkit-scrollbar {
  display: none;
}

.penta-svg {
  display: block;
  /* 140% 宽度：默认显示约 12 品，随屏宽等比缩放；
     13-21 品需向右滑动查看 */
  width: 140%;
  height: auto;
  min-width: 520px;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
}

.penta-board.is-full .penta-svg {
  /* 全屏模式：让指板容器占满屏幕剩余高度，SVG 自适应 */
  width: 100%;
  max-height: calc(100vh - 40px);
  min-width: 720px;
}

.penta-string-name {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-secondary, #646a73);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.penta-fret-num {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-tertiary, #8f959e);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.penta-board.is-full .penta-fret-num {
  font-size: 14px;
}

.penta-note-label {
  font-size: 9px;
  font-weight: 800;
  fill: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  paint-order: stroke;
}

.penta-board.is-full .penta-note-label {
  font-size: 13px;
}

.penta-hint {
  text-align: center;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-tertiary, #8f959e);
  margin-top: 6px;
  animation: penta-hint-fade 1.6s ease-in-out infinite;
}

@keyframes penta-hint-fade {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
