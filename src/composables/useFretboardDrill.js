/**
 * useFretboardDrill.js
 * 吉他指板记忆工具的自动节奏编排（组合式函数，无 DOM 操作）。
 *
 * 固定节奏：♩=60（每拍 1000ms），每组 12 拍：
 *   beat 0-3   recite 念题：逐拍揭示音符 + click + 英文朗读
 *   beat 4-7   think  思考：仅 click，指板答案不可见
 *   beat 8-11  reveal 答案：beat 8 显示指板与答案；beat 11 后自动下一组
 * beat 0/4/8 为重拍（高音 click）。
 *
 * 调度：setTimeout 链 + performance.now() 绝对时间锚点自校正，
 * 长任务造成的延迟在追赶时立即对齐、不累积；任何时刻只有一条调度链。
 * 暂停清除定时器与 TTS；继续时从中断拍重新起拍（念题拍重新朗读）。
 */

import { ref, onUnmounted } from 'vue'
import { generateNoteGroup, GROUP_SIZE } from '../music/fretboard.js'
import { playClick, unlockAudio } from '../sound/metronome.js'
import { speakNoteName, cancelSpeech } from '../sound/speech.js'

/** 固定 ♩=60 */
export const BEAT_MS = 1000
/** 每组 12 拍 */
export const BEATS_PER_GROUP = 12
/** 念题拍数（beat 0-3） */
export const RECITE_BEATS = 4
/** 思考拍数（beat 4-7） */
export const THINK_BEATS = 4

/**
 * 拍号 → 阶段。
 * @param {number} beat 0-11
 * @returns {'recite'|'think'|'reveal'}
 */
export function phaseForBeat(beat) {
  if (beat < RECITE_BEATS) return 'recite'
  if (beat < RECITE_BEATS + THINK_BEATS) return 'think'
  return 'reveal'
}

/**
 * @returns {{
 *   phase: import('vue').Ref<'idle'|'recite'|'think'|'reveal'>,
 *   paused: import('vue').Ref<boolean>,
 *   group: import('vue').Ref<Array<{fret:number,name:string}>>,
 *   revealedCount: import('vue').Ref<number>,
 *   beatInGroup: import('vue').Ref<number>,
 *   groupIndex: import('vue').Ref<number>,
 *   selectedString: import('vue').Ref<number>,
 *   selectedKey: import('vue').Ref<string|null>,
 *   flashTick: import('vue').Ref<number>,
 *   userAnswers: import('vue').Ref<number[]>,
 *   start: (stringIndex:number, keyName:string|null) => void,
 *   pause: () => void,
 *   resume: () => void,
 *   stop: () => void,
 *   answerFret: (fret:number) => void,
 * }}
 */
