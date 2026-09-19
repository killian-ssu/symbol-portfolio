> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-05-30
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 30 个随身物（vNext）功能补齐 设计说明

## 目标

把 `docs/v2-traveling-merchant/scoring-and-builds-vnext.md` 的“30 个随身物讨论池”全部做成可用（不再保留 enabled=false 占位），并对齐其触发时机、数值语言与关键约束：

- 道具占用 5 个行动格的“印记位”（已实现的印记位系统继续沿用）。
- 道具触发顺序清晰：同阶段的全局触发按固定顺序；格子相关触发按行动格顺序。
- 尽量用配置驱动：通过扩展少量 `ModifierCondition/ModifierEffect` 来表达剩余道具，不为每个道具写 if/else。
- 规则修正道具（山野图谱/通商路引）要影响出牌阶段预览牌型与结算牌型。
- “指定格子限制放置”（中格铜印/压箱底“只能放某格”）先不实现放置限制 UI；功能仍按 vNext 的“作用在第 3/第 5 格”来实现。

## 现状与缺口

### 现有触发链

当前结算链只执行：

- `onRefresh`（按本轮刷新次数循环）
- `onToolUsed`（按本轮使用工具顺序循环）
- `beforeScore`（一次）

未接入但 vNext 需要的：

- `onCardPlaced`（每次放牌时：成长/计数）
- `onRoundStart`（探索轮/路段开始）
- `afterScore`（本轮结算后追加分、通关后成长）
- `beforePatternLock / onPatternLocked`（规则修正与牌型锁定阶段）

### 现有效果能力

目前效果能覆盖：

- 单牌加分 / 单牌乘分 / 单牌再触发（repeat）
- 加倍率（patternMultiplier 叠加）
- 总分追加 / 倍率乘算（totalMultiplier）

缺少 vNext 的“相邻/计数/成长/规则修正”表达。

## 设计：阶段与触发接线（保持最小改动）

为兼容现有系统并保持 UI/动画可实现性，阶段接线采取“能落地即可”的方式：

1. **onRoundStart**：每次 `startExploreRound()` 后触发一次（用于旅人靴的刷新 +1 等路段/探索轮开始类效果）。
2. **onCardPlaced**：每次放入一张行动牌后触发一次（用于商路账簿/矿商秤/百草册等成长计数）。
3. **beforeScore**：维持现有（结算前应用所有对单牌/倍率/总分的修正）。
4. **afterScore**：在本轮得分结算完并写入 session.score 后触发一次（用于“结算后追加分”与“通关后成长”等）。

牌型锁定与规则修正：

- 规则修正不作为新的数值运算类型，而是进入“牌型判定层”的映射表，影响 `resolvePatternForTypes` 与 `getPreviewPattern`。

## 设计：新增运行时状态（成长类）

在 `GameSession` 增加最小的可持久字段：

- `globalBaseScoreAdd: number`（聚宝盆：通关后全牌基础分 +2 的累积）
- `tradeLedgerMult: number`（商路账簿：初始 1.0，每次交易 +0.1，在结算末尾乘入倍率区）
- `mineScaleAdd: number`（矿商秤：每次开矿永久 +3，结算后追加当前累积分）
- `gatherBookAdd: number`（百草册：每次采集永久 +1，影响后续采集牌 baseScore）

这些状态：

- 影响出牌阶段预览（至少影响“基础分/倍率预览”中的可观察项）
- 需要在 `resetRun()` 与 `resetForLevel()` 明确是否清零：成长类属于“本局内成长”，因此 `resetRun` 清零；`resetForLevel` 不清零。

## 设计：新增条件/效果（配置驱动）

### 新增 ModifierCondition（建议）

- `source_count_at_least`：统计本轮 5 张牌中某货源数量是否 >= N
- `tools_used_at_least`：统计本轮使用工具牌数量是否 >= N
- `left_neighbor_source_diff`：该牌与左邻牌货源不同（用于集市串铃）
- `adjacent_same_source`：该 slot 与相邻 slot（左或右）至少一侧同源（用于破货架）
- `slot_pair_same_source`：指定两个 slot 是否同源（用于压箱底：第 5 格与第 1 格同源）

### 新增 ModifierEffect（建议）

- `add_right_neighbor_baseScore`：右邻牌 `perCardScoreAdd += value`
- `add_adjacent_pair_baseScore`：本格与命中的相邻格都 `perCardScoreAdd += value`
- `repeat_right_neighbor_score`：右邻牌 `perCardRepeat *= value`（需要防止连环扣递归：只允许由该 effect 产生一次，不再触发自身）
- `multiply_pattern_multiplier`：对 patternMultiplier 做乘法（用于商路账簿末尾乘入倍率区 / 行商腰牌倍率翻倍等）

## 设计：道具逐项映射（对齐 vNext）

以 vNext 表为准，核心需要补齐的占位道具对应到上述能力：

- 破货架：`adjacent_same_source` + `add_adjacent_pair_baseScore(+8)`
- 红算盘：`source_count_at_least(trade,3)` + `add_pattern_multiplier(+3)`
- 旅人靴：`onRoundStart` + `add_refresh_left(+1)`（若不想改 UI，至少改 session.refreshLeft/refreshTotal）
- 古玩匣：`card_sourceType_is loot` + `add_card_baseScore(+5)`；若 `tools_used_at_least(1)` 再 +5
- 五色转经筒：`pattern_is five_unique` + 对所有牌 `add_card_baseScore(+8)`
- 集市串铃：`left_neighbor_source_diff` + `add_card_baseScore(+6)`
- 迎客幡：`slot_self` + `add_right_neighbor_baseScore(+10)`
- 连环扣：首次触发后对右邻 `repeat_right_neighbor_score(2)`，且该额外触发不再产生新的连环扣事件
- 行商腰牌：`tools_used_at_least(2)` + `multiply_pattern_multiplier(2)`（作用于倍率区）
- 聚宝盆：通关后 `globalBaseScoreAdd += 2`，下局所有牌 baseScore +globalBaseScoreAdd
- 商路账簿：每打出 trade：`tradeLedgerMult += 0.1`；结算末尾 `patternMultiplier *= tradeLedgerMult`
- 矿商秤：每打出 mine：`mineScaleAdd += 3`；结算后追加 `mineScaleAdd`
- 百草册：每打出 gather：`gatherBookAdd += 1`；后续 gather 牌 baseScore +gatherBookAdd
- 山野图谱 / 通商路引：规则修正映射表，影响预览与结算的“同源判定”

注：中格铜印/压箱底的“只能放某格”不做放置限制，但效果仍绑定 `slotIndex=2/4` 生效。

## 验证要点

- 30 个 relic 全部 `enabled=true` 且能进入奖励池（按 unlockChapter 逐章解锁）。
- 新触发点接线后，旧的 14 个可用道具行为不退化。
- 规则修正道具会影响出牌阶段的牌型预览与结算牌型一致。
- 连环扣不出现无限递归重复。
- tsc 编译通过。

