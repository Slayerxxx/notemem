/**
 * game.test.mjs
 * 游戏状态管理 Store 单元测试（使用 Node 原生 assert）。
 *
 * 运行：node src/stores/__tests__/game.test.mjs
 *
 * 覆盖：TR-4.1 分数计算 / TR-4.2 连击加成 / TR-4.3 限时模式
 *       TR-4.4 题量模式 / 状态机防抖 / 错题记录 / 双题型流程
 *       summary 与 progressText 统计 / 真实计时器超时
 *
 * 时间控制策略（不依赖 vi/timer mock）：
 * - 反应时间通过 answerQuestion 第二参 reactionMs 注入；
 * - 超时通过直接调用内部 handleQuestionTimeout() / handleSessionEnd() 模拟；
 * - 另留一组真实计时器用例验证 interval 自动触发。
 */

import assert from 'node:assert/strict'
import { setActivePinia, createPinia } from 'pinia'

import { useGameStore } from '../index.js'
import { degreeToRoman } from '../../quiz/generator.js'

/** 创建挂载在全新 pinia 上的 store（每个测试块独立） */
function freshStore() {
  setActivePinia(createPinia())
  return useGameStore()
}

/** 答对当前题（可注入反应毫秒） */
function answerCorrect(store, reactionMs = 8000) {
  store.answerQuestion(store.currentQuestion.correctIndex, reactionMs)
}

/** 答错当前题，返回错误选项索引 */
function answerWrong(store, reactionMs = 8000) {
  const q = store.currentQuestion
  const wrongIdx = (q.correctIndex + 1) % q.options.length
  store.answerQuestion(wrongIdx, reactionMs)
  return wrongIdx
}

// ============== TR-4.1: 分数计算（timeLimit=10s） ==============
{
  const store = freshStore()
  store.start({
    type: 'scale', level: 1, trainMode: 'custom',
    timeLimit: 10, totalQuestions: 20,
  })
  assert.equal(store.config.timeLimit, 10)

  // t=0.2T（2000ms）→ 基础 10 + 速度奖励 10 = 20
  answerCorrect(store, 2000)
  assert.equal(store.lastResult.isCorrect, true)
  assert.equal(store.lastResult.gainedScore, 20, 't=0.2T 应得 20 分')
  assert.equal(store.score, 20)
  store.nextQuestion()

  // t=0.4T（4000ms）→ 基础 10 + 速度奖励 5 = 15（连击 2 无加成）
  answerCorrect(store, 4000)
  assert.equal(store.lastResult.gainedScore, 15, 't=0.4T 应得 15 分')
  store.nextQuestion()

  // t=0.6T（6000ms）→ 仅基础 10
  answerCorrect(store, 6000)
  assert.equal(store.lastResult.gainedScore, 10, 't=0.6T 应得 10 分')

  assert.equal(store.score, 45)
  store.reset()
}

// ============== TR-4.2: 连击加成 ==============
{
  const store = freshStore()
  store.start({ type: 'scale', level: 1, trainMode: 'count', totalQuestions: 20 })
  const tlMs = store.config.timeLimit * 1000 // 默认 15000ms

  // 连续答对 11 题，reactionMs=0.8T 无速度奖励
  for (let i = 1; i <= 11; i++) {
    answerCorrect(store, tlMs * 0.8)
    const expected = i <= 4 ? 10 : i <= 9 ? 12 : 15
    assert.equal(store.lastResult.gainedScore, expected,
      `第 ${i} 题应得 ${expected} 分（实际 ${store.lastResult.gainedScore}）`)
    assert.equal(store.combo, i, `第 ${i} 题后 combo 应为 ${i}`)
    if (i < 11) store.nextQuestion()
  }
  // 4*10 + 5*12 + 2*15 = 130
  assert.equal(store.score, 130)
  assert.equal(store.maxCombo, 11)

  // 第 12 题答错：0 分，连击清零，总分不变
  store.nextQuestion()
  const q12 = store.currentQuestion
  const wrongIdx = answerWrong(store, tlMs * 0.8)
  assert.notEqual(wrongIdx, q12.correctIndex)
  assert.equal(store.lastResult.isCorrect, false)
  assert.equal(store.lastResult.gainedScore, 0)
  assert.equal(store.combo, 0)
  assert.equal(store.score, 130)

  // 第 13 题答对：连击从 1 重新计，回到基础 10 分
  store.nextQuestion()
  answerCorrect(store, tlMs * 0.8)
  assert.equal(store.lastResult.gainedScore, 10, '断连后首题应回到 10 分')
  assert.equal(store.combo, 1)
  assert.equal(store.score, 140)
  assert.equal(store.maxCombo, 11, '最长连击不受断连影响')

  store.reset()
}

