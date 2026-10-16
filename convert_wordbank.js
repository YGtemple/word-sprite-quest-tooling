/**
 * convert_wordbank.js v1.2 — 词库转换脚本（CONTRACT v1.2）
 *
 * 把任意来源的词表（JSON / CSV）转成符合 14 键 schema 的 words_chN.json。
 *
 * v1.2 变更：新增 examLevel 字段，按章节自动分配。
 *
 * 缺失字段补全规则：
 *   - synonyms/antonyms/grammar_tags → 空数组 []
 *   - image_tag → 'img_' + sanitize(word)
 *   - examLevel → 优先用原值，非法则按章节映射
 *               （ch1-3=middle, ch4-5=high, ch6-7=cet4, ch8=cet6）
 *   - phonetic/meaning/pos/category/example/example_trans → 空字符串 ''
 *   - frequency_rank → 保留原值，无则按章节默认
 *
 * 用法：node convert_wordbank.js <输入文件> <章节号1-8> [输出路径]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./schema_v1_2.js');

function convertRecord(raw, chapter, idOffset) {
  const word = (raw.word || raw.WORD || '').toString().trim();
  if (!word) return null;

  const synonyms = parseList(raw.synonyms);
  const antonyms = parseList(raw.antonyms);
  const grammarTags = parseList(raw.grammar_tags || raw.grammartags);

  let freqRank = parseInt(raw.frequency_rank || raw.frequencyrank, 10);
  if (isNaN(freqRank)) freqRank = (chapter - 1) * 500 + idOffset + 1;

  // v1.2 examLevel：优先用原值，非法才按章节兜底
  let examLevel = raw.examLevel || raw.examlevel || '';
  if (!S.ExamLevel[examLevel]) examLevel = S.CHAPTER_EXAM_LEVEL[chapter];

  return {
    id: idOffset + 1,
    word,
    phonetic: (raw.phonetic || '').toString().trim(),
    meaning: (raw.meaning || raw.MEANING || '').toString().trim(),
    pos: (raw.pos || raw.POS || 'n.').toString().trim(),
    category: (raw.category || raw.CATEGORY || 'general').toString().trim(),
    synonyms,
    antonyms,
    example: (raw.example || '').toString().trim(),
    example_trans: (raw.example_trans || raw.exampletrans || '').toString().trim(),
    image_tag: S.makeImageTag(word),   // R5：统一 sanitize
    grammar_tags: grammarTags,
    frequency_rank: freqRank,
    examLevel,
  };
}

function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.toString().split(/[;；|]/).map(s => s.trim()).filter(Boolean);
}

/**
 * 手写 CSV 行解析。不用 split(',') 因为词表的
 * meaning / example 字段里大量出现半角逗号。
 */
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }   // 转义双引号
    else if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, j) => { obj[h] = (cols[j] || '').trim(); });
    records.push(obj);
  }
  return records;
}

function main() {
  const inputFile = process.argv[2];
  const chapter = parseInt(process.argv[3], 10);
  const outputDir = process.argv[4] || path.join(__dirname);

  if (!inputFile || !chapter) {
    console.error('用法: node convert_wordbank.js <输入文件> <章节号1-8> [输出路径]');
    process.exit(1);
  }
  if (chapter < 1 || chapter > 8) {
    console.error(`章节号 ${chapter} 越界`);
    process.exit(1);
  }
  if (!fs.existsSync(inputFile)) {
    console.error(`文件不存在: ${inputFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  const records = inputFile.endsWith('.json') ? JSON.parse(raw) : parseCSV(raw);
  if (!Array.isArray(records) || records.length === 0) {
    console.error('输入文件无有效记录');
    process.exit(1);
  }

  const wordData = records.map((r, i) => convertRecord(r, chapter, i)).filter(Boolean);

  // 转换后自检：14 键完整性 + image_tag + examLevel
  const REQUIRED = S.WordDataFields;
  const issues = [];
  wordData.forEach((w, i) => {
    for (const f of REQUIRED) {
      if (w[f] === undefined || w[f] === null) issues.push(`第${i+1}条缺字段: ${f}`);
    }
    if (w.image_tag !== S.makeImageTag(w.word)) issues.push(`第${i+1}条 image_tag 不匹配`);
    if (!S.ExamLevel[w.examLevel]) issues.push(`第${i+1}条 examLevel 非法: ${w.examLevel}`);
  });

  const outFile = path.join(outputDir, `words_ch${chapter}.json`);
  fs.writeFileSync(outFile, JSON.stringify(wordData, null, 2), 'utf8');

  console.log(`[OK] words_ch${chapter}.json (v1.2) 已生成: ${outFile}`);
  console.log(`     单词数: ${wordData.length}`);
  console.log(`     examLevel: ${S.CHAPTER_EXAM_LEVEL[chapter]}`);
  console.log(`     字段: ${REQUIRED.length} 个 (14键)`);
  console.log(`     image_tag 已 sanitize`);

  if (issues.length > 0) {
    console.log(`\n  ⚠ 问题 (${issues.length}):`);
    issues.slice(0, 10).forEach(s => console.log(`    ${s}`));
  } else {
    console.log(`     字段完整性: ✓ 全部通过`);
  }
}

main();
