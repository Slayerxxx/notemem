/**
 * progression.test.mjs
 * 和弦进行文件名解析 / hash / 速度分桶纯函数单元测试（node:assert）。
 *
 * 运行：node src/music/__tests__/progression.test.mjs
 */

import assert from 'node:assert/strict'

import {
  parseProgressionFilename,
  hashProgression,
  getBpmForStyle,
  normalizeStyleDir,
  progressionQuestionId,
  buildProgressionPrompt,
  PROGRESSION_KEYS,
  PROGRESSION_DIFFICULTIES,
  isPureTriadToken,
  hasExtendedToken,
  getProgressionPoolByLevel,
} from '../progression.js'

// ============== 1. 顶层 baseline 文件名解析（Major） ==============
{
  const r = parseProgressionFilename(
    'A - I I7 Idom7 I7 - Relaxed Playful.mid'
  )
  assert.deepEqual(
    r,
    {
      key: 'A',
      mode: 'major',
      progressionTokens: ['I', 'I7', 'Idom7', 'I7'],
      mood: ['Relaxed', 'Playful'],
      style: 'baseline',
    },
    'Major 顶层文件应解析为 major/baseline'
  )
}

// ============== 2. 小写罗马 + 复杂后缀（Minor 顶层） ==============
{
  const r = parseProgressionFilename(
    'D - iim7 V7 iiim7 vi7 iim7 V7 - Romantic Nostalgic.mid'
  )
  assert.equal(r.key, 'D')
  assert.equal(r.mode, 'major', '裸文件名无路径时 mode 兜底为 major')
  assert.deepEqual(
    r.progressionTokens,
    ['iim7', 'V7', 'iiim7', 'vi7', 'iim7', 'V7']
  )
  assert.deepEqual(r.mood, ['Romantic', 'Nostalgic'])
  assert.equal(r.style, 'baseline')
}

// ============== 3. 含 M-5 / sus2 后缀 token ==============
{
  const r = parseProgressionFilename(
    'A - I I IM-5 IM-5 IV IV V Vsus2 - Joyful Triumphant.mid'
  )
  assert.deepEqual(
    r.progressionTokens,
    ['I', 'I', 'IM-5', 'IM-5', 'IV', 'IV', 'V', 'Vsus2']
  )
  assert.equal(r.progressionTokens.length, 8, '8 个 token 合法')
}

// ============== 4. 子目录路径：pop style ==============
{
  const r = parseProgressionFilename(
    'Major/pop style/A - I V vi IV - Hopeful Romantic.mid'
  )
  assert.equal(r.mode, 'major')
  assert.equal(r.style, 'pop')
  assert.equal(r.key, 'A')
  assert.deepEqual(r.progressionTokens, ['I', 'V', 'vi', 'IV'])
  assert.deepEqual(r.mood, ['Hopeful', 'Romantic'])
}

// ============== 5. 其余 style 子目录规整 ==============
{
  assert.equal(
    parseProgressionFilename('Major/pop2 style/C - I V vi IV - Hopeful.mid').style,
    'pop2'
  )
  assert.equal(
    parseProgressionFilename(
      'Minor/hiphop2 style/E - i iv v - Sad Lonely.mid'
    ).style,
    'hiphop2'
  )
  assert.equal(
    parseProgressionFilename(
      'Modal/soul style/A - I IV V bVIIM - Triumphant Rebellious.mid'
    ).style,
    'soul'
  )
}

// ============== 6. Minor / Modal 顶层目录 mode 推断 ==============
{
  const minor = parseProgressionFilename('Minor/A - i iv v - Sad Lonely.mid')
  assert.equal(minor.mode, 'minor')
  assert.deepEqual(minor.progressionTokens, ['i', 'iv', 'v'])

  const modal = parseProgressionFilename(
    'Modal/A - I IV V bVIIM - Triumphant Rebellious.mid'
  )
  assert.equal(modal.mode, 'modal')
  assert.deepEqual(
    modal.progressionTokens,
    ['I', 'IV', 'V', 'bVIIM'],
    'Modal 的 b 前缀 token 原样保留'
  )
}

// ============== 7. Modal 含 #/b 前缀 token 原样保留 ==============
{
  const samples = [
    'Modal/Gb - #IVdim bVIIM I V - Dark.mid',
    'Modal/Db - bIIM7 bVIM biii bviim - Mysterious Surprised.mid',
    'Modal/B - bIIIM6 ii bIIM I - Surprised.mid',
    'Modal/E - #IVm viim ivm I - Rebellious.mid',
  ]
  const expected = [
    ['#IVdim', 'bVIIM', 'I', 'V'],
    ['bIIM7', 'bVIM', 'biii', 'bviim'],
    ['bIIIM6', 'ii', 'bIIM', 'I'],
    ['#IVm', 'viim', 'ivm', 'I'],
  ]
  samples.forEach((s, i) => {
    const r = parseProgressionFilename(s)
    assert.equal(r.mode, 'modal')
    assert.deepEqual(r.progressionTokens, expected[i])
  })
}

// ============== 8. 全部 12 个降号拼写调性可解析 ==============
{
  for (const key of PROGRESSION_KEYS) {
    const r = parseProgressionFilename(
      `Major/${key} - I V vi IV - Hopeful.mid`
    )
    assert.equal(r.key, key)
  }
}

// ============== 8b. Minor 包升号调性归一化为降号拼写 ==============
{
  const r = parseProgressionFilename('Minor/C# - i iv v - Sad Lonely.mid')
  assert.equal(r.mode, 'minor')
  assert.equal(r.key, 'Db', 'C# 应归一化为 Db')
  assert.equal(
    parseProgressionFilename('Minor/F# - i iv v - Sad Lonely.mid').key,
    'Gb'
  )
  assert.equal(
    parseProgressionFilename('Minor/G# - i iv v - Sad Lonely.mid').key,
    'Ab'
  )
}

