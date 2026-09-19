> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-05-27
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# BuildScore UI HUD & 结算表现改造设计（2026-05-27）

## 背景与目标

本次改造聚焦在 BuildScore 模式的 HUD 信息架构与结算表现节奏优化，核心目标：

- Level/Turns/刷新次数信息更清晰可读
- 结算时以“分数框 + 倍率”两块 HUD 表现逐张累加与最终跳变
- 最终回合得分以“攻击/交盘缠”方式飞向 Target，并驱动 Target 递减到 0（过关）
- UI 节点由编辑器创建并绑定，代码不再运行时自动生成布局节点
- 牌型/牌库信息弹层复用 `common/prefab/mask.prefab` 作为遮罩底

非目标：

- 不做燃烧 shader / 粒子特效（后续再接）
- 不重构结算公式本身（仅补充表现所需的 breakdown 字段，避免 UI 反推）

## 现有资源复用

- 飘字：`assets/resources/common/prefab/FloatingText.prefab`
- 遮罩：`assets/resources/common/prefab/mask.prefab`
- （可选未来）toast/notify/alert/confirm/wait 等通用预制体

## HUD 结构与绑定（编辑器创建）

在 `assets/resources/gui/prefab/game_main.prefab` 内完成以下节点，并按脚本字段拖拽绑定。

### A. Level 进度条

- 节点：`HUD/Level/LevelProgressBar`
- 组件：`cc.ProgressBar`
- 绑定：`HudViewComp.levelProgressBar`

### B. 结算 HUD（两块：分数框 + 倍率）

- 根节点：`HUD/SettlementHud`（默认 active=false）
- 分数区：
  - `HUD/SettlementHud/ScoreNode`（用于震荡）
  - `HUD/SettlementHud/ScoreNode/ScoreLabel`（Label）
- 倍率区：
  - `HUD/SettlementHud/MultNode`（用于震荡）
  - `HUD/SettlementHud/MultNode/MultLabel`（Label，格式 `*2` 或 `x2` 由实现确定）

绑定（HudViewComp）：

- `settlementHud: Node`
- `settlementScoreNode: Node`
- `settlementScoreLabel: Label`
- `settlementMultNode: Node`
- `settlementMultLabel: Label`

### C. 牌型/牌库按钮（常驻显示）

- `HUD/BtnPatterns`（常驻 active=true）
- `HUD/BtnDeck`（常驻 active=true）

绑定（GameMainViewComp）：

- `patternsBtn: Node`
- `deckBtn: Node`

### D. 信息弹层（mask.prefab）

- 在 HUD 下创建 `HUD/InfoOverlay`，做法：
  - 将 `common/prefab/mask.prefab` 拖入 HUD，作为 `InfoOverlay`（或把实例重命名为 `InfoOverlay`）
  - 在 `InfoOverlay` 下创建 `TextLabel`（Label），用于显示牌型/牌库文本
  - `InfoOverlay` 默认 active=false

绑定（GameMainViewComp）：

- `infoOverlay: Node`
- `infoOverlayLabel: Label`

交互：

- 点击 BtnPatterns/BtnDeck → 打开弹层并填充文本
- 点击遮罩空白 → 关闭弹层（监听 `TOUCH_END`）

## 刷新次数展示

刷新按钮文本显示为：`刷新/{left}`（例如 `刷新/2`）。

数据来源：

- RunProgress 内维护剩余刷新次数（若已有：直接读；若没有：补 `getRefreshLeft()` 及事件触发）

刷新时机：

- 初始化 HUD 时
- 每次刷新成功/失败后（扣次数与 UI 更新要同步）

## 结算表现：数据口径与动画序列

### 数值口径（已确认）

- 逐张出牌阶段：分数框累加“基础分（未乘倍率）”
- 倍率区实时显示当前倍率（红色飘字或数值跳动）
- 五张结束后：分数框做一次跳变到“最终本回合总分（已乘倍率）”

### 动画规则

逐张（第 1~5 张）：

- 卡牌本体轻微抖动
- 在牌上方弹出飘字：
  - 分数飘字：蓝色（例如 `+30`）
  - 倍率飘字：红色（例如 `+0.5x` 或 `x2`，以实现约定为准）
- 分数框/倍率框触发震荡动画（scale/punch）
- 飘字不飞向分数框，只在卡牌附近弹出并淡出

五张结束：

- 分数框数字跳动到“最终回合总分”
- 生成一个“总分飘字/飞行体”（可复用 FloatingTextComp）从分数框飞向 Target
- Target 递减动画：从旧 Target 值逐步减到 `max(0, oldTarget - roundTotal)`，视觉上类似受到伤害/被交付盘缠
- 若 Target 归零：触发过关表现（可先做轻微缩放/淡出，未来替换粒子/音效）

### 表现驱动的数据（SettlementResult.breakdown）

为了避免 UI 反推，结算逻辑需要保证 SettlementResult 内包含表现所需字段，例如：

- `perCardBaseAdds: number[5]`：每张牌对基础分的贡献（用于蓝色飘字与逐张累加）
- `perCardMultDeltas?: number[5]`：每张牌引发的倍率变化（可选，没有就不播倍率飘字）
- `baseSum: number`：基础分合计
- `finalMult: number`：最终倍率
- `roundTotal: number`：最终回合总分（用于飞向 Target 与扣减）

## 代码改造范围（概览）

- `HudViewComp`
  - 从旧：chips/mult/total（三块）
  - 改为：score/mult（两块）+ levelProgressBar + 刷新按钮文本更新接口
- `GameMainViewComp`
  - 重写 `playSettlementSequence`：逐卡飘字与 HUD 震荡、最终乘倍率跳变、飞向 Target 扣减
  - 绑定并复用 `mask.prefab` 作为 InfoOverlay（只负责开关与填字）
- `RunProgress` / `GameSession`
  - 根据需要补充：刷新次数 getter、结算 breakdown 字段

## 验收标准

- Level 进度条显示并随关卡推进更新
- 刷新按钮显示 `刷新/剩余次数` 且随次数变化更新
- 结算时 SettlementHud 显示，按 1~5 张顺序播：
  - 牌上飘字（分数蓝、倍率红）
  - 分数框实时累加基础分并震荡
  - 倍率变化时倍率框震荡
  - 五张结束后分数框跳到最终回合总分
  - 最终分飞向 Target，Target 做递减动画，归零则过关
- 牌型/牌库按钮常驻可点击，弹层显示文本，点遮罩关闭

