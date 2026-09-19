> 公开阅读版 · 子时已到 · 整理于 2026-09-19
> 日期依据：未署日期 / 未署日期
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# TapTap H5 原生震动接入（1.0.3）

TapTap 的 H5 游戏可以使用平台提供的原生震动接口。本项目 1.0.3 已将命中反馈接入 `tap.vibrateShort({ type: "light" })`。

此前 1.0.2 仅接入了标准网页 `navigator.vibrate`，因此受到 iOS 浏览器不提供该接口的限制。这不能用来判断 TapTap 原生接口的能力。

## 官方依据

- [TapTap 官方仓库的震动文档](https://github.com/taptap/instant-games-open-mcp/blob/main/src/features/vibrate/docs.ts) 明确标注适用于小游戏和 H5；`tap` 由运行环境提供，无需安装或导入额外 SDK。
- [官方 H5 接入指南](https://github.com/taptap/instant-games-open-mcp/blob/main/src/features/vibrate/docTools.ts) 同时给出了浏览器页面按钮和游戏事件的调用示例。
- [短震动 API](https://developer.taptap.cn/minigameapidoc/dev/api/device/vibrate/tap.vibrateShort/) 说明短震动持续 15 毫秒，支持 light、medium、heavy，支持回调与 Promise；设备范围包括 iPhone 7 系列及更新设备、Android。

## 本次实现

- 微信仍优先调用 `wx.vibrateShort`；TapTap 检测并调用 `tap.vibrateShort`；缺少原生接口时才使用标准网页震动。
- 每次命中重新检测接口，因此也支持游戏启动后才注入的 TapTap 桥接对象。
- 保留 45 毫秒节流，避免同一帧的范围伤害反复震动；暂停或切后台时不触发。
- 捕获同步异常、失败回调及 Promise 拒绝。原生接口调用失败时静默结束本次反馈，避免重复震动；不以 400 毫秒长震动代替轻微命中反馈。
- 无额外远程脚本、SDK 依赖或登录流程；音效仍使用现有音频实现，包含本次新增的爆破、穿透、追踪弹发射和命中音效。

## 验证范围与真机确认

源码回归覆盖微信优先级、TapTap 原生接口、缺少网页震动接口的环境、桥接延迟注入、节流、暂停、后台以及三类失败处理。最终导出包另做静音浏览器运行测试，通过游戏实际命中检验桥接调用；音效通过离线渲染检查。

测试中的 TapTap 接口使用替身，因此只能证明代码正确调用，不能证明手机振动马达已实际工作。最终触感需要在 TapTap 客户端中打开 1.0.3 版本，完成首次点击后命中敌人确认。普通浏览器不会提供 `tap`，也不能代替 TapTap 客户端验收；旧客户端是否注入接口应以实际检测为准。

导出包及最终验证结果见 TapTap 1.0.3（工程内附件，未随本页公开）。
