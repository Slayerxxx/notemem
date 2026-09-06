/**
 * storage/index.js
 * localStorage 底层安全封装。
 *
 * 职责：
 * - 统一存储键前缀 notemem_，避免与同域其他应用冲突；
 * - JSON 序列化 / 解析，所有操作 try-catch：
 *   隐私模式、存储配额超限、localStorage 不存在（Node 环境）等
 *   异常场景下静默降级，绝不抛错（应用不崩溃，仅数据不持久化）。
 */

/** 存储键统一前缀 */
const STORAGE_PREFIX = 'notemem_'

/** 全部持久化键名 */
export const STORAGE_KEYS = {
  /** 错题本 */
  WRONGBOOK: `${STORAGE_PREFIX}wrongbook`,
  /** 历史统计 */
  STATS: `${STORAGE_PREFIX}stats`,
  /** 用户设置 */
  SETTINGS: `${STORAGE_PREFIX}settings`,
}

/**
 * 获取 localStorage 引用。
 * 任何环境下（Node / 隐私模式 / 访问受限）都安全返回，不可用时返回 null。
 * @returns {Storage|null}
 */
function getStorage() {
  try {
    const storage = globalThis.localStorage
    return storage ?? null
  } catch {
    return null
  }
}

/**
 * 检测 localStorage 是否可用（写入探测）。
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const storage = getStorage()
    if (!storage) return false
    const probeKey = `${STORAGE_PREFIX}__probe__`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/**
 * 读取并 JSON.parse；键不存在或任何异常时返回 fallback。
 * @param {string} key 存储键
 * @param {*} fallback 读取失败时的兜底值
 * @returns {*}
 */
export function safeGet(key, fallback) {
  try {
    const storage = getStorage()
    if (!storage) return fallback
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * JSON.stringify 后写入；异常（隐私模式 / 配额超限）静默失败，不抛错。
 * @param {string} key 存储键
 * @param {*} value 待持久化值
 */
export function safeSet(key, value) {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // 静默失败：数据仅保留在内存中，应用继续可用
  }
}

/**
 * 移除指定键；异常静默。
 * @param {string} key 存储键
 */
export function safeRemove(key) {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.removeItem(key)
  } catch {
    // 静默失败
  }
}
