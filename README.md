# 司靖波 · 作品集与游戏试玩

完整作品集的公开浏览版本，包含 PDF 在线阅读、下载与两个游戏的网页试玩。

本仓库只收录网页发布文件，不包含 Illustrator 源文件或游戏开发工程。作品与游戏素材版权归各自权利人所有，公开展示不授予再使用许可。字体许可见 `assets/FONT-LICENSE.txt`。

游戏试玩进度保存在当前浏览器。

## 策划文档

入口：[在线阅读](https://killian-ssu.github.io/symbol-portfolio/design/)。

首页集中展示《子时已到》的 13 份策划与流程文档，分为策划总览、系统设计、开发规范与验证。当前规则依据为 2026-11-13，文字修订于 2026-11-14。提供章节目录、系统间跳转、循环图及 Markdown 下载。

原有 81 份文档及其历史快照保留在[历史资料](https://killian-ssu.github.io/symbol-portfolio/design/history.html)，支持关键词、项目和分类筛选。历史资料的版本说明与当前正式游戏分别维护。

`design/current.json` 为首页文档配置，`design/sources/` 为经过公开阅读整理的 Markdown，`design/catalog.json` 为包含历史资料的目录。生成网页使用 `python3 scripts/build-design.py`，依赖见 `scripts/requirements-design.txt`。生成器只重建当前阅读页、策划首页和历史检索页；历史正文独立维护，原有地址保持有效。

标题使用规范的专业名词。当前规则、个人设计判断、待实施方案与尚未执行的测试明确区分，设计资料更新不代表 `play/` 中的游戏构建已同步。
