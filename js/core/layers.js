/**
 * 图层管理器
 * 控制 SVG 内各图层的显示与隐藏
 */

/**
 * 创建图层管理器实例
 * @param {Object} mapEngine - svg-map.js 返回的地图引擎实例
 * @returns {Object} 图层管理器
 */
function createLayerManager(mapEngine) {
    const layerStates = {
        base: true,
        mountains: false,
        regions: false,
        lines: false,
        dropZones: false,
        editor: false,
        overlayMountain: false,
        overlayRegion: false
    };

    /**
     * 切换指定图层的显示状态
     * @param {string} layerName - 图层名称
     * @param {boolean} [force] - 强制设置为该状态
     * @returns {boolean} 切换后的状态
     */
    function toggle(layerName, force) {
        if (!(layerName in layerStates)) {
            console.warn('Unknown layer:', layerName);
            return false;
        }
        const newState = force !== undefined ? force : !layerStates[layerName];
        layerStates[layerName] = newState;

        // 应用到 SVG 分组
        const group = mapEngine.layers[layerName];
        if (group) {
            group.style.display = newState ? '' : 'none';

            // 对数据图层，同时控制所有直接子元素的显示状态，
            // 确保图层开关能真正显示/隐藏所有内容
            if (['mountains', 'lines', 'regions', 'dropZones'].includes(layerName)) {
                Array.from(group.children).forEach(child => {
                    child.style.display = newState ? '' : 'none';
                });
            }
        }

        // 触发 UI 更新
        updateUI(layerName, newState);

        // 山脉标记开关同时控制线型标记
        if (layerName === 'mountains') {
            toggle('lines', newState);
        }

        return newState;
    }

    /**
     * 显示图层
     */
    function show(layerName) {
        return toggle(layerName, true);
    }

    /**
     * 隐藏图层
     */
    function hide(layerName) {
        return toggle(layerName, false);
    }

    /**
     * 批量设置图层状态
     * @param {Object} states - { layerName: boolean }
     */
    function setStates(states) {
        Object.entries(states).forEach(([name, state]) => {
            toggle(name, state);
        });
    }

    /**
     * 获取当前图层状态
     */
    function getState(layerName) {
        return layerStates[layerName];
    }

    /**
     * 获取所有图层状态
     */
    function getAllStates() {
        return { ...layerStates };
    }

    /**
     * 同步 UI 控件状态
     */
    function updateUI(layerName, state) {
        const checkbox = document.querySelector(`.layer-toggle[data-layer="${layerName}"] input`);
        const toggleEl = document.querySelector(`.layer-toggle[data-layer="${layerName}"]`);
        if (checkbox) checkbox.checked = state;
        if (toggleEl) toggleEl.classList.toggle('active', state);
    }

    /**
     * 绑定页面上的图层开关控件
     */
    function bindControls() {
        document.querySelectorAll('.layer-toggle[data-layer]').forEach(el => {
            const layerName = el.dataset.layer;
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.checked = layerStates[layerName] !== false;
            el.classList.toggle('active', checkbox.checked);

            // 使用 change 事件避免 label 的浏览器默认行为与 click 冲突导致双次切换
            checkbox.addEventListener('change', () => {
                toggle(layerName, checkbox.checked);
            });
        });
    }

    return {
        toggle,
        show,
        hide,
        setStates,
        getState,
        getAllStates,
        bindControls
    };
}
