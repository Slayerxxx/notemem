/**
 * midiPlayer.js
 * MIDI 和弦进行播放引擎（与 src/sound/index.js 解耦）：
 *
 * - 使用 @tonejs/midi 的 Midi.fromUrl(url) 解析 MIDI，取音符数最多的
 *   一条 track 的 notes[]（midi/name/ticks/durationTicks/velocity）与
 *   header.ppq；
 * - 忽略 MIDI 原始 tempo，按调用方传入的 BPM（getBpmForStyle 分桶结果）
 *   重算每音 startSec/durSec：secondsPerTick = 60 / (BPM × ppq)；
 * - 用 soundfont-player instrument.start(noteName, when, {duration, gain})
 *   精确排程；返回控制器 { play, stop, isPlaying, duration }；
 * - instrument 为 null（真实音色加载失败）时使用内置振荡器合成音色兜底，
 *   保证训练流程不阻塞。
 *
 * 纯计算部分（computeSchedule）无副作用，可在 Node 单测直接验证。
 */

import MidiPackage from '@tonejs/midi'

// @tonejs/midi 仅提供 CJS/UMD 产物（module 字段也指向 CJS），
// 通过默认导入互操作取 Midi 类（Vite 的 CJS 预打包与 Node ESM 均兼容）。
const { Midi } = MidiPackage

/** 最短音符时长（秒），避免采样被截断 */
const MIN_NOTE_SEC = 0.1
/** 排程起点相对 ctx.currentTime 的提前量（秒），补偿调用开销 */
const SCHEDULE_AHEAD_SEC = 0.06

/**
 * 将 MIDI notes 按指定 BPM 重算为绝对秒级排程。
 * @param {Array<{ticks:number, durationTicks?:number, duration?:number,
 *   midi:number, name?:string, velocity:number}>} notes
 * @param {number} ppq header.ppq（每四分音符 tick 数）
 * @param {number} bpm 目标 BPM
 * @returns {Array<{midi:number, noteName:string, startSec:number,
 *   durSec:number, velocity:number}>}
 */
