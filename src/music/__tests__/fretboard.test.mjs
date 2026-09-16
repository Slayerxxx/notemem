/**
 * fretboard.test.mjs
 * 吉他指板纯函数单元测试（node:assert/strict）。
 *
 * 运行：node src/music/__tests__/fretboard.test.mjs
 */

import assert from 'node:assert/strict'

import {
  GUITAR_STRINGS,
  MAX_FRET,
  GROUP_SIZE,
  ANY_KEY,
  getFretPitch,
  getFretNote,
  getCandidateFrets,
  generateNoteGroup,
  spellFlatNote,
  toSpokenName,
} from '../fretboard.js'
import { getMajorScale, MAJOR_KEYS } from '../scales.js'

// ============== 1. 调弦定义与品位半音位置（TR-1.1） ==============
{
  assert.equal(GUITAR_STRINGS.length, 6, '应有 6 根弦')
  // 标准调弦空弦半音位置：E A D G B E = 4 9 2 7 11 4
  assert.deepEqual(
    GUITAR_STRINGS.map((s) => s.openPitch),
    [4, 9, 2, 7, 11, 4],
    '空弦半音位置应为 E2 A2 D3 G3 B3 E4'
  )
  assert.deepEqual(
    GUITAR_STRINGS.map((s) => s.number),
    [6, 5, 4, 3, 2, 1],
    '弦序号应从 ⑥ 到 ①'
  )

  // 穷举 6 弦 × 13 品：与 (openPitch + fret) mod 12 一致
  for (const s of GUITAR_STRINGS) {
    for (let fret = 0; fret <= MAX_FRET; fret += 1) {
      assert.equal(
        getFretPitch(s.index, fret),
        (s.openPitch + fret) % 12,
        `${s.number} 弦 ${fret} 品半音位置错误`
      )
    }
  }

  // 手工抽查
  assert.equal(getFretPitch(0, 5), 9, '⑥弦 5 品应为 A(9)')
  assert.equal(getFretPitch(5, 12), 4, '①弦 12 品应为 E(4)')
  assert.equal(getFretPitch(4, 1), 0, '②弦 1 品应为 C(0)')
  assert.equal(getFretPitch(3, 2), 9, '③弦 2 品应为 A(9)')
  assert.equal(getFretPitch(2, 2), 4, '④弦 2 品应为 E(4)')
  assert.equal(getFretPitch(1, 2), 11, '⑤弦 2 品应为 B(11)')

  // 越界抛错
  assert.throws(() => getFretPitch(-1, 0), /Invalid string/)
  assert.throws(() => getFretPitch(6, 0), /Invalid string/)
  assert.throws(() => getFretPitch(0, -1), /Invalid fret/)
  assert.throws(() => getFretPitch(0, 13), /Invalid fret/)
  assert.throws(() => getFretPitch(0, 1.5), /Invalid fret/)
}

// ============== 2. 调内候选与调式拼写（TR-1.2） ==============
{
  for (const key of MAJOR_KEYS) {
    const scaleNames = new Set(getMajorScale(key).map((n) => n.name))
    for (const s of GUITAR_STRINGS) {
      const frets = getCandidateFrets(s.index, key)
      assert.ok(
        frets.length >= 7 && frets.length <= 8,
        `${key} 大调 ${s.number} 弦候选数应在 7-8，实际 ${frets.length}`
      )
      for (const fret of frets) {
        const name = getFretNote(s.index, fret, key)
        assert.ok(
          scaleNames.has(name),
          `${key} 大调 ${s.number} 弦 ${fret} 品「${name}」不在调内`
        )
      }
    }
  }

  // 调式拼写专项
  assert.equal(getFretNote(0, 2, 'G'), 'F♯', 'G 大调 ⑥弦 2 品应拼写为 F♯')
  assert.equal(getFretNote(0, 6, 'F'), 'B♭', 'F 大调 ⑥弦 6 品应拼写为 B♭')
  assert.equal(getFretNote(0, 1, 'F♯'), 'E♯', 'F♯ 大调 ⑥弦 1 品应拼写为 E♯（等音 F）')
  // C 大调空弦与 12 品同音名
  assert.equal(getFretNote(0, 0, 'C'), 'E')
  assert.equal(getFretNote(0, 12, 'C'), 'E')
}

