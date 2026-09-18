/**
 * settings.js
 * 用户设置 Store（Pinia setup 风格）。
 *
 * 职责：
 * - 持久化四个训练模块的默认难度 / 训练模式、音效开关、自定义模式预设；
 * - 每次变更后自动写入 localStorage（notemem_settings）；
 * - 读取失败或字段缺失时使用默认值合并兜底。
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { safeGet, safeSet, STORAGE_KEYS } from '../storage/index.js'

/** 默认设置 */
const DEFAULT_SETTINGS = {
  /** 音级训练默认难度（L1-L12） */
  scaleLevel: 1,
  /** 和弦训练默认难度（L1-L3） */
  chordLevel: 1,
  /** 五度圈训练默认难度（L1-L2） */
  circleLevel: 1,
  /** 和弦进行识别训练默认难度（L1-L4） */
  progressionLevel: 1,
  /** 音级默认训练模式：time | count | wrong | custom */
  scaleTrainMode: 'count',
  /** 和弦默认训练模式 */
  chordTrainMode: 'count',
  /** 五度圈默认训练模式 */
  circleTrainMode: 'count',
  /** 和弦进行识别默认训练模式 */
  progressionTrainMode: 'count',
  /** 吉他指板工具：上次选择的弦（0=⑥弦 … 5=①弦） */
  fretboardString: 0,
  /** 吉他指板工具：上次选择的调性（null=不限调） */
  fretboardKey: null,
  /** 五声音阶指板速查：上次选择的调（如 'A'） */
  pentatonicKey: 'A',
  /** 五声音阶指板速查：大调或小调（'major' | 'minor'） */
  pentatonicMode: 'minor',
  /** 五声音阶指板速查：标注模式（'degree' 数字 | 'note' 音名） */
  pentatonicLabelMode: 'degree',
  /** 音效开关 */
  soundEnabled: true,
  /** 自定义模式预设（用户保存的配置数组） */
  customPresets: [],
}

/** 初始化：默认值与 localStorage 中已存设置合并（存储值优先，缺失字段用默认） */
function loadSettings() {
  const stored = safeGet(STORAGE_KEYS.SETTINGS, {})
  const base =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  const merged = { ...DEFAULT_SETTINGS, ...base }
  // 防御：customPresets 损坏时重置为数组
  if (!Array.isArray(merged.customPresets)) merged.customPresets = []
  return merged
}

export const useSettingsStore = defineStore('settings', () => {
  // ============== State ==============

  /** 用户设置对象 */
  const settings = ref(loadSettings())

  // ============== 内部工具 ==============

  /** 持久化到 localStorage */
  function persist() {
    safeSet(STORAGE_KEYS.SETTINGS, settings.value)
  }

  // ============== Actions ==============

  /**
   * 合并更新部分设置字段。
   * @param {Partial<typeof DEFAULT_SETTINGS>} partial
   */
  function update(partial) {
    if (!partial || typeof partial !== 'object') return
    settings.value = { ...settings.value, ...partial }
    persist()
  }

  /** 恢复默认设置（含清空自定义预设） */
  function reset() {
    settings.value = { ...DEFAULT_SETTINGS, customPresets: [] }
    persist()
  }

  /**
   * 新增一个自定义模式预设。
   * @param {object} preset 预设配置
   */
  function addCustomPreset(preset) {
    settings.value = {
      ...settings.value,
      customPresets: [...settings.value.customPresets, preset],
    }
    persist()
  }

  /**
   * 按索引移除一个自定义模式预设。
   * @param {number} index
   */
  function removeCustomPreset(index) {
    const next = [...settings.value.customPresets]
    next.splice(index, 1)
    settings.value = { ...settings.value, customPresets: next }
    persist()
  }

  return {
    // state
    settings,
    // actions
    update,
    reset,
    addCustomPreset,
    removeCustomPreset,
  }
})
