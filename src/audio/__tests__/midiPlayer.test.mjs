/**
 * midiPlayer.test.mjs
 * MIDI 播放引擎单元测试（node:assert + mock AudioContext / instrument，
 * 不发起任何网络请求）。
 *
 * 运行：node src/audio/__tests__/midiPlayer.test.mjs
 */

import assert from 'node:assert/strict'

import {
  computeSchedule,
  createProgressionController,
  createSynthInstrument,
  playProgression,
} from '../midiPlayer.js'
import { loadInstrument, __clearInstrumentCache } from '../soundfontLoader.js'

// ============== Mock 设施 ==============

/** 可手动推进 currentTime 的 mock AudioContext */
function createMockCtx() {
  return {
    currentTime: 100,
    state: 'running',
    destination: {},
    resumeCalls: 0,
    async resume() {
      this.resumeCalls += 1
      this.state = 'running'
    },
    createOscillator() {
      const calls = { start: [], stop: [] }
      return {
        calls,
        type: '',
        frequency: { setValueAtTime() {} },
        connect() {},
        start(t) {
          calls.start.push(t)
        },
        stop(t) {
          calls.stop.push(t)
        },
      }
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      }
    },
  }
}

/** 记录全部 start/stop 调用的 mock soundfont instrument */
function createMockInstrument() {
  const started = []
  const stopped = []
  return {
    started,
    stopped,
    start(noteName, when, opts) {
      const node = {
        noteName,
        when,
        opts,
        stop(t) {
          stopped.push({ noteName, t })
        },
      }
      started.push(node)
      return node
    },
  }
}

// ============== 1. computeSchedule 按 BPM 重算 ==============
{
  const ppq = 480
  const bpm = 90
  // secondsPerTick = 60 / (90*480) = 1/720 秒
  const spt = 60 / (90 * 480)
  const notes = [
    { midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 },
    { midi: 64, name: 'E4', ticks: 480, durationTicks: 240, velocity: 0.6 },
    { midi: 67, name: 'G4', ticks: 960, durationTicks: 480, velocity: 1 },
  ]
  const sched = computeSchedule(notes, ppq, bpm)
  assert.ok(Math.abs(sched[0].startSec - 0) < 1e-9)
  assert.ok(Math.abs(sched[0].durSec - 480 * spt) < 1e-9, 'dur=480tick→2/3s')
  assert.ok(Math.abs(sched[1].startSec - 480 * spt) < 1e-9, 'start=1拍→2/3s')
  assert.ok(Math.abs(sched[1].durSec - 240 * spt) < 1e-9)
  assert.equal(sched[0].noteName, 'C4')
  assert.equal(sched[2].velocity, 1)
}

// ============== 1b. 不同 BPM 速度不同（soul 70 vs hiphop2 115） ==============
{
  const note = [{ midi: 60, name: 'C4', ticks: 480, durationTicks: 480, velocity: 0.8 }]
  const slow = computeSchedule(note, 480, 70)[0]
  const fast = computeSchedule(note, 480, 115)[0]
  assert.ok(Math.abs(slow.startSec - 60 / 70) < 1e-9, '70BPM 1 拍 = 60/70 秒')
  assert.ok(Math.abs(fast.startSec - 60 / 115) < 1e-9)
  assert.ok(slow.startSec > fast.startSec)
}

// ============== 1c. durationTicks 缺失时由 duration(秒) 反推；非法参数抛错 ==============
{
  const sched = computeSchedule(
    [{ midi: 60, name: 'C4', ticks: 0, duration: 0.5, velocity: 0.8 }],
    480,
    90
  )
  // 反推 ticks = round(0.5 / (1/720)) = 360 → durSec = 360/720 = 0.5
  assert.ok(Math.abs(sched[0].durSec - 0.5) < 1e-6)
  assert.throws(() => computeSchedule([], 0, 90))
  assert.throws(() => computeSchedule([], 480, 0))
}

// ============== 2. 控制器播放 / 停止 / isPlaying ==============
await (async () => {
  const ctx = createMockCtx()
  const instrument = createMockInstrument()
  const schedule = computeSchedule(
    [
      { midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 },
      { midi: 67, name: 'G4', ticks: 480, durationTicks: 480, velocity: 0.8 },
    ],
    480,
    90
  )
  const ctrl = createProgressionController({ schedule, ctx, instrument })
  assert.equal(ctrl.synth, false, '真实音色 synth=false')
  assert.ok(Math.abs(ctrl.duration - (480 * 2) / 720) < 1e-9, 'duration=4/3s')
  assert.equal(ctrl.isPlaying(), false)

  await ctrl.play()
  assert.equal(instrument.started.length, 2, '两个音符均已排程')
  assert.equal(instrument.started[0].noteName, 'C4')
  // when = 100 + 0.06 + startSec
  assert.ok(Math.abs(instrument.started[0].when - 100.06) < 1e-9)
  assert.ok(Math.abs(instrument.started[1].when - (100.06 + 2 / 3)) < 1e-9)
  assert.equal(instrument.started[0].opts.gain, 0.8)
  assert.ok(instrument.started[0].opts.duration > 0)
  assert.equal(ctrl.isPlaying(), true, '播放中 isPlaying=true')

  // 播放中再次 play 为 noop（不重复排程）
  await ctrl.play()
  assert.equal(instrument.started.length, 2)

  ctrl.stop()
  assert.equal(instrument.stopped.length, 2, 'stop 遍历全部 scheduledNodes')
  assert.equal(ctrl.isPlaying(), false)
})()

