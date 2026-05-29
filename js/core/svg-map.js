/**
 * SVG 地图引擎
 * 负责底图加载、viewBox 管理、坐标转换、经纬网绘制、标记渲染
 */

// 地图配置（根据实际底图尺寸调整）
const MAP_CONFIG = {
    baseWidth: 2981,
    baseHeight: 2180,
    baseImage: 'assets/maps/terrain-base.jpg',
    // 中国大致经纬度范围（用于绘制经纬网）
    lonRange: { min: 73, max: 135 },
    latRange: { min: 18, max: 54 },
    gridStep: 5 // 经纬线间隔（度）
};

/**
 * 初始化 SVG 地图引擎
 * @param {string} svgSelector - SVG 元素选择器
 * @returns {Object} 地图引擎实例
 */
function initSvgMap(svgSelector) {
    const svg = document.querySelector(svgSelector);
    if (!svg) throw new Error('SVG element not found: ' + svgSelector);

    // 设置 viewBox 与底图 1:1 对应
    svg.setAttribute('viewBox', `0 0 ${MAP_CONFIG.baseWidth} ${MAP_CONFIG.baseHeight}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // 创建图层组（按渲染顺序）
    const layers = {
        base: createGroup(svg, 'base-layer'),
        grid: createGroup(svg, 'grid-layer'),
        regions: createGroup(svg, 'regions-layer'),
        mountains: createGroup(svg, 'mountains-layer'),
        lines: createGroup(svg, 'lines-layer'),
        dropZones: createGroup(svg, 'dropzones-layer'),
        answers: createGroup(svg, 'answers-layer'),
        editor: createGroup(svg, 'editor-layer')
    };

    // 绘制经纬网
    drawGrid(layers.grid);

    /**
     * 在 SVG 内创建命名分组
     */
    function createGroup(parent, className) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', className);
        parent.appendChild(g);
        return g;
    }

    /**
     * 根据底图尺寸绘制经纬网
     * 采用线性映射：经纬度 → 像素坐标
     */
    function drawGrid(container) {
        const { baseWidth, baseHeight, lonRange, latRange, gridStep } = MAP_CONFIG;

        // 经纬度到像素坐标的转换函数
        function lonToX(lon) {
            return ((lon - lonRange.min) / (lonRange.max - lonRange.min)) * baseWidth;
        }
        function latToY(lat) {
            // 纬度从大到小（北在上），所以用 max - lat
            return ((latRange.max - lat) / (latRange.max - latRange.min)) * baseHeight;
        }

        // 绘制经线（竖线）
        for (let lon = Math.ceil(lonRange.min / gridStep) * gridStep; lon <= lonRange.max; lon += gridStep) {
            const x = lonToX(lon);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', 0);
            line.setAttribute('x2', x);
            line.setAttribute('y2', baseHeight);
            container.appendChild(line);

            // 经度标注（底部）
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + 4);
            text.setAttribute('y', baseHeight - 6);
            text.textContent = lon + '°E';
            container.appendChild(text);
        }

        // 绘制纬线（横线）
        for (let lat = Math.ceil(latRange.min / gridStep) * gridStep; lat <= latRange.max; lat += gridStep) {
            const y = latToY(lat);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', y);
            line.setAttribute('x2', baseWidth);
            line.setAttribute('y2', y);
            container.appendChild(line);

            // 纬度标注（左侧）
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 6);
            text.setAttribute('y', y - 4);
            text.textContent = lat + '°N';
            container.appendChild(text);
        }
    }

    /**
     * 将屏幕/鼠标坐标转换为 SVG 内部坐标
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{x: number, y: number}}
     */
    function screenToSvg(clientX, clientY) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const svgP = pt.matrixTransform(ctm.inverse());
        return { x: svgP.x, y: svgP.y };
    }

    /**
     * 在地图上添加山脉标记
     * @param {Object} mountain - 山脉数据对象
     * @param {Function} onClick - 点击回调
     */
    function addMountainMarker(mountain, onClick, visible = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'mountain-item');
        g.setAttribute('data-id', mountain.id);
        g.style.display = (visible && layers.mountains.style.display !== 'none') ? '' : 'none';

        // 圆点标记
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', mountain.point.x);
        circle.setAttribute('cy', mountain.point.y);
        circle.setAttribute('r', 7);
        circle.setAttribute('class', 'mountain-marker');
        g.appendChild(circle);

        // 标签
        if (mountain.labelPosition) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', mountain.labelPosition.x);
            text.setAttribute('y', mountain.labelPosition.y);
            text.setAttribute('class', 'mountain-label');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = mountain.name;
            g.appendChild(text);
        }

        if (onClick) {
            circle.addEventListener('click', () => onClick(mountain));
        }

        layers.mountains.appendChild(g);
        return g;
    }

    /**
     * 在地图上添加地形区边界
     * @param {Object} region - 地形区数据对象
     * @param {Function} onClick - 点击回调
     */
    function addRegionBoundary(region, onClick, visible = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'region-item');
        g.setAttribute('data-id', region.id);
        g.style.display = (visible && layers.regions.style.display !== 'none') ? '' : 'none';

        if (region.boundary && region.boundary.length >= 3) {
            const pointsStr = region.boundary.map(p => `${p.x},${p.y}`).join(' ');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('class', 'region-boundary');
            g.appendChild(polygon);

            if (onClick) {
                polygon.addEventListener('click', () => onClick(region));
            }
        }

        // 中心标签
        if (region.labelPosition) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', region.labelPosition.x);
            text.setAttribute('y', region.labelPosition.y);
            text.setAttribute('class', 'region-label');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = region.name;
            g.appendChild(text);
        }

        layers.regions.appendChild(g);
        return g;
    }

    /**
     * 添加 DropZone（目标区域提示）
     * @param {Object} item - 数据对象（需含 point/center 和 dropRadius）
     * @param {string} type - 'mountain' | 'region'
     */
    function addDropZone(item, type) {
        const cx = type === 'mountain' ? item.point.x : item.center.x;
        const cy = type === 'mountain' ? item.point.y : item.center.y;
        const r = item.dropRadius || 40;

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.setAttribute('class', 'drop-zone');
        circle.setAttribute('data-id', item.id);
        circle.setAttribute('data-type', type);

        layers.dropZones.appendChild(circle);
        return circle;
    }

    /**
     * 清除所有 DropZone
     */
    function clearDropZones() {
        layers.dropZones.innerHTML = '';
    }

    /**
     * 显示/隐藏指定 id 的标记
     */
    function setItemVisible(id, visible) {
        const selector = `[data-id="${id}"]`;
        const elems = svg.querySelectorAll(selector);
        elems.forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    }

    /**
     * 添加固定答案标记（正确放置后显示，不受图层开关控制）
     * @param {Object} item - 数据对象
     */
    function addAnswerMarker(item) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'answer-item');
        g.setAttribute('data-id', item.id);

        if (item.point) {
            // 山脉
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', item.point.x);
            circle.setAttribute('cy', item.point.y);
            circle.setAttribute('r', 9);
            circle.setAttribute('class', 'answer-marker');
            g.appendChild(circle);
        } else if (item.points && item.points.length >= 2) {
            // 线型
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const pointsStr = item.points.map(p => `${p.x},${p.y}`).join(' ');
            polyline.setAttribute('points', pointsStr);
            polyline.setAttribute('class', 'answer-marker line-answer');
            polyline.setAttribute('fill', 'none');
            g.appendChild(polyline);
        } else if (item.boundary && item.boundary.length >= 3) {
            // 地形区边界
            const pointsStr = item.boundary.map(p => `${p.x},${p.y}`).join(' ');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('class', 'answer-marker region-answer');
            g.appendChild(polygon);
        } else if (item.center) {
            // 地形区中心（无边界时）
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', item.center.x);
            circle.setAttribute('cy', item.center.y);
            circle.setAttribute('r', 9);
            circle.setAttribute('class', 'answer-marker');
            g.appendChild(circle);
        }

        // 标签
        if (item.labelPosition) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', item.labelPosition.x);
            text.setAttribute('y', item.labelPosition.y);
            text.setAttribute('class', 'answer-label');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = item.name;
            g.appendChild(text);
        }

        layers.answers.appendChild(g);
        return g;
    }

    /**
     * 清除所有固定答案标记
     */
    function clearAnswers() {
        layers.answers.innerHTML = '';
    }

    /**
     * 编辑模式：添加点击标记
     */
    function addEditorMarker(x, y, label) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 6);
        circle.setAttribute('class', 'editor-marker');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x + 10);
        text.setAttribute('y', y - 8);
        text.setAttribute('class', 'editor-label');
        text.textContent = `${label} (${Math.round(x)}, ${Math.round(y)})`;
        g.appendChild(text);

        layers.editor.appendChild(g);
        return g;
    }

    /**
     * 编辑模式：添加 dropZone 预览圈
     */
    function addEditorDropZone(x, y, r, label) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', r);
        circle.setAttribute('class', 'editor-drop-zone');
        circle.setAttribute('fill', 'rgba(255, 152, 0, 0.08)');
        circle.setAttribute('stroke', '#ff9800');
        circle.setAttribute('stroke-width', '1.5');
        circle.setAttribute('stroke-dasharray', '4,4');
        g.appendChild(circle);

        if (label) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y - r - 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'editor-label');
            text.textContent = label;
            g.appendChild(text);
        }

        layers.editor.appendChild(g);
        return g;
    }

    /**
     * 编辑模式：添加折线预览（线型采集用）
     * @param {Array} points - [{x,y}, ...]
     * @param {string} label - 标签文本
     */
    function addEditorPolyline(points, label) {
        if (!points || points.length < 1) return null;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'editor-polyline-group');

        // 绘制折线（至少2个点）
        if (points.length >= 2) {
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
            polyline.setAttribute('points', pointsStr);
            polyline.setAttribute('class', 'editor-polyline');
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', '#ff5722');
            polyline.setAttribute('stroke-width', '2');
            polyline.setAttribute('stroke-dasharray', '4,4');
            g.appendChild(polyline);
        }

        // 绘制顶点标记
        points.forEach((p, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', p.x);
            circle.setAttribute('cy', p.y);
            circle.setAttribute('r', 5);
            circle.setAttribute('class', 'editor-polyline-vertex');
            g.appendChild(circle);
        });

        // 标签（放在第一个点旁边）
        if (label && points.length) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', points[0].x + 10);
            text.setAttribute('y', points[0].y - 8);
            text.setAttribute('class', 'editor-label');
            text.textContent = label;
            g.appendChild(text);
        }

        layers.editor.appendChild(g);
        return g;
    }

    /**
     * 在地图上添加线型标记（游戏模式用）
     * @param {Object} lineData - 线型数据对象（含 points, name 等）
     * @param {Function} onClick - 点击回调
     */
    function addPolyline(lineData, onClick, visible = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'line-item');
        g.setAttribute('data-id', lineData.id);
        g.style.display = (visible && layers.lines.style.display !== 'none') ? '' : 'none';

        if (lineData.points && lineData.points.length >= 2) {
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const pointsStr = lineData.points.map(p => `${p.x},${p.y}`).join(' ');
            polyline.setAttribute('points', pointsStr);
            polyline.setAttribute('class', 'line-polyline');
            g.appendChild(polyline);

            if (onClick) {
                polyline.addEventListener('click', () => onClick(lineData));
            }
        }

        // 标签
        if (lineData.labelPosition) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lineData.labelPosition.x);
            text.setAttribute('y', lineData.labelPosition.y);
            text.setAttribute('class', 'line-label');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = lineData.name;
            g.appendChild(text);
        }

        layers.lines.appendChild(g);
        return g;
    }

    /**
     * 清除编辑模式标记
     */
    function clearEditorMarkers() {
        layers.editor.innerHTML = '';
    }

    return {
        svg,
        layers,
        screenToSvg,
        addMountainMarker,
        addRegionBoundary,
        addPolyline,
        addDropZone,
        clearDropZones,
        setItemVisible,
        addEditorMarker,
        addEditorDropZone,
        addEditorPolyline,
        clearEditorMarkers,
        addAnswerMarker,
        clearAnswers,
        config: MAP_CONFIG
    };
}
