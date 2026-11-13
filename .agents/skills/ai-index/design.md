# 策划文档

`design/current.json` 定义首页的当前文档与分组；`design/catalog.json` 保留完整目录和版本来源。公开 Markdown 位于 `design/sources/`，由 `scripts/build-design.py` 生成 `design/docs/` 下的当前阅读页、`design/index.html` 与 `design/history.html`。依赖见 `scripts/requirements-design.txt`；历史阅读页独立维护，原有 URL 和章节锚点保持有效。

生成器的 `build_reader` 管章节目录、正文及相邻文档，`build_home` 管策划总览／系统设计／开发规范分组，`build_history` 管历史目录。`design/archive.js` 的 `filter` 管关键词与分类检索、URL 状态恢复；开头兼容旧首页检索地址。`design/planning.css` 管当前阅读布局及历史页面共用的紧凑排版，基础视觉保留在 `archive.css`。

正式游戏现状、个人判断与待验证方案分开。标题采用专业名词；完整的房间、星级术语保持概念准确。公开正文只链接站内已有内容或明确外部来源，不暴露本地文件路径，不把仓库内部链接直接作为公网链接。更新游戏规则须同步对应网页源文及元数据；仅重新生成不会从其它工程自动抓取内容。
