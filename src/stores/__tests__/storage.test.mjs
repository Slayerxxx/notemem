/**
 * storage.test.mjs
 * 数据持久化层单元测试（使用 Node 原生 assert）。
 *
 * 运行：node src/stores/__tests__/storage.test.mjs
 *
 * 覆盖：
 * - TR-5.1 错题写入后「重新创建 store 实例」（模拟刷新）数据仍在
 * - TR-5.2 removeItem 移除单条，其余保留
 * - TR-5.3 clearAll 清空 / 按模块清空，且不影响 stats 与 settings
 * - TR-5.4 localStorage 不可用时安全降级（safeGet/safeSet/ store 初始化不崩溃）
 * - TR-5.5 stats 累积：最高分、加权正确率 / 平均反应、recentScores 上限、刷新持久化
 * - settings：update / reset / 音效开关 / 自定义预设的持久化
 * - 同一 questionId 最多保留 5 条历史；count / scaleCount / chordCount 正确
 *
 * 说明：ESM 的 import 会被提升，但 storage 与各 store 仅在「函数调用 /
 * useStore() 实例化」时才访问 localStorage，故下方 mock 在测试执行前就绪。
 */

import assert from 'node:assert/strict'
import { setActivePinia, createPinia } from 'pinia'

// ============== 简易 localStorage mock（Node 环境无 localStorage） ==============
const mem = new Map()
const memoryStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => { mem.delete(k) },
  clear: () => mem.clear(),
}
globalThis.localStorage = memoryStorage

import {
  isStorageAvailable,
  safeGet,
  safeSet,
  safeRemove,
  STORAGE_KEYS,
} from '../../storage/index.js'
import {
  useWrongBookStore,
  useStatsStore,
  useSettingsStore,
} from '../index.js'

// ============== 测试辅助 ==============

/** 每个测试块前：清空 mock 存储并挂载全新 pinia */
function freshPinia() {
  mem.clear()
  setActivePinia(createPinia())
}

/** 模拟页面刷新：换新 pinia（不清 localStorage），后续 useStore 得到全新实例 */
function simulateRefresh() {
  setActivePinia(createPinia())
}

let wrongSeq = 0
/** 构造一条错题记录（结构与 game store 的 wrongItems 元素一致） */
function makeWrong(type, questionId, overrides = {}) {
  wrongSeq += 1
  const isScale = type === 'scale'
  const scope = questionId.split(':')[1]
  return {
    id: `wrong:${questionId}:${1700000000000 + wrongSeq}:${wrongSeq}`,
    type,
    questionId,
    ...(isScale ? { keyName: scope } : { root: scope }),
    promptText: isScale
      ? `${scope} 大调中，E 是第几级？`
      : `${scope} 大三和弦的组成音是？`,
    correctAnswer: isScale ? '第 III 级' : 'C, E, G',
    userAnswer: '第 V 级',
    reactionMs: 8000,
    timestamp: 1700000000000 + wrongSeq,
    ...overrides,
  }
}

/** 生成 n 个反应毫秒数（每项 base + i*step） */
function reactionTimes(n, base = 2000, step = 100) {
  return Array.from({ length: n }, (_, i) => base + i * step)
}

/** 在指定 localStorage 环境下执行（结束后恢复 mock） */
function withStorage(storageLike, fn) {
  const prev = globalThis.localStorage
  globalThis.localStorage = storageLike
  try {
    fn()
  } finally {
    globalThis.localStorage = prev
  }
}

// ============== TR-5.4（前半）：存储可用性探测与安全读写 ==============
{
  freshPinia()
  assert.equal(isStorageAvailable(), true, 'mock localStorage 下应可用')

  // 缺失键返回 fallback
  assert.deepEqual(safeGet('notemem_not_exist_key', { a: 1 }), { a: 1 })
  assert.equal(safeGet('notemem_not_exist_key', null), null)

  // 写入 / 读取往返
  safeSet('notemem_tmp', { x: [1, 2, 3], s: '文本' })
  assert.deepEqual(safeGet('notemem_tmp', null), { x: [1, 2, 3], s: '文本' })

  // 损坏 JSON 返回 fallback 而不抛错
  mem.set('notemem_bad_json', '{这不是合法 JSON')
  assert.equal(safeGet('notemem_bad_json', 'fallback'), 'fallback')

  // safeRemove 后读取回到 fallback
  safeRemove('notemem_tmp')
  assert.equal(safeGet('notemem_tmp', 'gone'), 'gone')
}

