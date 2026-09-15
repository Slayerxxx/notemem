<template>
  <div class="fretboard-wrap">
    <svg
      class="fretboard-svg"
      viewBox="0 0 366 200"
      role="img"
      aria-label="吉他指板图"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- 玫瑰木指板：暖色深木纵向渐变 -->
        <linearGradient id="fb-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4b3327" />
          <stop offset="45%" stop-color="#3a261c" />
          <stop offset="100%" stop-color="#2b1c14" />
        </linearGradient>
        <!-- 木纹纤维（横向柔带） -->
        <linearGradient id="fb-grain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#5d4030" stop-opacity="0" />
          <stop offset="50%" stop-color="#6d4a36" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#5d4030" stop-opacity="0" />
        </linearGradient>
        <!-- 品丝金属柱面反光 -->
        <linearGradient id="fb-wire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9aa0aa" />
          <stop offset="45%" stop-color="#f7f9fc" />
          <stop offset="55%" stop-color="#dfe3ea" />
          <stop offset="100%" stop-color="#8b909a" />
        </linearGradient>
        <!-- 骨质琴枕 -->
        <linearGradient id="fb-nut" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e7dcc4" />
          <stop offset="50%" stop-color="#f7f0dd" />
          <stop offset="100%" stop-color="#d3c7ac" />
        </linearGradient>
        <!-- 琴弦金属高光 -->
        <linearGradient id="fb-string" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c9cdd4" />
          <stop offset="45%" stop-color="#ffffff" />
          <stop offset="60%" stop-color="#b9bec8" />
          <stop offset="100%" stop-color="#8d939d" />
        </linearGradient>
        <!-- 品记珍珠母贝 -->
        <radialGradient id="fb-marker" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="55%" stop-color="#efe9d8" />
          <stop offset="100%" stop-color="#c9c0a8" />
        </radialGradient>
        <!-- 答案点 -->
        <radialGradient id="fb-answer" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0%" stop-color="#7ea0ff" />
          <stop offset="55%" stop-color="#4f7cff" />
          <stop offset="100%" stop-color="#3a5fd6" />
        </radialGradient>
      </defs>

      <!-- 指板主体 -->
      <rect x="28" y="26" width="330" height="136" rx="5" fill="url(#fb-wood)" />
      <!-- 木纹纤维（纵向长条） -->
      <rect x="44" y="26" width="10" height="136" fill="url(#fb-grain)" opacity="0.7" />
      <rect x="118" y="26" width="14" height="136" fill="url(#fb-grain)" opacity="0.55" />
      <rect x="206" y="26" width="8" height="136" fill="url(#fb-grain)" opacity="0.6" />
      <rect x="286" y="26" width="12" height="136" fill="url(#fb-grain)" opacity="0.5" />
      <!-- 指板顶部受光 -->
      <rect x="28" y="26" width="330" height="10" rx="5" fill="#ffffff" opacity="0.045" />

      <!-- 品丝（1-12 品），暗底 + 金属面模拟投影 -->
      <g>
        <rect
          v-for="f in 12"
          :key="'wire-shadow-' + f"
          :x="fretWireX(f) - 1"
          y="24"
          width="3"
          height="140"
          fill="#000000"
          opacity="0.28"
        />
        <rect
          v-for="f in 12"
          :key="'wire-' + f"
          :x="fretWireX(f)"
          y="24"
          width="1.8"
          height="140"
          fill="url(#fb-wire)"
        />
      </g>

      <!-- 品记：3/5/7/9 单点，12 品双点 -->
      <circle :cx="fretCenterX(3)" cy="96" r="4.6" fill="url(#fb-marker)" opacity="0.92" />
      <circle :cx="fretCenterX(5)" cy="96" r="4.6" fill="url(#fb-marker)" opacity="0.92" />
      <circle :cx="fretCenterX(7)" cy="96" r="4.6" fill="url(#fb-marker)" opacity="0.92" />
      <circle :cx="fretCenterX(9)" cy="96" r="4.6" fill="url(#fb-marker)" opacity="0.92" />
      <circle :cx="fretCenterX(12)" cy="75" r="4" fill="url(#fb-marker)" opacity="0.92" />
      <circle :cx="fretCenterX(12)" cy="117" r="4" fill="url(#fb-marker)" opacity="0.92" />

      <!-- 琴枕（骨质，覆盖在指板与品丝之上） -->
      <rect x="27.5" y="21" width="7" height="146" rx="2" fill="url(#fb-nut)" />
      <rect x="34.5" y="22" width="1.4" height="144" fill="#000000" opacity="0.22" />

      <!-- 琴弦（在琴枕之上） -->
      <g>
        <!-- 选中弦的高亮光晕（仅 reveal） -->
        <line
          v-if="reveal"
          :x1="6"
          :y1="stringY(selectedString)"
          x2="361"
          :y2="stringY(selectedString)"
          stroke="#4f7cff"
          stroke-width="7"
          stroke-linecap="round"
          opacity="0.28"
        />
        <line
          v-for="(s, i) in GUITAR_STRINGS"
          :key="'string-' + s.number"
          :x1="6"
          :y1="stringY(i)"
          x2="361"
          :y2="stringY(i)"
          stroke="url(#fb-string)"
          :stroke-width="stringWidth(i)"
          stroke-linecap="round"
        />
      </g>

      <!-- 弦名标签（该弦空弦答案出现时让位给答案点） -->
      <g v-for="(s, i) in GUITAR_STRINGS" :key="'label-' + s.number">
        <text
          v-if="!reveal || !openStringOnSelected(i)"
          :x="14"
          :y="stringY(i) + 3.5"
          text-anchor="middle"
          class="fb-string-name"
        >{{ s.openName }}</text>
      </g>

      <!-- 答案层 -->
      <g v-if="reveal">
        <template v-for="(m, i) in markers" :key="'answer-' + i">
          <!-- 音名主点 -->
          <circle :cx="m.x" :cy="m.y" r="11.5" fill="url(#fb-answer)" stroke="#ffffff" stroke-width="1.4" />
          <text
            :x="m.x"
            :y="m.y + 3.6"
            text-anchor="middle"
            class="fb-answer-name"
          >{{ m.name }}</text>
          <!-- 序号 badge（同品位重复时环绕分布） -->
          <circle :cx="m.badgeX" :cy="m.badgeY" r="6.6" fill="#ffffff" stroke="#4f7cff" stroke-width="1.4" />
          <text
            :x="m.badgeX"
            :y="m.badgeY + 2.8"
            text-anchor="middle"
            class="fb-answer-order"
          >{{ m.order }}</text>
        </template>
      </g>

      <!-- 品位数字 -->
      <text x="14" y="180" text-anchor="middle" class="fb-fret-num">0</text>
      <text
        v-for="f in 12"
        :key="'fret-num-' + f"
        :x="fretCenterX(f)"
        y="180"
        text-anchor="middle"
        class="fb-fret-num"
      >{{ f }}</text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { GUITAR_STRINGS } from '../music/fretboard.js'

