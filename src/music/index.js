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
  CIRCLE_DIFFICULTIES,
  DEFAULT_TIME_LIMIT,
  getScaleKeyByLevel,
  getChordRootsByLevel,
  getCircleNotesByLevel,
} from './difficulty.js'

export {
  CIRCLE_NOTES_FLAT,
  CIRCLE_OF_FIFTHS,
  PERFECT_FIFTH_UP,
  PERFECT_FIFTH_DOWN,
  getFifthNeighbors,
  stepAlongCircle,
  toFlatName,
} from './circle.js'

export {
  GUITAR_STRINGS,
  MAX_FRET,
  GROUP_SIZE,
  ANY_KEY,
  getFretPitch,
  spellFlatNote,
  getFretNote,
  getCandidateFrets,
  generateNoteGroup,
  toSpokenName,
} from './fretboard.js'

export {
  PROGRESSION_KEYS,
  MODE_NAMES,
  PROGRESSION_DIFFICULTIES,
  parseProgressionFilename,
  normalizeStyleDir,
  hashProgression,
  getBpmForStyle,
  progressionQuestionId,
  buildProgressionPrompt,
  isPureTriadToken,
  hasExtendedToken,
  getProgressionPoolByLevel,
} from './progression.js'
