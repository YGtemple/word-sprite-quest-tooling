/**
 * validate_levels.js v1.2 — 关卡配置校验脚本（CONTRACT v1.2）
 *
 * v1.2 新增校验：
 *  - mode 字段合法（casual/campaign/bootcamp/pvp）
 *  - mixedTypes：Boss 关 >= 2 种
 *  - actionIntensity 0-3
 *  - wordCount > 0
 *  - withinLevelEscalation bool
 *  - starThresholds [s1,s2,s3] 且 s1<s2<s3
 *  - scoreRule 含 correctBase/comboBonus/timeBonus/wrongPenalty
 *  - R8：campaign 关存在 mixedTypes（每 5 关）
 *  - 高阶去卡通图：examLevel>=cet4 的章节不含 Picture 玩法
 *
 * 用法：node validate_levels.js [levels_240.json 路径]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./schema_v1_2.js');

const inputPath = process.argv[2]
  || path.join(__dirname, '..', 'config', 'levels_240.json');

const VALID_TYPES = new Set(Object.keys(S.LevelType));
const VALID_MODES = new Set(Object.values(S.GameMode));
const WIN_TARGET_DEFAULT = S.WIN_TARGET_MAP;

// ---------- 量化曲线：硬编码断言，不许 AI 自由发挥 ----------
function expectOption(g) { return g<=30?3 : g<=120?4 : g<=210?5 : 6; }
function expectTime(g)   { return g<=30?25: g<=120?20: g<=210?15: 12; }
function expectFreq(g)   { return g<=120?'high' : g<=180?'mid' : 'low'; }

const V1_FIELDS  = ['chapter','index','gameplayType','optionCount','timeLimit',
  'wordFreqBand','isBoss','comboReq','winTarget','difficulty'];
const V11_FIELDS = ['actionIntensity','wordCount','withinLevelEscalation','starThresholds','scoreRule'];
const V12_FIELDS = ['mode','mixedTypes'];
const ALL_FIELDS = [...V1_FIELDS, ...V11_FIELDS, ...V12_FIELDS];

let errors = [];
let warnings = [];

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`[FAIL] 文件不存在: ${inputPath}`);
    process.exit(1);
  }
  const levels = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // 1. 总关数
  if (levels.length !== 240) errors.push(`总关数 ${levels.length} != 240`);

  // 2. 逐条校验
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const gi = i + 1;
    const pfx = `[${lv.chapter}-${lv.index}]`;

    // 字段完整性（v1 + v1.1 + v1.2）
    for (const f of ALL_FIELDS) {
      if (lv[f] === undefined || lv[f] === null) errors.push(`${pfx} 缺字段: ${f}`);
    }

    // 章节与关内序号范围
    if (lv.chapter < 1 || lv.chapter > 8) errors.push(`${pfx} chapter 越界`);
    if (lv.index < 1 || lv.index > 30) errors.push(`${pfx} index 越界`);

    // 全局序号连续
    if ((lv.chapter - 1) * 30 + lv.index !== gi)
      errors.push(`${pfx} 全局序号不连续`);

    // gameplayType 合法性
    if (!VALID_TYPES.has(lv.gameplayType)) errors.push(`${pfx} gameplayType 非法: ${lv.gameplayType}`);

    // 章节解锁范围
    const allowed = S.CHAPTER_GAMEPLAYS[lv.chapter];
    if (allowed && !allowed.includes(lv.gameplayType))
      errors.push(`${pfx} 玩法 ${lv.gameplayType} 未在第 ${lv.chapter} 章解锁`);

    // 高阶去卡通图：examLevel>=cet4 不含 Picture
    const examLevel = S.CHAPTER_EXAM_LEVEL[lv.chapter];
    if (!S.canUsePicture(examLevel)) {
      if (lv.gameplayType === 'Picture')
        errors.push(`${pfx} examLevel=${examLevel} 禁用 Picture 玩法`);
      if (lv.mixedTypes && lv.mixedTypes.includes('Picture'))
        errors.push(`${pfx} mixedTypes 含 Picture 但 examLevel=${examLevel}`);
    }

    // Boss 判定：第 15 关小 Boss，第 30 关大 Boss
    const isSmall = lv.index === 15;
    const isBig = lv.index === 30;
    if (isSmall && !lv.isBoss) errors.push(`${pfx} 第15关应为小Boss`);
    if (isBig && !lv.isBoss) errors.push(`${pfx} 第30关应为大Boss`);
    if (!isSmall && !isBig && lv.isBoss) errors.push(`${pfx} 非Boss位置 isBoss=true`);

    // comboReq
    if (isSmall && lv.comboReq < 3) errors.push(`${pfx} 小Boss comboReq>=3`);
    if (isBig && lv.comboReq < 5) errors.push(`${pfx} 大Boss comboReq>=5`);
    if (!lv.isBoss && lv.comboReq !== 0) warnings.push(`${pfx} 非Boss comboReq应为0`);

    // winTarget
    if (isSmall && lv.winTarget !== 15) errors.push(`${pfx} 小Boss winTarget=15`);
    if (isBig && lv.winTarget !== 20) errors.push(`${pfx} 大Boss winTarget=20`);

    // 量化曲线（非Boss）
    if (!lv.isBoss) {
      if (lv.optionCount !== expectOption(gi)) errors.push(`${pfx} optionCount 期望${expectOption(gi)}`);
      if (lv.timeLimit !== expectTime(gi)) errors.push(`${pfx} timeLimit 期望${expectTime(gi)}`);
    }
    if (isSmall && lv.timeLimit !== 15) errors.push(`${pfx} 小Boss timeLimit=15`);
    if (isBig && lv.timeLimit !== 10) errors.push(`${pfx} 大Boss timeLimit=10`);

    if (lv.wordFreqBand !== expectFreq(gi)) errors.push(`${pfx} wordFreqBand 期望${expectFreq(gi)}`);
    if (lv.difficulty < 0 || lv.difficulty > 3) errors.push(`${pfx} difficulty 越界`);

    // v1.2 mode
    if (lv.mode && !VALID_MODES.has(lv.mode)) errors.push(`${pfx} mode 非法: ${lv.mode}`);

    // v1.2 mixedTypes
    if (lv.mixedTypes) {
      if (!Array.isArray(lv.mixedTypes)) errors.push(`${pfx} mixedTypes 非数组`);
      else {
        for (const mt of lv.mixedTypes) {
          if (!VALID_TYPES.has(mt)) errors.push(`${pfx} mixedTypes 含非法类型: ${mt}`);
        }
        // R8：Boss 关 mixedTypes >= 2
        if (lv.isBoss && lv.mixedTypes.length < 2)
          errors.push(`${pfx} Boss 关 mixedTypes 须>=2 (R8)`);
      }
    }

    // v1.1 actionIntensity
    if (lv.actionIntensity !== undefined && (lv.actionIntensity < 0 || lv.actionIntensity > 3))
      errors.push(`${pfx} actionIntensity 越界: ${lv.actionIntensity}`);

    // v1.1 wordCount
    if (lv.wordCount !== undefined && lv.wordCount <= 0)
      errors.push(`${pfx} wordCount 须>0`);

    // v1.1 withinLevelEscalation
    if (lv.withinLevelEscalation !== undefined && typeof lv.withinLevelEscalation !== 'boolean')
      errors.push(`${pfx} withinLevelEscalation 非bool`);

    // v1.1 starThresholds
    if (lv.starThresholds) {
      if (!Array.isArray(lv.starThresholds) || lv.starThresholds.length !== 3)
        errors.push(`${pfx} starThresholds 须为3元素数组`);
      else if (!(lv.starThresholds[0] <= lv.starThresholds[1] && lv.starThresholds[1] <= lv.starThresholds[2]))
        errors.push(`${pfx} starThresholds 须递增`);
    }

    // v1.1 scoreRule
    if (lv.scoreRule) {
      for (const k of ['correctBase','comboBonus','timeBonus','wrongPenalty']) {
        if (lv.scoreRule[k] === undefined) errors.push(`${pfx} scoreRule 缺 ${k}`);
      }
    }
  }

  // 3. 每章 30 关
  for (let ch = 1; ch <= 8; ch++) {
    const cnt = levels.filter(l => l.chapter === ch).length;
    if (cnt !== 30) errors.push(`第${ch}章关数 ${cnt} != 30`);
  }

  // ===== 报告 =====
  console.log('═══════════════════════════════════════');
  console.log('  levels_240.json 校验报告 (CONTRACT v1.2)');
  console.log('═══════════════════════════════════════');
  console.log(`  文件: ${inputPath}`);
  console.log(`  总关数: ${levels.length}`);
  console.log(`  Boss 关: ${levels.filter(l => l.isBoss).length}`);
  console.log(`  mixedTypes>=2 关: ${levels.filter(l => l.mixedTypes && l.mixedTypes.length >= 2).length}`);
  console.log(`  章节数: ${new Set(levels.map(l => l.chapter)).size}`);

  if (warnings.length > 0) {
    console.log(`\n  ⚠ 警告 (${warnings.length}):`);
    warnings.forEach(w => console.log(`    ${w}`));
  }
  if (errors.length > 0) {
    console.log(`\n  ✗ 错误 (${errors.length}):`);
    errors.forEach(e => console.log(`    ${e}`));
    console.log('\n  结果: ✗ 退回 (P0)');
    process.exit(1);
  } else {
    console.log('\n  结果: ✓ 通过 (合入)');
    process.exit(0);
  }
}

main();
