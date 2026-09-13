/**
 * soundfontLoader.js
 * soundfont-player 真实钢琴音色加载器（方案 A：本地化、与项目同源）。
 *
 * - 音色包预渲染 JS 放在 public/soundfonts/acoustic_grand_piano.js，
 *   构建期随 dist 同源部署，无外部 CDN 依赖；
 * - 同一 AudioContext 实例内缓存 instrument Promise（会话内不重复加载）；
 * - 加载失败返回 null（绝不抛错），由视图层决定是否 fallback 到合成音，
 *   且失败结果不缓存——下次调用仍可重试。
 */

import Soundfont from 'soundfont-player'

/** 本地音色包路径（相对站根，Vite 原样 serve public/） */
export const DEFAULT_SOUNDFONT_URL = '/soundfonts/acoustic_grand_piano.js'
export const DEFAULT_INSTRUMENT_NAME = 'acoustic_grand_piano'

/**
 * ctx → Promise<instrument|null> 的会话级缓存（WeakMap 随 ctx 释放）。
 * @type {WeakMap<AudioContext, Promise<object|null>>}
 */
const instrumentCache = new WeakMap()

/**
 * 加载（或复用缓存的）钢琴音色 instrument。
 * @param {AudioContext} ctx
 * @param {object} [opts]
 * @param {string} [opts.url] 本地音色包 URL
 * @param {Function} [opts.loader] 注入的加载函数（测试用），
 *   签名 (ctx, url, name) => Promise<instrument>
 * @returns {Promise<object|null>} instrument player；失败返回 null
 */
export function loadInstrument(ctx, opts = {}) {
  if (!ctx) return Promise.resolve(null)

  const cached = instrumentCache.get(ctx)
  if (cached) return cached

  const {
    url = DEFAULT_SOUNDFONT_URL,
    name = DEFAULT_INSTRUMENT_NAME,
    loader = defaultLoader,
  } = opts

  const promise = Promise.resolve()
    .then(() => loader(ctx, url, name))
    .then((instrument) => (instrument ? instrument : null))
    .catch((err) => {
      // 失败不缓存：允许后续重新进入训练页时重试
      console.warn('[soundfont] 音色加载失败，将使用合成音色：', err)
      instrumentCache.delete(ctx)
      return null
    })

  instrumentCache.set(ctx, promise)
  return promise
}

/** 默认加载器：soundfont-player 识别 .js 结尾 URL，直接 fetch 本地音色包 */
function defaultLoader(ctx, url /*, name */) {
  return Soundfont.instrument(ctx, url)
}

/** 仅供测试：清空某 ctx 的缓存 */
export function __clearInstrumentCache(ctx) {
  instrumentCache.delete(ctx)
}
