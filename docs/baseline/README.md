# Pre-freeze V1/V2 历史基线资料规则

| 字段 | 内容 |
| --- | --- |
| Status | Historical — frozen point-in-time pre-freeze baseline |
| Owner | XiChuan9 |
| Created | 2026-07-28 |

## 历史用途

本目录冻结的是 Public Local Import Core 范围收缩之前的 V1/V2
point-in-time 验证背景，仅用于回答：

> V2 的显示或计算发生变化时，这是新架构回归，还是 V1 本来就这样？

它不是当前公开产品的功能清单、发布门或验收状态。当前公开范围以
[Public Local Import Core Scope Freeze](../tasks/public-local-import-core-freeze.md)
为准。仓库内只保存不包含私人运动数据的环境、代码和验证摘要。

## 可以提交

- commit SHA 和 tag；
- Node/npm/浏览器版本；
- 验证日期；
- 验证过的页面和操作；
- 已知问题；
- Demo/synthetic 数据的非识别性结果；
- Demo/synthetic 截图；
- 自动测试和 CI 链接。

## 不得提交

- 真实活动数量和完整统计；
- 真实活动名称；
- 用户姓名、头像、设备序列号；
- GPS 路线、住宅和工作地点；
- 心率、功率和详细训练流；
- 真实 Strava 页面截图；
- Token、Client ID Secret；
- 私人备份路径中的文件。

真实基线证据建议保存到：

```text
<private-evidence-root>/
```

## 冻结的历史验证页面（非当前公开范围）

以下列表只记录收缩前某个时间点曾使用的 V1/V2 最低基线。`Run Plus`
和 `NSM` 是已退出公开当前运行时的历史私有扩展；保留名称仅为解释旧
基线记录，不表示当前公开产品提供或验证这些页面。

```text
Dashboard
Activities
Run
Run Plus
NSM
Bike
Swim
Settings
Activity Detail
Map
Gear
```

每项记录 Pass/Fail/Blocked、验证方式和已知问题。未自动化的视觉检查必须明确标记为 Manual。