// ============== 8c. 9 个 token 的长进行可解析（真实数据存在） ==============
{
  const r = parseProgressionFilename(
    'Minor/A - i VII i v III VII i v i - Mysterious Surprised.mid'
  )
  assert.equal(r.progressionTokens.length, 9)
  assert.deepEqual(r.mood, ['Mysterious', 'Surprised'])
}

// ============== 9. 非法文件名抛错 ==============
{
  const bad = [
    'Invalid File.mid', // 缺 ` - ` 分隔
    'I V vi IV - Hopeful.mid', // 只有两段
    'A - I V vi IV.mid', // 只有两段（无 mood）
    'H - I V vi IV - Hopeful.mid', // 非法调性
    'A - V vi - Hopeful.mid', // token 不足 3 个
    'A - ?? !! ## - Hopeful.mid', // 非法 token
    '',
  ]
  for (const name of bad) {
    assert.throws(
      () => parseProgressionFilename(name),
      /Invalid progression filename/,
      `应抛错：${name}`
    )
  }
}

// ============== 10. normalizeStyleDir ==============
{
  assert.equal(normalizeStyleDir('pop style'), 'pop')
  assert.equal(normalizeStyleDir('pop2 style'), 'pop2')
  assert.equal(normalizeStyleDir('hiphop2 style'), 'hiphop2')
  assert.equal(normalizeStyleDir('soul style'), 'soul')
}

// ============== 11. hashProgression 稳定 & 顺序敏感 ==============
{
  const a = ['I', 'V', 'vi', 'IV']
  const b = ['I', 'V', 'vi', 'IV']
  const c = ['I', 'V', 'IV', 'vi']
  assert.equal(hashProgression(a), hashProgression(b), '相同 tokens hash 相同')
  assert.notEqual(hashProgression(a), hashProgression(c), '顺序不同 hash 不同')
  assert.match(hashProgression(a), /^[0-9a-z]+$/, 'hash 为 36 进制字符串')
}

// ============== 12. 速度分桶 getBpmForStyle ==============
{
  assert.equal(getBpmForStyle('baseline'), 90)
  assert.equal(getBpmForStyle('pop'), 90)
  assert.equal(getBpmForStyle('pop2'), 90)
  assert.equal(getBpmForStyle('soul'), 70)
  assert.equal(getBpmForStyle('hiphop2'), 115)
  assert.equal(getBpmForStyle('unknown'), 90, '未知 style 默认中桶 90')
}

// ============== 13. 题目 id 与题干文案 ==============
{
  assert.equal(
    progressionQuestionId({ mode: 'major', key: 'C', tokenHash: 'abc123' }),
    'progression:major:C:abc123'
  )
  assert.equal(
    buildProgressionPrompt('major', 'C'),
    '请听这段大调和弦进行，调性：C 大调'
  )
  assert.equal(
    buildProgressionPrompt('minor', 'A'),
    '请听这段小调和弦进行，调性：A 小调'
  )
  assert.equal(
    buildProgressionPrompt('modal', 'A'),
    '请听这段 Modal 和弦进行，调性：A'
  )
}

// ============== 14. 基于真实 manifest 的难度池划分（AC-3） ==============
{
  const { readFileSync } = await import('node:fs')
  const manifest = JSON.parse(
    readFileSync(new URL('../../../public/midi/manifest.json', import.meta.url))
  )
  assert.equal(manifest.major.length, 600 * 5, 'major 3000 条')
  assert.equal(manifest.minor.length, 696 * 5, 'minor 3480 条')
  assert.equal(manifest.modal.length, 984 * 5, 'modal 4920 条')

  const l1 = getProgressionPoolByLevel(1, manifest)
  const l2 = getProgressionPoolByLevel(2, manifest)
  const l3 = getProgressionPoolByLevel(3, manifest)
  const l4 = getProgressionPoolByLevel(4, manifest)

  for (const [lv, pool, mode] of [
    [1, l1, 'major'],
    [2, l2, 'major'],
    [3, l3, 'minor'],
    [4, l4, 'modal'],
  ]) {
    assert.ok(pool.length > 0, `L${lv} 池非空`)
    assert.ok(pool.every((r) => r.mode === mode), `L${lv} 全部 mode=${mode}`)
    assert.ok(pool.every((r) => r.style === 'baseline'), `L${lv} 全部 baseline`)
  }
  assert.ok(
    l1.every((r) => r.progressionTokens.every(isPureTriadToken)),
    'L1 tokens 全部无后缀纯三和弦'
  )
  assert.ok(
    l2.every((r) => hasExtendedToken(r.progressionTokens)),
    'L2 至少含 1 个扩展和弦 token'
  )
  // L1 与 L2 互斥（major baseline 全量恰好被两池瓜分）
  const majorBaselineCount = manifest.major.filter(
    (r) => r.style === 'baseline'
  ).length
  assert.equal(
    l1.length + l2.length,
    majorBaselineCount,
    'L1+L2 覆盖全部 major baseline'
  )

  // 非法等级抛错
  assert.throws(() => getProgressionPoolByLevel(0, manifest))
  assert.throws(() => getProgressionPoolByLevel(5, manifest))

  // 难度配置形态
  assert.deepEqual(PROGRESSION_DIFFICULTIES.map((d) => d.level), [1, 2, 3, 4])
  assert.equal(PROGRESSION_DIFFICULTIES[0].optionCount, 4)
}

console.log('progression.test.mjs ✅ 全部通过')