const props = defineProps({
  /** 当前练习弦索引 0=⑥ … 5=① */
  selectedString: {
    type: Number,
    required: true,
  },
  /** 本组 4 个答案 [{ fret, name }] */
  answers: {
    type: Array,
    default: () => [],
  },
  /** 是否揭示答案（false 时仅渲染空指板结构） */
  reveal: {
    type: Boolean,
    default: false,
  },
})

// ============== 几何常量（viewBox 366 × 200） ==============
const NUT_X = 28
const NUT_W = 6
const FRET_W = 27
const BOARD_TOP = 26
const STRING_FIRST_Y = 41
const STRING_SPACING = 22

/** 弦索引 → 纵向坐标 */
function stringY(i) {
  return STRING_FIRST_Y + i * STRING_SPACING
}

/** 琴弦粗细：⑥ 最粗 → ① 最细 */
function stringWidth(i) {
  return [2.6, 2.3, 2, 1.7, 1.3, 1][i] ?? 1.2
}

/** 品丝 x（f = 1-12） */
function fretWireX(f) {
  return NUT_X + NUT_W + f * FRET_W - FRET_W + FRET_W // 34 + f*27 - 27 + 27 ≡ 34 + f*27
}

/** 品格中点 x（f = 1-12）；f = 0 为空弦区 */
function fretCenterX(f) {
  if (f === 0) return 14
  return NUT_X + NUT_W + (f - 0.5) * FRET_W
}

/** 答案品位 → 主点 x */
function markerX(fret) {
  return fret === 0 ? 14 : fretCenterX(fret)
}

/** 该弦空弦位置在 reveal 时是否被答案占用 */
function openStringOnSelected(stringIndex) {
  if (stringIndex !== props.selectedString) return false
  return props.answers.some((a) => a.fret === 0)
}

/**
 * 答案标注：同品位重复出现时，序号 badge 沿右上/右下/左下/左上周绕，
 * 保证 4 次同品位也互不遮挡；主点位置始终精确落在品位中心。
 */
const markers = computed(() => {
  const seen = new Map()
  // badge 环绕角（度）：右上 → 右下 → 左下 → 左上
  const angles = [-45, 45, 135, -135]
  return props.answers.map((a, i) => {
    const count = seen.get(a.fret) ?? 0
    seen.set(a.fret, count + 1)
    const x = markerX(a.fret)
    const y = stringY(props.selectedString)
    const rad = (angles[count % 4] * Math.PI) / 180
    return {
      name: a.name,
      order: i + 1,
      x,
      y,
      badgeX: x + Math.cos(rad) * 13.6,
      badgeY: y + Math.sin(rad) * 13.6,
    }
  })
})
</script>

<style scoped>
.fretboard-wrap {
  width: 100%;
  padding: 4px 2px;
  box-sizing: border-box;
}

.fretboard-svg {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
}

.fb-string-name {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-secondary, #646a73);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.fb-fret-num {
  font-size: 10px;
  font-weight: 600;
  fill: var(--text-tertiary, #8f959e);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.fb-answer-name {
  font-size: 10px;
  font-weight: 800;
  fill: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  paint-order: stroke;
}

.fb-answer-order {
  font-size: 9px;
  font-weight: 800;
  fill: var(--primary-color, #4f7cff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
</style>
