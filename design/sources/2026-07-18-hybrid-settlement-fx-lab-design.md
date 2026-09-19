> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-18
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 混合结算爆裂动效实验室设计

日期：2026-07-18

## 目标

在既有 `assets/dev/particle-fx-lab/particle_fx_lab.scene` 中新增一个可反复播放的“混合爆裂”预览：普通 `ParticleSystem2D` 提供闪光、烟团和小火星；少量独立 Sprite 碎片按重力、旋转和画布边界反弹。该预览用来确认结算逐击时的打击感，暂不接入 `game_main`、行动格或结算流程。

## 参考拆解

参考视频的爆裂并非只有一种粒子：短暂亮核和烟团负责冲击轮廓，星点/小屑负责密度，而可辨识的大块碎片承担重量、飞行路径和撞边反馈。`ParticleSystem2D` 没有可供业务使用的单粒子边界碰撞回调，因此大碎片必须是独立节点，不能伪装成普通粒子。

## 结构

```text
HybridBurstPreview（实验室内的预览根）
├─ fx_cartoon_explosion_v1（现有普通粒子：亮核、烟团、火星）
└─ BouncyShardBurstComp（新组件）
   └─ 运行时 Sprite 节点池（大碎片；使用 Inspector 绑定的占位 SpriteFrame）
```

- `BouncyShardPhysics.ts`：纯 TypeScript，负责碎片数量递进、重力积分与边界反弹；不引入 `cc`，可自动测试。
- `BouncyShardBurstComp.ts`：把纯物理状态映射到池化 UI Sprite 节点。所有数量、时长、速度、重力、衰减、颜色、SpriteFrame、尺寸、边界节点和粒子根均为带 tooltip 的 Inspector 属性。
- 现有 `fx_cartoon_explosion_v1` 继续作为普通粒子层；本轮不改动其视觉参数。
- 实验室场景新增“混合爆裂”模式、强度标签和递进按钮。启动后自动从强度 1 循环到 5，让用户一眼看到碎片数量随触发次数增加。

## 运动规则

1. 每次播放先重播现有卡通爆炸，再生成 `baseShardCount + (intensity - 1) * shardCountStep` 块碎片，并限制在 `maxShardCount`。
2. 碎片从 Inspector 指定的爆点出发，随机得到方向、初速度、尺寸和角速度。
3. 每帧施加重力；到达画布边界时夹回边界、翻转对应速度，并乘以 `bounceDamping`；平行于边界的速度乘以 `wallFriction`。
4. 每块碎片最多反弹 `maxBounces` 次；寿命末段淡出、缩小并回收到节点池。
5. 同屏达到 `poolSize` 时复用最早的可用节点，不新建无限节点。

## 预览默认值

| 项目 | 默认 |
| --- | ---: |
| 强度范围 | 1–5 |
| 碎片数量 | 3 起，每级 +3，上限 15 |
| 生命周期 | 0.95s |
| 重力 | -1450 px/s² |
| 水平速度 | 420–720 px/s |
| 垂直速度 | 480–860 px/s |
| 反弹衰减 | 0.58 |
| 墙面摩擦 | 0.82 |
| 最多反弹 | 2 |
| 普通粒子 | 复用 `fx_cartoon_explosion_v1` |

以上只是实验室起点，全部可在 Inspector 中调节。

## 占位素材与未来替换

本轮复用已有 `confetti_chip.png`、`explosion_blob_a.png`、`explosion_blob_b.png` 作为占位碎片，不新增外部素材。正式美术替换时，把 4–6 张透明、有深色描边的碎片 SpriteFrame 拖入 `BouncyShardBurstComp.shardFrames`；建议准备三角片、斜四边形、弯曲碎片和小星形各一张。

## 边界与分层

- 碰撞边界采用实验室 `Canvas` 的 `UITransform`，因此表现的是画面边缘而非某个行动格矩形。
- 碎片节点在 `HybridBurstPreview` 内生成，且该根位于实验室按钮下方，确保按钮和标题可读可点。
- 不新建 Dialog、遮罩或正式局内节点。

## 非目标

- 不接入 `GameMainViewComp`、`BoardViewComp`、`game_main.prefab` 或真实结算节奏。
- 不使用每碎片一个 `RigidBody2D`，也不修改 Cocos 引擎粒子实现。
- 不修改本工作区已有的 HUD、牌型图片和背景改动。牌型图片替换为文字将作为独立的正式 UI 小步，在本实验室视觉确认后进行。

## 验收

### 自动

- 纯物理函数验证数量随强度递增并封顶。
- 纯物理函数验证右侧/上侧边界反弹、阻尼和反弹次数。
- 契约验证新组件存在 Inspector 属性、实验室提供混合模式与递进播放入口，且正式结算代码未引用该组件。

### 手动

1. 打开 `particle_fx_lab.scene`，点击“混合爆裂”。
2. 重复点击“重新播放”或“强度 +1”，可看到亮核/烟团与大碎片同时出现。
3. 大碎片到达画面边缘后最多反弹两次，不穿出边界；小火星可自然淡出。
4. 连续播放十次不残留旧碎片、不无限增生节点；标题和按钮始终可见。

