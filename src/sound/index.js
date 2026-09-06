/**
 * sound/index.js
 * 音效系统：Web Audio API 振荡器合成，无外部音频文件。
 *
 * - playCorrect：答对音效，短促上升双音（约 200ms）；
 * - playWrong：答错/超时音效，低频下降音（约 200ms）；
 * - playCombo：连击里程碑音效（5 连 / 10 连），上行琶音。
 *
 * 浏览器自动播放策略：AudioContext 延迟到用户首次交互时创建
 * （unlockAudio 在选项点击等交互事件中调用），创建失败静默降级，
 * 不影响训练流程。
 */

/** 模块级 AudioContext 单例（懒创建，非响应式） */
let audioCtx = null

/**
 * 确保音效上下文可用；不可用时返回 null（调用方静默跳过）。
 * 首次调用发生在用户手势事件内，符合浏览器自动播放策略。
 * @returns {AudioContext|null}
 */
function ensureContext() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    // 被系统暂停（如切后台）时恢复
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

/**
 * 用户首次交互时调用，提前创建/恢复 AudioContext，
 * 使后续音效可以即时播放（满足 TR-11.3）。
 */
export function unlockAudio() {
  ensureContext()
}

/**
 * 合成单个音符。
 * @param {number} freq 频率（Hz）
 * @param {number} startMs 相对当前的起始偏移（毫秒）
 * @param {number} durMs 时长（毫秒）
 * @param {OscillatorType} type 波形
 * @param {number} peakGain 峰值音量（0-1）
 */
function tone(freq, startMs, durMs, type = 'sine', peakGain = 0.12) {
  const ctx = ensureContext()
  if (!ctx) return

  const t0 = ctx.currentTime + startMs / 1000
  const t1 = t0 + durMs / 1000

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)

  // 快起慢收的包络，避免爆音
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t1)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t1 + 0.02)
}

/** 答对音效：G5 → C6 上升双音 */
export function playCorrect() {
  tone(784, 0, 90, 'sine', 0.12)
  tone(1047, 90, 130, 'sine', 0.12)
}

/** 答错 / 超时音效：低频下降音 */
export function playWrong() {
  tone(233, 0, 110, 'square', 0.06)
  tone(175, 100, 140, 'square', 0.06)
}

/** 连击里程碑音效（5 连 / 10 连）：上行小三连音 */
export function playCombo() {
  tone(659, 0, 80, 'triangle', 0.1)
  tone(831, 80, 80, 'triangle', 0.1)
  tone(988, 160, 150, 'triangle', 0.1)
}