// ============== TR-5.4（后半）：localStorage 不可用时安全降级 ==============
{
  // 场景 1：localStorage 不存在（置 undefined，模拟 Node / 被禁用环境）
  withStorage(undefined, () => {
    assert.equal(isStorageAvailable(), false, '无 localStorage 时应不可用')
    assert.doesNotThrow(() => safeSet('notemem_x', { a: 1 }), 'safeSet 不应抛错')
    assert.equal(safeGet('notemem_x', 'fb'), 'fb', 'safeGet 应返回 fallback')
    assert.doesNotThrow(() => safeRemove('notemem_x'), 'safeRemove 不应抛错')

    // store 初始化与全部变更操作均不崩溃；内存态仍可用
    setActivePinia(createPinia())
    let wb, stats, settings
    assert.doesNotThrow(() => {
      wb = useWrongBookStore()
      stats = useStatsStore()
      settings = useSettingsStore()
      wb.addItems([makeWrong('scale', 'scale:C:3'), makeWrong('chord', 'chord:C')])
      wb.removeItem('not-exist')
      stats.recordSession({
        type: 'scale', level: 1, score: 90, total: 10, correct: 8,
        reactionTimes: reactionTimes(10),
      })
      settings.update({ soundEnabled: false })
    }, '存储不可用时 store 全流程不应崩溃')
    assert.equal(wb.count, 2, '内存态错题仍可读写')
    assert.equal(stats.getRecord('scale', 1).bestScore, 90)
    assert.equal(settings.settings.soundEnabled, false)
  })

  // 场景 2：localStorage 存在但所有方法抛错（隐私模式 / 配额异常）
  const throwingStorage = {
    getItem: () => { throw new Error('SecurityError') },
    setItem: () => { throw new Error('QuotaExceededError') },
    removeItem: () => { throw new Error('SecurityError') },
  }
  withStorage(throwingStorage, () => {
    assert.equal(isStorageAvailable(), false, '探测写入抛错应判定不可用')
    assert.equal(safeGet('any_key', 'fb'), 'fb')
    assert.doesNotThrow(() => safeSet('any_key', { v: 1 }))
    assert.doesNotThrow(() => safeRemove('any_key'))

    setActivePinia(createPinia())
    let wb
    assert.doesNotThrow(() => {
      wb = useWrongBookStore()
      wb.addItems([makeWrong('scale', 'scale:G:5')])
    }, '抛错存储下 store 初始化 / 写入不应崩溃')
    assert.equal(wb.count, 1)
  })

  // 恢复 mock 后存储重新可用
  freshPinia()
  assert.equal(isStorageAvailable(), true)
}

// ============== TR-5.1：错题写入后刷新，数量与内容一致 ==============
{
  freshPinia()
  const wb = useWrongBookStore()
  const wrongs = [
    makeWrong('scale', 'scale:C:3'),
    makeWrong('chord', 'chord:C'),
  ]
  wb.addItems(wrongs)
  assert.equal(wb.count, 2)

  // 模拟刷新：新 pinia + 重新实例化 store（setup 重新从 localStorage 读取）
  simulateRefresh()
  const wb2 = useWrongBookStore()
  assert.equal(wb2.count, 2, '刷新后错题数量应一致')
  assert.equal(wb2.scaleCount, 1)
  assert.equal(wb2.chordCount, 1)
  assert.deepEqual(wb2.items, wrongs, '刷新后错题内容应与写入时一致')
}

// ============== TR-5.2：removeItem 移除单条，其余保留 ==============
{
  freshPinia()
  const wb = useWrongBookStore()
  const w1 = makeWrong('scale', 'scale:C:3')
  const w2 = makeWrong('scale', 'scale:G:5')
  const w3 = makeWrong('chord', 'chord:F')
  wb.addItems([w1, w2, w3])

  wb.removeItem(w2.id)
  assert.equal(wb.count, 2)
  assert.ok(!wb.items.some((i) => i.id === w2.id), '被移除的错题不应存在')
  assert.ok(wb.items.some((i) => i.id === w1.id), '其余错题应保留')
  assert.ok(wb.items.some((i) => i.id === w3.id), '其余错题应保留')

  // 移除不存在的 id 无副作用
  wb.removeItem('wrong:not:exist')
  assert.equal(wb.count, 2)

  // 刷新后移除结果持久化
  simulateRefresh()
  const wb2 = useWrongBookStore()
  assert.equal(wb2.count, 2)
  assert.ok(!wb2.items.some((i) => i.id === w2.id))
}

