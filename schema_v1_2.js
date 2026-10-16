/**
 * schema_v1_2.js — CONTRACT v1.2 常量定义
 *
 * validate_levels.js / check_gameplay.js / validate_words.js / convert_wordbank.js
 * 四个脚本共用这一份 schema 常量。改契约先改这里，校验器才有唯一事实来源。
 */
'use strict';

// ---------- §3 WordData 14 键 ----------
const WordDataFields = [
  'id', 'word', 'phonetic', 'meaning', 'pos', 'category',
  'synonyms', 'antonyms', 'example', 'example_trans',
  'image_tag', 'grammar_tags', 'frequency_rank', 'examLevel',
];

// ---------- §3 examLevel 5 档 ----------
const ExamLevel = {
  middle: 'middle',       // 中考
  high: 'high',           // 高考
  cet4: 'cet4',           // 四级
  cet6: 'cet6',           // 六级
  postgrad: 'postgrad',   // 考研
};

// 章节 → examLevel 映射（§3 词库分层）
const CHAPTER_EXAM_LEVEL = {
  1: 'middle', 2: 'middle', 3: 'middle',
  4: 'high',   5: 'high',
  6: 'cet4',   7: 'cet4',
  8: 'cet6',
};

// ---------- §4 LevelType（17 个取值 ↔ 18 种玩法注册表）----------
const LevelType = {
  Match: 'Match', Listen: 'Listen', Sort: 'Sort', Memory: 'Memory',
  Spell: 'Spell', Puzzle: 'Puzzle', Dictation: 'Dictation', Eliminate: 'Eliminate',
  Antonym: 'Antonym', Synonym: 'Synonym', FillBlank: 'FillBlank', Picture: 'Picture',
  Grammar: 'Grammar', Translate: 'Translate', Order: 'Order',
  Ball: 'Ball', Runner: 'Runner', Idle: 'Idle',
};

// ---------- §4.1 GameMode 5 档 ----------
const GameMode = {
  casual: 'casual',       // 轻松摸鱼
  campaign: 'campaign',   // 冒险闯关
  bootcamp: 'bootcamp',   // 专注集训
  pvp: 'pvp',             // 实时PK（Phase3）
  arcade: 'arcade',       // 街机纯玩
};

// ---------- §11.2 PropType ----------
const PropType = {
  hint: 'hint', shuffle: 'shuffle', freeze: 'freeze',
  hammer: 'hammer', revive: 'revive',
};

// ---------- 各章解锁的玩法（用于校验 gameplayType 是否越章）----------
const CHAPTER_GAMEPLAYS = {
  1: ['Match', 'Listen', 'Sort', 'Memory'],
  2: ['Spell', 'Puzzle', 'Dictation'],
  3: ['Eliminate', 'Antonym', 'Synonym'],
  4: ['FillBlank', 'Picture', 'Grammar'],
  5: ['Translate', 'Order'],
  6: ['Match', 'Spell', 'Antonym'],
  7: ['FillBlank', 'Grammar', 'Translate'],
  8: ['Order', 'Picture', 'Idle'],
};

// ---------- §8 高阶去卡通图 ----------
/**
 * examLevel >= cet4 的关卡禁用 Picture 玩法，改用例句 + 词根解析卡片。
 * 这是 §8 的产品要求（让备考用户不被幼稚视觉干扰），不是纯技术约束。
 */
function canUsePicture(examLevel) {
  if (!examLevel) return true;
  return examLevel === 'middle' || examLevel === 'high';
}

// ---------- R5 image_tag sanitize ----------
/**
 * 统一小写 + 下划线。生图与词库转换前必须 sanitize，
 * 否则空格/大写/符号会直接导致裂图（CONTRACT §7 R5）。
 */
function makeImageTag(word) {
  return String(word || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------- 通关目标（Boss 关硬编码）----------
const WIN_TARGET_MAP = {
  normal: 10,
  smallBoss: 15,
  bigBoss: 20,
};

module.exports = {
  WordDataFields,
  ExamLevel,
  CHAPTER_EXAM_LEVEL,
  LevelType,
  GameMode,
  PropType,
  CHAPTER_GAMEPLAYS,
  canUsePicture,
  makeImageTag,
  WIN_TARGET_MAP,
};
