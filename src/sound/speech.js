/**
 * speech.js
 * 音符字母音名朗读：Web Speech API（speechSynthesis）封装。
 *
 * - speakNoteName：以 en-US 朗读字母音名（F♯ → "F sharp"，B♭ → "B flat"）；
 * - cancelSpeech：暂停/退出时立即终止朗读；
 * - 设备不支持 TTS 或调用异常时全部静默降级，不影响节拍与视觉流程。
 *
 * 文本映射复用 music/fretboard.js 的 toSpokenName，保证与显示/测试同源。
 */

import { toSpokenName } from '../music/fretboard.js'

/**
 * 特性检测：当前环境是否支持 speechSynthesis。
 * @returns {boolean}
 */
export function isSpeechSupported() {
  try {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    )
  } catch {
    return false
  }
}

/**
 * 在拍点朗读一个音符的字母音名。
 * @param {string} noteName 如 'C'、'F♯'、'B♭'、'E♯'
 */
export function speakNoteName(noteName) {
  if (!isSpeechSupported()) return
  try {
    const synth = window.speechSynthesis
    const text = toSpokenName(noteName)
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 1.05
    utter.volume = 1

    // 优先选用设备上的英语语音（找不到则交给系统默认语音按 en-US 处理）
    const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
    if (Array.isArray(voices) && voices.length > 0) {
      const voice =
        voices.find((v) => v.lang === 'en-US') ??
        voices.find((v) => typeof v.lang === 'string' && v.lang.startsWith('en'))
      if (voice) utter.voice = voice
    }

    synth.speak(utter)
  } catch {
    // 静默降级
  }
}

/**
 * 取消所有正在进行 / 排队的朗读（暂停、退出时调用）。
 */
export function cancelSpeech() {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // 静默降级
  }
}