// ============== TR-5.3：clearAll 清空 / 按模块清空，不影响 stats 与 settings ==============
{
  freshPinia()
  const wb = useWrongBookStore()
  const stats = useStatsStore()
  const settings = useSettingsStore()

  wb.addItems([
    makeWrong('scale', 'scale:C:1'),
    makeWrong('scale', 'scale:G:2'),
    makeWrong('chord', 'chord:C'),
  ])
  stats.recordSession({
    type: 'scale', level: 1, score: 100, total: 10, correct: 8,
    reactionTimes: reactionTimes(10),
  })
  settings.update({ soundEnabled: false, scaleLevel: 6 })

  // clearAll('scale')：只清音级，和弦错题保留
  wb.clearAll('scale')
  assert.equal(wb.count, 1)
  assert.equal(wb.scaleCount, 0)
  assert.equal(wb.chordCount, 1)
  assert.ok(wb.items[0].questionId === 'chord:C')
  // stats 与 settings 不受影响
  assert.ok(stats.getRecord('scale', 1), '统计不应受错题清空影响')
  assert.equal(settings.settings.soundEnabled, false, '设置不应受错题清空影响')
  assert.equal(settings.settings.scaleLevel, 6)

  // clearAll()：清空全部错题，stats / settings 依然保留
  wb.clearAll()
  assert.equal(wb.count, 0)
  assert.deepEqual(wb.items, [])
  assert.equal(stats.getRecord('scale', 1).bestScore, 100, '统计数据应保留')
  assert.equal(settings.settings.soundEnabled, false, '设置应保留')

  // 刷新后空错题本与保留的 stats / settings 均持久化
  simulateRefresh()
  const wb2 = useWrongBookStore()
  const stats2 = useStatsStore()
  const settings2 = useSettingsStore()
  assert.equal(wb2.count, 0)
  assert.equal(stats2.getRecord('scale', 1).bestScore, 100)
  assert.equal(settings2.settings.soundEnabled, false)
}

// ============== 同一 questionId 最多保留 5 条历史 ==============
{
  freshPinia()
  const wb = useWrongBookStore()

  // 单次批量写入 6 条同一 questionId：保留最新 5 条，最旧一条被丢弃
  const batch = []
  for (let i = 0; i < 6; i++) {
    batch.push(makeWrong('scale', 'scale:C:3', {
      id: `same-q-${i}`,
      timestamp: 1000 + i,
    }))
  }
  wb.addItems(batch)
  assert.equal(wb.count, 5, '同一 questionId 应只保留 5 条')
  assert.ok(!wb.items.some((i) => i.id === 'same-q-0'), '最旧一条应被删除')
  for (let i = 1; i <= 5; i++) {
    assert.ok(wb.items.some((x) => x.id === `same-q-${i}`), `第 ${i} 条应保留`)
  }

  // 跨批次追加同样裁剪：先 3 条再 3 条，保留最新 5 条（时间线连续）
  freshPinia()
  const wbFresh = useWrongBookStore()
  const mk = (i) => makeWrong('chord', 'chord:D', {
    id: `cross-${i}`,
    timestamp: 2000 + i,
  })
  wbFresh.addItems([mk(0), mk(1), mk(2)])
  wbFresh.addItems([mk(3), mk(4), mk(5)])
  assert.equal(wbFresh.count, 5)
  assert.ok(!wbFresh.items.some((i) => i.id === 'cross-0'), '跨批次最旧一条应被删除')
  assert.ok(wbFresh.items.some((i) => i.id === 'cross-5'), '最新一条应保留')

  // 不同 questionId 互不影响
  wbFresh.addItems([makeWrong('chord', 'chord:E', { id: 'other-1' })])
  assert.equal(wbFresh.count, 6)
  assert.equal(wbFresh.getByType('chord').length, 6)
}

