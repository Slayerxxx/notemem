/**
 * useProgressionAudio.js
 * 和弦进行识别训练的音频播放组合式函数。
 *
 * 职责：
 * - 惰性创建 / 复用单个 AudioContext（必须在用户手势内创建与 resume）；
 * - 首次播放时加载本地 soundfont 真实钢琴音色，失败自动降级为内置
 *   振荡器合成音色（synthFallback=true，视图层给出提示），流程不阻塞；
 * - play(midiUrl, style)：按 style 经 getBpmForStyle 取 BPM，拉取并解析
 *   MIDI，排程播放；重复点击先停旧再播新；
 * - 暴露 isPlaying / progress（0-1，rAF 驱动）/ status / synthFallback；
 * - 组件卸载时停止播放并关闭 AudioContext。
 *
 * 计时联动：首次成功触发播放时调用 onFirstPlay 回调，由视图层
 * 调 game.startProgressionTimer() 启动「延迟计时」。
 */
import { ref, onBeforeUnmount } from 'vue'
import { loadInstrument } from '../audio/soundfontLoader.js'
import { playProgression } from '../audio/midiPlayer.js'
import { getBpmForStyle } from '../music/progression.js'

/**
 * @param {object} [opts]
 * @param {Function} [opts.onFirstPlay] 首次点击播放时触发（用于启动延迟计时）
 */
export function useProgressionAudio({ onFirstPlay } = {}) {
  /** 整体加载状态：idle | loading（音色/MIDI 准备中）| ready | error */
  const status = ref('idle')
  /** 是否正在发声 */
  const isPlaying = ref(false)
  /** 当前播放进度 0-1 */
  const progress = ref(0)
  /** 是否处于合成音色兜底（真实音色加载失败） */
  const synthFallback = ref(false)
  /** 最近一次错误文案（status=error 时有效） */
  const errorMessage = ref('')

  /** @type {AudioContext|null} */
  let ctx = null
  /** @type {Promise<object|null>|null} */
  let instrumentPromise = null
  /** @type {object|null} */
  let resolvedInstrument
  /** @type {{stop:Function, isPlaying:Function, duration:number}|null} */
  let controller = null
  let rafId = 0
  let playStartMs = 0
  let firstPlayFired = false

  /** 首次用户手势时创建 / 恢复 AudioContext */
  function ensureContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      ctx = new Ctx()
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return ctx
  }

  /** rAF 循环：按挂钟时间估算播放进度，自然结束后复位 */
  function rafLoop() {
    cancelAnimationFrame(rafId)
    const loop = () => {
      if (!controller) return
      if (controller.isPlaying()) {
        const elapsed = (performance.now() - playStartMs) / 1000
        progress.value = Math.max(
          0,
          Math.min(1, elapsed / Math.max(0.1, controller.duration))
        )
        rafId = requestAnimationFrame(loop)
      } else {
        isPlaying.value = false
        progress.value = 0
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  /** 立即停止当前播放并复位进度 */
  function stop() {
    cancelAnimationFrame(rafId)
    if (controller) {
      try {
        controller.stop()
      } catch {
        // 卸载竞态下静默
      }
      controller = null
    }
    isPlaying.value = false
    progress.value = 0
  }

  /**
   * 播放指定 MIDI 进行（点击 ▶ 与反馈态「再听一遍」共用）。
   * @param {string} midiUrl 题目 midiUrl（相对站根）
   * @param {string} [style] 风格目录名，决定重算 BPM
   */
  async function play(midiUrl, style) {
    if (!midiUrl) return
    try {
      const audioCtx = ensureContext()

      if (!firstPlayFired) {
        firstPlayFired = true
        try {
          onFirstPlay?.()
        } catch {
          // 回调异常不影响播放
        }
      }

      // 重播 / 切题：先掐掉上一段
      stop()

      status.value = 'loading'
      errorMessage.value = ''

      // 音色只加载一次（失败结果为 null，后续题目沿用合成兜底）
      if (!instrumentPromise) {
        instrumentPromise = loadInstrument(audioCtx)
      }
      resolvedInstrument = await instrumentPromise
      synthFallback.value = resolvedInstrument === null

      const bpm = getBpmForStyle(style)
      controller = await playProgression({
        midiUrl,
        bpm,
        ctx: audioCtx,
        instrument: resolvedInstrument,
      })

      status.value = 'ready'
      playStartMs = performance.now()
      await controller.play()
      isPlaying.value = true
      progress.value = 0
      rafLoop()
    } catch (err) {
      console.warn('[progression-audio] 播放失败：', err)
      status.value = 'error'
      errorMessage.value = '音频加载失败，请重试'
      isPlaying.value = false
      progress.value = 0
    }
  }

  onBeforeUnmount(() => {
    stop()
    if (ctx) {
      ctx.close().catch(() => {})
      ctx = null
    }
    instrumentPromise = null
    resolvedInstrument = undefined
  })

  return {
    status,
    isPlaying,
    progress,
    synthFallback,
    errorMessage,
    play,
    stop,
  }
}