export function computeSchedule(notes, ppq, bpm) {
  if (!Number.isFinite(ppq) || ppq <= 0) {
    throw new Error(`computeSchedule: 非法 ppq ${ppq}`)
  }
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new Error(`computeSchedule: 非法 bpm ${bpm}`)
  }
  const secondsPerTick = 60 / (bpm * ppq)
  return notes.map((n) => {
    const durationTicks = Number.isFinite(n.durationTicks)
      ? n.durationTicks
      : Math.round((n.duration ?? 0) / secondsPerTick)
    return {
      midi: n.midi,
      noteName: n.name ?? midiToNoteName(n.midi),
      startSec: Math.max(0, n.ticks * secondsPerTick),
      durSec: Math.max(durationTicks * secondsPerTick, MIN_NOTE_SEC),
      velocity: Number.isFinite(n.velocity) ? n.velocity : 0.8,
    }
  })
}

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** 简易 MIDI note number → 音名（@tonejs/midi note.name 缺失时兜底） */
function midiToNoteName(midi) {
  const name = NOTE_LETTERS[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

/** MIDI note number → 频率（Hz），合成兜底用 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * 创建合成音色 instrument（soundfont 加载失败时的兜底）。
 * 返回与 soundfont instrument 同构的 { start(nameOrMidi, when, opts) → node }。
 * @param {AudioContext} ctx
 * @returns {{start:Function}}
 */
export function createSynthInstrument(ctx) {
  return {
    isSynth: true,
    start(noteNameOrMidi, when, opts = {}) {
      const midi =
        typeof noteNameOrMidi === 'number'
          ? noteNameOrMidi
          : noteNameToMidi(noteNameOrMidi)
      const freq = midiToFreq(midi)
      const dur = Number.isFinite(opts.duration) ? opts.duration : 0.5
      const peak = Math.max(0, Math.min(1, opts.gain ?? 0.8)) * 0.18

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, when)
      gain.gain.setValueAtTime(0.0001, when)
      gain.gain.exponentialRampToValueAtTime(peak, when + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(when)
      osc.stop(when + dur + 0.03)

      return {
        stop(t) {
          try {
            osc.stop(t ?? ctx.currentTime)
          } catch {
            // 已停止的节点重复 stop 静默忽略
          }
        },
      }
    },
  }
}

/** 音名 → MIDI note number（合成兜底解析 soundfont 风格音名，如 C4/F#3） */
function noteNameToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(String(name).trim())
  if (!m) return 60
  const letterIndex = NOTE_LETTERS.indexOf(m[1] + (m[2] === '#' ? '#' : ''))
  let semitone = letterIndex
  if (m[2] === 'b') semitone = (semitone - 1 + 12) % 12
  return (parseInt(m[3], 10) + 1) * 12 + semitone
}

/**
 * 由秒级排程创建播放控制器。
 * @param {object} args
 * @param {Array} args.schedule computeSchedule 输出
 * @param {AudioContext} args.ctx
 * @param {object|null} args.instrument soundfont instrument；null 时用合成兜底
 * @returns {{play:Function, stop:Function, isPlaying:Function, duration:number, synth:boolean}}
 */
export function createProgressionController({ schedule, ctx, instrument }) {
  if (!ctx) throw new Error('createProgressionController: 缺少 AudioContext')
  if (!Array.isArray(schedule) || schedule.length === 0) {
    throw new Error('createProgressionController: schedule 为空')
  }
  const player = instrument ?? createSynthInstrument(ctx)
  /** @type {Array<{stop:(t?:number)=>void}>} */
  let scheduledNodes = []
  let playing = false
  /** 本次排程在 ctx 时间轴上的起点 / 终点 */
  let startCtxTime = 0
  let endCtxTime = 0
  let cleanupTimer = null

  const duration = schedule.reduce(
    (max, n) => Math.max(max, n.startSec + n.durSec),
    0
  )

  function clearNodes() {
    scheduledNodes = []
  }

  function stopNodes() {
    const now = ctx.currentTime
    for (const node of scheduledNodes) {
      try {
        node.stop(now)
      } catch {
        // 部分节点可能已自然结束
      }
    }
    scheduledNodes = []
  }

  const controller = {
    /** 整段进行时长（秒，按重算后的 BPM） */
    duration,
    /** 是否为合成兜底音色 */
    synth: !instrument,

    /** 排程并播放；重复调用（播放中）为 noop */
    async play() {
      if (playing) return
      if (typeof ctx.resume === 'function' && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {})
      }
      stopNodes()
      if (cleanupTimer) {
        clearTimeout(cleanupTimer)
        cleanupTimer = null
      }

      playing = true
      startCtxTime = ctx.currentTime + SCHEDULE_AHEAD_SEC
      endCtxTime = startCtxTime + duration

      for (const n of schedule) {
        const node = player.start(n.noteName, startCtxTime + n.startSec, {
          duration: n.durSec,
          gain: n.velocity,
        })
        if (node) scheduledNodes.push(node)
      }

      // 自然结束后清理节点引用（isPlaying 以 ctx 时间为准）
      cleanupTimer = setTimeout(() => {
        clearNodes()
        cleanupTimer = null
      }, duration * 1000 + 200)
    },

    /** 立即停止全部已排程音符并清空引用 */
    stop() {
      playing = false
      if (cleanupTimer) {
        clearTimeout(cleanupTimer)
        cleanupTimer = null
      }
      stopNodes()
      endCtxTime = 0
    },

    /** 是否仍在播放（自然结束也算停止） */
    isPlaying() {
      if (!playing) return false
      return ctx.currentTime < endCtxTime
    },
  }

  return controller
}

/**
 * 从 MIDI 文件 URL 创建进行播放控制器（高层一站式 API）。
 * @param {object} args
 * @param {string} args.midiUrl 相对站根的 /midi/... URL
 * @param {number} args.bpm 目标 BPM（由 getBpmForStyle 得到）
 * @param {AudioContext} args.ctx
 * @param {object|null} args.instrument soundfont instrument；null 自动合成兜底
 * @param {object} [args.midiData] 已解析的 Midi 对象（测试注入，跳过 fetch）
 * @returns {Promise<{play,stop,isPlaying,duration,synth}>}
 */
export async function playProgression({ midiUrl, bpm, ctx, instrument, midiData }) {
  const midi = midiData ?? (await Midi.fromUrl(midiUrl))
  const ppq = midi.header.ppq
  // 多轨 MIDI 取音符最多的一条
  const track = (midi.tracks ?? []).reduce(
    (best, t) => ((t.notes?.length ?? 0) > (best.notes?.length ?? 0) ? t : best),
    midi.tracks?.[0] ?? { notes: [] }
  )
  const schedule = computeSchedule(track.notes ?? [], ppq, bpm)
  return createProgressionController({ schedule, ctx, instrument })
}
