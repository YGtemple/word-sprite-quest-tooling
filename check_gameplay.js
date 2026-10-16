/**
 * check_gameplay.js v1.2 — 玩法子类重构检查脚本（CONTRACT v1.2）
 *
 * v1.2 新增检查：
 *  - R8 模式族：每子类须支持 campaign 与 bootcamp 形态（检查 mode 分支或配置读取）
 *  - R9 模式联动：结算须调用 grantResources()，不得私自另存资源/生词
 *  - grantResources 调用检查（v1.2 奖励钩子）
 *  - withinLevelEscalation / onEscalationStep 检查
 *
 * 用法：node check_gameplay.js [gameplay 目录路径]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const inputDir = process.argv[2]
  || path.join(__dirname, '..', 'assets', 'scripts', 'gameplay');

// CONTRACT §7 玩法注册表
const VALID_LEVELS = new Set([
  'MatchLevel','ListenLevel','SortLevel','MemoryLevel','SpellLevel','PuzzleLevel',
  'DictationLevel','EliminateLevel','AntonymLevel','SynonymLevel','FillBlankLevel',
  'PictureLevel','GrammarLevel','TranslateLevel','OrderLevel',
]);

// 基类已提供、子类不应重复实现的方法
const BASE_METHODS = new Set([
  'startTimer','stopTimer','updateCombo','checkComboMilestone',
  'playEffect','updateHUD','nextQuestion','checkLevelComplete','showResultPanel',
  'addScore','computeStars','onEscalationStep','grantResources',
]);

// CONTRACT §4.3 子类必须实现的三个钩子
const REQUIRED_METHODS = new Set(['onQuestionStart','onAnswer','onResult']);

let violations = [];
let warnings = [];
let checked = 0;

function main() {
  if (!fs.existsSync(inputDir)) {
    console.log(`[INFO] 目录不存在: ${inputDir}，跳过检查`);
    process.exit(0);
  }

  const files = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.ts') && f !== 'BaseLevel.ts');

  if (files.length === 0) {
    console.log('[INFO] 未找到玩法子类文件，跳过检查');
    process.exit(0);
  }

  console.log('═══════════════════════════════════════');
  console.log('  玩法子类重构检查 (CONTRACT v1.2)');
  console.log('═══════════════════════════════════════');
  console.log(`  扫描目录: ${inputDir}`);
  console.log(`  发现文件: ${files.length}\n`);

  for (const file of files) {
    const baseName = file.replace(/\.ts$/, '');
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    checked++;

    console.log(`\n  [${baseName}.ts]`);

    // 1. 命名规范（R5）
    if (!VALID_LEVELS.has(baseName)) {
      violations.push(`${baseName}.ts: 文件名不在注册表`);
      console.log(`    ✗ 文件名不在注册表`);
    } else {
      console.log(`    ✓ 命名符合注册表`);
    }

    // 2. 继承 BaseLevel
    if (!/extends\s+BaseLevel/.test(content)) {
      violations.push(`${baseName}.ts: 未 extends BaseLevel`);
      console.log(`    ✗ 未继承 BaseLevel`);
    } else {
      console.log(`    ✓ 继承 BaseLevel`);
    }

    // 3. 三个抽象方法必须实现
    const implMethods = new Set();
    for (const m of REQUIRED_METHODS) {
      const re = new RegExp(`(?:protected|public|private)?\\s*${m}\\s*\\(`);
      if (re.test(content)) implMethods.add(m);
    }
    for (const m of REQUIRED_METHODS) {
      if (!implMethods.has(m)) {
        violations.push(`${baseName}.ts: 缺少 ${m}`);
        console.log(`    ✗ 缺少 ${m}`);
      }
    }
    if (implMethods.size === REQUIRED_METHODS.size) console.log(`    ✓ 三方法完整`);

    // 4. wx.* / tt.* 红线 R7
    const wxMatches = content.match(/\bwx\./g);
    const ttMatches = content.match(/\btt\./g);
    if (wxMatches) {
      violations.push(`${baseName}.ts: 直接调用 wx.* ${wxMatches.length}次 (R7)`);
      console.log(`    ✗ 直接调用 wx.* (${wxMatches.length}次) — R7`);
    }
    if (ttMatches) {
      violations.push(`${baseName}.ts: 直接调用 tt.* ${ttMatches.length}次 (R7)`);
      console.log(`    ✗ 直接调用 tt.* (${ttMatches.length}次) — R7`);
    }
    if (!wxMatches && !ttMatches) console.log(`    ✓ 无直接平台 API`);

    // 5. cc.* 旧写法
    if (/\bcc\./.test(content)) {
      violations.push(`${baseName}.ts: 使用 cc.* 旧写法`);
      console.log(`    ✗ 使用 cc.* 旧写法`);
    } else {
      console.log(`    ✓ 无 cc.* 旧写法`);
    }

    // 6. console（只警告——调试难免要打日志，完全禁掉不现实）
    if (/\bconsole\./.test(content)) {
      warnings.push(`${baseName}.ts: 含 console 调用`);
      console.log(`    ⚠ 含 console 调用`);
    }

    // 7. R9：grantResources 调用
    if (!/grantResources/.test(content)) {
      warnings.push(`${baseName}.ts: 未调用 grantResources() (R9 模式联动建议)`);
      console.log(`    ⚠ 未调用 grantResources() — R9`);
    } else {
      console.log(`    ✓ 调用 grantResources()`);
    }

    // 8. R8：mode 分支
    if (/mode/.test(content) || /levelData\.mode/.test(content)) {
      console.log(`    ✓ 引用 mode 字段 (R8)`);
    } else {
      warnings.push(`${baseName}.ts: 未引用 levelData.mode (R8 模式族建议)`);
      console.log(`    ⚠ 未引用 mode — R8`);
    }

    // 9. R9：禁止私自另存
    if (/setStorageSync|setStorage\b/.test(content) && !/PlatformAdapter/.test(content)) {
      violations.push(`${baseName}.ts: 直接调用存储 API，须经 PlatformAdapter (R9)`);
      console.log(`    ✗ 直接存储 API — R9`);
    }

    // 10. 计时器清理
    if (!/onDestroy|stopTimer/.test(content)) {
      warnings.push(`${baseName}.ts: 未显式 stopTimer/onDestroy`);
    }
  }

  // 汇总
  console.log('\n═══════════════════════════════════════');
  console.log('  检查汇总');
  console.log('═══════════════════════════════════════');
  console.log(`  已检查: ${checked} 个文件`);
  console.log(`  违规(P0): ${violations.length}`);
  console.log(`  警告(P1): ${warnings.length}`);

  if (violations.length > 0) {
    console.log('\n  ✗ P0 违规:');
    violations.forEach(v => console.log(`    - ${v}`));
  }
  if (warnings.length > 0) {
    console.log('\n  ⚠ P1 警告:');
    warnings.forEach(w => console.log(`    - ${w}`));
  }

  if (violations.length > 0) {
    console.log('\n  结果: ✗ 退回 (P0)');
    process.exit(1);
  } else {
    console.log('\n  结果: ✓ 通过');
    process.exit(0);
  }
}

main();
