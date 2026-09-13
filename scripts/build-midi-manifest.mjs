/**
 * build-midi-manifest.mjs
 * 构建期脚本：扫描 public/midi/{Major,Minor,Modal}/ 下全部 .mid 文件，
 * 解析文件名并生成 public/midi/manifest.json。
 *
 * 输出结构：
 *   {
 *     major: [ { key, mode, progressionTokens, mood, style, url, tokenHash } ],
 *     minor: [ ... ],
 *     modal: [ ... ],
 *   }
 *
 * 运行：npm run build:manifest
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseProgressionFilename,
  hashProgression,
} from '../src/music/progression.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const MIDI_ROOT = join(REPO_ROOT, 'public', 'midi')
const OUT_FILE = join(MIDI_ROOT, 'manifest.json')

/** 顶层目录 → 输出数组键 */
const TOP_DIRS = [
  { dir: 'Major', key: 'major' },
  { dir: 'Minor', key: 'minor' },
  { dir: 'Modal', key: 'modal' },
]

/**
 * 递归收集目录下全部 .mid 文件的相对路径（以 midiRoot 为基准，POSIX 分隔）。
 * @param {string} absDir
 * @param {string} relDir
 * @returns {string[]}
 */
function collectMidFiles(absDir, relDir) {
  const out = []
  let entries = []
  try {
    entries = readdirSync(absDir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const abs = join(absDir, entry)
    const rel = relDir ? `${relDir}/${entry}` : entry
    const st = statSync(abs)
    if (st.isDirectory()) {
      out.push(...collectMidFiles(abs, rel))
    } else if (st.isFile() && /\.mid$/i.test(entry)) {
      out.push(rel)
    }
  }
  return out
}

function main() {
  if (!existsSync(MIDI_ROOT)) {
    console.error(`[manifest] MIDI 目录不存在：${MIDI_ROOT}`)
    process.exitCode = 1
    return
  }

  const manifest = { major: [], minor: [], modal: [] }
  let parsed = 0
  const errors = []

  for (const { dir, key } of TOP_DIRS) {
    const absTop = join(MIDI_ROOT, dir)
    if (!existsSync(absTop)) {
      console.warn(`[manifest] 顶层目录缺失，跳过：${dir}`)
      continue
    }
    const files = collectMidFiles(absTop, dir)
    for (const rel of files) {
      try {
        const info = parseProgressionFilename(rel)
        if (info.mode !== key) {
          throw new Error(`mode 与目录不一致：${rel} → ${info.mode}`)
        }
        // url 相对站根；逐段 encode 保留空格等字符
        const url =
          '/midi/' +
          rel
            .split('/')
            .map((seg) => encodeURIComponent(seg))
            .join('/')
        manifest[key].push({
          key: info.key,
          mode: info.mode,
          progressionTokens: info.progressionTokens,
          mood: info.mood,
          style: info.style,
          url,
          tokenHash: hashProgression(info.progressionTokens),
        })
        parsed += 1
      } catch (err) {
        errors.push(`${rel}: ${err.message}`)
      }
    }
  }

  if (errors.length > 0) {
    console.error(`[manifest] ${errors.length} 个文件解析失败：`)
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`)
    if (errors.length > 20) console.error(`  …另有 ${errors.length - 20} 条`)
    process.exitCode = 1
    return
  }

  writeFileSync(OUT_FILE, JSON.stringify(manifest), 'utf8')
  console.log(
    `[manifest] 生成成功：${OUT_FILE}\n` +
      `  major: ${manifest.major.length} 条\n` +
      `  minor: ${manifest.minor.length} 条\n` +
      `  modal: ${manifest.modal.length} 条\n` +
      `  合计 ${parsed} 条`
  )
}

main()
