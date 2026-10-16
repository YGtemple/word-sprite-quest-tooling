# 像素档案馆 ·「结构小史」长片系列 统一制作规格（冻结，所有 shard 必须严格遵循）

> 本文件是 EP25–EP34 各 shard 的唯一基准。先读它，再动手。
> 直接模板（工程结构以此为准，逐文件对照）：`EP23_楼梯Blondel/`
> 账号背景（口径/红线）：`../账号背景_AI快速上手指南.md`

---

## 0. 成片硬性规格（每集一致，最终用 ffprobe 逐条核对）

- 画幅 **1920×1080，30fps**；横屏 16:9。
- 视频 **H.264 Baseline / Constrained Baseline，pix_fmt yuv420p**（`-profile:v baseline -level 4.0`）。
- 音频 **AAC-LC，48kHz，128k**；`-movflags +faststart`。
- **全片无任何硬字幕 / 无对白字幕条**（图形内的术语标注，如"踏面 T"这种是图形的一部分，允许；但禁止把旁白整句写成文字）。
- 时长：本系列为**长片，目标 8.5–9.6 分钟（约 510–575 秒）**，以最终配音时长为准；`#composition` 的 `data-duration` 必须等于最终 narration 时长（精确到毫秒）。
- 动效铁律：**旁白每句都配画面变化**；全程 Ken Burns 推拉 + 循环动效 + SVG 描边/位移/计数，**禁止任何静止冷场**（句内用周期 0.4–1.6s 循环微动效填满）。

## 0.1 口径覆盖（重要，优先级高于现成脚本里的旧注释）

- 部分现成旁白脚本（EP25/EP26/自动扶梯/油枪/漏电等）顶部写有"全程禁变速""禁止 repeat:-1、用有限循环 8–12 次"。**这些旧注释一律以本 SPEC 为准**：为与**最新已播出的 EP22、EP23** 对齐，统一采用 **atempo=1.40 提速**、并在**唯一 seek-safe 主时间轴上使用 `repeat:-1`（+yoyo）**。
- 原因：主时间轴由 HyperFrames 逐帧 seek 驱动，其上的 `repeat:-1` 在任意 seek 位置都确定（EP22/EP23 已验证可正常渲染、循环正确）；克隆配音自然语速偏慢，1.40 才是当前系列的纪录片节奏。脚本里逐句【画面】【持续动效】要求继续有效，仅覆盖"变速/循环次数"这两条。

## 1. 工程脚手架（copy 模板，不要从零写）

