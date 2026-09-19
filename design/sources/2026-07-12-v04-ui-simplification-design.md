> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-12
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# v0.4 局内 UI 简化设计

## 目标

将 v0.4 Core 接入当前局内视觉，删除未经确认的双手牌、连线批次、刷新保留和重排弹层假设。局内应清楚表达：同一手牌区的行动/工具、通用 Boss 规则文字、Boss 专用进度、五类行动累计、区域 1→5 的依次结算，以及道具的常驻拖拽排序。

## 已确认的体验规则

1. 行动牌与工具牌共用 `Hand`。行动牌刷新时替换为三张新的行动牌；工具牌保留且使用后消耗。不会有独立工具手牌根。
2. Boss 的规则说明放在游戏界面通用 HUD。Boss 应对进度和解除状态由 Boss 专用 Prefab 显示；通用 HUD 不重复展示计数。
3. 五类行动累计继续使用已有 `SourceImprintBar` 与 `HudViewComp.setSourceImprints()`，不创建第二套累计栏。
4. 右向触发保持 Core 的区域 1→5 结算顺序，但不显示箭头连线、`×N` 批次文字或专用连线动画。结算表现由行动格/道具自身的触发、数字与爆分效果承担。
5. 刷新不再有保留选择。`refreshHand()` 只刷新行动手牌，工具牌不受影响；移除提灯保留 UI 和与之相关的交互状态。
6. 道具常驻在五个行动格下方的对应区域。道具可拖拽交换位置，但只允许在本轮尚未放置行动时，或上一轮结算完成且行动格已清空时排序。第一张行动落位后锁定，直到结算完成再次解锁。
7. 所有美术尺寸、暗化、绿光、粒子、拖拽动画、数字样式等呈现参数由 Prefab Inspector 管理；UI 代码不覆盖它们。玩法合法性、刷新规则、道具排序、Boss/结算顺序继续由 Core 返回。

## 方案比较与选择

### 方案 A：保留独立工具区和连线批次

实现较少，但与当前简洁手牌画面和战棋式触发认知不一致；不采用。

### 方案 B：同区手牌 + 逐格结算 + 常驻道具拖拽

工具和行动牌在同一手牌布局中显示；Core 保持高性能压缩结算，UI 将压缩批次映射为逐区域的局部效果。道具成为区域下方可见、可调整的构筑对象。采用此方案。

### 方案 C：保留重排弹层、用点击交换替代拖拽

更易接线，但打断局内节奏，且不符合已确认的道具常驻构想；不采用。

## 架构与数据流

```text
V04GameSession / GameSession 门面
  ├─ state.hand：行动与工具的同一显示序列
  ├─ state.regions：区域行动、区域道具与锁定所需状态
  ├─ refreshHand()：只重抽行动牌
  ├─ reorderRelics(order)：Core 校验并交换区域道具
  └─ SettlementBatch：仍作为 UI 结算顺序数据，但不要求连线节点

GameMainViewComp
  ├─ HandViewComp：一个 handRoot，同一布局显示两类牌
  ├─ HudViewComp：SourceImprintBar + 通用 Boss 文案
  ├─ BossViewComp（或既有 Boss Prefab 组件）：进度/解除状态
  └─ BoardViewComp：行动格、道具锚点、区域道具拖拽与局部结算播放
```

Core 不知道 Prefab 节点；UI 不自行计算可拖拽时机或 Boss 应对数。`GameMainViewComp` 仅根据 Core state 的“本轮是否已有行动”和结算状态开关道具排序。

## 组件边界

### HandViewComp

- 移除 `toolRoot` 的运行时分流；所有卡牌都加入 `handRoot` 并使用各自 Prefab。
- 继续由 `CardViewComp` 区分可点击行动和可消耗工具。
- 工具目标选择的绿光仍可作用于行动牌；工具牌在目标选择态不作为目标。

### HudViewComp 与 Boss Prefab

- `SourceImprintBar` 是唯一行动累计视图。
- Hud 仅显示 Boss 名称和规则文字。
- 新增/扩展 Boss Prefab 视图组件，仅接收 `{ count, required, broken }`；无 Boss 时隐藏。

### BoardViewComp

- 删除 `rightwardLinks`、`rightwardBatchLabels` 和其时间参数的运行时依赖；不再要求这些 Prefab 节点。
- 将 `SettlementBatch` 变为对源/目标区域的局部触发接口，未绑定特效节点时安全降级为无动画。
- 提供 Inspector 可配的每格 `FxAnchor` 与区域道具锚点。没有道具动画资源时不影响结算。

### 区域道具排序

- 使用 `BoardViewComp` 的拖拽回调把“源区域、目标区域”交给 `GameMainViewComp`。
- `GameMainViewComp` 在 Core 状态允许时调用 `progress.swapRelics(source, target)`；锁定时回弹，不修改 Core。
- 拖拽是否可用由 Core/门面暴露的 `canReorderRelics` 状态决定，规则为五个行动区域均为空且不在结算动画中。

## 失败与降级

- 未绑定 Boss Prefab 时只缺少进度表现，规则文字和结算正确。
- 未绑定道具锚点/动画节点时，拖拽和排序仍使用区域节点作为回退；不创建运行时美术节点。
- 刷新、拖拽和工具目标在结算动画中一律拒绝，且保持当前 UI 状态。
- 旧的 `refreshRetainRoot`、`relicReorderRoot`、右向连线字段在本轮移除或废弃，不再由 GameMain 激活。

## 验收标准

1. 一排手牌中可同时显示行动牌和工具牌；刷新后仅行动牌更换。
2. `SourceImprintBar` 的五类累计更新，且不存在重复的累计栏。
3. Boss 关显示 HUD 规则文字与 Boss Prefab 计数；解除后 Boss Prefab 显示解除态。
4. 五张行动结算时，视觉按区域 1→5 自身与其道具播放；没有连线/批次数字节点要求。
5. 无行动放置时交换两个区域道具成功；第一张行动落位后拖拽回弹；结算后重新可换。
6. 在 Cocos 改动所有表现参数后，运行时不会由 TypeScript 覆写。