// ============== 2b. 自然结束后 isPlaying 变 false（时间轴推进） ==============
await (async () => {
  const ctx = createMockCtx()
  const instrument = createMockInstrument()
  const schedule = computeSchedule(
    [{ midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 }],
    480,
    90
  )
  const ctrl = createProgressionController({ schedule, ctx, instrument })
  await ctrl.play()
  assert.equal(ctrl.isPlaying(), true)
  ctx.currentTime = 200 // 远超 endCtxTime
  assert.equal(ctrl.isPlaying(), false, '超过结束时间 isPlaying=false')
  ctrl.stop()
})()

// ============== 3. 合成兜底音色（instrument=null） ==============
await (async () => {
  const ctx = createMockCtx()
  const synth = createSynthInstrument(ctx)
  assert.equal(synth.isSynth, true)
  const node = synth.start(60, 100, { duration: 0.5, gain: 0.8 })
  assert.equal(typeof node.stop, 'function')
  node.stop(100.5)
  // 音名入参也可解析
  const node2 = synth.start('G4', 100, { duration: 0.3, gain: 0.5 })
  assert.equal(typeof node2.stop, 'function')
  node2.stop()

  // controller 自动走合成兜底
  const schedule = computeSchedule(
    [{ midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 }],
    480,
    90
  )
  const ctrl = createProgressionController({ schedule, ctx, instrument: null })
  assert.equal(ctrl.synth, true, 'instrument=null 时 synth=true')
  await ctrl.play()
  assert.equal(ctrl.isPlaying(), true)
  ctrl.stop()
  assert.equal(ctrl.isPlaying(), false)
})()

// ============== 4. playProgression 高层 API（注入 midiData，不 fetch） ==============
await (async () => {
  const ctx = createMockCtx()
  const instrument = createMockInstrument()
  const midiData = {
    header: { ppq: 480 },
    tracks: [
      { notes: [{ midi: 60, name: 'C4', ticks: 0, durationTicks: 10, velocity: 0.8 }] },
      {
        // 音符更多的轨道应被选中
        notes: [
          { midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 },
          { midi: 62, name: 'D4', ticks: 480, durationTicks: 480, velocity: 0.8 },
          { midi: 64, name: 'E4', ticks: 960, durationTicks: 480, velocity: 0.8 },
        ],
      },
    ],
  }
  const ctrl = await playProgression({
    midiUrl: '/midi/x.mid',
    bpm: 90,
    ctx,
    instrument,
    midiData,
  })
  assert.equal(instrument.started.length, 0)
  await ctrl.play()
  assert.equal(instrument.started.length, 3, '应选取音符最多的 track')
  ctrl.stop()
})()

// ============== 5. suspended context 播放前自动 resume ==============
await (async () => {
  const ctx = createMockCtx()
  ctx.state = 'suspended'
  const instrument = createMockInstrument()
  const schedule = computeSchedule(
    [{ midi: 60, name: 'C4', ticks: 0, durationTicks: 480, velocity: 0.8 }],
    480,
    90
  )
  const ctrl = createProgressionController({ schedule, ctx, instrument })
  await ctrl.play()
  assert.equal(ctx.resumeCalls, 1)
  ctrl.stop()
})()

// ============== 6. loadInstrument 失败返回 null / 成功缓存 ==============
await (async () => {
  const ctx = createMockCtx()

  // 注入失败 loader → null，不抛错
  const fail = await loadInstrument(ctx, {
    loader: async () => {
      throw new Error('network down')
    },
  })
  assert.equal(fail, null)

  // 注入成功 loader → instrument；同一 ctx 再次调用命中缓存（loader 只调一次）
  let calls = 0
  const fakeInstrument = { play() {} }
  const okLoader = async () => {
    calls += 1
    return fakeInstrument
  }
  const a = await loadInstrument(ctx, { loader: okLoader })
  const b = await loadInstrument(ctx, { loader: okLoader })
  assert.equal(a, fakeInstrument)
  assert.equal(b, fakeInstrument)
  assert.equal(calls, 1, '同 ctx 缓存命中，loader 不重复调用')
  __clearInstrumentCache(ctx)
})()

console.log('midiPlayer.test.mjs ✅ 全部通过')
