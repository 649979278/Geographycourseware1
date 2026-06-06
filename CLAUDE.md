# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

中国地理教学课件 — 一个纯前端、无构建步骤的地理互动教学课件，主打拖拽标注、游戏练习和本地演示。当前已实现"中国的地形"模块，支持山脉与地形区标注。

## Development Environment

本项目无构建工具、无包管理器构建步骤、无测试框架。开发时直接编辑静态文件，通过本地 HTTP 服务器访问。

### 启动开发服务器

```bash
node server.js
```

访问 http://localhost:3000。server.js 提供静态文件服务 + `/api/save` JSON 数据写入接口（仅允许写入 `data/` 目录下的 `.json` 文件）。

### 直接打开 HTML（file:// 协议）

由于所有 JS 以传统 `<script>` 标签按顺序加载、无 ES Module，理论上可直接用浏览器打开 `index.html` 或 `terrain.html`。但 `/api/save` 接口需要 HTTP 服务器，因此编辑器模式的导出/保存功能必须走 `node server.js`。

## High-Level Architecture

### 坐标系与底图

- 底图原始尺寸固定为 **2981 x 2180** 像素，由 `MAP_CONFIG`（`js/core/svg-map.js`）定义。
- 所有地理数据（山脉点、地形区边界、线型坐标）均以此原始像素坐标系存储。
- SVG 设置 `viewBox="0 0 2981 2180"`，通过 `preserveAspectRatio="xMidYMid meet"` 自适应容器。
- 所有底图与参考图统一使用相对路径 `images/xxx`，确保项目可复制到其他机器直接运行。

### 页面结构

- `index.html` — 首页入口，目前仅"中国的地形"模块可用，其余模块（疆域、气候、河流）处于占位状态。
- `terrain.html` — 核心模块页，包含完整的游戏逻辑、编辑器面板、图层校准面板。脚本按以下顺序加载：
  1. `data/overlay-calibration.js` — 叠加图层校准数据（全局 `window.OVERLAY_CALIBRATION`）
  2. `data/mountains.js` / `data/lines.js` / `data/terrain-regions.js` — 地理数据（全局 `window.GEO_DATA`）
  3. `data/game-config.js` — 关卡配置（全局 `window.GAME_CONFIG`）
  4. `js/utils/helpers.js` — 工具函数（Toast、时间格式化、洗牌等）
  5. `js/core/svg-map.js` — SVG 地图引擎（初始化 viewBox、图层组、滤镜、坐标转换）
  6. `js/core/layers.js` — 图层管理器（底图组合切换、图层显隐控制）
  7. `js/core/overlay-engine.js` — 叠加图片引擎（Canvas 2D 三角仿射映射形变渲染参考图）
  8. 内联主逻辑 — 游戏状态机、模式切换、拖拽交互、编辑器、校准面板等

### 核心模块职责

| 文件 | 职责 |
|---|---|
| `js/core/svg-map.js` | 初始化 SVG、创建图层组（base/grid/regions/mountains/lines/dropZones/answers/editor）、坐标转换（屏幕坐标 ↔ SVG 坐标）、标记渲染（点、线、多边形）、发光/投影滤镜定义。 |
| `js/core/layers.js` | 管理图层开关状态；通过三要素组合（mountain/admin/grid）解析对应的预合成底图文件名（`images/1、底图.png` 到 `7、经纬网+山脉+省区+底图.png`）；控制 SVG 各图层组的显隐。 |
| `js/core/overlay-engine.js` | 加载山脉图/地形图/政区轮廓等参考图片，使用 Canvas 2D 进行三角仿射变换（warp）以贴合底图；提供 9 控制点拖拽校准交互；校准数据通过 `window.OVERLAY_CALIBRATION` 持久化。 |

### 游戏模式

`terrain.html` 内联脚本维护一个全局 `state` 对象，包含四种模式：

- **single（单人练习）** — 计时得分，可使用提示（扣 3 分）。
- **pk（双人 PK）** — 回合制，每人限时 20 秒，答错或超时可切换玩家。
- **challenge（闯关模式）** — 逐题闯关，答错一题即失败，每闯过一关获得 1 次提示。
- **editor（坐标采集 / 图层校准）** — 采集地理坐标点/线/边界，或校准叠加图片位置。通过 URL 参数 `?editor` 进入。

### 数据格式

地理数据以全局变量形式存储：

```js
window.GEO_DATA.mountains = [{ id, name, x, y, targetLevel: 'mountains' }, ...]
window.GEO_DATA.lines = [{ id, name, points: [{x, y}, ...], targetLevel: 'mountains' }, ...]
window.GEO_DATA.regions = [{ id, name, boundary: [{x, y}, ...], targetLevel: 'terrain-regions' }, ...]
```

`targetLevel` 字段决定该数据项属于哪个关卡（`mountains` 或 `terrain-regions`）。`lines.js` 目前承载山脉线型数据，而 `mountains.js` 为空（历史原因）。

### 叠加图片校准

`data/overlay-calibration.js` 存储每张叠加参考图的平移、缩放、透明度及 8 向 warp 偏移量。编辑器模式下可通过 9 控制点拖拽进行精细对齐，导出后覆盖此文件。

### 底图组合策略

`js/core/layers.js` 中的 `resolveBaseImage()` 将三个布尔开关（mountain、admin、grid）编码为 3 位二进制，映射到 8 张预合成底图之一。新增底图组合时需同步生成对应的 PNG 文件放入 `images/` 目录。

## Common Tasks

### 添加新的地理数据

1. 在 `terrain.html` 的编辑器模式（`?editor`）中采集坐标，或手动编辑 `data/lines.js` / `data/terrain-regions.js`。
2. 确保每条数据包含 `id`、`name`、`targetLevel`（决定归属关卡）。
3. 修改 `data/game-config.js` 中对应关卡的描述文字（如描述中的数量统计）。
4. `index.html` 首页的统计数字由运行时合并 `GEO_DATA` 自动计算，无需手动修改。

### 修改关卡配置

编辑 `data/game-config.js`：
- `terrain.levels` — 定义关卡 ID、名称、数据源、计分规则、时间限制。
- `stars` — 三星/二星/一星的判定阈值（用时、错误数）。
- `pk` — 双人 PK 的回合时长、答错是否切换玩家。

### 调整叠加图片默认位置

1. 进入编辑器模式的"图层校准"标签页。
2. 拖拽控制点或调整滑块。
3. 点击"导出校准数据"，将输出的 JSON 覆盖 `data/overlay-calibration.js` 中对应对象。

## Notes

- 无构建步骤，无测试框架，无 lint 配置。修改后直接刷新浏览器验证。
- 代码以传统脚本标签加载，无模块化系统，全局变量依赖顺序很重要。
- `terrain.html` 内联主逻辑非常庞大（约 1500+ 行），包含所有模式的业务逻辑、DOM 事件绑定和编辑器交互。新增模式或大幅改动时建议提取独立文件，但需保持 `<script>` 标签加载顺序。

## 测试规范

使用 Playwright 进行测试时，生成的截图必须放入专用子目录，禁止平铺到项目根目录或随意散落在各处。

- **统一目录**：`.playwright-mcp/screenshots/`
- **命名格式**：`{feature}-{step}-{timestamp}.png`
- **清理要求**：测试结束后及时删除不再需要的截图，避免提交到仓库
