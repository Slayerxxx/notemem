/**
 * wrongbook.js
 * 错题本 Store（Pinia setup 风格）。
 *
 * 职责：
 * - 持久化存储每轮训练产生的错题记录（结构与 game store 的 wrongItems 一致）；
 * - 同一 questionId 每次答错都保留（形成时间线），但最多保留 5 条历史，
 *   超出时删除最旧记录；
 * - 支持按记录 id 移除单条、按模块（音级/和弦）清空；
 * - 提供错题记录给题目生成器做错题强化 / 错题模式出题。
 *
 * 每次变更后自动写入 localStorage（notemem_wrongbook），
 * localStorage 不可用时仅内存态可用，不报错。
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { safeGet, safeSet, STORAGE_KEYS } from '../storage/index.js'

/** 同一 questionId 最多保留的错题历史条数 */
const MAX_HISTORY_PER_QUESTION = 5

/** 初始化时从 localStorage 读取错题列表（异常 / 非数组时降级为空数组） */
function loadItems() {
  const data = safeGet(STORAGE_KEYS.WRONGBOOK, [])
  return Array.isArray(data) ? data : []
}

export const useWrongBookStore = defineStore('wrongbook', () => {
  // ============== State ==============

  /** 错题记录数组（新记录追加在末尾） */
  const items = ref(loadItems())

  // ============== Getters ==============

  /** 错题总数 */
  const count = computed(() => items.value.length)

  /** 音级训练错题数 */
  const scaleCount = computed(() => items.value.filter((i) => i?.type === 'scale').length)

  /** 和弦训练错题数 */
  const chordCount = computed(() => items.value.filter((i) => i?.type === 'chord').length)

  /** 五度圈训练错题数 */
  const circleCount = computed(() => items.value.filter((i) => i?.type === 'circle').length)

  /** 和弦进行识别训练错题数 */
  const progressionCount = computed(
    () => items.value.filter((i) => i?.type === 'progression').length
  )

  // ============== 内部工具 ==============

  /** 持久化到 localStorage */
  function persist() {
    safeSet(STORAGE_KEYS.WRONGBOOK, items.value)
  }

  // ============== Actions ==============

  /**
   * 批量写入本轮错题（游戏结束时调用）。
   * 去重 / 裁剪策略：同一 questionId 的每次答错都保留（时间线），
   * 但每个 questionId 最多保留 5 条，超出时从最旧记录开始丢弃；
   * 不同 questionId 之间互不影响，整体保持时间先后顺序。
   * @param {Array} wrongItems 本轮错题记录数组
   */
  function addItems(wrongItems) {
    const incoming = Array.isArray(wrongItems) ? [...wrongItems] : []
    if (incoming.length === 0) return

    const merged = [...items.value, ...incoming]

    // 统计每个 questionId 的条数，超出上限的部分从最旧（队首）开始丢弃
    const totals = new Map()
    for (const item of merged) {
      const qid = item?.questionId
      totals.set(qid, (totals.get(qid) ?? 0) + 1)
    }
    const dropRemaining = new Map()
    for (const [qid, n] of totals) {
      if (n > MAX_HISTORY_PER_QUESTION) {
        dropRemaining.set(qid, n - MAX_HISTORY_PER_QUESTION)
      }
    }

    if (dropRemaining.size > 0) {
      items.value = merged.filter((item) => {
        const qid = item?.questionId
        const left = dropRemaining.get(qid) ?? 0
        if (left > 0) {
          dropRemaining.set(qid, left - 1)
          return false // 丢弃最旧的一条
        }
        return true
      })
    } else {
      items.value = merged
    }
    persist()
  }

  /**
   * 按记录唯一 id 移除单条错题。
   * @param {string} id 错题记录 id
   */
  function removeItem(id) {
    const next = items.value.filter((item) => item?.id !== id)
    if (next.length === items.value.length) return
    items.value = next
    persist()
  }

  /**
   * 清空错题。
   * @param {'scale'|'chord'|'circle'|'progression'} [type] 不传则清空全部；传入则只清该模块
   */
  function clearAll(type) {
    if (
      type === 'scale' ||
      type === 'chord' ||
      type === 'circle' ||
      type === 'progression'
    ) {
      items.value = items.value.filter((item) => item?.type !== type)
    } else {
      items.value = []
    }
    persist()
  }

  /**
   * 按模块筛选错题。
   * @param {'scale'|'chord'|'circle'|'progression'} type
   * @returns {Array}
   */
  function getByType(type) {
    return items.value.filter((item) => item?.type === type)
  }

  /**
   * 返回供题目生成器使用的错题数组（该模块全部记录，
   * 生成器通过 questionId 字段识别题目并加权）。
   * @param {'scale'|'chord'|'circle'|'progression'} type
   * @returns {Array}
   */
  function getWrongQuestions(type) {
    return getByType(type)
  }

  return {
    // state
    items,
    // getters
    count,
    scaleCount,
    chordCount,
    circleCount,
    progressionCount,
    // actions
    addItems,
    removeItem,
    clearAll,
    getByType,
    getWrongQuestions,
  }
})
