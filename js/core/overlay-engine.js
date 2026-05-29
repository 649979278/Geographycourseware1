/**
 * 叠加图片引擎
 * 负责参考图片的加载、校准、Canvas 2D 三角仿射映射形变渲染
 */

/* ============================================================
   Warp 数学工具（从参考代码复用）
   ============================================================ */

function getWarpHandleKeys() {
    return [
        'topLeft', 'topCenter', 'topRight', 'rightCenter',
        'bottomCenter', 'bottomLeft', 'leftCenter', 'bottomRight'
    ];
}

function createDefaultLayerWarp() {
    return getWarpHandleKeys().reduce((result, key) => {
        result[key] = { x: 0, y: 0 };
        return result;
    }, {});
}

function normalizeWarpHandlePoint(value) {
    const safeValue = value || {};
    return {
        x: Number.isFinite(safeValue.x) ? safeValue.x : 0,
        y: Number.isFinite(safeValue.y) ? safeValue.y : 0
    };
}

function normalizeLayerWarp(value) {
    const safeValue = value || {};
    return getWarpHandleKeys().reduce((result, key) => {
        result[key] = normalizeWarpHandlePoint(safeValue[key]);
        return result;
    }, {});
}

function createWarpHandlePoints(viewport, warp) {
    const safeWarp = normalizeLayerWarp(warp);
    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;
    return [
        { key: 'topLeft',    x: viewport.x + safeWarp.topLeft.x,    y: viewport.y + safeWarp.topLeft.y },
        { key: 'topCenter',  x: viewport.x + halfWidth + safeWarp.topCenter.x,  y: viewport.y + safeWarp.topCenter.y },
        { key: 'topRight',   x: viewport.x + viewport.width + safeWarp.topRight.x,   y: viewport.y + safeWarp.topRight.y },
        { key: 'rightCenter',x: viewport.x + viewport.width + safeWarp.rightCenter.x, y: viewport.y + halfHeight + safeWarp.rightCenter.y },
        { key: 'bottomRight',x: viewport.x + viewport.width + safeWarp.bottomRight.x, y: viewport.y + viewport.height + safeWarp.bottomRight.y },
        { key: 'bottomCenter',x: viewport.x + halfWidth + safeWarp.bottomCenter.x, y: viewport.y + viewport.height + safeWarp.bottomCenter.y },
        { key: 'bottomLeft', x: viewport.x + safeWarp.bottomLeft.x, y: viewport.y + viewport.height + safeWarp.bottomLeft.y },
        { key: 'leftCenter', x: viewport.x + safeWarp.leftCenter.x, y: viewport.y + halfHeight + safeWarp.leftCenter.y }
    ];
}

function createWarpOutlinePoints(viewport, warp) {
    return createWarpHandlePoints(viewport, warp).map(p => ({ x: p.x, y: p.y }));
}

function createWarpDragSession(handleKey, startPoint, initialWarp) {
    return {
        handleKey,
        startPoint: { x: startPoint.x, y: startPoint.y },
        initialWarp: normalizeLayerWarp(initialWarp)
    };
}

function applyWarpDragDelta(session, currentPoint, options) {
    const nextWarp = normalizeLayerWarp(session.initialWarp);
    const sensitivity = Number.isFinite(options?.sensitivity) ? options.sensitivity : 0.35;
    const dx = (currentPoint.x - session.startPoint.x) * sensitivity;
    const dy = (currentPoint.y - session.startPoint.y) * sensitivity;
    nextWarp[session.handleKey] = {
        x: Number((nextWarp[session.handleKey].x + dx).toFixed(2)),
        y: Number((nextWarp[session.handleKey].y + dy).toFixed(2))
    };
    return nextWarp;
}

function clampLayerWarp(warp, viewport) {
    const safeWarp = normalizeLayerWarp(warp);
    const width = Number.isFinite(viewport?.width) ? viewport.width : 100;
    const height = Number.isFinite(viewport?.height) ? viewport.height : 100;
    const limitX = Math.max(8, width * 1.2);
    const limitY = Math.max(8, height * 1.2);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    return getWarpHandleKeys().reduce((result, key) => {
        result[key] = {
            x: Number(clamp(safeWarp[key].x, -limitX, limitX).toFixed(2)),
            y: Number(clamp(safeWarp[key].y, -limitY, limitY).toFixed(2))
        };
        return result;
    }, {});
}

