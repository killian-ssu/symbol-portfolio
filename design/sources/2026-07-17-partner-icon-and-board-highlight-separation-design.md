> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-17
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 伙伴图标比例与行动格提示分层设计

## 背景与根因

- `hand_card.prefab` 的 `ItemIcon` 当前使用固定 `120×140` 与 `CUSTOM`，运行时替换不同宽高比的伙伴 SpriteFrame 时会被拉伸。
- `board_cell.prefab` 的 `CardIcon` 已使用 `RAW`，但统一缩放 `0.64`，相对 `100×100` 的行动格背景偏小。
- 桌面导出的 `行动格.png` 实际是白色四角边框，`选中边框.png` 实际是纯色圆角底；当前入库文件的语义与内容相反。
- `BoardCellStampComp` 把“下一张牌落入此格”和“工具/道具合法目标高光”合并到同一个 `HighlightRoot`，无法分别表现静态边框与波浪外扩高光。

## 图标尺寸

- 手牌 `ItemIcon` 使用 `Sprite Size Mode = RAW`，节点 `Scale X/Y` 同为 `0.88`。
- 行动格 `CardIcon` 保持 `RAW`，节点 `Scale X/Y` 同为 `0.82`。
- 运行时代码只替换 SpriteFrame，不修改 UITransform、缩放或颜色。
- 两处均保留每张伙伴图的原始宽高比，并允许图形相对背景略微溢出。

## 素材语义

- `cell_empty.png` 保存纯色圆角行动格底。
- `cell_selected.png` 保存白色四角下一格边框。
- 保持两个资源现有 UUID，由 Creator 重新导入内容；Prefab 按语义绑定，不依赖桌面中文文件名。

## 行动格节点结构

```text
board_cell
├─ bg                       纯色空行动格
├─ NextActionBorderRoot     白色四角边框，默认 inactive
├─ ActionRoot               已落位伙伴背景、Icon、分数
├─ RelicAnchor
├─ FxAnchor
├─ HighlightRoot            波浪外扩合法目标高光，默认 inactive
│  └─ FlowBorder
├─ DisabledRoot
└─ SettlementFxRoot
```

- `BoardCellStampComp.nextActionBorderRoot` 只由 `setNextActionHighlighted(on)` 控制。
- `targetHighlightRoot` 只响应工具合法目标、道具替换等既有选择状态。
- 两种状态不再共享节点；下一格边框隐藏时不影响合法目标高光，反之亦然。

## 波浪外扩高光

- 手牌继续使用现有 `HighlightRoot/FlowBorder` 与 `CardTargetGlow.mtl`。
- 行动格与道具的 `HighlightRoot` 都增加单个 `FlowBorder`，使用同一个 `CardTargetGlow.effect` 和相同颜色、速度。
- 新增方形参数材质 `CellTargetGlow.mtl`，仅调整方形画布、方形轮廓和圆角参数，不改变手牌材质。
- `FlowBorder` 继续使用不可进入动态图集的 `resources/gui/texture/Square.png`，所有位置、外扩边距和材质参数由 Prefab/Inspector 控制。
- 新材质的 `.meta` 必须由当前根目录的 Cocos Creator 生成，不手写 UUID。

## 状态流

- 正常可出牌：仅 `NextActionBorderRoot` 显示在 Core 给出的 `nextActionSlotIndex`。
- 工具选择目标、动画结算、奖励、道具替换及非游玩状态：下一格边框按既有策略隐藏。
- 工具合法行动格或道具：对应 `HighlightRoot` 显示波浪外扩高光；非法目标继续使用 `DisabledRoot`。
- 道具替换的当前区域选择继续复用 `HighlightRoot`，不显示下一格边框。

## 验证

- 资源契约检查两个 PNG 的透明度/内容语义、Prefab SpriteFrame UUID、节点分层和默认 inactive 状态。
- 检查手牌与行动格 Icon 均为 `RAW`、X/Y 等比缩放分别为 `0.88` 与 `0.82`。
- 检查 `setNextActionHighlighted` 只切换 `nextActionBorderRoot`，合法目标只切换 `targetHighlightRoot`。
- 检查手牌、行动格、道具三个高光入口都绑定 `FlowBorder` 与正确材质。
- 运行伙伴素材契约、Core 测试、TypeScript 检查；`test:v04-ui` 的既有材质参数断言继续单独报告，不回退用户当前材质改动。

## 范围外

- 不修改牌库、牌型、分数、目标合法性、奖励或出牌顺序。
- 不修改主界面总体布局、手牌锚点、行动格锚点、道具锚点或现有动效时序。
