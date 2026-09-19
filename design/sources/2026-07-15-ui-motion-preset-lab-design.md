> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-15
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 《远行商人》UI 动效预设库与 Cocos 实验室设计

日期：2026-07-15  
状态：用户已复核，进入实施

## 1. 目标与范围

本轮把已确认的两种动效从“分散的 Prefab 数值”升级为可命名、可重复播放、可在后续项目中导出复用的第一版 UI 动效资产库：

- `button_press_snappy_v1`：按钮“干脆快弹”，用于开始游戏和刷新按钮。
- `board_impact_combo_strong_v1`：行动格“强烈递进重弹”，重复触发时越来越重、越来越快。
- 新增一个不参与正式构建的 Cocos 动效实验室场景，用真实运行时播放器自动重复播放两个预设。
- 新增动效目录，记录稳定 ID、中文名称、用途、参数、使用位置和版本规则。

分数动画不混入本轮实现。本轮验收后，以同一预设库和实验室为基础，单独设计“行动格短延迟爆分”和“分数区加分弹跳”。

## 2. 现有问题

当前代码有两组 TypeScript 默认参数，但按钮和行动格 Prefab 又各自序列化了一份数值。动画曲线固定为 `backOut`，不能在 Inspector 中切换。这会导致：

- 修改代码默认值不会自动更新已有 Prefab。
- 不同控件各自调整后，无法知道它们是否仍在使用同一模板。
- 没有稳定名称、参数目录和变更记录。
- 真实游戏流程不适合高频重复试播。
- 当连续冲击间隔变短时，现有播放器会先恢复基准变换，再播放新冲击，可能出现重置感而不是连击感。

## 3. 采用的架构

### 3.1 分层

```text
UIMotionPresetLibraryComp（Prefab 中的参数真相源）
        |
        +-- button_press_snappy_v1
        +-- board_impact_combo_strong_v1
        |
UIMotionPlayer（只负责播放、打断、基准变换）
        |
        +-- PressFeedbackComp（触摸生命周期）
        +-- BoardCellStampComp（结算连击入口）
        +-- UIMotionLabComp（开发试播）
```

`ui_motion_library.prefab` 是运行时参数真相源。其组件使用 `@ccclass` 序列化预设结构，使用 `@property` 把曲线、缩放、旋转、X/Y 时长与连击参数暴露给 Inspector。正式组件只保存 `presetId`，不再序列化整套参数副本。

主场景与实验室场景都实例化同一个 `ui_motion_library.prefab`，因此两个场景读取同一份参数。库组件在 `onLoad` 时注册当前实例；主菜单和局内 UI 预制体后续实例化时直接按 ID 读取。

### 3.2 缺失预设处理

- 找不到库或 ID 时，使用 TypeScript 中与库预制体一致的安全回退值，不阻止按钮和结算。
- 开发构建输出一次明确警告，包含缺失的 `presetId`。
- 契约测试比对 Prefab 数值与 TypeScript 回退值，防止两份值静默分叉。

## 4. 预设规格

### 4.1 `button_press_snappy_v1`

显示名：按钮·干脆快弹  
使用位置：`StartBtn`、`RefreshBtn`

| 参数 | 值 |
|---|---:|
| 曲线 | `quadOut` |
| 缩放增量 | `0.11` |
| 参考宽度 | `320px` |
| 宽控件最小强度比 | `0.65` |
| X 轴按下时长 | `0.08s` |
| Y 轴按下时长 | `0.12s` |
| 旋转 | 随机 `±2°` |
| 旋转到达时长 | `0.06s` |
| 旋转回正延迟 / 时长 | `0.06s / 0.08s` |
| X 轴松开恢复 | `0.10s` |
| Y 轴松开恢复 | `0.14s` |
| 松开旋转恢复 | `0.08s` |

`StartBtn` 宽 `320px`，`RefreshBtn` 宽 `250px`，因此两者都使用完整 `11%` 强度。更宽的按钮才逐步衰减，但不低于 `65%` 强度。

触摸行为保持手机优先：`TOUCH_START` 立即播放，`TOUCH_END` 恢复，`TOUCH_CANCEL` 安全恢复，不依赖 hover，不延迟原业务回调。