function hasActiveWarp(warp) {
    const safeWarp = normalizeLayerWarp(warp);
    return getWarpHandleKeys().some(key => Math.abs(safeWarp[key].x) > 0.01 || Math.abs(safeWarp[key].y) > 0.01);
}

/* ============================================================
   Canvas 渲染工具（从参考代码复用）
   ============================================================ */

const warpImageCache = new Map();

function getCachedWarpImage(src) {
    if (!warpImageCache.has(src)) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        warpImageCache.set(src, img);
    }
    return warpImageCache.get(src);
}

function createWarpGridPoints(warp, canvasWidth, canvasHeight) {
    const handlePoints = createWarpHandlePoints({ x: 0, y: 0, width: 100, height: 100 }, warp).reduce((result, point) => {
        result[point.key] = {
            x: (point.x / 100) * canvasWidth,
            y: (point.y / 100) * canvasHeight
        };
        return result;
    }, {});
    const center = {
        x: (handlePoints.topCenter.x + handlePoints.bottomCenter.x + handlePoints.leftCenter.x + handlePoints.rightCenter.x) / 4,
        y: (handlePoints.topCenter.y + handlePoints.bottomCenter.y + handlePoints.leftCenter.y + handlePoints.rightCenter.y) / 4
    };
    return [
        [handlePoints.topLeft, handlePoints.topCenter, handlePoints.topRight],
        [handlePoints.leftCenter, center, handlePoints.rightCenter],
        [handlePoints.bottomLeft, handlePoints.bottomCenter, handlePoints.bottomRight]
    ];
}

function createSourceGridPoints(image, viewport) {
    const sx = (viewport.x / 100) * image.naturalWidth;
    const sy = (viewport.y / 100) * image.naturalHeight;
    const sw = (viewport.width / 100) * image.naturalWidth;
    const sh = (viewport.height / 100) * image.naturalHeight;
    const halfWidth = sw / 2;
    const halfHeight = sh / 2;
    return [
        [{ x: sx, y: sy }, { x: sx + halfWidth, y: sy }, { x: sx + sw, y: sy }],
        [{ x: sx, y: sy + halfHeight }, { x: sx + halfWidth, y: sy + halfHeight }, { x: sx + sw, y: sy + halfHeight }],
        [{ x: sx, y: sy + sh }, { x: sx + halfWidth, y: sy + sh }, { x: sx + sw, y: sy + sh }]
    ];
}

function drawWarpGrid(context, image, sourceGrid, destinationGrid) {
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const s00 = sourceGrid[row][col];
            const s01 = sourceGrid[row][col + 1];
            const s10 = sourceGrid[row + 1][col];
            const s11 = sourceGrid[row + 1][col + 1];
            const d00 = destinationGrid[row][col];
            const d01 = destinationGrid[row][col + 1];
            const d10 = destinationGrid[row + 1][col];
            const d11 = destinationGrid[row + 1][col + 1];
            drawImageTriangle(context, image, s00, s01, s10, d00, d01, d10);
            drawImageTriangle(context, image, s10, s01, s11, d10, d01, d11);
        }
    }
}

function drawImageTriangle(context, image, sourceA, sourceB, sourceC, destA, destB, destC) {
    const denominator = (
        sourceA.x * (sourceB.y - sourceC.y) +
        sourceB.x * (sourceC.y - sourceA.y) +
        sourceC.x * (sourceA.y - sourceB.y)
    );
    if (Math.abs(denominator) < 0.0001) return;

    const matrix = {
        a: (destA.x * (sourceB.y - sourceC.y) + destB.x * (sourceC.y - sourceA.y) + destC.x * (sourceA.y - sourceB.y)) / denominator,
        b: (destA.y * (sourceB.y - sourceC.y) + destB.y * (sourceC.y - sourceA.y) + destC.y * (sourceA.y - sourceB.y)) / denominator,
        c: (destA.x * (sourceC.x - sourceB.x) + destB.x * (sourceA.x - sourceC.x) + destC.x * (sourceB.x - sourceA.x)) / denominator,
        d: (destA.y * (sourceC.x - sourceB.x) + destB.y * (sourceA.x - sourceC.x) + destC.y * (sourceB.x - sourceA.x)) / denominator,
        e: (destA.x * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) + destB.x * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) + destC.x * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) / denominator,
        f: (destA.y * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) + destB.y * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) + destC.y * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) / denominator
    };

    context.save();
    context.beginPath();
    context.moveTo(destA.x, destA.y);
    context.lineTo(destB.x, destB.y);
    context.lineTo(destC.x, destC.y);
    context.closePath();
    context.clip();
    context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    context.drawImage(image, 0, 0);
    context.restore();
}