// ============== TR-4.3: 限时模式 ==============
{
  const store = freshStore()
  store.start({ type: 'scale', level: 1, trainMode: 'time', sessionTime: 60 })
  assert.equal(store.sessionRemaining, 60, '初始剩余应为 60 秒')
  assert.equal(store.config.sessionTime, 60)
  assert.equal(store.config.totalQuestions, null, '限时模式 totalQuestions 应为 null')
  assert.equal(store.phase, 'answering')

  // 答题中倒计时归零：本题按超时计错并直接 finish
  store.sessionRemaining = 0
  store.handleSessionEnd()
  assert.equal(store.phase, 'finished')
  assert.equal(store.answeredCount, 1, '超时题应计入已答')
  assert.equal(store.correctCount, 0)
  assert.equal(store.wrongItems.length, 1, '超时题应记入错题')

  // finished 后作答无效（防抖，分数不变）
  const scoreAfter = store.score
  store.answerQuestion(0, 1000)
  assert.equal(store.phase, 'finished')
  assert.equal(store.score, scoreAfter)
  assert.equal(store.answeredCount, 1)
  store.reset()

  // 反馈态中倒计时归零：停留反馈态，nextQuestion 时检测剩余时间再 finish
  const store2 = freshStore()
  store2.start({ type: 'scale', level: 1, trainMode: 'time', sessionTime: 60 })
  answerCorrect(store2, 5000)
  assert.equal(store2.phase, 'feedback')
  store2.sessionRemaining = 0
  store2.handleSessionEnd()
  assert.equal(store2.phase, 'feedback', '反馈态时间到应停留展示反馈，不自动跳转')
  store2.nextQuestion()
  assert.equal(store2.phase, 'finished')
  store2.reset()
}

// ============== TR-4.4: 题量模式 ==============
{
  const store = freshStore()
  store.start({ type: 'chord', level: 1, trainMode: 'count', totalQuestions: 5 })
  assert.equal(store.config.totalQuestions, 5)

  for (let i = 0; i < 5; i++) {
    assert.equal(store.phase, 'answering')
    answerCorrect(store, 8000)
    assert.equal(store.phase, 'feedback')
    if (i < 4) {
      store.nextQuestion()
      assert.equal(store.phase, 'answering')
    }
  }
  assert.equal(store.answeredCount, 5)
  store.nextQuestion()
  assert.equal(store.phase, 'finished', '答满 5 题后应结束')

  // 第 6 题无法生成：finished 态 nextQuestion / answerQuestion 均无效
  const lastQuestion = store.currentQuestion
  store.nextQuestion()
  assert.equal(store.currentQuestion, lastQuestion, '结束后不应再生成新题')
  store.answerQuestion(0, 1000)
  assert.equal(store.answeredCount, 5)

  // finish 返回本轮汇总
  const result = store.finish()
  assert.equal(result.total, 5)
  assert.equal(result.correct, 5)
  store.reset()
}

