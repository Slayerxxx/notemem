/**
 * stores/index.js
 * Pinia store 统一导出。
 * Pinia 实例在 main.js 中通过 app.use(createPinia()) 注册，
 * 组件内直接 `import { useGameStore } from '@/stores'` 使用即可。
 */
export { useGameStore } from './game.js'
export { useWrongBookStore } from './wrongbook.js'
export { useStatsStore } from './stats.js'
export { useSettingsStore } from './settings.js'