### 4.2 `board_impact_combo_strong_v1`

显示名：行动格·强烈递进重弹  
使用位置：5 个行动格的 `ActionRoot`

| 参数 | 值 |
|---|---:|
| 曲线 | `backOut` |
| 基础缩放增量 | `0.24` |
| X 轴打击时长 | `0.09s` |
| Y 轴打击时长 | `0.16s` |
| X 轴回弹时长 | `0.18s` |
| Y 轴回弹时长 | `0.24s` |
| 基础旋转 | `8°` |
| 旋转到达时长 | `0.08s` |
| 旋转回正时长 | `0.14s` |
| 每击强度增长 | `0.18` |
| 强度上限 | `1.95` |
| 第 1→2 击间隔 | `0.31s` |
| 每击间隔倍率 | `0.82` |
| 最短间隔 | `0.09s` |
| 连击重置空档 | `0.70s` |
| 末击后计分同步点 | `0.10s` |

第 `n` 击强度：

```text
intensity(n) = min(1.95, 1 + (n - 1) * 0.18)
```

第 `n` 个间隔：

```text
gap(n) = max(0.09, 0.31 * 0.82 ^ (n - 1))
```

缩放和角度达到上限后不再增大，后续冲击感由更短的间隔、后续分数动画、音效与粒子承担。连续旋转使用“随机首方向 + 后续左右交替”，避免纯随机连续偏向同一侧。

## 5. 结算数据与连击映射

UI 不推断道具规则。它只消费 Core 已输出的 `SettlementBatch`：

1. 对当前行动格，只统计 `targetRegion` 等于该格且 `eventType` 为 `ORIGINAL_ACTION` 或 `RETRIGGER_ACTION` 的 `repeatCount`。
2. 该总数就是实际伙伴行动次数；每一次实际行动都播放一击，视觉击数不设上限。
3. 原始行动也算第 1 击，没有再次行动时只播放一击。
4. 缩放和旋转强度仍按 `1.95` 封顶，但封顶后的真实触发继续播放，并保持最短 `0.09s` 间隔。
5. `perCardBaseAdds` 仍然在该格整段连击结束后一次加入分数区。本轮不伪造 Core 没有给出的单击分数拆分。

新连击到来时，播放器不先回到基准变换。新击从当前视觉状态接管，冲到更高的目标，再尝试回弹；如果下一击已到，当前回弹被平滑接管。整段连击结束或被页面销毁后才精确恢复基准缩放与角度。

## 6. Cocos 动效实验室

新建 `assets/dev/ui-motion-lab/ui_motion_lab.scene`，不加入正式 Build 场景列表，不使用 `UIID`，不通过 `oops.gui` 打开。它是开发资产，只在 Cocos Creator 中手动打开预览。

场景包含：

- 一个按钮演示节点，使用真实 `PressFeedbackComp` 和 `button_press_snappy_v1`。
- 一个行动格演示节点，使用真实 `BoardCellStampComp`/`UIMotionPlayer` 与 `board_impact_combo_strong_v1`。
- 按钮自动播放：按下、短暂保持、松开，每 `1.20s` 循环。
- 行动格自动播放：默认 8 击强烈递进，连击结束 `0.90s` 后重复；演示击数为 Inspector 正整数，不设代码上限。
- 两个自动循环可在 `UIMotionLabComp` Inspector 中分别关闭。
- 演示节点的尺寸、颜色、字体、锚点与布局全部保存在场景 Inspector，运行时代码不重写。

第一版实验室不实现“运行时拖滑杆后一键写回 Prefab”。调参时打开 `ui_motion_library.prefab` 修改 Inspector 并保存，然后回到实验室预览。一键写回需要编辑器扩展，等预设系统稳定后再做。

## 7. 动效目录和版本规则

新建 `docs/ui-motion/UI_MOTION_CATALOG.md`，每个预设记录：

- 稳定 ID 和中文名。
- 交互用途和不应使用的场景。
- 当前关键参数快照。
- 正在使用该预设的 Prefab/节点。
- 创建日期、状态和变更记录。

调参期使用 `_draft`。确认后发布为 `_v1`。稳定版开始被多个组件使用后，明显改变手感时复制为 `_v2`，由使用方显式迁移；不静默改掉所有项目已发布的手感。