/* ============================================================
   Overlay 引擎
   ============================================================ */

function createOverlayEngine(config) {
    const container = config.container;
    const baseWidth = config.baseWidth || 2981;
    const baseHeight = config.baseHeight || 2180;

    const state = {
        data: {},
        images: {},
        visible: new Set(),
        calibration: {
            activeLayerId: null,
            activeHandleKey: null,
            dragSession: null,
            showHandles: true
        },
        onChange: config.onChange || null
    };

    const defaultData = {
        mountainBlank: {
            src: config.mountainSrc || '地形区图片/中国的山脉.jpg',
            x: 0, y: 0, width: 100, height: 100, opacity: 0.8, scale: 1.0,
            warp: createDefaultLayerWarp()
        },
        terrainRegion: {
            src: config.regionSrc || '地形区图片/中国地形图.jpg',
            x: 0, y: 0, width: 100, height: 100, opacity: 0.8, scale: 1.0,
            warp: createDefaultLayerWarp()
        }
    };

    function loadOverlays(externalData) {
        const raw = externalData || {};
        state.data = {};
        Object.keys(defaultData).forEach(key => {
            const def = defaultData[key];
            const ext = raw[key] || {};
            state.data[key] = {
                src: ext.src || def.src,
                x: Number.isFinite(ext.x) ? ext.x : def.x,
                y: Number.isFinite(ext.y) ? ext.y : def.y,
                width: Number.isFinite(ext.width) ? ext.width : def.width,
                height: Number.isFinite(ext.height) ? ext.height : def.height,
                opacity: Number.isFinite(ext.opacity) ? ext.opacity : def.opacity,
                scale: Number.isFinite(ext.scale) ? ext.scale : def.scale,
                warp: normalizeLayerWarp(ext.warp)
            };
            preloadImage(state.data[key].src);
        });
    }

    function preloadImage(src) {
        if (!state.images[src]) {
            state.images[src] = getCachedWarpImage(src);
        }
    }

    function setVisible(layerId, visible) {
        if (visible) {
            state.visible.add(layerId);
        } else {
            state.visible.delete(layerId);
        }
        renderOverlays();
    }

    function isVisible(layerId) {
        return state.visible.has(layerId);
    }

    function getContainerSize() {
        const rect = container.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    function renderOverlays() {
        // 清空容器
        container.innerHTML = '';
        const size = getContainerSize();
        if (!size.width || !size.height) return;

        state.visible.forEach(layerId => {
            const layer = state.data[layerId];
            if (!layer) return;
            const image = state.images[layer.src];
            if (!image) return;

            const scale = Number.isFinite(layer.scale) ? layer.scale : 1;
            const scaledWidth = layer.width * scale;
            const scaledHeight = layer.height * scale;
            const offsetX = (layer.width - scaledWidth) / 2;
            const offsetY = (layer.height - scaledHeight) / 2;
            const left = ((layer.x + offsetX) / 100) * size.width;
            const top = ((layer.y + offsetY) / 100) * size.height;
            const width = (scaledWidth / 100) * size.width;
            const height = (scaledHeight / 100) * size.height;

            if (!hasActiveWarp(layer.warp)) {
                // 无变形：使用简单 img
                const img = document.createElement('img');
                img.className = 'overlay-canvas';
                img.src = layer.src;
                img.style.position = 'absolute';
                img.style.left = left + 'px';
                img.style.top = top + 'px';
                img.style.width = width + 'px';
                img.style.height = height + 'px';
                img.style.opacity = layer.opacity;
                img.style.pointerEvents = 'none';
                container.appendChild(img);
            } else {
                // 有变形：使用 Canvas
                const canvas = document.createElement('canvas');
                canvas.className = 'overlay-canvas';
                canvas.style.position = 'absolute';
                canvas.style.left = left + 'px';
                canvas.style.top = top + 'px';
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.style.opacity = layer.opacity;
                canvas.style.pointerEvents = 'none';
                canvas.width = Math.max(1, Math.round(width));
                canvas.height = Math.max(1, Math.round(height));

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const render = () => {
                    if (!image.naturalWidth || !image.naturalHeight) return;
                    const viewport = { x: 0, y: 0, width: 100, height: 100 };
                    const safeWarp = clampLayerWarp(layer.warp, viewport);
                    const destGrid = createWarpGridPoints(safeWarp, canvas.width, canvas.height);
                    const srcGrid = createSourceGridPoints(image, viewport);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    drawWarpGrid(ctx, image, srcGrid, destGrid);
                };

                if (image.complete && image.naturalWidth && image.naturalHeight) {
                    render();
                } else {
                    image.addEventListener('load', render, { once: true });
                }

                container.appendChild(canvas);
            }
        });
    }

    function getCalibrationData() {
        return JSON.parse(JSON.stringify(state.data));
    }

    function setCalibrationData(key, field, value) {
        if (!state.data[key]) return;
        if (field === 'warp') {
            state.data[key].warp = normalizeLayerWarp(value);
        } else if (['x', 'y', 'width', 'height', 'opacity', 'scale'].includes(field)) {
            state.data[key][field] = Number(value);
        }
        renderOverlays();
        if (state.onChange) state.onChange(getCalibrationData());
    }

    function updateWarpFromDrag(layerId, handleKey, startPoint, currentPoint, options) {
        if (!state.data[layerId]) return;
        const session = createWarpDragSession(handleKey, startPoint, state.data[layerId].warp);
        const nextWarp = applyWarpDragDelta(session, currentPoint, options);
        state.data[layerId].warp = clampLayerWarp(nextWarp, { width: 100, height: 100 });
        renderOverlays();
        if (state.onChange) state.onChange(getCalibrationData());
        return state.data[layerId].warp;
    }

    function updateViewportFromDrag(layerId, dx, dy) {
        if (!state.data[layerId]) return;
        const layer = state.data[layerId];
        layer.x += dx;
        layer.y += dy;
        renderOverlays();
        if (state.onChange) state.onChange(getCalibrationData());
    }

    function exportCalibration() {
        const data = getCalibrationData();
        return `window.OVERLAY_CALIBRATION = ${JSON.stringify(data, null, 2)};\n`;
    }

    function resetLayer(layerId) {
        if (!defaultData[layerId]) return;
        const def = defaultData[layerId];
        state.data[layerId] = {
            src: def.src,
            x: def.x, y: def.y,
            width: def.width, height: def.height,
            opacity: def.opacity,
            scale: def.scale,
            warp: createDefaultLayerWarp()
        };
        renderOverlays();
        if (state.onChange) state.onChange(getCalibrationData());
    }

    function resetAll() {
        Object.keys(defaultData).forEach(key => resetLayer(key));
    }

    /* --------------------------------------------------------
       校准控制点渲染（返回 HTML 容器元素）
       -------------------------------------------------------- */
    function createCalibrationHandles(layerId) {
        const layer = state.data[layerId];
        if (!layer || !state.calibration.showHandles) return null;

        const containerSize = getContainerSize();
        if (!containerSize.width || !containerSize.height) return null;

        // 使用与 renderOverlays 一致的实际渲染 viewport（考虑 scale 带来的中心偏移）
        const layerScale = Number.isFinite(layer.scale) ? layer.scale : 1;
        const scaledWidth = layer.width * layerScale;
        const scaledHeight = layer.height * layerScale;
        const offsetX = (layer.width - scaledWidth) / 2;
        const offsetY = (layer.height - scaledHeight) / 2;
        const viewport = {
            x: layer.x + offsetX,
            y: layer.y + offsetY,
            width: scaledWidth,
            height: scaledHeight
        };

        // Warp 值是相对于图层自身尺寸的百分比，需先转为容器百分比
        const safeWarp = normalizeLayerWarp(layer.warp);
        const wpx = (key) => safeWarp[key].x * (viewport.width / 100);
        const wpy = (key) => safeWarp[key].y * (viewport.height / 100);

        const handleDefs = [
            { key: 'topLeft',     pctX: viewport.x + wpx('topLeft'),     pctY: viewport.y + wpy('topLeft') },
            { key: 'topCenter',   pctX: viewport.x + viewport.width / 2 + wpx('topCenter'),   pctY: viewport.y + wpy('topCenter') },
            { key: 'topRight',    pctX: viewport.x + viewport.width + wpx('topRight'),    pctY: viewport.y + wpy('topRight') },
            { key: 'rightCenter', pctX: viewport.x + viewport.width + wpx('rightCenter'), pctY: viewport.y + viewport.height / 2 + wpy('rightCenter') },
            { key: 'bottomRight', pctX: viewport.x + viewport.width + wpx('bottomRight'), pctY: viewport.y + viewport.height + wpy('bottomRight') },
            { key: 'bottomCenter',pctX: viewport.x + viewport.width / 2 + wpx('bottomCenter'), pctY: viewport.y + viewport.height + wpy('bottomCenter') },
            { key: 'bottomLeft',  pctX: viewport.x + wpx('bottomLeft'),  pctY: viewport.y + viewport.height + wpy('bottomLeft') },
            { key: 'leftCenter',  pctX: viewport.x + wpx('leftCenter'),  pctY: viewport.y + viewport.height / 2 + wpy('leftCenter') }
        ];

        const centerX = viewport.x + viewport.width / 2;
        const centerY = viewport.y + viewport.height / 2;

        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'calibration-handles-layer';
        handlesContainer.style.position = 'absolute';
        handlesContainer.style.inset = '0';
        handlesContainer.style.pointerEvents = 'none';
        handlesContainer.style.overflow = 'visible';
        handlesContainer.style.zIndex = '10';

        // 轮廓线（使用内部 SVG，viewBox 0-100 百分比坐标，无需坐标转换）
        const svgNS = 'http://www.w3.org/2000/svg';
        const outlineSvg = document.createElementNS(svgNS, 'svg');
        outlineSvg.setAttribute('viewBox', '0 0 100 100');
        outlineSvg.setAttribute('preserveAspectRatio', 'none');
        outlineSvg.style.position = 'absolute';
        outlineSvg.style.inset = '0';
        outlineSvg.style.width = '100%';
        outlineSvg.style.height = '100%';
        outlineSvg.style.overflow = 'visible';
        outlineSvg.style.pointerEvents = 'none';

        const pointsStr = handleDefs.map(d => `${d.pctX},${d.pctY}`).join(' ');
        const outline = document.createElementNS(svgNS, 'polygon');
        outline.setAttribute('points', pointsStr);
        outline.setAttribute('class', 'warp-outline');
        outlineSvg.appendChild(outline);
        handlesContainer.appendChild(outlineSvg);

        // 控制点
        const baseSize = Math.max(6, Math.min(containerSize.width, containerSize.height) * 0.012);
        const hitSize = baseSize * 3;

        [...handleDefs, { key: 'center', pctX: centerX, pctY: centerY }].forEach(def => {
            const g = document.createElement('div');
            g.className = 'warp-handle-group' + (def.key === 'center' ? ' center' : '');
            g.dataset.handleKey = def.key;
            g.style.position = 'absolute';
            g.style.left = `calc(${def.pctX}% - ${hitSize / 2}px)`;
            g.style.top = `calc(${def.pctY}% - ${hitSize / 2}px)`;
            g.style.width = `${hitSize}px`;
            g.style.height = `${hitSize}px`;
            g.style.pointerEvents = 'auto';
            g.style.cursor = 'grab';
            g.style.zIndex = '11';
            g.style.display = 'flex';
            g.style.alignItems = 'center';
            g.style.justifyContent = 'center';

            const dot = document.createElement('div');
            dot.className = 'warp-handle' + (def.key === 'center' ? ' center' : '');
            dot.style.width = `${baseSize}px`;
            dot.style.height = `${baseSize}px`;
            dot.style.borderRadius = '50%';
            dot.style.background = def.key === 'center' ? '#2196f3' : '#ff5722';
            dot.style.border = '2px solid #fff';
            dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
            dot.style.pointerEvents = 'none';

            g.appendChild(dot);
            handlesContainer.appendChild(g);
        });

        return handlesContainer;
    }

    return {
        loadOverlays,
        setVisible,
        isVisible,
        renderOverlays,
        getCalibrationData,
        setCalibrationData,
        updateWarpFromDrag,
        updateViewportFromDrag,
        exportCalibration,
        resetLayer,
        resetAll,
        createCalibrationHandles,
        get state() { return state; }
    };
}
