> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-07-18
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 章节图案波浪换色背景设计

日期：2026-07-18

## 1. 目标

为《远行商人》局内主界面增加一个常驻动态背景：

- 背景使用单个全屏 `Sprite + Shader`。
- 底色为轻微渐变的章节主色。
- 四种占位图标组成低对比度方格，持续向右上方缓慢滚动。
- 只在章节变化时，使用弯曲的单色波浪边界将旧章节色替换为新章节色。
- 波浪只影响背景，`Anomaly / Board / Hand / HUD / ToolTargeting` 等玩法与 UI 节点始终显示在它上方。

本功能不新建 Dialog、不添加全屏交互遮罩，不改变玩法数据或 Core 判定。

## 2. 已确认的视觉语义

参考视频的核心特征保留为：

- 图标在规整方格中循环排列，网格本身有轻微倾斜。
- 背景与图案持续缓慢移动，不因换章停止或跳位。
- 新颜色通过有明确曲线边界的波浪推进，而不是全屏线性混色。
- 波浪前后的图案 UV 完全连续；只有底色和图案染色随区域变化。

不保留参考视频的青、橙、黄三段转场，也不让背景覆盖 UI。

## 3. 推荐架构

### 3.1 单背景 Shader

新的专用 Effect 以现有 `InfiniteScrolling.effect` 为底稿，合并以下职责：

1. 从一张灰度透明图案贴图取样。
2. 控制图案重复数、错行、缩放、旋转和滚动。
3. 由章节主色生成轻微的上下或斜向渐变。
4. 在常态下只输出当前章节色。
5. 在换章时根据波浪有符号距离，选择当前章节色或目标章节色。

Shader 只接收一次过渡需要的：

- `currentColor`
- `nextColor`
- `waveProgress`

它不保存“四章四色”之类的固定数组。因此未来章节数量增长时，Shader 不需修改。

### 3.2 可扩展的章节主题数据

新增一个背景表现组件，在 Inspector 中暴露：

- `themeColors: Color[]`：按章节顺序保存主色，当前配置 4 项，未来可直接追加。
- 渐变方向和深浅强度。
- 图案透明度、染色强度、重复数、缩放和旋转。
- 滚动速度与方向。
- 波浪方向、振幅、频率、边缘柔化和持续时间。

每章只需配置一个主色。渐变、图案明暗和边缘质感由全局 Inspector 参数派生，避免每章重复维护一整套参数。

业务层只传入章节序号。组件根据 `themeColors[chapter - 1]` 选择目标颜色，不由 `GameMainViewComp` 或 Core 写死具体色值。

### 3.3 层级

背景 Sprite 保持在 `game_main` 的玩法和 UI 节点之前：

```text
game_main
├─ ChapterPatternBackground
├─ Anomaly
├─ ToolTargetDim
├─ Board
├─ Hand
├─ HUD
└─ ToolTargeting
```

波浪是 `ChapterPatternBackground` 内部的色彩分区，不是一个会遮盖 UI 的顶层节点。

## 4. 运行时数据流

### 4.1 首次进入

1. `GameMainViewComp` 获得当前章节序号。
2. 背景组件立即应用相应主色，不播放波浪。
3. 图案根据全局时间持续滚动。

### 4.2 同章切页

- 章节序号未变化时不触发波浪。
- 页面目标、地图纸景和 UI 按原流程更新。

### 4.3 换章

1. 组件保留当前主色，读取目标章节主色。
2. 将 `waveProgress` 从 0 动画到 1。
3. Shader 使用波浪边界决定每个像素显示旧色还是新色。
4. 动画期间图案坐标只使用一套全局 UV，不分别采样两张移动贴图。
5. 进度到 1 后，将目标色提升为当前色，再把 `waveProgress` 复位，画面不发生跳变。

UI 节点全程不参与换色。

## 5. 波浪形状

使用分析式曲线，不使用 `Mask` 或大尺寸波浪 PNG：