// ============== 3. 不限调：全候选 + 降号拼写（TR-1.3） ==============
{
  assert.deepEqual(
    spellFlatNote(1),
    'D♭',
    '位置 1 的降号拼写应为 D♭'
  )
  for (const s of GUITAR_STRINGS) {
    const frets = getCandidateFrets(s.index, ANY_KEY)
    assert.deepEqual(
      frets,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      `${s.number} 弦不限调时 0-12 品应全部候选`
    )
    for (const fret of frets) {
      const name = getFretNote(s.index, fret)
      assert.ok(
        !name.includes('♯'),
        `不限调拼写不应出现升号：${s.number} 弦 ${fret} 品 ${name}`
      )
    }
  }
  // ⑥E 弦：2 品音名降号拼写为 G♭；⑤A 弦 4 品为 D♭
  assert.equal(getFretNote(0, 2), 'G♭')
  assert.equal(getFretNote(1, 4), 'D♭')
}

// ============== 4. 随机音符组合法性（TR-1.4） ==============
{
  const keyOptions = [ANY_KEY, ...MAJOR_KEYS]
  // 固定种子的伪随机，保证测试可复现
  function seededRng(seed) {
    let state = seed >>> 0
    return () => {
      // xorshift32
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      state >>>= 0
      return state / 0x100000000
    }
  }

  for (const s of GUITAR_STRINGS) {
    for (const key of keyOptions) {
      const candidateSet = new Set(getCandidateFrets(s.index, key))
      for (let round = 0; round < 200; round += 1) {
        const group = generateNoteGroup(s.index, key, seededRng(round + 1))
        assert.equal(group.length, GROUP_SIZE, '每组必须恰为 4 个音符')
        for (const item of group) {
          assert.ok(
            Number.isInteger(item.fret) &&
              item.fret >= 0 &&
              item.fret <= MAX_FRET,
            `品位越界：${item.fret}`
          )
          assert.equal(
            item.name,
            getFretNote(s.index, item.fret, key),
            '音符名称应与品位推算一致'
          )
          assert.ok(
            candidateSet.has(item.fret),
            `抽中品位 ${item.fret} 不在候选集合中`
          )
        }
      }
    }
  }

  // 不允许重复品位：每组 4 个品位必须互不相同
  for (const s of GUITAR_STRINGS) {
    for (const key of keyOptions) {
      for (let round = 0; round < 100; round += 1) {
        const g = generateNoteGroup(s.index, key, seededRng(round * 31 + 7))
        const frets = g.map((x) => x.fret)
        assert.equal(
          new Set(frets).size,
          frets.length,
          `${s.number} 弦 ${key ?? '不限调'} 组内品位不应重复：${frets.join(',')}`
        )
      }
    }
  }

  // 恒取下标 0 的 rng 不再产出重复品位：洗牌后前 4 个互不相同
  const group = generateNoteGroup(0, 'C', () => 0)
  assert.equal(group.length, 4)
  assert.equal(new Set(group.map((x) => x.fret)).size, 4)
}

// ============== 5. TTS 英文朗读文本映射（TR-1.5） ==============
{
  // 字母用音标拼写，避免 iOS Safari 把孤立大写字母读成 "Capital A"
  assert.equal(toSpokenName('C'), 'see')
  assert.equal(toSpokenName('D'), 'dee')
  assert.equal(toSpokenName('E'), 'ee')
  assert.equal(toSpokenName('F'), 'ef')
  assert.equal(toSpokenName('G'), 'gee')
  assert.equal(toSpokenName('A'), 'ay')
  assert.equal(toSpokenName('B'), 'bee')
  assert.equal(toSpokenName('F♯'), 'ef sharp')
  assert.equal(toSpokenName('E♯'), 'ee sharp')
  assert.equal(toSpokenName('B♭'), 'bee flat')
  assert.equal(toSpokenName('G♭'), 'gee flat')
  assert.equal(toSpokenName('D♭'), 'dee flat')
  // 小写字母也应归一化（防御性）
  assert.equal(toSpokenName('a'), 'ay')
}

console.log('fretboard.test.mjs OK')