// ============== count / scaleCount / chordCount / getWrongQuestions ==============
{
  freshPinia()
  const wb = useWrongBookStore()
  assert.equal(wb.count, 0)
  assert.equal(wb.scaleCount, 0)
  assert.equal(wb.chordCount, 0)

  wb.addItems([
    makeWrong('scale', 'scale:C:1'),
    makeWrong('scale', 'scale:G:2'),
    makeWrong('scale', 'scale:F:3'),
    makeWrong('chord', 'chord:C'),
    makeWrong('chord', 'chord:G'),
  ])
  assert.equal(wb.count, 5)
  assert.equal(wb.scaleCount, 3)
  assert.equal(wb.chordCount, 2)
  assert.equal(wb.getByType('scale').length, 3)
  assert.equal(wb.getByType('chord').length, 2)

  // getWrongQuestions 返回记录本身，questionId 可被题目生成器识别
  const chordWrong = wb.getWrongQuestions('chord')
  assert.equal(chordWrong.length, 2)
  assert.ok(chordWrong.every((q) => typeof q.questionId === 'string' &&
    q.questionId.startsWith('chord:')))
  const scaleWrong = wb.getWrongQuestions('scale')
  assert.ok(scaleWrong.every((q) => q.questionId.startsWith('scale:')))

  // 空数组入参无副作用
  wb.addItems([])
  wb.addItems(null)
  assert.equal(wb.count, 5)
}

