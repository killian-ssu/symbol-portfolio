> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-05-30
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 道具印记位（5格）与满格替换 设计说明

## 目标

在局内使用 5 个行动格（slotIndex 0-4，对应 UI 1-5）承载“道具印记位”。道具不做背包栏/道具架；视觉仅体现在格子底纹/符印/边框变化；行动牌仍直接放在格子上。

当玩家获得新道具（relic）时：

1. 若存在空位：自动放入第一个空位（从 slotIndex=0 起查找），播放一次落入反馈动画，并展示道具名称与效果说明，然后继续原本流程。
2. 若满格：进入替换流程（pendingItem），玩家点击一个旧印记位并确认后替换，替换位置保持不变，不做整体左移/重排；替换完成后继续原本流程。
3. 若一次获得多个道具：进入队列，逐个执行自动放置或替换；若未来探索轮中途获得，则延迟到本轮结算结束后处理。

## 核心约束

- 每格最多 1 个道具印记（slotIndex 0-4）。
- 全局道具与格子道具都占用 1 个印记位：
  - 全局道具：效果作用全局，但仍占据某个 slot 的印记位（位置稳定）。
  - 格子道具：效果作用本格/相邻格（位置稳定，后续支持相邻触发）。
- 满格时新道具不自动覆盖旧道具；必须由玩家选择替换目标。
- 替换界面打开时，禁止继续出牌、刷新、进入下一关。

## 数据模型（方案 A）

### SlotState（运行时）

- `slots[0..4].slotModifierId: string | null` 作为“印记位占用”的唯一真相（relic 不区分 global/slot 的占用方式，统一占一个 slot）。
- `modifiersGlobal: string[]` 仅保留 `kind=upgrade`（若后续仍保留升级系统）。

### ModifierConfig（配置）

在现有 `ModifierConfig` 上新增可选字段，用于渲染印记：

- `icon?: string`：SpriteAtlas 内的 icon spriteFrame 名
- `frame?: string`：SpriteAtlas 内的 frame spriteFrame 名（可为空）

逻辑效果仍由 `scope: global|slot` 决定：

- `scope=global`：参与全局触发，不绑定 `slot_self/slot_index_is` 的“自身格”语义。
- `scope=slot`：绑定占用的 slotIndex，支持 `slot_self`、`slot_index_is` 等条件。

## 流程设计

### 1) 获得 relic：自动放置

触发点：关卡通关奖励选择（pending_reward）选择了某个 `modifier(kind=relic)`。

步骤：

1. 从 `slotIndex=0` 起查找首个 `slotModifierId == null` 的格子。
2. 若找到：
   - 写入该 slot 的 `slotModifierId = newRelicId`
   - 播放该格“印记落入”动画（scale/opacity tween）
   - 展示道具名称与效果说明（不阻塞交互，展示后继续流程）
   - 继续原本流程（进入下一关 / 下一阶段）

### 2) 获得 relic：满格替换

触发条件：5 个 slot 均已有 `slotModifierId != null`。

步骤：

1. 将新道具保存为 `pendingItem`（并进入队列）。
2. 暂停进入下一关或下一阶段。
3. 进入“替换模式”：
   - 隐藏行动牌（仅隐藏牌节点，不影响印记显示）
   - 显示提示文案：`行囊已满，请选择一个旧印记替换`，并展示新道具名称/说明
   - 五个格子进入可点击
4. 玩家点击一个 slot：
   - 高亮该格
   - 弹出确认窗口，展示 `原道具 -> 新道具` 预览与描述
5. 玩家确认：
   - 将 `selectedSlotIndex` 中旧道具移除（覆盖写入）
   - 将 `pendingItem` 放入该 slot（位置不变）
   - 播放旧印记淡出 / 新印记盖入动画
   - 退出替换模式，恢复行动牌显示
   - 若队列还有 pendingItem：继续下一轮替换；否则继续原本流程

## UI/交互实现策略（不新增背包栏）

### 盘面格子印记渲染

在 `board_cell.prefab` 内由编辑器添加（并绑定）：

- `StampRoot`（默认隐藏）
  - `Icon`（cc.Sprite）
  - `Frame`（cc.Sprite，可选）

运行时通过脚本将 `slotModifierId` 映射到对应 `ModifierConfig.icon/frame`，从 SpriteAtlas 中取 spriteFrame 设置到 Icon/Frame。

### 替换模式 UI（最小化新增资源）

- 不新增独立“背包/道具架”UI。
- 替换模式提示使用飘字/提示文案（不阻塞点格子）。
- 确认替换使用现有 Confirm 弹窗（带遮罩，确认时阻塞输入）。

## 测试要点

- 空位自动放置：依次填充 0→4，确认不弹选择界面、能播放一次动画与提示。
- 满格替换：进入替换模式，隐藏行动牌；点击某格后确认替换；替换后该位置保持不变。
- 替换模式禁用操作：替换模式下无法出牌/刷新/跳关/进入下一关。
- scope 行为不变：`scope=global` 道具依然全局生效，`scope=slot` 道具依然与其占用 slotIndex 绑定。

