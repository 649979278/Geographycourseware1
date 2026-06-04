# 地形模块底图切换与图层开关重设计划

## Context
当前地形教学课件使用 `assets/maps/terrain-base.jpg` 作为单一底图，通过顶部 toolbar 的 checkbox 控制 SVG 图层和 overlay 图层的显隐。现需统一切换到第二批预合成图片目录，并重新设计开关 UI 与底图映射逻辑。

第二批图片共 12 张，其中 8 张含底图可直接替换，4 张为白色背景不透明图不能直接覆盖叠加，因此所有展示必须通过预合成图实现。

## Design Decisions
1. **UI 布局**：方案 A（右侧抽屉面板）。顶部 toolbar 保留「🗺️ 图层」按钮，点击展开右侧固定抽屉面板，分组展示开关。
2. **开关分组**：
   - **基础要素组**（可多选）：河流、行政区界线、经纬网
   - **叠加要素组**（独立开关）：山脉图
   - **特殊组合**（独立开关）：行政区+省会+河流 (12号)
3. **山脉智能合并**：开启山脉时，若基础要素全关则展示 `10-底图+山脉`；若基础要素有任一开，则自动合并为 `11-全部要素叠加`。
4. **12 号开关**：独立优先级最高，开启时直接展示 12 号图，其他基础/叠加开关暂时失效或隐藏。
5. **基础要素降级**：三位开关（河流/行政区/经纬网）的组合若缺少精确预合成图（如仅河流+行政区无经纬网），统一降级到 `8-底图+河流+行政区+经纬网`。

## Algorithm

```
function resolveBaseImage(states):
  if states.special12: return '地形区图片/第二批图片/12-中国行政区界线+省会+主要河流.png'

  code = (states.rivers ? 4 : 0) + (states.admin ? 2 : 0) + (states.grid ? 1 : 0)

  baseMap = {
    0: '1-底图.png',
    4: '3-底图叠加中国主要河流.png',
    2: '5-底图叠加中国行政区界线.png',
    1: '7-底图叠加经纬网.png',
    6: '8-底图叠加图2+4+6.png',
    5: '8-底图叠加图2+4+6.png',
    3: '8-底图叠加图2+4+6.png',
    7: '8-底图叠加图2+4+6.png'
  }

  base = baseMap[code]

  if states.mountain:
    if code == 0: base = '10-底图叠加中国山脉图.png'
    else: base = '11-全部要素叠加.png'

  return '地形区图片/第二批图片/' + base
```

## Files to Modify

### 1. `terrain.html`
- **toolbar 区域**（约第 14-41 行）：将现有多个 `layer-toggle` checkbox 替换为单个「🗺️ 图层」按钮。
- **新增抽屉面板**：在 `</body>` 前或主容器内新增右侧固定抽屉面板 DOM，包含三组开关（checkbox + label）。
- **底图 img 标签**（约第 99 行）：将 `src="assets/maps/terrain-base.jpg"` 改为动态设置，初始加载 `1-底图.png`。
- **校准面板下拉框**（约第 235-238 行）：`<select id="calibrationLayerSelect">` 新增 `<option value="adminOutline">完整政区轮廓</option>`。
- **editor 面板样式**：确保抽屉面板在 editor 模式下也能正常显示和操作。

### 2. `js/core/layers.js`（重写核心逻辑）
- 将 `layerStates` 扩展为新开关状态：`rivers`, `admin`, `grid`, `mountain`, `special12`。
- 新增 `resolveBaseImage(states)` 函数实现上述算法。
- 修改 `toggle()`：每次开关状态变更后，调用 `resolveBaseImage` 计算新底图路径，更新 `document.getElementById('baseMapImg').src`。
- 保留对 SVG 分组（mountains, regions, lines, dropZones 等）的显隐控制，因为这些是游戏交互标记，不依赖底图替换。
- `bindControls()` 改为绑定抽屉面板内的 checkbox。
- 新增 `getBaseImagePath()` 供外部（如坐标采集、校准模式）获取当前底图路径。

### 3. `js/core/svg-map.js`
- `MAP_CONFIG.baseImage` 初始值改为 `'地形区图片/第二批图片/1-底图.png'`。
- `baseWidth` / `baseHeight` 需确认新图片尺寸是否与旧图一致（2981x2180）。若不一致需更新。

### 4. `data/overlay-calibration.js`
- 新增 `adminOutline` 配置项：
  ```js
  "adminOutline": {
    "src": "地形区图片/完整中国政区轮廓.jpg",
    "x": 0, "y": 0, "width": 100, "height": 100,
    "opacity": 0.75, "scale": 1,
    "warp": { ... }
  }
  ```
- 初始 warp 值可设为全零，后续通过校准模式调整。

### 5. `css/map.css`
- 新增 `.layer-drawer` 样式：固定定位右侧，宽度 260px，背景色、阴影、滚动支持。
- 新增 `.layer-drawer-toggle`（顶部按钮）样式。
- 新增 `.layer-group` 样式：分组标题、开关项间距。
- 移除或保留旧 `.layer-toggle` 样式（若旧 toolbar 样式不再使用可移除，为安全起见建议保留旧 CSS 类名以防其他页面复用）。

## Backward Compatibility
- 游戏核心逻辑（拖拽、判定、计分）基于 SVG 坐标系统，与底图替换解耦，不受影响。
- 原有的 `mountainBlank` / `terrainRegion` overlay 校准逻辑保持不变，仅在底图替换为第二批图片后叠加显示。
- 旧底图文件 `assets/maps/terrain-base.jpg` 可保留，也可清理（建议保留以防回退）。

## Testing / Verification
1. 启动本地服务器或直接打开 `terrain.html`。
2. 验证默认加载 `1-底图.png`。
3. 依次测试抽屉面板中每个开关：
   - 单独开河流 → 应为 `3-...`
   - 单独开行政区 → 应为 `5-...`
   - 单独开经纬网 → 应为 `7-...`
   - 同时开河流+行政区 → 应为 `8-...`
   - 开山脉（基础全关）→ 应为 `10-...`
   - 开山脉（基础有开）→ 应为 `11-...`
   - 开 12 号 → 应为 `12-...`
4. 进入「坐标采集」模式，确认底图开关仍可操作。
5. 进入「图层校准」模式，确认底图随开关切换，且新增「完整政区轮廓」选项可正常加载和校准。
6. 运行单人练习和双人 PK，确认游戏功能无回归。

## 计划外考虑
- 若第二批图片 `1-底图.png` 的分辨率与旧底图不同，所有基于 `baseWidth/baseHeight` 的坐标数据需重新校准。本计划假设分辨率一致。
- 若 `12-中国行政区界线+省会+主要河流.png` 实际不含底图，算法需调整为叠加逻辑（技术上不可行，因白色不透明）。当前计划基于用户确认「12 含底图」。
