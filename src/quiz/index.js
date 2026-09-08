/**
 * quiz/index.js
 * 题目生成模块统一导出
 */

export {
  // 音级工具
  ROMAN_NUMERALS,
  degreeToRoman,
  // 题目生成
  generateScaleQuestion,
  generateChordQuestion,
  generateCircleQuestion,
  generateQuestion,
  // 错题加权
  pickWeighted,
  WRONG_BOOST_PROBABILITY,
  // 和弦干扰项策略标记
  CHORD_DISTRACTOR_STRATEGIES,
  DISTRACTOR_ADJACENT,
  DISTRACTOR_MINOR,
  DISTRACTOR_INTERVAL,
} from './generator.js'
