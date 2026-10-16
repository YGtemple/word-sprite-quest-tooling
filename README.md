# 单词精灵闯关 · 协作文档与校验工具

配套 [word-sprite-quest](https://github.com/YGtemple/word-sprite-quest) 的协作文档与自动化校验脚本。

主仓库放的是**工程代码**，这里放的是让那套代码能被多 AI 协作维护的**基础设施**：契约检查器、配置校验、词库校验、渲染槽锁、制作规格。

## 一、为什么需要这些脚本

主仓库的项目由 5 个 AI 工具分工开发（WorkBuddy 定契约 → Codex 写实现 → Trae 生成配置 → Banana 出图 → 微信工具构建）。契约 `CONTRACT.md` 有十条红线，但**红线如果只写在文档里，等于没有**。

这些脚本就是把红线变成可执行检查。主仓库 README 里那句验证结果：

```
TypeScript 严格类型检查通过
4 个单测通过
Trae 玩法检查 0 P0 / 0 P1
240 关配置通过
```

后两条就是 `check_gameplay.js` 和 `validate_levels.js` 跑出来的。契约里「违反即 P0 退回」的退回动作，实际由这两个脚本执行。

## 二、校验脚本

| 脚本 | 检查对象 | 产出 |
|---|---|---|
| `validate_levels.js` | `levels_240.json` 关卡配置 | P0 错误 / P1 警告 / 通过 |
| `check_gameplay.js` | `scripts/gameplay/*.ts` 玩法子类 | P0 违规 / P1 警告 |
| `validate_words.js` | `words_ch1..8.json` 词库 | schema 合规性 |
| `convert_wordbank.js` | 原始词表 → 8 章词库 | `words_chN.json` |
| `generate_levels.js` | 空配置 → 240 关 | `levels_240.json` |
| `generate_wordbank.js` | 词表 → 词库（22.8 KB 最大脚本） | `words_chN.json` |

### `validate_levels.js` — 关卡配置校验（193 行）

这是最重的一个。它把 CONTRACT 的量化曲线全部硬编码成断言：

```js
function expectOption(g) { return g<=30 ? 3 : g<=120 ? 4 : g<=210 ? 5 : 6; }
function expectTime(g)   { return g<=30 ? 25: g<=120 ? 20: g<=210 ? 15: 12; }
function expectFreq(g)   { return g<=120? 'high': g<=180? 'mid': 'low'; }
```

`g` 是全局序号（1-240）。也就是说**选项数、限时、词频带三条曲线必须严格按这条分段函数走**，AI 生成配置时只要有一关偏离，脚本立刻报 `[chapter-index] optionCount 期望4`。

检查项覆盖：

- 总关数必须 240，每章必须 30 关
- 全局序号连续（`(chapter-1)*30 + index === globalIndex`）
- 第 15 关必须小 Boss（`comboReq>=3`，`winTarget=15`，`timeLimit=15`）
- 第 30 关必须大 Boss（`comboReq>=5`，`winTarget=20`，`timeLimit=10`）
- 非 Boss 位置 `isBoss` 必须为 false
- Boss 关 `mixedTypes.length >= 2`（R8）
- **高阶去卡通图**：`examLevel>=cet4` 的章节出现 `Picture` 玩法直接报错

最后一条特别值得说。它校验的是 CONTRACT §8 那条「让备考用户不被幼稚视觉干扰」的产品要求——`CHAPTER_EXAM_LEVEL` 映射章节到考试等级，`canUsePicture()` 判定，AI 想在考研章节塞个看图猜词会被脚本拦下。

### `check_gameplay.js` — 玩法子类重构检查（178 行）

用**正则静态分析**而非运行时检查，因为多 AI 协同时要能在提交前就跑。十项检查：

```js
// R7 双平台隔离：直接调 wx.* / tt.* 即 P0
const wxMatches = content.match(/\bwx\./g);
if (wxMatches) violations.push(`${baseName}.ts: 直接调用 wx.* ${wxMatches.length}次 (R7)`);

// 代码质量红线：禁止 cc.* 旧写法
if (/\bcc\./.test(content)) violations.push(`${baseName}.ts: 使用 cc.* 旧写法`);

// R9：直接调存储 API 且未引 PlatformAdapter 即 P0
if (/setStorageSync|setStorage\b/.test(content) && !/PlatformAdapter/.test(content))
  violations.push(`${baseName}.ts: 直接调用存储 API，须经 PlatformAdapter (R9)`);
```

十项里四项是 P0（文件名不在注册表、未继承 BaseLevel、调平台 API、用 cc.* 旧写法），六项是 P1 警告（含 console、未调 grantResources、未引用 mode 等）。

`console` 只给警告不给错误——调试时难免要打日志，完全禁掉不现实。

## 三、渲染槽锁

三个脚本解决一个具体问题：**44 集视频同时渲染会把机器跑死**。

`acquire.ps1` 抢槽，`release.ps1` 释放，全机最多 2 个槽（`slot1` / `slot2`）。槽用文件存在性实现，文件内容记 `PID;标签;ISO时间`。

关键在**死槽检测**：

```powershell
$owner = [int]($line -split ';')[0]
if (-not (Get-Process -Id $owner -ErrorAction SilentlyContinue)) {
    Remove-Item $p -Force; return $s    # 持有者进程已死，抢占
}
```

进程崩了没来得及释放锁，槽会永久卡住。所以每次尝试获取时先查槽内记录的 PID 是否还活着，死了就清掉重抢。

`render_episode.ps1` 是完整的单集流水线：抢槽 → `npx hyperframes render` 渲染无音频视频 → `ffprobe` 取旁白时长 → 混音 → 封装 → 校验 → 清临时文件。整个用 `Tee-Object` 把渲染日志同时写进 `render.log`，失败时能回查。

## 四、制作规格（`SPEC_长片系列.md`）

44 集视频的统一基准文档。核心是那节**「口径覆盖（重要，优先级高于现成脚本里的旧注释）」**：

> 部分现成旁白脚本（EP25/EP26/自动扶梯/油枪/漏电等）顶部写有"全程禁变速""禁止 repeat:-1、用有限循环 8–12 次"。**这些旧注释一律以本 SPEC 为准**。

这是个真实的工程问题：44 集不是一次做完的，早期几集的脚本注释写的是旧口径，后期改了规范但没回头改那些文件。SPEC 用「优先级高于旧注释」这句话一次性解决，而不是去改 44 个文件。

成片硬性规格全部给了可核对的数值：

| 项 | 值 |
|---|---|
| 画幅 | 1920×1080，30fps，横屏 16:9 |
| 视频 | H.264 Baseline，`-profile:v baseline -level 4.0`，`yuv420p` |
| 音频 | AAC-LC，48kHz，128k，`-movflags +faststart` |
| 时长 | 8.5–9.6 分钟（约 510–575 秒），以最终配音为准 |
| 字幕 | 全片无硬字幕，图形内术语标注允许 |

还有一条动效铁律写得很有意思：

> 旁白每句都配画面变化；全程 Ken Burns 推拉 + 循环动效 + SVG 描边/位移/计数，**禁止任何静止冷场**（句内用周期 0.4–1.6s 循环微动效填满）。

这是给 AI 生成画面用的约束——不是美学要求，是防止模型输出一段旁白时画面静止不动。

工程脚手架那节规定了「copy 模板，不要从零写」：把 `EP23_楼梯Blondel` 整个复制到新目录（带 `node_modules`、`vendor`、`fonts`），只清内容产物留骨架，且**版本锁定** `hyperframes 0.8.114`、`gsap 3.12.5` 精确版本无 `^/~`。

## 五、文件结构

```
├── README.md
├── LICENSE
├── validate_levels.js       # 关卡配置校验（193 行，量化曲线硬编码断言）
├── check_gameplay.js        # 玩法子类静态检查（178 行，十项规则）
├── validate_words.js        # 词库 schema 校验
├── convert_wordbank.js      # 词表 → 8 章词库
├── generate_levels.js       # 240 关配置生成
├── generate_wordbank.js     # 词库生成（22.8 KB）
├── schema_v1_2.js           # CONTRACT v1.2 schema 常量（校验器的数据源）
├── schema_v1_2.ts           # 同上的 TS 版
├── SPEC_长片系列.md          # 44 集视频统一制作规格
├── levels_sample.json       # 关卡配置样例
└── words_sample.json        # 词库样例
```

## 六、用法

```bash
# 关卡配置校验（P0 错误会 exit 1）
node validate_levels.js config/levels_240.json

# 玩法子类检查（P0 违规会 exit 1）
node check_gameplay.js assets/scripts/gameplay

# 词库校验
node validate_words.js config/words_ch1.json
```

两个校验脚本的退出码设计成 0/1，可以直接串进 CI 或 pre-commit hook。契约里「违反即 P0 退回」的退回动作就是靠这个 exit code。

```powershell
# 渲染单集（含抢槽/死槽检测）
. .\render_episode.ps1 -Proj "D:\...\EP25_自行车辐条" -Out "out.mp4" -Crf 22
```

## 许可证

MIT License
