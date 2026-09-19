> 公开阅读版 · 远行商人 · 整理于 2026-09-19
> 日期依据：文件名日期 / 2026-05-19
> 本机绝对路径已匿名化；只保留已公开的文档与媒体链接。

# 远行商人 MVP v0.1 - Modifier（规则条目）系统设计

目标：用一套枚举型的 `trigger + condition + effects` 机制统一实现：
- 随身物（全局/底座）
- 货源强化（升级奖励，不占随身物位）
- Boss 规则（以临时 Modifier 或 code-dispatch 方式接入同一时序）

该系统的价值：后续扩内容时更多靠“配置组合”，尽量减少“每加一个道具就改一段专用代码”的维护成本。

---

## 1. 术语与范围

- Modifier：规则条目，具有触发时机、条件与效果列表
- scope：
  - `global`：全局生效
  - `slot`：绑定某个行动格（0-4）
- kind：
  - `relic`：随身物
  - `upgrade`：货源强化/升级（来源为奖励；不占随身物位）
- 触发时机：复用 v0.1 的统一时机（onRoundStart/onCardPlaced/onToolUsed/beforeScore/onScore/afterScore/onRefresh）

不在本次系统内解决：
- “完全自由的脚本/DSL” 表达（明确采用枚举型）
- 局外成长（Meta）与跨局存档（v0.1 不做）

---

## 2. 数据模型（配置）

### 2.1 文件与存放位置

- 文件：`assets/resources/config/gameplay/relics.json`
- 语义：该文件成为 “Modifier 总表”，既包含 relic 也包含 upgrade

### 2.2 Modifier schema（枚举型）

```json
{
  "id": "upgrade_gather_base_plus2",
  "name": "采集熟练",
  "kind": "upgrade",
  "scope": "global",
  "trigger": "beforeScore",
  "condition": { "type": "card_sourceType_is", "sourceType": "gather" },
  "effects": [
    { "type": "add_card_baseScore", "value": 2 }
  ],
  "description": "所有采集牌基础收益 +2"
}
```

字段说明：
- `id/name/description`：展示用字段（必须可直接展示）
- `kind`：`relic | upgrade`
- `scope`：`global | slot`
- `trigger`：触发时机枚举
- `condition`：条件对象（枚举 + 参数）
- `effects[]`：效果列表（按顺序执行）

约束：
- upgrade 不占随身物位；不进入“替换随身物”流程
- slot scope 的 modifier 必须绑定 `slotIndex`（由运行时状态保存，不写入此表）

---

## 3. 运行时模型（局内状态）

### 3.1 装备与持有

- `RunState.modifiersGlobal: string[]`：全局生效 modifier id 列表（包含 relic 与 upgrade）
- `RunState.modifiersSlot: Record<SlotIndex, string | null>`：每个行动格绑定的 modifier id（仅 slot scope）

说明：
- `modifiersGlobal` 的来源包括：获得全局随身物、获得 upgrade 奖励
- `modifiersSlot` 的来源包括：获得底座随身物后玩家选择放置到某格

### 3.2 临时规则（Boss / 临时标签）

- Boss 规则仍由 `levels.json` 引用 `bossRule` id，并在每轮/每次结算前后插入对应逻辑
- 推荐接入方式：
  - Boss 在运行时生成临时 modifier（不进存档、不进奖励池），挂到 `activeTempModifiers`
  - 或用 `bossRuleId` code-dispatch，但必须在统一时序点执行（beforeScore/onRoundStart 等）

临时标签（例如加价印 x2）属于“卡牌/格子临时状态”，不属于 Modifier 表（避免把一次性状态写回配置）。

---

## 4. 统一结算时序（事件总线）

定义一次探索轮内的关键时序点（与 v0.1 文档一致）：

1. `onRoundStart`：探索轮开始（Boss 点名、清理临时状态的准备）
2. `onCardPlaced`：放入行动格
3. `onToolUsed`：使用工具牌（以及造成的修改）
4. `beforeScore`：结算前统一收集 Modifier 影响（如树影：第5张不参与牌型）
5. `onScore`：结算中（逐个触发效果，形成“触发链”）
6. `afterScore`：结算结束（清格、移除临时标签、推进探索轮计数）
7. `onRefresh`：刷新后（狐火灯等）

执行策略：
- 每个时机点，按顺序遍历（全局 modifier → 5 个格子的 slot modifier → 临时 modifier）
- 对每个 modifier：先判定 condition，再按顺序执行 effects
- 所有“改变结算结果”的 effect 必须可被记录为触发日志（用于 UI 的结算表现与调试）

---

## 5. 枚举清单（MVP 首批）

### 5.1 triggers

- `onRoundStart`
- `onCardPlaced`
- `onToolUsed`
- `beforeScore`
- `onScore`
- `afterScore`
- `onRefresh`

### 5.2 conditions（首批）

- `always`
- `card_sourceType_is`：匹配某张卡牌的 sourceType
- `slot_index_is`：匹配某个行动格
- `pattern_is`：匹配本轮牌型
- `pattern_at_least`：牌型等级不低于某值（用于“三同源及以上”）
- `tool_id_is`：匹配某次工具牌使用
- `is_refresh_first_card`：用于“刷新后第一张”

### 5.3 effects（首批）

- `add_card_baseScore`：对目标卡的 baseScore 加法（用于货源强化）
- `add_card_score`：对目标卡本次收益加法（例如 +5）
- `multiply_card_score`：对目标卡本次收益乘法（例如 x2）
- `multiply_total_score`：对本轮总收益乘法（道具倍率）
- `add_pattern_multiplier`：对本轮牌型倍率加法（例如 +0.5）
- `repeat_card_score`：对目标卡“再结算一次”（双层箱类）

---

## 6. 奖励系统对接

`rewards.json` 的条目统一引用：
- `type = modifier`：发放一个 modifier（id 指向 relics.json 的条目），可为 relic 或 upgrade
- `type = tool_card`：加入工具牌到牌库

约束：
- 若发放的是 slot scope 的 relic，需要弹出“放置到哪个行动格”选择
- 若发放的是 global scope，则直接加入 `modifiersGlobal`
- upgrade（kind=upgrade）直接加入 `modifiersGlobal` 且不占随身物位

---

## 7. 失败/回退策略（保证可调试）

- 若配置中出现未知的 condition/effect type：应在开发环境直接报错并指明 `modifierId`
- 若 scope/trigger/参数缺失：提供最小默认值并记录 warning（或在 dev 期直接 fail-fast）
- 对每次探索轮的结算结果输出 trigger 日志，便于快速定位“为什么这轮爆了/没爆”
