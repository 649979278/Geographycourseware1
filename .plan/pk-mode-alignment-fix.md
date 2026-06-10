# PK模式底图与采集点偏移修复

## 问题描述
双人PK模式下，右屏的实际采集点比原采集点偏左。单人/闯关模式（单画幅）下采集点与标注点位完全一致，但进入双人PK后右侧点位出现水平偏移。

## 根本原因
底图图片 `images/1、底图.png` 的实际像素尺寸为 **960×720**（宽高比 1.333），而 SVG viewBox 为 **2981×2180**（宽高比 1.367）。

- `<img>` 使用 `object-fit: contain`，基于图片自然宽高比 **1.333** 做等比缩放居中
- SVG 使用 `preserveAspectRatio="xMidYMid meet"`，基于 viewBox 宽高比 **1.367** 做等比缩放居中

两者居中策略相同，但比例基准不同，导致底图可见区域与 SVG 坐标系统的可见区域存在水平偏差。单人模式容器较宽、偏差像素占比小（约0.9%），不易察觉；PK模式每个面板更窄，偏差占比更大（约1.7%），右侧点位偏移尤为明显。

## 修复方案
将底图从外部 `<img>` 元素移入 SVG 内部作为 `<image>` 元素，使底图与标记点共享同一 viewBox 和 `preserveAspectRatio`，从根本上消除对齐偏差。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `js/core/svg-map.js` | `initSvgMap()` 中新增 SVG `<image>` 元素（嵌入 defs 之后、图层组之前），设置 width=2981, height=2180, preserveAspectRatio="xMidYMid meet"；通过 MutationObserver 监听外部 `<img>` 的 src 变化，自动同步到 SVG `<image>` 的 href |
| `css/map.css` | `.base-map-img` 改为 `display: none`（保留 DOM 用于预加载和 src 同步，视觉渲染交由 SVG `<image>` 负责） |
| `terrain.html` | `syncOverlayContainer()` 和 `syncDualOverlayContainers()` 改用 `MAP_CONFIG.baseWidth/baseHeight` 计算宽高比，不再依赖 `img.naturalWidth/naturalHeight`（img 已隐藏，getBoundingClientRect 返回零值） |

### 不变的部分
- `<img>` 元素保留在 DOM 中，继续用于图层切换时的 src 更新（MutationObserver 自动同步到 SVG）
- 所有图层管理、拖拽交互、坐标采集逻辑无需改动
- `screenToSvg()` 坐标转换函数无需改动（CTM 始终正确反映 SVG 实际渲染状态）

## 验证结果
- ✅ 单人模式 SVG 底图正常渲染，CTM 缩放比与预期一致
- ✅ PK 双屏模式左右两屏底图正常渲染，bbox 完全匹配 viewBox (2981×2180)
- ✅ 图层切换时 MutationObserver 正确同步 SVG `<image>` href
- ✅ `screenToSvg()` 坐标转换在 PK 模式下右屏正确（右边缘映射到 svgX=2981）
- ✅ 单人↔PK 模式切换无回归问题
