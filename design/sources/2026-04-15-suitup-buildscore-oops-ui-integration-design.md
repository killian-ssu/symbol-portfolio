> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-04-15
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# SuitUp BuildScore（Oops Framework）UI 接入与配置加载设计

## 1. 目标与范围

### 1.1 目标
- 在现有 Oops Framework 工程（poker）标准启动链路内，实现本小游戏的对局主界面接入方式与配置加载方式
- 保持 core 纯逻辑与 UI 表现分离，避免规则逻辑散落在 Component 中
- 让后续开发可以按“配置 → core → UI → 验收用例”的节奏稳定迭代

### 1.2 非目标（本设计不实现）
- 不实现商店/货币/Jobs/局外成长等非 MVP 内容
- 不改动 oops-plugin-framework 的源码（避免升级/同步成本）

## 2. 工程现状约束
- 引擎：Cocos Creator 3.8.x
- 框架：Oops Framework（已集成 extensions/oops-plugin-framework）
- 启动入口：Main（工程内附件，未随本页公开）
- 初始化链路：Initialize → InitResSystem → 打开 Loading → Loading 自定义加载 → 进入游戏
- GUI 配置入口：GameUIConfig.ts（工程内附件，未随本页公开）

## 3. 接入方案（UI 界面方式）

### 3.1 总体流程
1. 继续使用现有 `main.scene` 作为 Root 场景与初始化承载
2. 初始化完成后在 Loading 阶段加载 `config/gameplay` 配置
3. Loading 完成后通过 `oops.gui.open(UIID.GameMain)` 打开对局主界面（GameMain prefab）

### 3.2 UIID 与 UIConfigData 扩展
- 在 `UIID` 中新增 `GameMain`
- 在 `UIConfigData` 中新增 `GameMain` 配置，指向 `resources` bundle 下的 prefab 路径
- GameMain 作为主界面常驻；弹窗（RewardPicker/Confirm 等）作为 Dialog 层或 UI 层的子界面按需打开

## 4. 配置加载与校验设计

### 4.1 配置目录约定
- 配置放置目录：`assets/resources/config/gameplay/`
- 文档真相源：`docs/ai/DATA_SCHEMA.md`

### 4.2 不修改 JsonUtil 的原因
- Oops 的 `JsonUtil` 固定使用 `config/game/` 目录（见 JsonUtil.ts（工程内附件，未随本页公开）），改动会导致框架升级/同步成本上升
- 业务侧实现独立加载器更可控，也更贴合“玩法配置是业务资产”的边界

### 4.3 GameplayConfigLoader（业务侧新增）
- 在 `assets/script/game/config/` 内新增加载器，用 `resLoader.loadDir("config/gameplay", JsonAsset)` 读取目录内所有 JSON
- 加载完成后按 `docs/ai/DATA_SCHEMA.md` 做字段校验与错误报表（缺文件/字段名错误/类型不符）
- 产出一个只读配置对象供 core 使用（例如 `GameplayConfigs`）

### 4.4 加载时机
- 在 LoadingViewComp.loadCustom（工程内附件，未随本页公开） 中追加加载 `config/gameplay`（在 JsonUtil.loadDir 之后或替换为显式顺序）
- 加载失败时：输出错误并阻止进入 GameMain（避免“半配置运行”导致更难排查）

## 5. 代码分层与模块边界（与 docs/ai/ARCHITECTURE.md 对齐）

### 5.1 core（纯逻辑）
- 不依赖 Cocos Component / Prefab / 节点 API
- 输入：配置、随机数源、玩家操作
- 输出：结算事件与指令（segments、gravityMoves、scoreBreakdown、endState、toolDeal、rewardOffer 等）

### 5.2 ui（表现层）
- 只负责：拖拽交互、动画表现、HUD 显示、弹窗（RewardPicker）
- 不实现规则判定，不直接改 core 内部状态（只通过接口/事件交互）

### 5.3 config（配置层）
- 只负责：加载、校验、类型定义、默认值兼容策略
- 不负责：规则计算

## 6. 对局主界面（GameMain）职责
- 初始化对局/进入关卡（默认进入第 1 关）
- 接收 UI 输入并调用 core（落牌、用工具、选择奖励）
- 以“播放队列”方式消费 core 输出（消除 → 下移 → 连锁下一段 → 结算完成）
- 驱动 HUD：目标分/当前分/回合数/连锁段数/倍率

## 7. 资源与 prefab 规划（可由人工搭建）
- `resources/gameplay/prefab/game_main.prefab`：主界面（Board/Hand/HUD/ToolBar/RewardPickerAnchor）
- `resources/gameplay/prefab/reward_picker.prefab`：三选一（也可走 gui.open 单独作为 UI）
- Board/Hand/HUD 内部子节点结构由“搭建说明书”约束，确保脚本能稳定绑定

## 8. 手工搭建说明书交付物
- 新增文档：`docs/ai/COCOS_BUILD_GUIDE.md`
- 内容包括：
  - 创建 prefab/节点树的逐步操作
  - 每个节点挂载的组件脚本与暴露字段如何拖拽绑定
  - UIConfigData 中 prefab 路径如何填写
  - 运行自检清单（HUD 显示、拖拽落牌、消除动画、关卡结束与三选一弹出）

## 9. 验收标准（最小闭环）
- 启动后能通过 `oops.gui.open(UIID.GameMain)` 进入对局界面
- `config/gameplay` 配置加载与校验通过（至少 scoring/levels/tools/jokers/upgrades 均可读）
- 第 1 关 HUD 正确显示（目标分/当前分/剩余回合）