// ============== 状态机流转与作答防抖 ==============
{
  const store = freshStore()

  // idle 态调用作答/下一题无副作用
  store.answerQuestion(0, 1000)
  store.nextQuestion()
  assert.equal(store.phase, 'idle')

  store.start({ type: 'scale', level: 1, trainMode: 'count', totalQuestions: 10 })
  assert.equal(store.phase, 'answering')
  assert.ok(store.currentQuestion)
  assert.equal(store.selectedIndex, null)

  answerCorrect(store, 5000)
  assert.equal(store.phase, 'feedback')
  assert.equal(store.answeredCount, 1)
  assert.ok(store.selectedIndex === store.currentQuestion.correctIndex)

  // 防抖：feedback 态重复作答（无论对错）一律忽略
  const scoreSnapshot = store.score
  const comboSnapshot = store.combo
  store.answerQuestion((store.currentQuestion.correctIndex + 1) % 7, 5000)
  store.answerQuestion(store.currentQuestion.correctIndex, 5000)
  assert.equal(store.score, scoreSnapshot, '重复作答不应改变分数')
  assert.equal(store.combo, comboSnapshot, '重复作答不应改变连击')
  assert.equal(store.answeredCount, 1)

  // 下一题：回到 answering 且题目更新、作答状态清空
  const oldId = store.currentQuestion.id
  store.nextQuestion()
  assert.equal(store.phase, 'answering')
  assert.notEqual(store.currentQuestion.id, oldId, '应生成新题目')
  assert.equal(store.selectedIndex, null)
  assert.equal(store.lastResult, null)
  // 出题后 prevQuestionId 更新为当前题 id（供下一次生成时排除连续重复）
  assert.equal(store.prevQuestionId, store.currentQuestion.id)

  // reset 回到 idle 并清空状态
  store.reset()
  assert.equal(store.phase, 'idle')
  assert.equal(store.currentQuestion, null)
  assert.equal(store.config, null)
  assert.equal(store.score, 0)
  assert.equal(store.combo, 0)

  // 非法配置抛错（且不改变 idle 状态）
  assert.throws(() => store.start({ type: 'unknown' }), /未知训练类型/)
  assert.throws(() => store.start({ type: 'scale', trainMode: 'bad' }), /未知训练模式/)
  assert.equal(store.phase, 'idle')
}

// ============== 错题记录字段完整性 ==============
{
  const store = freshStore()
  store.start({ type: 'scale', level: 1, trainMode: 'count', totalQuestions: 10 })

  // 答错一道音级题
  const q1 = store.currentQuestion
  const wrongIdx = (q1.correctIndex + 1) % q1.options.length
  store.answerQuestion(wrongIdx, 3000)
  assert.equal(store.wrongItems.length, 1)
  const w = store.wrongItems[0]
  assert.ok(w.id, '错题记录应有唯一 id')
  assert.equal(w.type, 'scale')
  assert.equal(w.questionId, q1.id)
  assert.equal(w.keyName, 'C', '音级题错题应带 keyName')
  assert.ok(w.promptText.includes(q1.promptNote), '题干应包含被问音名')
  assert.equal(w.correctAnswer, `第 ${degreeToRoman(q1.degree)} 级`)
  assert.equal(w.userAnswer, `第 ${degreeToRoman(q1.options[wrongIdx])} 级`)
  assert.equal(w.reactionMs, 3000)
  assert.equal(typeof w.timestamp, 'number')

  // 超时一道题：userAnswer 标记「超时未答」，selectedIndex = -1
  store.nextQuestion()
  const q2 = store.currentQuestion
  store.handleQuestionTimeout()
  assert.equal(store.phase, 'feedback')
  assert.equal(store.selectedIndex, -1)
  assert.equal(store.lastResult.isCorrect, false)
  assert.equal(store.lastResult.gainedScore, 0)
  assert.equal(store.wrongItems.length, 2)
  const w2 = store.wrongItems[1]
  assert.equal(w2.questionId, q2.id)
  assert.equal(w2.userAnswer, '超时未答')
  assert.equal(w2.reactionMs, store.config.timeLimit * 1000)
  assert.equal(store.summary.wrongCount, 2)
  store.reset()

  // 和弦题错题：root 字段存在，答案为音名组合文本
  const store2 = freshStore()
  store2.start({ type: 'chord', level: 1, trainMode: 'count', totalQuestions: 5 })
  const cq = store2.currentQuestion
  const cWrong = (cq.correctIndex + 1) % cq.options.length
  store2.answerQuestion(cWrong, 5000)
  const cw = store2.wrongItems[0]
  assert.equal(cw.type, 'chord')
  assert.equal(cw.root, cq.root)
  assert.equal(cw.keyName, undefined, '和弦题错题不应带 keyName')
  assert.equal(cw.questionId, `chord:${cq.root}`)
  assert.equal(cw.correctAnswer, cq.options[cq.correctIndex].text)
  assert.equal(cw.userAnswer, cq.options[cWrong].text)
  assert.ok(cw.promptText.includes(cq.root))
  store2.reset()
}

