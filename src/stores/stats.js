/**
 * stats.js
 * 历史统计 Store（Pinia setup 风格）。
 *
 * 职责：
 * - 按「训练类型 + 难度等级」维度（键 `${type}_${level}`，如 scale_1、chord_2）
 *   累积每轮训练结果：最高分、累计答题数 / 答对数、累计反应时长、轮次、
 *   最近 10 轮得分；
 * - 提供正确率、平均反应时长、最高分查询；
 * - 每次变更后自动持久化到 localStorage（notemem_stats）。
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { safeGet, safeSet, STORAGE_KEYS } from '../storage/index.js'

/** 最近得分保留轮数 */
const MAX_RECENT_SCORES = 10

/** 初始化时从 localStorage 读取统计记录（异常 / 非对象时降级为空对象） */
function loadRecords() {
  const data = safeGet(STORAGE_KEYS.STATS, {})
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
}

/** 新建一个空维度记录 */
function createEmptyRecord() {
  return {
    /** 历史最高分 */
    bestScore: 0,
    /** 累计答题数 */
    totalAnswered: 0,
    /** 累计答对数 */
    totalCorrect: 0,
    /** 累计反应时长（毫秒） */
    totalReactionMs: 0,
    /** 累计训练轮次 */
    sessions: 0,
    /** 最近轮次得分（最多 10 条，旧 → 新） */
    recentScores: [],
  }
}

export const useStatsStore = defineStore('stats', () => {
  // ============== State ==============

  /** 以 `${type}_${level}` 为键的统计记录 */
  const records = ref(loadRecords())

  // ============== 内部工具 ==============

  /** 持久化到 localStorage */
  function persist() {
    safeSet(STORAGE_KEYS.STATS, records.value)
  }

  /** 维度键 */
  function keyOf(type, level) {
    return `${type}_${level}`
  }

  // ============== Actions ==============

  /**
   * 记录一轮训练结果。
   * @param {object} session
   * @param {'scale'|'chord'} session.type 训练类型
   * @param {number} session.level 难度等级
   * @param {number} session.score 本轮得分
   * @param {number} session.total 本轮答题数
   * @param {number} session.correct 本轮答对数
   * @param {number[]} session.reactionTimes 本轮每题反应毫秒数
   */
  function recordSession({ type, level, score, total, correct, reactionTimes } = {}) {
    const key = keyOf(type, level)
    const prev = records.value[key] ?? createEmptyRecord()
    const times = Array.isArray(reactionTimes) ? reactionTimes : []
    const reactionSum = times.reduce((sum, t) => sum + (Number(t) || 0), 0)

    const next = {
      bestScore: Math.max(prev.bestScore ?? 0, Number(score) || 0),
      totalAnswered: (prev.totalAnswered ?? 0) + (Number(total) || 0),
      totalCorrect: (prev.totalCorrect ?? 0) + (Number(correct) || 0),
      totalReactionMs: (prev.totalReactionMs ?? 0) + reactionSum,
      sessions: (prev.sessions ?? 0) + 1,
      recentScores: [...(prev.recentScores ?? []), Number(score) || 0].slice(
        -MAX_RECENT_SCORES,
      ),
    }
    // 整体替换以保证响应式追踪
    records.value = { ...records.value, [key]: next }
    persist()
  }

  /**
   * 获取某维度记录，无记录返回 null。
   * @param {'scale'|'chord'} type
   * @param {number} level
   * @returns {object|null}
   */
  function getRecord(type, level) {
    return records.value[keyOf(type, level)] ?? null
  }

  /** 清空全部统计 */
  function clearAll() {
    records.value = {}
    persist()
  }

  // ============== Getters（函数式，按维度查询） ==============

  /**
   * 正确率（0-1），无数据时为 0。
   * @returns {number}
   */
  function accuracyOf(type, level) {
    const r = getRecord(type, level)
    if (!r || r.totalAnswered <= 0) return 0
    return r.totalCorrect / r.totalAnswered
  }

  /**
   * 平均反应时长（毫秒，按答题数加权），无数据时为 0。
   * @returns {number}
   */
  function avgReactionOf(type, level) {
    const r = getRecord(type, level)
    if (!r || r.totalAnswered <= 0) return 0
    return r.totalReactionMs / r.totalAnswered
  }

  /**
   * 历史最高分，无记录时为 0。
   * @returns {number}
   */
  function bestScoreOf(type, level) {
    return getRecord(type, level)?.bestScore ?? 0
  }

  return {
    // state
    records,
    // actions
    recordSession,
    getRecord,
    clearAll,
    // getters
    accuracyOf,
    avgReactionOf,
    bestScoreOf,
  }
})