- 主推进距离由 `dot(uv, direction)` 得到。
- 在主距离上叠加两组低频正弦曲线，形成大幅圆滑起伏与轻微局部变化。
- 用 `smoothstep` 柔化边缘，避免台阶和锯齿。
- 默认方向为左下向右上，但方向、振幅和频率均由 Inspector 管理。

## 6. 图案素材

占位素材与正式素材统一使用：

`assets/resources/game/texture/background/chapter_pattern.png`

正式素材要求：

- 512×512 PNG。
- 透明背景。
- 四个灰度图标排成 2×2。
- 图标与方格明暗信息使用白色或灰度，不烘焙章节颜色。
- 四边能无缝循环，图标不贴边。

实施初期先绑定同路径占位图。后续美术直接替换该 PNG，保留尺寸和 `.meta` 即可，不需改 Prefab 或代码引用。

## 7. 异常与边界处理

- 当章节序号小于 1 或超出 `themeColors` 时，保留当前颜色并输出一次警告；不用取模方式静默复用错误颜色。
- 首次绑定没有当前颜色时，立即应用目标颜色，不从黑色或透明色播放过渡。
- 重复请求当前章节时直接忽略。
- 动画未完成又收到新章节时，只记录最新目标；当前波浪完成后再从已落定的当前色切向该目标，不并行播放多个 tween。
- 节点、Sprite 或材质未绑定时安全返回并输出精确组件名称，不影响玩法流程。

## 8. 实现边界

预计新增：

- `assets/resources/common/shader/ChapterPatternBackground.effect`
- `assets/resources/common/shader/ChapterPatternBackground.mtl`
- `assets/script/game/buildscore/ui/ChapterPatternBackgroundComp.ts`
- `assets/resources/game/texture/background/chapter_pattern.png`

预计小幅修改：

- `assets/resources/gui/prefab/game_main.prefab`
- `assets/script/game/buildscore/ui/GameMainViewComp.ts`

不修改：

- `core/v04`
- `GameSession`
- `assets/resources/config/gameplay/`
- 玩法 ID、章节目标、特别状况、奖励或结算顺序
- Board、Hand、HUD 的层级和 Inspector 参数

`game_main.prefab` 和 `GameMainViewComp.ts` 当前均有用户未提交改动。实施时必须基于当前文件小步编辑，不恢复历史 Prefab，不回退任何无关差异。

## 9. 验证

### 9.1 自动契约

增加针对背景的轻量契约测试，检查：

- Effect 与 Material 存在，材质引用正确 Effect。
- Effect 包含图案滚动、当前/目标颜色、波浪进度和宽高比参数。
- 背景组件的主题数组可扩展，不将章节数量硬编码到 Shader。
- `game_main` 中背景节点位于玩法/UI 节点之前，不复用 `ToolTargetDim`。
- 占位图存在且为 512×512 PNG。
- 不引入 Core 规则判定或新 Dialog。

### 9.2 工程验证

- `npx tsc --noEmit`
- 现有 `test:v04-ui` 与章节视觉契约仍通过。

### 9.3 Cocos 手工验收

1. Creator 3.8.7 打开唯一主体目录。
2. 720×1280 设计尺寸下背景无黑边、拉伸和图案接缝。
3. 常态图案缓慢向右上连续移动，网格角度与移动方向可分别调整。
4. 章内切页不换色；章节变化时只播放一次波浪。
5. 波浪前后图案网格对齐，滚动不停顿、不跳位。
6. Board、Hand、HUD 与工具目标态始终正常显示，不被背景波浪遮住。
7. 追加第 5 个 Inspector 主题色后，不修改 Shader 也可正常切换。

## 10. 非目标

- 不制作青、橙、黄三段顶层转场。
- 不在换章时隐藏或替换 UI。
- 不为每个章节创建独立材质或独立 Shader。
- 不让图标素材承载玩法 ID 或章节颜色。
- 不在本功能中重做地图纸景、章节 HUD 或其他视觉系统。