// ============== timeoutQuestion 公开 action 与幂等 ==============
{
  const store = freshStore()
  store.start({ type: 'scale', level: 1, trainMode: 'count', totalQuestions: 5 })
  store.timeoutQuestion()
  assert.equal(store.phase, 'feedback')
  assert.equal(store.selectedIndex, -1)
  assert.equal(store.wrongItems.length, 1)
  // feedback 态再次超时/作答均无效
  store.timeoutQuestion()
  store.handleQuestionTimeout()
  assert.equal(store.wrongItems.length, 1)
  assert.equal(store.answeredCount, 1)
  store.reset()
}

// ============== 音级题与和弦题各跑一轮 3 题小流程 ==============
{
  for (const type of ['scale', 'chord']) {
    const store = freshStore()
    store.start({ type, level: 1, trainMode: 'count', totalQuestions: 3 })
    for (let i = 0; i < 3; i++) {
      assert.equal(store.currentQuestion.type, type)
      answerCorrect(store, 8000)
      assert.equal(store.phase, 'feedback')
      assert.equal(store.lastResult.isCorrect, true)
      if (i < 2) store.nextQuestion()
    }
    assert.equal(store.answeredCount, 3)
    assert.equal(store.correctCount, 3)
    assert.equal(store.reactionTimes.length, 3)
    store.nextQuestion()
    assert.equal(store.phase, 'finished')
    store.reset()
  }
}

// ============== summary / progressText 统计 ==============
{
  const store = freshStore()
  store.start({ type: 'scale', level: 1, trainMode: 'count', totalQuestions: 10 })
  assert.equal(store.progressText, '已答 0/10')

  answerCorrect(store, 2000) // 2000 < 0.3*15000=4500 → 20 分
  store.nextQuestion()
  answerCorrect(store, 6000) // 6000 < 0.5*15000=7500 → 15 分
  store.nextQuestion()
  answerWrong(store, 4000)   // 0 分

  const s = store.summary
  assert.equal(s.total, 3)
  assert.equal(s.correct, 2)
  assert.ok(Math.abs(s.accuracy - 2 / 3) < 1e-9, '正确率应为 2/3')
  assert.equal(s.avgReactionMs, 4000, '平均反应应为 (2000+6000+4000)/3')
  assert.equal(s.fastestReactionMs, 2000, '最快反应应为 2000ms')
  assert.equal(s.wrongCount, 1)
  assert.equal(s.maxCombo, 2)
  assert.equal(s.score, 35, '总分应为 20+15+0=35')
  assert.equal(store.progressText, '已答 3/10')
  store.reset()

  // 限时模式进度文案随剩余秒数变化
  const store2 = freshStore()
  store2.start({ type: 'chord', level: 1, trainMode: 'time', sessionTime: 180 })
  assert.equal(store2.progressText, '剩余 180 秒')
  store2.sessionRemaining = 120
  assert.equal(store2.progressText, '剩余 120 秒')
  store2.reset()

  // 空轮次 summary 安全降级
  const store3 = freshStore()
  const empty = store3.summary
  assert.equal(empty.total, 0)
  assert.equal(empty.accuracy, 0)
  assert.equal(empty.avgReactionMs, 0)
  assert.equal(empty.fastestReactionMs, null)
  assert.equal(empty.wrongCount, 0)
}

