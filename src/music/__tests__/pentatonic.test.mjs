/**
 * pentatonic.test.mjs
 * 五声音阶纯函数单元测试（node:assert/strict）。
 *
 * 运行：node src/music/__tests__/pentatonic.test.mjs
 */

import assert from 'node:assert/strict'

import {
  MAJOR_KEYS,
  PENTATONIC_MODES,
  getPentatonicScale,
  findPentatonicNote,
  NOTE_TO_POSITION,
} from '../scales.js'

// ============== 1. 基本结构与音程（大调五声） ==============
{
  for (const key of MAJOR_KEYS) {
    const scale = getPentatonicScale(key, 'major')
    assert.equal(scale.length, 5, `${key} 大调五声应有 5 个音`)
    const rootPitch = NOTE_TO_POSITION[key]
    assert.equal(scale[0].pitch, rootPitch, `${key} 大调五声根音应为 ${key}`)
    assert.equal(scale[0].degree, '1', '根音音级标签应为 1')
    // 半音距离应为 [0,2,4,7,9]
    const intervals = scale.map((n) => (n.pitch - rootPitch + 12) % 12)
    assert.deepEqual(
      intervals,
      [0, 2, 4, 7, 9],
      `${key} 大调五声音程应为 [0,2,4,7,9]`
    )
    // 音级标签
    assert.deepEqual(
      scale.map((n) => n.degree),
      ['1', '2', '3', '5', '6'],
      `${key} 大调五声音级标签应为 1,2,3,5,6`
    )
  }
}

// ============== 2. 基本结构与音程（小调五声） ==============
{
  for (const key of MAJOR_KEYS) {
    const scale = getPentatonicScale(key, 'minor')
    assert.equal(scale.length, 5, `${key} 小调五声应有 5 个音`)
    const rootPitch = NOTE_TO_POSITION[key]
    assert.equal(scale[0].pitch, rootPitch, `${key} 小调五声根音应为 ${key}`)
    // 半音距离应为 [0,3,5,7,10]
    const intervals = scale.map((n) => (n.pitch - rootPitch + 12) % 12)
    assert.deepEqual(
      intervals,
      [0, 3, 5, 7, 10],
      `${key} 小调五声音程应为 [0,3,5,7,10]`
    )
    // 音级标签
    assert.deepEqual(
      scale.map((n) => n.degree),
      ['1', '♭3', '4', '5', '♭7'],
      `${key} 小调五声音级标签应为 1,♭3,4,5,♭7`
    )
  }
}

// ============== 3. 拼写正确性：降号自然显示 ==============
{
  // 大调五声拼写
  assert.deepEqual(
    getPentatonicScale('C', 'major').map((n) => n.name),
    ['C', 'D', 'E', 'G', 'A'],
    'C 大调五声应为 C D E G A'
  )
  assert.deepEqual(
    getPentatonicScale('G', 'major').map((n) => n.name),
    ['G', 'A', 'B', 'D', 'E'],
    'G 大调五声应为 G A B D E'
  )
  assert.deepEqual(
    getPentatonicScale('F', 'major').map((n) => n.name),
    ['F', 'G', 'A', 'C', 'D'],
    'F 大调五声应为 F G A C D'
  )
  assert.deepEqual(
    getPentatonicScale('B♭', 'major').map((n) => n.name),
    ['B♭', 'C', 'D', 'F', 'G'],
    'B♭ 大调五声应为 B♭ C D F G'
  )

  // 小调五声拼写（关系大调调号体系，降号自然出现）
  assert.deepEqual(
    getPentatonicScale('A', 'minor').map((n) => n.name),
    ['A', 'C', 'D', 'E', 'G'],
    'A 小调五声应为 A C D E G（关系大调 C，无升降）'
  )
  assert.deepEqual(
    getPentatonicScale('E', 'minor').map((n) => n.name),
    ['E', 'G', 'A', 'B', 'D'],
    'E 小调五声应为 E G A B D（关系大调 G，升号体系但均为自然音）'
  )
  assert.deepEqual(
    getPentatonicScale('B', 'minor').map((n) => n.name),
    ['B', 'D', 'E', 'F♯', 'A'],
    'B 小调五声应为 B D E F♯ A（关系大调 D，F♯ 自然出现）'
  )
  assert.deepEqual(
    getPentatonicScale('C', 'minor').map((n) => n.name),
    ['C', 'E♭', 'F', 'G', 'B♭'],
    'C 小调五声应为 C E♭ F G B♭（关系大调 E♭，降号自然出现）'
  )
  assert.deepEqual(
    getPentatonicScale('F', 'minor').map((n) => n.name),
    ['F', 'A♭', 'B♭', 'C', 'E♭'],
    'F 小调五声应为 F A♭ B♭ C E♭'
  )
  assert.deepEqual(
    getPentatonicScale('B♭', 'minor').map((n) => n.name),
    ['B♭', 'D♭', 'E♭', 'F', 'A♭'],
    'B♭ 小调五声应为 B♭ D♭ E♭ F A♭'
  )
  assert.deepEqual(
    getPentatonicScale('F♯', 'minor').map((n) => n.name),
    ['F♯', 'A', 'B', 'C♯', 'E'],
    'F♯ 小调五声应为 F♯ A B C♯ E（关系大调 A）'
  )
}

// ============== 4. 小调五声 = 关系大调五声同音集 ==============
{
  // 小调根音 +3 半音 = 关系大调根音，二者五声音集应相同
  for (const key of MAJOR_KEYS) {
    const minorPitch = NOTE_TO_POSITION[key]
    const relMajorPitch = (minorPitch + 3) % 12
    // 找到关系大调名
    const relMajorKey = MAJOR_KEYS.find(
      (k) => NOTE_TO_POSITION[k] === relMajorPitch
    )
    if (!relMajorKey) continue // 部分半音位置可能不在 MAJOR_KEYS（理论上应都在）
    const minorSet = getPentatonicScale(key, 'minor').map((n) => n.pitch).sort()
    const majorSet = getPentatonicScale(relMajorKey, 'major').map((n) => n.pitch).sort()
    assert.deepEqual(
      minorSet,
      majorSet,
      `${key} 小调五声音集应等于 ${relMajorKey} 大调五声音集`
    )
  }
}

// ============== 5. findPentatonicNote 命中 ==============
{
  const scale = getPentatonicScale('A', 'minor')
  for (const n of scale) {
    const found = findPentatonicNote('A', 'minor', n.pitch)
    assert.ok(found, `应命中 ${n.name}`)
    assert.equal(found.name, n.name)
    assert.equal(found.degree, n.degree)
  }
  // 非五声音阶音应返回 null
  // A 小调五声 pitch 集合 = {9, 0, 2, 4, 7}，1=C♯ 不在内
  assert.equal(findPentatonicNote('A', 'minor', 1), null, 'C♯ 不在 A 小调五声')
  // 越界归一化
  assert.equal(findPentatonicNote('A', 'minor', 12)?.pitch, 0, '12 归一化为 0')
  assert.equal(findPentatonicNote('A', 'minor', -3)?.pitch, 9, '-3 归一化为 9')
}

// ============== 6. 参数校验 ==============
{
  assert.throws(() => getPentatonicScale('Z', 'major'), /Unsupported key/)
  assert.throws(() => getPentatonicScale('C', 'dorian'), /Unsupported pentatonic mode/)
  assert.deepEqual(PENTATONIC_MODES, ['major', 'minor'])
}

console.log('pentatonic.test.mjs OK')
