/**
 * music/index.js
 * 乐理核心模块统一导出
 */

export {
  MAJOR_KEYS,
  getMajorScale,
  getNoteByDegree,
  getDegreeOfNote,
  normalizeNoteName,
  NOTE_TO_POSITION,
} from './scales.js'

export {
  CHORD_ROOTS,
  getMajorTriad,
  getMinorTriad,
  spellChordTone,
} from './chords.js'

export {
  SCALE_DIFFICULTIES,
  CHORD_DIFFICULTIES,
  DEFAULT_TIME_LIMIT,
  getScaleKeyByLevel,
  getChordRootsByLevel,
} from './difficulty.js'
