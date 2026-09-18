<template>
  <div class="penta-board">
    <div ref="scrollEl" class="penta-scroll" @scroll="onScroll">
      <svg
        class="penta-svg"
        :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
        role="img"
        aria-label="五声音阶指板图"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- 玫瑰木指板 -->
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
          <!-- 品丝金属柱面反光 -->
          <linearGradient id="penta-wire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9aa0aa" />
            <stop offset="45%" stop-color="#f7f9fc" />
            <stop offset="55%" stop-color="#dfe3ea" />
            <stop offset="100%" stop-color="#8b909a" />
          </linearGradient>
          <!-- 骨质琴枕 -->
          <linearGradient id="penta-nut" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#e7dcc4" />
            <stop offset="50%" stop-color="#f7f0dd" />
            <stop offset="100%" stop-color="#d3c7ac" />
          </linearGradient>
          <!-- 琴弦金属高光 -->
          <linearGradient id="penta-string" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c9cdd4" />
            <stop offset="45%" stop-color="#ffffff" />
            <stop offset="60%" stop-color="#b9bec8" />
            <stop offset="100%" stop-color="#8d939d" />
          </linearGradient>
          <!-- 品记珍珠母贝 -->
          <radialGradient id="penta-marker" cx="0.38" cy="0.35" r="0.75">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="55%" stop-color="#efe9d8" />
            <stop offset="100%" stop-color="#c9c0a8" />
          </radialGradient>
          <!-- 普通音级点（主色蓝） -->
          <radialGradient id="penta-note" cx="0.35" cy="0.3" r="0.85">
            <stop offset="0%" stop-color="#7ea0ff" />
            <stop offset="55%" stop-color="#4f7cff" />
            <stop offset="100%" stop-color="#3a5fd6" />
          </radialGradient>
          <!-- 根音点（橙色强调） -->
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
        <!-- 木纹纤维（纵向柔带） -->
        <rect :x="NUT_X + 14" y="26" width="10" height="136" fill="url(#penta-grain)" opacity="0.7" />
        <rect :x="NUT_X + 88" y="26" width="14" height="136" fill="url(#penta-grain)" opacity="0.55" />
        <rect :x="NUT_X + 176" y="26" width="8" height="136" fill="url(#penta-grain)" opacity="0.6" />
        <rect :x="NUT_X + 256" y="26" width="12" height="136" fill="url(#penta-grain)" opacity="0.5" />
        <rect :x="NUT_X + 540" y="26" width="14" height="136" fill="url(#penta-grain)" opacity="0.5" />
        <!-- 指板顶部受光 -->
        <rect :x="NUT_X" y="26" :width="fretWireX(MAX_FRET) - NUT_X + 8" height="10" rx="5" fill="#ffffff" opacity="0.045" />

        <!-- 品丝（1-21 品），暗底 + 金属面 -->
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

        <!-- 品记：3/5/7/9/15/17/19/21 单点，12 双点 -->
        <circle :cx="fretCenterX(3)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(5)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(7)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(9)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(12)" cy="75" r="4" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(12)" cy="117" r="4" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(15)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(17)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(19)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />
        <circle :cx="fretCenterX(21)" cy="96" r="4.6" fill="url(#penta-marker)" opacity="0.92" />

        <!-- 琴枕（骨质，覆盖在指板与品丝之上） -->
        <rect :x="NUT_X - 0.5" y="21" width="7" height="146" rx="2" fill="url(#penta-nut)" />
        <rect :x="NUT_X + 6.5" y="22" width="1.4" height="144" fill="#000000" opacity="0.22" />

        <!-- 琴弦（在琴枕之上） -->
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

        <!-- 品位数字 -->
        <text x="14" y="180" text-anchor="middle" class="penta-fret-num">0</text>
        <text
          v-for="f in MAX_FRET"
          :key="'fret-num-' + f"
          :x="fretCenterX(f)"
          y="180"
          text-anchor="middle"
          class="penta-fret-num"
        >{{ f }}</text>
      </svg>
    </div>

    <!-- 滑动提示 -->
    <p v-if="showScrollHint" class="penta-hint">← 滑动查看高把位 →</p>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { GUITAR_STRINGS } from '../music/fretboard.js'
import { findPentatonicNote } from '../music/scales.js'

const props = defineProps({
  /** 调名（如 'A'、'C'、'B♭'、'F♯'） */
  keyName: {
    type: String,
    required: true,
  },
  /** 五声音阶模式：'major' | 'minor' */
  mode: {
    type: String,
    default: 'minor',
    validator: (v) => ['major', 'minor'].includes(v),
  },
  /** 标注模式：'note' 显示音名 | 'degree' 显示音级数字 */
  labelMode: {
    type: String,
    default: 'degree',
    validator: (v) => ['note', 'degree'].includes(v),
  },
})

// ============== 几何常量 ==============
/** 最大品数（含 21 品） */
const MAX_FRET = 21
/** 有效弦长（SVG 单位），用于真实品距计算 */
const SCALE_LENGTH = 1400
/** 琴枕左边缘 x */
const NUT_X = 30
/** 琴枕宽度 */
const NUT_W = 6
/** 第一根弦（① 弦）的 y 坐标 */
const STRING_FIRST_Y = 41
/** 弦间距 */
const STRING_SPACING = 22
/** SVG 总宽高 */
const SVG_W = 1050
const SVG_H = 210

/**
 * 真实品距：琴枕右侧到第 n 品的距离 = L × (1 - 2^(-n/12))。
 * 品越往高越窄，与真实吉他指板比例一致。
 * @param {number} f 品号 1-21
 * @returns {number} 品丝 x 坐标
 */
function fretWireX(f) {
  if (f <= 0) return NUT_X + NUT_W
  return NUT_X + NUT_W + SCALE_LENGTH * (1 - Math.pow(2, -f / 12))
}

/** 品格中点 x（f = 0 为空弦区） */
function fretCenterX(f) {
  if (f === 0) return 14
  return (fretWireX(f - 1) + fretWireX(f)) / 2
}

/** 弦索引 → 纵向坐标（⑥弦在底部，①弦在顶部） */
function stringY(i) {
  return STRING_FIRST_Y + (5 - i) * STRING_SPACING
}

/** 琴弦粗细：⑥ 最粗 → ① 最细 */
function stringWidth(i) {
  return [2.6, 2.3, 2, 1.7, 1.3, 1][i] ?? 1.2
}

/**
 * 指定弦、指定品位的半音位置（0-11），不依赖 fretboard.js 的 MAX_FRET 限制。
 * @param {number} stringIndex 0-5
 * @param {number} fret 0-21
 * @returns {number}
 */
function pitchAt(stringIndex, fret) {
  const s = GUITAR_STRINGS[stringIndex]
  return ((s.openPitch + fret) % 12 + 12) % 12
}

/**
 * 全指板五声音阶命中标记。
 * 遍历 6 弦 × 22 品（0-21），命中五声音阶音的位置画点。
 */
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

// ============== 滑动提示控制 ==============
const scrollEl = ref(null)
const showScrollHint = ref(true)

function onScroll() {
  showScrollHint.value = false
}

onMounted(async () => {
  await nextTick()
  if (!scrollEl.value) return
  // 若内容未溢出（宽屏能完整显示），不显示提示
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
  /* 140% 宽度：默认显示约 12 品，随屏宽等比缩放（屏宽自适应）；
     13-21 品需向右滑动查看 */
  width: 140%;
  height: auto;
  min-width: 520px;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
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

.penta-note-label {
  font-size: 9px;
  font-weight: 800;
  fill: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  paint-order: stroke;
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
