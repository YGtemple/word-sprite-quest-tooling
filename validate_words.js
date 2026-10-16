/**
 * validate_words.js — WordData 词库校验脚本（CONTRACT v1.2）
 *
 * 校验 words_chN.json 是否符合 14 键 schema：
 *  1. 必须含 14 个字段（id + 13 业务字段，含 examLevel）
 *  2. image_tag 已 sanitize（= makeImageTag(word)）
 *  3. examLevel 合法（middle/high/cet4/cet6/postgrad）
 *  4. id 唯一
 *  5. word 非空
 *  6. synonyms/antonyms/grammar_tags 为数组
 *  7. frequency_rank 为正数
 *  8. examLevel 与章节匹配（ch1-3=middle, ch4-5=high, ch6-7=cet4, ch8=cet6）
 *
 * 用法：node validate_words.js [words_chN.json 路径或目录]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./schema_v1_2.js');

const REQUIRED = S.WordDataFields;
const VALID_EXAM = new Set(Object.values(S.ExamLevel));

let totalErrors = [];
let totalWords = 0;
let filesChecked = 0;

function validateFile(filePath) {
  const fileName = path.basename(filePath);

  // 从文件名提取章节号，用于校验 examLevel 是否匹配
  const chMatch = fileName.match(/words_ch(\d)/);
  const expectedExam = chMatch ? S.CHAPTER_EXAM_LEVEL[parseInt(chMatch[1])] : null;

  const raw = fs.readFileSync(filePath, 'utf8');
  let words;
  try {
    words = JSON.parse(raw);
  } catch (e) {
    totalErrors.push(`${fileName}: JSON 解析失败`);
    return;
  }

  if (!Array.isArray(words)) {
    totalErrors.push(`${fileName}: 不是数组`);
    return;
  }

  filesChecked++;
  totalWords += words.length;
  let fileErrors = [];
  const seenIds = new Set();

  words.forEach((w, i) => {
    const prefix = `${fileName}[${i+1}]`;

    // 字段完整性（14 键）
    for (const f of REQUIRED) {
      if (w[f] === undefined || w[f] === null) fileErrors.push(`${prefix} 缺字段: ${f}`);
    }

    // id 唯一
    if (seenIds.has(w.id)) fileErrors.push(`${prefix} id 重复: ${w.id}`);
    seenIds.add(w.id);

    // word 非空
    if (!w.word || !w.word.toString().trim()) fileErrors.push(`${prefix} word 为空`);

    // R5 image_tag sanitize：必须等于 makeImageTag(word)
    if (w.word && w.image_tag !== S.makeImageTag(w.word)) {
      fileErrors.push(`${prefix} image_tag 应为 ${S.makeImageTag(w.word)}，实际 ${w.image_tag}`);
    }

    // examLevel 合法
    if (!VALID_EXAM.has(w.examLevel)) fileErrors.push(`${prefix} examLevel 非法: ${w.examLevel}`);

    // examLevel 与章节匹配
    if (expectedExam && w.examLevel !== expectedExam) {
      fileErrors.push(`${prefix} examLevel 应为 ${expectedExam}（章节${chMatch[1]}），实际 ${w.examLevel}`);
    }

    // 数组字段
    for (const f of ['synonyms', 'antonyms', 'grammar_tags']) {
      if (w[f] !== undefined && !Array.isArray(w[f])) fileErrors.push(`${prefix} ${f} 非数组`);
    }

    // frequency_rank 正数
    if (w.frequency_rank !== undefined && (typeof w.frequency_rank !== 'number' || w.frequency_rank <= 0)) {
      fileErrors.push(`${prefix} frequency_rank 须为正数`);
    }
  });

  if (fileErrors.length > 0) totalErrors.push(...fileErrors);
  console.log(`  ${fileName}: ${words.length} 词 — ${fileErrors.length === 0 ? '✓' : '✗ ' + fileErrors.length + ' 错误'}`);
}

function main() {
  const input = process.argv[2] || path.join(__dirname);
  let files = [];

  if (fs.statSync(input).isDirectory()) {
    files = fs.readdirSync(input)
      .filter(f => f.match(/^words_ch\d+\.json$/))
      .map(f => path.join(input, f));
  } else {
    files = [input];
  }

  if (files.length === 0) {
    console.log('[INFO] 未找到 words_chN.json 文件');
    process.exit(0);
  }

  console.log('═══════════════════════════════════════');
  console.log('  WordData 词库校验报告 (CONTRACT v1.2)');
  console.log('═══════════════════════════════════════');
  console.log(`  扫描: ${files.length} 个文件\n`);

  for (const f of files) validateFile(f);

  console.log(`\n  总词数: ${totalWords}`);
  console.log(`  文件数: ${filesChecked}`);
  console.log(`  错误: ${totalErrors.length}`);

  if (totalErrors.length > 0) {
    console.log('\n  ✗ 错误列表:');
    totalErrors.slice(0, 20).forEach(e => console.log(`    ${e}`));
    if (totalErrors.length > 20) console.log(`    ... 还有 ${totalErrors.length - 20} 条`);
    console.log('\n  结果: ✗ 退回 (P0)');
    process.exit(1);
  } else {
    console.log('\n  结果: ✓ 通过 (合入)');
    process.exit(0);
  }
}

main();