// ============== 错题模式与默认配置 ==============
{
  // 错题模式：透传错题记录，训练正常开始与结束
  const store = freshStore()
  store.start({
    type: 'scale', level: 1, trainMode: 'wrong',
    wrongQuestions: [{ id: 'scale:C:3' }, { id: 'chord:C' }],
    totalQuestions: 5,
  })
  assert.equal(store.phase, 'answering')
  assert.equal(store.config.timeLimit, 15, '错题模式默认单题限时 15s')
  for (let i = 0; i < 5; i++) {
    answerCorrect(store, 8000)
    if (i < 4) store.nextQuestion()
  }
  store.nextQuestion()
  assert.equal(store.phase, 'finished')
  assert.equal(store.answeredCount, 5)
  store.reset()

  // 错题模式：题目范围自动从错题提取——音级错题涉及 A 大调，
  // 即使 level=1（C 大调），出题也应全部为 A 大调，且题目 id 来自错题
  {
    const s = freshStore()
    const wrong = [
      { questionId: 'scale:A:6', type: 'scale', keyName: 'A' },
      { questionId: 'scale:A:3', type: 'scale', keyName: 'A' },
    ]
    s.start({ type: 'scale', level: 1, trainMode: 'wrong', wrongQuestions: wrong })
    assert.equal(s.config.totalQuestions, 2, '错题模式默认题量应为错题总数')
    assert.deepEqual(s.config.customKeys, ['A'], '应从错题提取调式范围')
    const seenIds = new Set()
    for (let i = 0; i < 2; i++) {
      assert.equal(s.currentQuestion.keyName, 'A', '错题模式应只出 A 大调题')
      assert.ok(['scale:A:6', 'scale:A:3'].includes(s.currentQuestion.id),
        `题目 id ${s.currentQuestion.id} 应来自错题集合`)
      seenIds.add(s.currentQuestion.id)
      answerCorrect(s, 8000)
      if (i < 1) s.nextQuestion()
    }
    assert.ok(seenIds.size >= 1)
    s.reset()
  }

  // 错题模式：和弦错题涉及 F 根音，题目根音应全部为 F
  {
    const s = freshStore()
    s.start({
      type: 'chord', level: 3, trainMode: 'wrong',
      wrongQuestions: [{ questionId: 'chord:F', type: 'chord', root: 'F' }],
    })
    assert.deepEqual(s.config.customRoots, ['F'], '应从错题提取根音范围')
    assert.equal(s.config.totalQuestions, 1)
    for (let i = 0; i < 5; i++) {
      assert.equal(s.currentQuestion.root, 'F', '错题模式应只出 F 和弦题')
      answerCorrect(s, 8000)
      if (i < 4) {
        // 错题仅 1 道、题量 1，首题反馈后 nextQuestion 即应结束
        s.nextQuestion()
        break
      }
    }
    s.reset()
  }

  // 默认值：题量模式默认 20 题
  const s2 = freshStore()
  s2.start({ type: 'chord', level: 2, trainMode: 'count' })
  assert.equal(s2.config.totalQuestions, 20)
  assert.equal(s2.config.timeLimit, 15)
  assert.equal(s2.sessionRemaining, null)
  s2.reset()

  // 默认值：限时模式默认 60 秒
  const s3 = freshStore()
  s3.start({ type: 'chord', level: 1, trainMode: 'time' })
  assert.equal(s3.sessionRemaining, 60)
  s3.reset()
}

// ============== 真实计时器：单题倒计时归零自动判超时 ==============
{
  const store = freshStore()
  // 单题限时 0.2 秒，等待后 interval 应自动触发超时
  store.start({ type: 'scale', level: 1, trainMode: 'custom', timeLimit: 0.2, totalQuestions: 3 })
  assert.ok(store.questionRemainingMs > 0)
  await new Promise((resolve) => setTimeout(resolve, 450))
  assert.equal(store.phase, 'feedback', '真实倒计时归零应自动进入反馈态')
  assert.equal(store.selectedIndex, -1)
  assert.equal(store.lastResult.isCorrect, false)
  assert.equal(store.wrongItems.length, 1)
  // 反馈态停留不自动跳转
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.equal(store.phase, 'feedback', '超时后应停留反馈态等待下一题')
  store.reset()
}

console.log('All game store tests passed!')