export function useFretboardDrill() {
  /** 当前阶段；idle=配置态 */
  const phase = ref('idle')
  const paused = ref(false)
  /** 当前组 4 个音符 */
  const group = ref([])
  /** 用户在指板上的作答（按序点击的品位数组，长度 0-4） */
  const userAnswers = ref([])
  /** 念题阶段已揭示个数 0-4 */
  const revealedCount = ref(0)
  /** 组内当前拍 0-11 */
  const beatInGroup = ref(0)
  /** 已开始的组数（从 1 起） */
  const groupIndex = ref(0)
  const selectedString = ref(0)
  const selectedKey = ref(null)
  /** 拍点计数：每执行一个拍动作 +1，供视图触发拍闪烁动画 */
  const flashTick = ref(0)

  /** 唯一的待执行定时器 */
  let timer = null
  /** 下一拍的目标时间戳（performance.now 基准，ms） */
  let nextBeatAt = 0
  /** 调度链是否存活（start 后 true，stop 后 false） */
  let running = false

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /**
   * 执行某一拍的全部拍点动作。
   * @param {number} beat 0-11
   */
  function executeBeat(beat) {
    const accent = beat === 0 || beat === RECITE_BEATS || beat === RECITE_BEATS + THINK_BEATS
    playClick(accent)
    flashTick.value += 1

    const p = phaseForBeat(beat)
    if (p !== phase.value) phase.value = p

    if (p === 'recite') {
      // 揭示第 beat+1 个音符并朗读（resume 重入同拍时重新朗读）
      revealedCount.value = beat + 1
      const note = group.value[beat]
      if (note) speakNoteName(note.name)
    }
    beatInGroup.value = beat
  }

  /** 安排下一拍（自校正延迟） */
  function scheduleNext() {
    const delay = Math.max(0, nextBeatAt - performance.now())
    timer = setTimeout(tick, delay)
  }

  /** 定时器回调：推进到下一拍或进入新组 */
  function tick() {
    timer = null
    const nextBeat = beatInGroup.value + 1
    // 锚点先推进：即使被阻塞，后续拍仍按原始网格追赶，不累积漂移
    nextBeatAt += BEAT_MS

    if (nextBeat >= BEATS_PER_GROUP) {
      beginNewGroup()
      return
    }
    executeBeat(nextBeat)
    scheduleNext()
  }

  /** 生成下一组并立即执行其第 0 拍 */
  function beginNewGroup() {
    group.value = generateNoteGroup(selectedString.value, selectedKey.value)
    revealedCount.value = 0
    userAnswers.value = []
    beatInGroup.value = 0
    groupIndex.value += 1
    // 新组重新锚定时间网格（组间无间隔连续）
    nextBeatAt = performance.now()
    executeBeat(0)
    nextBeatAt += BEAT_MS
    scheduleNext()
  }

  /**
   * 开始练习（须在用户点击手势内调用，以解锁音频/TTS）。
   * @param {number} stringIndex 0-5
   * @param {string|null} keyName 大调名或 null（不限调）
   */
  function start(stringIndex, keyName) {
    clearTimer()
    cancelSpeech()

    selectedString.value = stringIndex
    selectedKey.value = keyName
    group.value = generateNoteGroup(stringIndex, keyName)
    revealedCount.value = 0
    userAnswers.value = []
    beatInGroup.value = 0
    groupIndex.value = 1
    paused.value = false
    running = true

    unlockAudio()

    nextBeatAt = performance.now()
    executeBeat(0)
    nextBeatAt += BEAT_MS
    scheduleNext()
  }

  /** 暂停：立即停止计时、click 不再触发、TTS 取消，画面冻结 */
  function pause() {
    if (!running || paused.value) return
    paused.value = true
    clearTimer()
    cancelSpeech()
  }

  /**
   * 继续：从中断拍重新起拍。
   * 念题阶段当前拍重新揭示/朗读；思考/答案阶段重新计该拍。
   */
  function resume() {
    if (!running || !paused.value) return
    paused.value = false
    cancelSpeech()
    nextBeatAt = performance.now()
    executeBeat(beatInGroup.value)
    nextBeatAt += BEAT_MS
    scheduleNext()
  }

  /**
   * 用户在指板上点击作答：按序记录品位。
   * 仅在念题/思考阶段可作答；答案阶段锁定，满 4 个后忽略。
   * @param {number} fret 0-12
   */
  function answerFret(fret) {
    if (!running || paused.value) return
    if (phase.value === 'reveal' || phase.value === 'idle') return
    if (userAnswers.value.length >= GROUP_SIZE) return
    userAnswers.value = [...userAnswers.value, fret]
  }

  /** 结束练习：彻底清理，回到 idle 配置态 */
  function stop() {
    running = false
    clearTimer()
    cancelSpeech()
    paused.value = false
    phase.value = 'idle'
    beatInGroup.value = 0
    revealedCount.value = 0
    userAnswers.value = []
    group.value = []
    groupIndex.value = 0
  }

  // 组件卸载兜底：路由离开后不得残留声音/定时器
  onUnmounted(() => {
    stop()
  })

  return {
    phase,
    paused,
    group,
    revealedCount,
    beatInGroup,
    groupIndex,
    selectedString,
    selectedKey,
    flashTick,
    userAnswers,
    start,
    pause,
    resume,
    stop,
    answerFret,
  }
}
