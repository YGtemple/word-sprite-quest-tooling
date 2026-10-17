> ## ⚠️ 本仓库已合并
>
> 内容已并入 **[word-sprite-quest](https://github.com/YGtemple/word-sprite-quest)** 的 `tooling/` 目录。
> 请前往主仓库查看完整项目（含源码、契约文档与配置）。
>
> 本仓库保留为历史归档，不再更新。

---

# word-sprite-quest-tooling · 单词精灵闯关工具链（v1.2）

> 跨 AI 协作文档与自动化校验脚本：契约检查器、关卡/词库校验、渲染槽锁、长片制作规格。

## 内容

| 文件 | 作用 |
|---|---|
| `validate_levels.js` | 关卡数据校验 |
| `check_gameplay.js` | 玩法实现完整性检查 |
| `validate_words.js` | 词库校验 |
| `convert_wordbank.js` | 词库格式转换 |
| `generate_levels.js` | 关卡数据生成 |
| `schema_v1_2.js` | v1.2 字段定义 |
| `_RENDER_LOCK/` | 渲染槽锁（acquire / release） |
| `SPEC_长片系列.md` | 长片制作规格 |
| `collaboration/` | 跨 AI 协作文档 |
| `research/` | 调研底稿 |
| `tests/` | 测试 |

## 说明

本仓库对应 CONTRACT **v1.2** 时代的工具链。v1.3 新增了元留存层（体力/道具/任务/排行榜）与 15 个街机关卡，配置与校验器见主仓库 `tooling/`。

渲染槽锁（`_RENDER_LOCK/`）与长片制作规格（`SPEC_长片系列.md`）是这套工具链里**与游戏本身无关的通用部分**——它们服务于视频渲染任务的并发控制，可以单独复用。

## 许可证

MIT License