1. 目标工程目录：`D:\豆包产物\像素档案馆\03_源码工程\EP0X_主题\`（主题见定题表，2–6 字见名知意）。
2. 用 PowerShell `Copy-Item -Recurse` 把 **EP23_楼梯Blondel** 整个复制到新目录（带上 `node_modules`、`vendor`、`fonts`、`tools`、`audio\bgm_src.mp3`，**不要** npm install / 不升级任何依赖）。
3. 删除上一集的内容产物，只留骨架与公共资产：
   - 清空/删除：`audio\raw\*`、`audio\fast\*`、`audio\norm\*`、`audio\narration.wav`、`audio\full.wav`、`audio\timing.*`、`audio\concat_list.txt`、`renders\*`、`tools\stills\*`。
   - 保留：`audio\bgm_src.mp3`、`audio\ref_voice.wav`、`vendor\`、`fonts\`、`node_modules\`、`tools\`（脚本可复用）。
4. 重写：`src\content.js`、`src\graphics_seed.js`、`src\batch_g1.js`、`src\batch_g2.js`、`src\batch_g3.js`（**不要改 `src\app.js`、`index.html` 的结构**；只把 index.html 第 5 行 `<title>` 与第 69 行 `data-duration` 改成本集）。
5. 版本锁定：package.json 必须保持 `hyperframes 0.8.114`、`gsap 3.12.5`（精确版本，无 `^`/`~`）。

## 2. 考据与旁白（事实有来源，数字不臆断）

- 已有旁白脚本的集（见定题表"脚本"列），**直接采用该脚本的分章与逐句文案**，仍需快速复核关键数字/年份并保留来源 URL；发现硬伤要先报告，不擅自改写事实口径。
- 需要新写旁白的集：先列 3–5 条权威来源（教材/标准/厂商技术页/论文），再动笔。每个关键数字都要能指回来源。
- 旁白节奏：每句 6–14 秒为宜；单章 3–6 句；句与句之间留 0.3–0.6s 气口。长句拆短，避免一句话跨两个图形阶段。

## 3. 旁白音频（克隆音色，统一后处理链）

- 音色：用 `audio\ref_voice.wav` 做参考克隆，全系列同一音色，不换声。
- 后处理链固定：响度归一 → 去长静音 → 降噪 → 高通 80Hz → 限制器。输出 `audio\narration.wav`（48kHz 单声道）。
- 提速：**atempo=1.40**（见 §0.1）。先提速后归一，顺序不可换。
- 分段：按章分为 `audio\raw\chN.wav`，拼成 `narration.wav` 时用 `concat_list.txt`，交叉淡入淡出 80ms 防爆音。

## 4. 图形与动效（每集 6–12 个图形，全程有动效）

- 风格：**科技纪录片**。深色底、细线框、无衬线小字标注；强调色单集不超过 2 种。
- 每章至少 1 个主图形 + 1 个持续动效。主图形对应旁白的核心概念（结构剖面 / 力学示意 / 时序图 / 数据条）。
- **持续动效优先用 `repeat:-1` + `yoyo`**（主时间轴 seek-safe，见 §0.1）。周期 0.4–1.6s。
- SVG 描边动画用 `stroke-dasharray`/`stroke-dashoffset`；计数动画用 `requestAnimationFrame` + `easeOutExpo`，不用 `setInterval`。
- 严禁：静止超过 1.5s 的画面、纯文字满屏、与其他集重复的图形。

## 5. 字幕与文字

- **全片无硬字幕**（见 §0）。图形内的术语标注允许，但必须是图形设计的一部分，不能是"把旁白打上去"。
- 图形内文字：中文为主，单位与符号用国际标准（mm、kN、°C）。不用艺术字。
- 字号下限：标注 ≥ 28px（1080p 下可读）；关键数字 ≥ 40px。

## 6. 渲染与封装（严格按顺序）

1) 工程自检（渲染前必须 0 error）：

```powershell
& npx hyperframes check .
```

2) 确认 `audio\narration.wav` 已就绪且时长为最终值。

3) 渲染（视频，无音频轨）：

```powershell
& npx hyperframes render . -o "renders\_raw.mp4" --fps 30 --resolution landscape --no-browser-gpu
```

4) 最终封装（视频 + narration + BGM）。先 ffprobe `renders\_raw.mp4`：
   - 若 _raw **已是** h264 baseline/constrained baseline + yuv420p：视频用 `-c:v copy`（省一次重编码、省时间）；
   - 否则用 `-c:v libx264 -profile:v baseline -level 4.0 -pix_fmt yuv420p -crf 20 -preset medium` 重编码。

   BGM：`bgm_src.mp3`，音量 0.14，开头 2s 淡入、结尾前 6s 淡出。命令模板（N=narration 时长，OUT=成片路径）：

```powershell
$fc="[1:a]aresample=48000[a0];[2:a]aresample=48000,volume=0.14,afade=t=in:st=0:d=2,afade=t=out:st=$($N-6):d=6[bgm];[a0][bgm]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.977[aout]"
& ffmpeg -y -i "renders\_raw.mp4" -i "audio\narration.wav" -i "audio\bgm_src.mp3" `
  -filter_complex $fc -map 0:v -map "[aout]" `
  <video encode flags> -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$OUT"
```

   成片输出到：`D:\豆包产物\像素档案馆\04_成片\<标题>_横屏全程动效版_v1.mp4`。

## 7. 每集交付前校验（四项全过，缺一不可，并把结果记录）

1. `npx hyperframes check` 0 error（见 6.1）。
2. 整段解码无输出：`ffmpeg -v error -i "<成片>" -f null -`（stderr/输出必须为空）。
3. ffprobe 核对：编码 h264 且 profile=Baseline/Constrained Baseline、pix_fmt=yuv420p、音频 aac、48000、1920×1080、30fps、时长≈narration。
4. 抽帧目检：每章中点 + 若干句中点抽帧（用 ffmpeg `-ss <t> -frames:v 1`），核对：无元素重叠/穿帮、无字体重叠、画面确实在运动（相邻两帧有变化）、无硬字幕。发现问题回炉补动效后重渲染。

## 8. 磁盘清理（D 盘只余约 26GB，必须逐集清）

- 每集最终封装 + 四项校验通过、且确认成片可播后：删除 `renders\_raw.mp4` 及 `renders\` 下其它中间视频（**成片与工程保留**；narration.wav、bgm、工程源码保留）。
- 可选：删除 `audio\raw`、`norm`（保留 `fast` 与 `narration.wav`）以进一步省空间。
- 清理只针对本集自己产生的中间文件，**绝不删改其它工程/其它会话/用户的文件**。

## 9. 回报格式（每个 shard 回传，便于汇总）

每集回传：集数 / 标题 / 票签号 / 成片绝对路径 / 时长(s) / ffprobe 关键值 / 四项校验结果（逐项 PASS）/ 锁定口径要点（3–6 条）/ 待核项及处理 / 本集主要图形与每章动效一句话。
