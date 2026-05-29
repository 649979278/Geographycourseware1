# 中国的地形 — 一期代码落地计划

## Context

根据需求文档，当前 terrain.html 已实现游戏框架、编辑器、叠加图层校准等基础能力，但以下代码层面功能尚未实现：

1. **答案固定后点击查看描述不可用**：`addAnswerMarker` 无点击事件，且 `.answers-layer` 设置了 `pointer-events: none`
2. **答案固定后地形区虚线圈定缺失**：`.region-answer` 为实线，需求要求虚线
3. **地形起伏视觉效果缺失**：需求要求"最好能呈现出与地形对应的起伏的感觉"

数据补充（山脉/地形区坐标和 description）由用户后续手工维护，不在本计划范围内。

---

## 一、答案固定后点击查看描述

### 问题

- `svg-map.js` 的 `addAnswerMarker(item)` 不接收 `onClick` 参数，不绑定点击事件
- `addAnswerLine(item)` 和 `addAnswerRegion(item)` 同样缺少
- `map.css` 的 `.answers-layer` 设置了 `pointer-events: none`，阻止鼠标交互

### 修改方案

**文件：`js/core/svg-map.js`**

1. `addAnswerMarker(item)` → `addAnswerMarker(item, onClick)`
   - 在创建的 `<g>` 上绑定 `click` 事件调用 `onClick(item)`
   - 设置 `g.style.cursor = 'pointer'`

2. `addAnswerLine(item)` → `addAnswerLine(item, onClick)`
   - 同上

3. `addAnswerRegion(item)` → `addAnswerRegion(item, onClick)`
   - 同上

**文件：`terrain.html`**

修改 `handleCorrect()` 中3处调用，传入 `showDescription`：

```javascript
state.mapEngine.addAnswerMarker(answerItem, showDescription);
state.mapEngine.addAnswerLine(answerItem, showDescription);
state.mapEngine.addAnswerRegion(answerItem, showDescription);
```

**文件：`css/map.css`**

```css
.answers-layer {
    pointer-events: none;  /* 容器层不拦截 */
}
.answer-item {
    pointer-events: auto;  /* 每个答案项可点击 */
    cursor: pointer;
}
```

---

## 二、答案固定后地形区虚线圈定

### 问题

`.region-answer` 是实线边框，需求要求虚线。

### 修改

**文件：`css/map.css`**

```css
.region-answer {
    fill: rgba(76, 175, 80, 0.08);
    stroke: #4caf50;
    stroke-width: 2;
    stroke-dasharray: 8, 5;  /* 新增虚线 */
}
```

---

## 三、地形起伏视觉效果

### 方案：SVG drop-shadow 滤镜

**文件：`js/core/svg-map.js`**

在 `initSvgMap` 中初始化时，向 SVG `<defs>` 添加投影滤镜：

```javascript
const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
svg.insertBefore(defs, svg.firstChild);

const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
filter.id = 'terrain-shadow';
filter.setAttribute('x', '-20%');
filter.setAttribute('y', '-20%');
filter.setAttribute('width', '140%');
filter.setAttribute('height', '140%');
filter.innerHTML = '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>';
defs.appendChild(filter);
```

在 `addMountainMarker` 中给圆形标记应用滤镜：`circle.setAttribute('filter', 'url(#terrain-shadow)')`

**文件：`css/map.css`**

地形区边界增加阴影感：

```css
.region-boundary {
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));
}
```

---

## 四、修改文件清单

| 文件 | 修改点 |
|------|--------|
| `js/core/svg-map.js` | addAnswerMarker/Line/Region 增加 onClick 参数；SVG defs 添加阴影滤镜；mountain-marker 应用滤镜 |
| `terrain.html` | handleCorrect 传入 showDescription |
| `css/map.css` | .answer-item pointer-events + cursor；.region-answer 虚线；.region-boundary 阴影 |

---

## 五、验证

1. 山脉标注关卡 → 正确放置 → 点击答案标记 → 弹出描述弹窗（当前会显示"暂无描述"，待数据补充后显示真实内容）
2. 地形区关卡 → 正确放置 → 确认虚线边界 → 点击弹出描述
3. 确认原有功能（拖拽放置、提示、PK模式、图层开关）不受影响
4. 确认山脉标记有投影效果、地形区边界有微阴影
