> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-16
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 伙伴牌目标双相位外扩光效设计

日期：2026-07-16

参考：[Shader 实现杀戮尖塔卡牌外边框高亮效果](https://www.bilibili.com/video/BV1E5411m7AD/)

## 更正说明

前一版设计误把参考卡图底部自带的浅青装饰当成 Shader 主效果，因而实现了静态窄框和三条底部正弦曲线。逐帧核对视频最终代码后确认，参考 Shader 的主体是两层相差半个周期、持续向卡牌四周外扩并逐渐淡出的轮廓光。

本设计废弃前一版底部正弦波方案，按视频的时间函数和双相位结构重新定义效果。

## 目标

合法目标伙伴牌显示与参考视频同原理的外扩高亮：

- 光从卡牌圆角矩形边缘同时向上下左右及四个圆角外扩。
- 两层脉冲相差半个周期，前一层淡出时后一层接续，不出现整段熄灭。
- 外扩半径使用平方根时间曲线，起步快、后段减速。
- 透明度随外扩进度从高到低衰减。
- 项目配色继续使用青绿和浅青，不保留底部三条正弦曲线、星屑或宽范围常亮光块。
- Creator 编辑器和游戏运行时使用同一套 Prefab 与材质参数。

本设计只替换合法目标牌的视觉表现，不改变工具选择态、目标合法性、非法目标暗化、点击行为或 Core 数据。

## 参考算法

视频最终实现对卡牌 Alpha 在上下左右和四个对角方向进行采样。每层脉冲使用：

```text
phase = fract(time + phaseOffset)
radius = sqrt(phase) * maxExpansion
alpha = mix(startAlpha, endAlpha, phase)
```

两层的 `phaseOffset` 分别为 `0.0` 和 `0.5`。在透明像素位置，如果当前半径的八方向采样命中卡牌 Alpha，就绘制该层轮廓。

## 采用方案

项目采用与参考算法视觉和时间规律等价的圆角矩形距离场实现：

1. 使用现有圆角矩形 SDF 得到像素到卡牌外边缘的距离。
2. 用参考视频相同的 `fract`、半周期偏移、`sqrt` 半径和透明度衰减计算两层外扩脉冲。
3. 将“八方向 Alpha 采样是否命中卡牌”替换为“外部距离是否小于当前扩散半径”。
4. 用普通透明混合的等价公式在单个片元 Pass 中合成两层脉冲。

卡牌在项目中由 `bg`、`ItemIcon` 和 `ScoreText` 等多个节点组成，不能像视频的单张卡图一样直接采样完整卡牌 Alpha。距离场替换避免新增遮罩贴图和十六次纹理采样，同时对当前固定圆角矩形得到更平滑、稳定的同类结果。

不采用专用 Alpha 遮罩双 Pass 方案，因为它需要新增透明边距贴图并显著增加每像素采样次数。不采用两个 Sprite 节点 Tween，因为它不属于参考 Shader 的像素扩散算法，并会引入运行时视觉控制。

## 节点与资产结构

高亮继续使用已经落地的单节点结构：

```text
hand_card
├── bg
├── HighlightRoot
│   └── FlowBorder
├── ItemIcon
└── ScoreText
```

- `HighlightRoot` 默认 inactive，尺寸为 `116 × 156`，相对 `100 × 140` 卡牌四边各外扩 8 px。
- `FlowBorder` 铺满 `HighlightRoot`，使用 `CardTargetGlow.mtl`。
- `FlowBorder` 使用现有 `resources/gui/texture/Square.png` 白色 SpriteFrame。该资源禁止进入动态图集，使 Shader 在编辑器与运行时都获得完整 `0–1` UV。
- 渲染顺序保持在白色 `bg` 之上、`ItemIcon` 和 `ScoreText` 之下。
- 不新增粒子、遮罩贴图、动画组件或运行时材质控制组件。

## 视觉规格

### 卡牌形状和画布

- 卡牌形状：居中的 `100 × 140` 圆角矩形。
- 高亮画布：`116 × 156`。
- 高亮画布宽高比：`116 / 156 = 0.743590`。
- 卡牌宽高比：`100 / 140 = 0.714286`。
- 卡牌高度占画布高度：`140 / 156 = 0.897436`。
- 单边可用外扩空间：8 px。

### 双相位外扩

- 第一层相位偏移：`0.0`。
- 第二层相位偏移：`0.5`，固定在 Shader 内，不作为可误调参数暴露。
- 默认循环速度：每秒 1 个周期。
- 默认最大外扩：`7 / 156 = 0.044872`，对应 7 px；加抗锯齿后仍不得越过 8 px 画布边距。
- 默认抗锯齿宽度：`0.0032`，对应约 0.5 px。
- 半径曲线：`sqrt(phase) * maxExpansion`。
- 起始透明度：`0.8`。
- 结束透明度：`0.1`。
- 两层重叠时使用普通 Alpha 合成的等价式：

```text
combinedAlpha = 1 - (1 - alpha0) * (1 - alpha1)
```

光效只绘制在卡牌外部。卡面本身继续由现有 `bg`、图标和分数节点绘制，Shader 不覆盖卡面。

### 配色

- 外扩主色：`#28E887`。
- 近边缘浅青核心：`#B9FFE9`。

浅青核心只用于加强靠近卡牌边缘的能量感；两层脉冲共享同一组项目色，不再生成独立底部波纹颜色。

颜色沿外扩距离使用固定渐变：

```text
coreFactor = 1 - clamp(outsideDistance / maxExpansion, 0, 1)
finalColor = mix(glowColor, coreColor, coreFactor)
```

卡边附近偏浅青，外沿回到青绿；颜色不随相位随机变化。

## Shader 和材质参数

`CardTargetGlow.mtl` 只保留下列 Inspector 参数：

- `glowColor`：青绿外扩主色。
- `coreColor`：近边缘浅青色。
- `canvasAspectRatio`：高亮画布宽高比。
- `shapeAspectRatio`：卡牌宽高比。
- `shapeHeightScale`：卡牌高度占高亮画布比例。
- `cornerRadius`：卡牌圆角。
- `maxExpansion`：最大外扩距离，默认对应 7 px。
- `featherWidth`：外沿抗锯齿宽度。
- `cycleSpeed`：每秒循环次数。
- `startAlpha`：脉冲起始透明度。
- `endAlpha`：脉冲结束透明度。

删除前一版下列概念和参数：

- 固定窄边框和亮度沿边流动。
- `waveBandHeight`、`waveAmplitude`、`waveFrequency`、`waveLineWidth`、`waveSpeed`。
- `waveColor`、`waveHighlightColor`。
- `waveCurveMask` 和所有底部正弦曲线。

Shader 对速度、半径、透明度和圆角进行安全限幅。`maxExpansion + featherWidth` 必须小于单边画布余量，避免外扩被裁切。

默认使用普通透明混合 `src_alpha / one_minus_src_alpha`，不使用加法混合。

## 状态与数据流

现有数据流保持不变：

```text
Core 给出目标合法性
→ GameMain 进入工具选择态
→ CardViewComp.setToolTargetState(targeting, legal)
→ legal 时切换 HighlightRoot.active
```

`CardViewComp` 只负责显示或隐藏 `HighlightRoot`。不在 UI 中重复判断合法性，也不在运行时写入颜色、速度、半径或材质参数。不合法伙伴牌继续使用现有 `targetDimRoot`。

## 失败处理

- 材质或 Prefab 引用缺失属于资产接线错误，由契约测试发现。
- `HighlightRoot` 未绑定时保持当前安全行为：不显示高亮，不影响目标选择。
- 极端 Inspector 参数由 Shader 限幅，不能导致整张卡被不透明颜色覆盖或出现除零。
- 节点停用后停止绘制；重新启用时按全局时间继续双相位动画，不保存额外状态。
- 运行时若 UV 不再是 `0–1`，契约测试通过 `Square.png` 的 `packable: false` 约束阻止动态图集回归。

## 文件范围

预计修改：

- `assets/resources/common/shader/CardTargetGlow.effect`
- `assets/resources/common/shader/CardTargetGlow.mtl`
- `assets/script/game/buildscore/ui/CardViewComp.ts`，只更新 Inspector 提示文字
- `scripts/test-v04-ui-contract.js`
- `docs/superpowers/specs/2026-07-16-card-target-flow-border-design.md`
- `docs/superpowers/plans/2026-07-16-card-target-flow-border-implementation-plan.md`

`hand_card.prefab` 的现有 `116 × 156` 单节点高亮结构已经满足新方案，除非 Creator 导入验证发现材质属性序列化需要刷新，否则不修改。

不修改 Core、玩法 JSON、目标合法性、非法目标暗化、其他卡牌或局内布局。

## 验证与验收

### 自动检查

- Shader 存在两个相差 `0.5` 周期的脉冲。
- 两层半径均使用 `sqrt(phase) * maxExpansion`。
- 透明度从 `startAlpha` 衰减到 `endAlpha`。
- 两层使用普通 Alpha 的等价合成，不使用加法混合。
- Shader 不包含 `waveCurveMask`、底部正弦曲线或任何 `wave*` 参数。
- 材质只暴露本设计列出的颜色、形状、外扩、抗锯齿、速度和透明度参数。
- `HighlightRoot` 保持默认 inactive、`116 × 156` 和单个 `FlowBorder` 子节点。
- `FlowBorder` 继续使用非动态图集的完整白色 SpriteFrame。
- `CardViewComp` 只切换节点 active，不调用 `setProperty`。
- 现有玩法、UI 和工具牌快捷测试继续通过。

### Creator 与游戏检查

- 合法伙伴牌的光从四条边和四个圆角同步向外扩散，而不是只在底部运动。
- 任一时刻至少有一层脉冲可见；两层以半周期错开连续衔接。
- 在一个周期内能观察到外沿从靠近卡边移动到最大约 7 px，并同步淡出。
- 不出现前一版底部三条正弦线、随机星屑或常亮宽光块。
- 三张相邻且旋转的手牌各自扩散，图标、分数和白色卡面不被覆盖。
- 最大外扩和抗锯齿在常见分辨率下不被 `HighlightRoot` 裁切。
- Creator 场景预览与游戏运行时的颜色、扩散范围、周期和圆角一致。
- 同时显示全部合法伙伴牌时仍只有一个渲染节点，不创建粒子或每帧脚本更新。