// ============== TR-5.5：stats 累积与持久化 ==============
{
  freshPinia()
  const stats = useStatsStore()

  // 无记录维度返回 null / 0
  assert.equal(stats.getRecord('scale', 1), null)
  assert.equal(stats.accuracyOf('scale', 1), 0)
  assert.equal(stats.avgReactionOf('scale', 1), 0)
  assert.equal(stats.bestScoreOf('scale', 1), 0)

  // 第一轮：10 题对 6 题，得分 80，反应总时长 2000+...+2900 = 24500ms
  const times1 = reactionTimes(10, 2000, 100) // 2000..2900，合计 24500
  stats.recordSession({
    type: 'scale', level: 1, score: 80, total: 10, correct: 6,
    reactionTimes: times1,
  })
  // 第二轮：10 题对 9 题，得分 120（新高分），反应 1000..1900，合计 14500ms
  const times2 = reactionTimes(10, 1000, 100) // 合计 14500
  stats.recordSession({
    type: 'scale', level: 1, score: 120, total: 10, correct: 9,
    reactionTimes: times2,
  })

  const r = stats.getRecord('scale', 1)
  assert.equal(r.sessions, 2)
  assert.equal(r.bestScore, 120, '最高分应取最大值')
  assert.equal(r.totalAnswered, 20)
  assert.equal(r.totalCorrect, 15)
  assert.equal(r.totalReactionMs, 24500 + 14500)
  assert.deepEqual(r.recentScores, [80, 120])

  // 加权正确率 15/20 = 0.75；加权平均反应 (24500+14500)/20 = 1950ms
  assert.ok(Math.abs(stats.accuracyOf('scale', 1) - 15 / 20) < 1e-9,
    '正确率应按累计答题数加权')
  assert.equal(stats.avgReactionOf('scale', 1), (24500 + 14500) / 20,
    '平均反应应按累计反应时长 / 总答题数计算')
  assert.equal(stats.bestScoreOf('scale', 1), 120)

  // 其他维度独立
  assert.equal(stats.getRecord('chord', 1), null)

  // recentScores 最多保留 10 条：连续记录 12 轮
  for (let i = 0; i < 12; i++) {
    stats.recordSession({
      type: 'chord', level: 2, score: 10 + i, total: 5, correct: 5,
      reactionTimes: reactionTimes(5, 1000),
    })
  }
  const r2 = stats.getRecord('chord', 2)
  assert.equal(r2.sessions, 12)
  assert.equal(r2.recentScores.length, 10, 'recentScores 应只保留最近 10 条')
  assert.deepEqual(r2.recentScores, [12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
  assert.equal(r2.bestScore, 21)
  assert.equal(r2.totalAnswered, 60)
  assert.equal(r2.totalCorrect, 60)

  // 刷新后统计数据仍在
  simulateRefresh()
  const stats2 = useStatsStore()
  assert.equal(stats2.getRecord('scale', 1).bestScore, 120)
  assert.equal(stats2.getRecord('scale', 1).sessions, 2)
  assert.equal(stats2.getRecord('chord', 2).recentScores.length, 10)
  assert.ok(Math.abs(stats2.accuracyOf('scale', 1) - 0.75) < 1e-9)
  assert.equal(stats2.avgReactionOf('chord', 2), 1000 + 200, '5 题反应 1000..1400 平均 1200ms')

  // clearAll 清空统计
  stats2.clearAll()
  assert.equal(stats2.getRecord('scale', 1), null)
  assert.equal(stats2.getRecord('chord', 2), null)
  simulateRefresh()
  const stats3 = useStatsStore()
  assert.equal(stats3.getRecord('scale', 1), null, '清空后刷新仍为空')
}

// ============== settings：update / reset / 音效开关 / 预设 持久化 ==============
{
  freshPinia()
  const s = useSettingsStore()

  // 默认值
  assert.equal(s.settings.scaleLevel, 1)
  assert.equal(s.settings.chordLevel, 1)
  assert.equal(s.settings.scaleTrainMode, 'count')
  assert.equal(s.settings.chordTrainMode, 'count')
  assert.equal(s.settings.soundEnabled, true)
  assert.deepEqual(s.settings.customPresets, [])

  // update 合并更新
  s.update({ scaleLevel: 6, chordTrainMode: 'time' })
  assert.equal(s.settings.scaleLevel, 6)
  assert.equal(s.settings.chordTrainMode, 'time')
  assert.equal(s.settings.chordLevel, 1, '未更新字段保持不变')

  // 刷新后新实例读取一致
  simulateRefresh()
  const s2 = useSettingsStore()
  assert.equal(s2.settings.scaleLevel, 6)
  assert.equal(s2.settings.chordTrainMode, 'time')
  assert.equal(s2.settings.soundEnabled, true, '未改动字段保持默认')

  // 音效开关切换并持久化
  s2.update({ soundEnabled: false })
  simulateRefresh()
  const s3 = useSettingsStore()
  assert.equal(s3.settings.soundEnabled, false, '音效关闭应持久化')

  // 自定义预设增删
  s3.addCustomPreset({ name: '预设一', keys: ['C', 'G'], timeLimit: 10 })
  s3.addCustomPreset({ name: '预设二', roots: ['C', 'F'] })
  assert.equal(s3.settings.customPresets.length, 2)
  assert.equal(s3.settings.customPresets[0].name, '预设一')
  s3.removeCustomPreset(0)
  assert.equal(s3.settings.customPresets.length, 1)
  assert.equal(s3.settings.customPresets[0].name, '预设二')

  // 刷新后预设保留
  simulateRefresh()
  const s4 = useSettingsStore()
  assert.equal(s4.settings.customPresets.length, 1)
  assert.equal(s4.settings.customPresets[0].name, '预设二')
  assert.equal(s4.settings.soundEnabled, false)

  // reset 恢复全部默认
  s4.reset()
  assert.equal(s4.settings.scaleLevel, 1)
  assert.equal(s4.settings.chordLevel, 1)
  assert.equal(s4.settings.scaleTrainMode, 'count')
  assert.equal(s4.settings.chordTrainMode, 'count')
  assert.equal(s4.settings.soundEnabled, true)
  assert.deepEqual(s4.settings.customPresets, [])

  // reset 结果持久化
  simulateRefresh()
  const s5 = useSettingsStore()
  assert.equal(s5.settings.scaleLevel, 1)
  assert.equal(s5.settings.soundEnabled, true)
  assert.deepEqual(s5.settings.customPresets, [])

  // 非法入参不崩溃
  assert.doesNotThrow(() => s5.update(null))
  assert.doesNotThrow(() => s5.update('bad'))
  assert.equal(s5.settings.scaleLevel, 1)
}

// ============== 损坏的持久化数据：store 初始化安全降级 ==============
{
  freshPinia()
  // 写入损坏 / 错误类型的数据
  mem.set(STORAGE_KEYS.WRONGBOOK, '不是数组')
  mem.set(STORAGE_KEYS.STATS, '[1,2,3]')
  mem.set(STORAGE_KEYS.SETTINGS, 'null')

  let wb, stats, settings
  assert.doesNotThrow(() => {
    wb = useWrongBookStore()
    stats = useStatsStore()
    settings = useSettingsStore()
  }, '损坏数据下 store 初始化不应崩溃')
  assert.deepEqual(wb.items, [], '错题本损坏应降级为空数组')
  assert.deepEqual(stats.records, {}, '统计损坏应降级为空对象')
  assert.equal(settings.settings.scaleLevel, 1, '设置损坏应降级为默认值')
  assert.equal(settings.settings.soundEnabled, true)

  // 降级后写入可正常持久化覆盖坏数据
  wb.addItems([makeWrong('scale', 'scale:A:6')])
  stats.recordSession({
    type: 'chord', level: 3, score: 50, total: 5, correct: 4,
    reactionTimes: reactionTimes(5),
  })
  simulateRefresh()
  const wb2 = useWrongBookStore()
  const stats2 = useStatsStore()
  assert.equal(wb2.count, 1)
  assert.equal(stats2.getRecord('chord', 3).bestScore, 50)
}

console.log('All storage layer tests passed!')