## 8. 预计文件

新增：

- `assets/script/game/common/ui-motion/UIMotionPresetLibraryComp.ts`：可序列化预设数据和当前库查询。
- `assets/resources/common/prefab/ui_motion_library.prefab`：两个命名预设的真相源。
- `assets/dev/ui-motion-lab/UIMotionLabComp.ts`：开发循环播放。
- `assets/dev/ui-motion-lab/ui_motion_lab.scene`：独立实验室。
- 对应 Cocos `.meta` 文件。
- `docs/ui-motion/UI_MOTION_CATALOG.md`：资产目录与使用记录。

修改：

- `assets/script/game/common/ui-motion/UIMotionProfiles.ts`：扩展 `quadOut` 和连击纯函数，保留安全回退值。
- `assets/script/game/common/ui-motion/UIMotion.ts`：按命名预设播放，支持不重置基准的连击接管。
- `assets/script/game/common/ui-motion/PressFeedbackComp.ts`：只保存按钮预设 ID 和目标节点。
- `assets/script/game/buildscore/ui/BoardCellStampComp.ts`：只保存冲击预设 ID 和目标节点，提供连击入口。
- `assets/script/game/buildscore/ui/BoardViewComp.ts`：转发连击播放。
- `assets/script/game/buildscore/ui/GameMainViewComp.ts`：从 `SettlementBatch` 取可视行动次数，不再使用旧的“格子序号 + log2 连锁”单击强度公式。
- `assets/resources/gui/prefab/main_menu.prefab`、`game_main.prefab`、`assets/resources/game/poker/prefab/board_cell.prefab`：把分散参数替换为稳定预设 ID，不改布局、锚点和美术。
- `assets/main.scene`：实例化 `ui_motion_library.prefab`，不改现有 Canvas 和启动流程。
- `scripts/test-ui-motion-contract.js`：纯函数、预设、Prefab 和场景接线契约。

## 9. 测试与验收

### 自动测试

- 先写失败测试，验证两个稳定 ID、按钮 B 参数和强烈递进 B 参数。
- 验证强度序列为 `1.00, 1.18, 1.36, 1.54, 1.72, 1.90, 1.95, 1.95`。
- 验证间隔按 `0.31 * 0.82^n` 下降且不低于 `0.09s`。
- 验证只统计目标格的 `ORIGINAL_ACTION/RETRIGGER_ACTION`，不把道具自身批次当成伙伴打击。
- 验证视觉击数等于 Core 给出的实际伙伴行动总数，包括大于 8 的情况。
- 验证主场景与实验室都引用同一个库 Prefab。
- 验证三个业务 Prefab 只保存预设 ID，不再保存旧的整组参数副本。
- 验证稳定 ID 出现在动效目录。
- 运行全量 v0.5 Core/UI 契约与 TypeScript 类型检查，保证不改分数和玩法。

### Cocos 手工验收

1. Creator 标题栏/进程必须指向项目根目录，不是 `.worktrees`。
2. 打开实验室，按钮 B 和行动格 8 击强烈递进会自动循环，不需要进入正式游戏。
3. 按钮 B 使用 `Quad Out`，手感比当前 `Back Out +20%` 更短、更干脆，触摸取消和连续快点后精确归位。
4. 行动格每击逐渐放大且间隔逐渐缩短，新击不会先把卡片瞬间重置为原尺寸。
5. 旋转首方向随机，后续左右交替；强度封顶后不继续遮挡相邻行动格。
6. 正式游戏的开始、刷新和结算逻辑不变；动效不改变 Core 分数、`SettlementBatch` 或节点命中区域。
7. 关闭实验室、退出局内页面或中断连击后，目标节点恢复原缩放和原角度，没有未完成 Promise 卡住结算。

## 10. 非目标

- 不做鼠标悬停。
- 不做运行时一键写回 Prefab 的编辑器扩展。
- 不改变音效、粒子、美术图片、节点布局、锚点或颜色。
- 不把实验室场景加入正式构建。
- 不在 UI 内重新计算道具、向右链、牌型或分数。
- 不在本轮实现分数区、倍率和资源数值动画。
