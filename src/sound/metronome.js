/**
 * metronome.js
 * 节拍器：Web Audio API 合成短促 click，无外部音频文件。
 *
 * - unlockAudio：用户手势内创建/恢复 AudioContext（浏览器自动播放策略）；
 * - playClick(accent)：普通拍与重拍（每组第 1/5/9 拍）两种 click。
 *
 * 独立 AudioContext 单例，不与既有训练音效（sound/index.js）共享，
 * 避免对既有模块产生任何行为影响。任何异常静默降级，绝不抛错。
 */

/** 拍长由编排层决定，本模块只负责发声 */

/** 模块级 AudioContext 单例（懒创建，非响应式） */
let audioCtx = null

/**
 * 确保音频上下文可用；不可用时返回 null。
 * @returns {AudioContext|null}
 */
function ensureContext() {
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ??
        /** @type {any} */ (window).webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * 用户首次交互（开始按钮）时调用，提前解锁音频。
 */
export function unlockAudio() {
  ensureContext()
}

/**
 * 播放一个节拍器 click。
 * 方波 + 极快衰减包络模拟机械「嗒」声；重拍更高更响。
 * @param {boolean} [accent] 重拍（小节首拍）使用更高频率与音量
 */
export function playClick(accent = false) {
  const ctx = ensureContext()
  if (!ctx) return
  try {
    const t0 = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(accent ? 2200 : 1568, t0)

    const peak = accent ? 0.16 : 0.08
    gain.gain.setValueAtTime(peak, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.05)
  } catch {
    // 静默降级：节拍器故障不影响视觉流程
  }
}
