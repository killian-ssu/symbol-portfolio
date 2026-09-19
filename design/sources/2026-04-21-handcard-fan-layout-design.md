> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-04-21
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 扇形动态手牌区（方案一：纯数学计算 + ECS）设计文档

## 1. 目标与范围
在 Cocos Creator 中，基于 Oops Framework 的 ECS 架构，实现类似《杀戮尖塔》和《炉石传说》中的扇形动态手牌区。
核心目标：
- 动态排列：无论手中是 1 张牌还是 15 张牌，都能自动适应屏幕宽度并呈扇形均匀排列。
- 交互动效：当鼠标/手指悬停在某张牌上时，该卡牌放大并抬高，同时周围卡牌丝滑地向两侧避让（挤开）。
- 架构解耦：所有卡牌的位置、旋转、状态逻辑交由专门的 ECS System 进行计算和驱动。

## 2. 架构设计 (基于 Oops Framework ECS)
我们将采用纯粹的 ECS 模式，UI 层只负责渲染和抛出事件，核心计算放在 System 层。

### 2.1 Components (组件)
- `HandCardComp`: 标记一张手牌，包含卡牌的唯一 ID、配置数据等。
- `CardTransformComp`: 包含卡牌**当前**和**目标**的 X、Y、Scale、Angle（旋转角度）、ZIndex（层级）。
- `CardStateComp`: 记录卡牌当前状态，如：`Normal`（正常排列）、`Hover`（被悬停）、`Dragging`（被拖拽）、`Playing`（打出动画中）。

### 2.2 System (系统)
- `HandCardLayoutSystem`: 手牌排版系统，负责核心数学计算。
    - **触发时机**: 当手牌数量变化，或者有卡牌的状态（如 `Hover` 触发避让）发生变化时，重新计算所有卡牌的 `CardTransformComp` 的**目标值**。
- `CardTransformSystem`: 缓动执行系统。
    - **触发时机**: 每帧（`update`）或通过 Tween。负责将卡牌从**当前值**平滑地插值（Lerp）或 Tween 到 `CardTransformComp` 中计算好的**目标值**，并将结果应用到实际的 Cocos `Node` 上。

### 2.3 View (视图与交互层)
- `HandCardViewComp`: 挂载在单张手牌预制体上的脚本，仅负责监听 Cocos 原生的 `MOUSE_ENTER`, `MOUSE_LEAVE`, `TOUCH_START`, `TOUCH_MOVE` 等事件，并在触发时更新实体身上的 `CardStateComp`，从而触发 `HandCardLayoutSystem` 的重新计算。

## 3. 核心数学算法 (抛物线排版)

我们不使用复杂的贝塞尔曲线，而是使用易于计算和控制的**二次函数（抛物线）**结合**极坐标**思想来实现扇形。

### 3.1 扇形排版公式
假设手牌区中心点为原点 `(0, 0)`，当前共有 $N$ 张手牌，手牌区域最大跨度为 $W$。

1. **计算 X 坐标**: 
   - 限制最大卡牌间距。如果 $N$ 较小，间距固定；如果 $N$ 很大，计算出的总宽度超过 $W$，则压缩间距以挤在一个屏幕内。
   - 第 $i$ 张牌的 X 坐标 $x_i$ 根据间距向两边散开分布。
2. **计算 Y 坐标**: 
   - 抛物线公式：$y_i = a * x_i^2 + b$
   - $a$ 是一个极小的负数（控制抛物线开口向下，即两边的牌往下掉）。
   - $b$ 是整体 Y 轴的基准偏移。
3. **计算旋转角度 (Angle)**: 
   - 角度直接与 X 坐标成正比：$angle_i = -c * x_i$
   - $c$ 是角度系数，X 在右侧（正数），卡牌向右倾斜（负角度）；X 在左侧（负数），卡牌向左倾斜（正角度）。
4. **计算层级 (Z-Index)**:
   - 正常排版时，$i$ 越大（越靠右），Z-Index 越高（或根据你的游戏设定，从中间向两边递减）。

### 3.2 交互避让算法 (Hover 态)
当玩家悬停在第 $k$ 张牌上时：
1. **当前牌 ($k$)**:
   - `Target Y` = 抛物线原计算 Y 值 + `HoverOffset`（向上抬高）。
   - `Target Scale` = `HoverScale`（放大）。
   - `Target Angle` = 0（强制回正，方便阅读）。
   - `Z-Index` = 强制置顶（最大）。
2. **左侧牌 ($i < k$)**:
   - `Target X` = 原计算 X 值 - `PushOffset`（向左挤开）。
   - `Target Y` 和 `Target Angle` 保持抛物线原来基于未挤开时的位置（避免挤开时牌掉得太深）。
3. **右侧牌 ($i > k$)**:
   - `Target X` = 原计算 X 值 + `PushOffset`（向右挤开）。

## 4. 数据流转与测试
1. View 监听到 Hover -> 更新 Entity 的 `CardStateComp`。
2. ECS 监听到 `CardStateComp` 变化 -> 触发 `HandCardLayoutSystem`。
3. `HandCardLayoutSystem` 遍历所有手牌实体，根据上述公式计算出新的 `Target X/Y/Angle/Scale` 并写入 `CardTransformComp`。
4. `CardTransformSystem`（或全局的 Tween 管理器）读取 `Target` 值，通过 `cc.tween` 或 `Math.lerp` 让卡牌 Node 丝滑移动过去。

## 5. 预期风险与解决
- **层级闪烁问题**：当快速滑动时，多张牌的 Hover 状态切换极快，可能导致 Z-Index 频繁重排产生闪烁。
  - *解决*：在 System 中严格锁定全局只有一张牌处于 Hover 态（类似单选），且设置 Z-Index 变更的微小防抖。
- **不同分辨率适配**：抛物线的参数 $a$ 和最大宽度 $W$ 可能会在超宽屏或窄屏上表现不同。
  - *解决*：在初始化时，根据 `cc.view.getVisibleSize()` 动态计算 $W$ 和 $a$ 系数。