/**
 * 图层管理器
 * 控制 SVG 内各图层的显示与隐藏，以及底图替换逻辑
 */

/**
 * 组合底图目录前缀
 */
const IMAGE_BASE = 'images/';

/**
 * 根据开关状态解析应展示的底图路径
 * 三要素组合：mountain(山脉)=bit2, admin(省区)=bit1, grid(经纬网)=bit0
 * @param {Object} states - 开关状态对象
 * @returns {string} 底图相对路径
 */
function resolveBaseImage(states) {
    const code = (states.mountain ? 4 : 0) + (states.admin ? 2 : 0) + (states.grid ? 1 : 0);

    const baseMap = {
        0: '1、底图.png',
        1: '4、经纬网+底图.png',
        2: '3、省区+底图.png',
        3: '6、经纬网+省区+底图.png',
        4: '2、山脉+底图.png',
        5: '5、经纬网+山脉+底图.png',
        6: '7、经纬网+山脉+省区+底图.png',
        7: '7、经纬网+山脉+省区+底图.png'
    };

    return IMAGE_BASE + baseMap[code];
}

/**
 * 创建图层管理器实例
 * @param {Object} mapEngine - svg-map.js 返回的地图引擎实例
 * @returns {Object} 图层管理器
 */
function createLayerManager(mapEngine, overlayEngine) {
    const layerStates = {
        base: true,
        mountains: false,
        regions: false,
        lines: false,
        dropZones: false,
        editor: false,
        overlayMountain: false,
        overlayRegion: false,
        adminCapital: false,
        admin: false,
        grid: false,
        mountain: false
    };

    // 底图 img 元素缓存
    let baseMapImg = null;

    /**
     * 获取底图 img 元素
     */
    function getBaseMapImg() {
        if (!baseMapImg) {
            baseMapImg = document.getElementById('baseMapImg');
        }
        return baseMapImg;
    }

    /**
     * 更新底图 src
     */
    function updateBaseImage() {
        const img = getBaseMapImg();
        if (!img) return;
        const newSrc = resolveBaseImage(layerStates);
        const currentSrc = img.getAttribute('src') || '';
        if (currentSrc !== newSrc) {
            img.src = newSrc;
        }
    }

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

        // 如果切换的是底图开关组，更新底图
        if (['admin', 'grid', 'mountain'].includes(layerName)) {
            updateBaseImage();
        }

        // 行政区省会叠加图控制
        if (layerName === 'adminCapital' && overlayEngine) {
            overlayEngine.setVisible('adminCapital', newState);
        }

        // 应用到 SVG 分组
        const group = mapEngine.layers[layerName];
        if (group) {
            group.style.display = newState ? '' : 'none';

            // 对数据图层，同时控制所有直接子元素的显示状态
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
     * 获取当前应展示的底图路径
     */
    function getBaseImagePath() {
        return resolveBaseImage(layerStates);
    }

    /**
     * 同步 UI 控件状态
     */
    function updateUI(layerName, state) {
        // 更新旧式 toolbar checkbox（兼容）
        const checkbox = document.querySelector(`.layer-toggle[data-layer="${layerName}"] input`);
        const toggleEl = document.querySelector(`.layer-toggle[data-layer="${layerName}"]`);
        if (checkbox) checkbox.checked = state;
        if (toggleEl) toggleEl.classList.toggle('active', state);

        // 更新抽屉面板 checkbox
        const drawerCheckbox = document.querySelector(`.layer-drawer [data-layer="${layerName}"] input[type="checkbox"]`);
        const drawerItem = document.querySelector(`.layer-drawer [data-layer="${layerName}"]`);
        if (drawerCheckbox) drawerCheckbox.checked = state;
        if (drawerItem) drawerItem.classList.toggle('active', state);
    }

    /**
     * 绑定页面上的图层开关控件（包括抽屉面板）
     */
    function bindControls() {
        // 绑定旧式 toolbar 控件（兼容）
        document.querySelectorAll('.layer-toggle[data-layer]').forEach(el => {
            const layerName = el.dataset.layer;
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.checked = layerStates[layerName] !== false;
            el.classList.toggle('active', checkbox.checked);

            checkbox.addEventListener('change', () => {
                toggle(layerName, checkbox.checked);
            });
        });

        // 绑定抽屉面板控件
        document.querySelectorAll('.layer-drawer [data-layer]').forEach(el => {
            const layerName = el.dataset.layer;
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.checked = layerStates[layerName] !== false;
            el.classList.toggle('active', checkbox.checked);

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
        getBaseImagePath,
        bindControls
    };
}
