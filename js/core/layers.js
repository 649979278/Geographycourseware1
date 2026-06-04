/**
 * 图层管理器
 * 控制 SVG 内各图层的显示与隐藏，以及底图替换逻辑
 */

/**
 * 第二批图片目录前缀
 */
const BATCH2_BASE = '地形区图片/第二批图片/';

/**
 * 根据开关状态解析应展示的底图路径
 * @param {Object} states - 开关状态对象
 * @returns {string} 底图相对路径
 */
function resolveBaseImage(states) {
    // 优先级：12 > 11 > 8 > 基础组合/山脉
    if (states.special12) {
        return BATCH2_BASE + '12-中国行政区界线+省会+主要河流.png';
    }
    if (states.special11) {
        return BATCH2_BASE + '11-全部要素叠加.png';
    }
    if (states.special8) {
        return BATCH2_BASE + '8-底图叠加图2+4+6.png';
    }

    // 基础要素编码: 河流=bit2, 行政区=bit1, 经纬网=bit0
    const code = (states.rivers ? 4 : 0) + (states.admin ? 2 : 0) + (states.grid ? 1 : 0);

    const baseMap = {
        0: '1-底图.png',
        4: '3-底图叠加中国主要河流.png',
        2: '5-底图叠加中国行政区界线.png',
        1: '7-底图叠加经纬网.png',
        6: '8-底图叠加图2+4+6.png',
        5: '8-底图叠加图2+4+6.png',
        3: '8-底图叠加图2+4+6.png',
        7: '8-底图叠加图2+4+6.png'
    };

    let base = baseMap[code];

    // 山脉智能合并
    if (states.mountain) {
        if (code === 0) {
            base = '10-底图叠加中国山脉图.png';
        } else {
            base = '11-全部要素叠加.png';
        }
    }

    return BATCH2_BASE + base;
}

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
        overlayRegion: false,
        // 新开关状态
        rivers: false,
        admin: false,
        grid: false,
        mountain: false,
        special8: false,
        special11: false,
        special12: false
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
        // img.src 是绝对路径，newSrc 是相对路径，直接比较会永远不相等
        // 使用 getAttribute('src') 获取原始值，或比较路径末尾
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

        // 特殊开关（8/11/12）开启时，禁止其他基础底图开关
        const priorityKeys = ['special8', 'special11', 'special12'];
        const baseImageKeys = ['rivers', 'admin', 'grid', 'mountain'];
        const anyPriorityOn = priorityKeys.some(k => layerStates[k]);
        if (baseImageKeys.includes(layerName) && anyPriorityOn && newState) {
            return layerStates[layerName];
        }

        // 基础开关开启时，禁止特殊开关（8/11）开启（12除外，它有自己的独立逻辑）
        const anyBaseOn = baseImageKeys.some(k => layerStates[k]);
        if (['special8', 'special11'].includes(layerName) && anyBaseOn && newState) {
            return layerStates[layerName];
        }

        layerStates[layerName] = newState;

        // 如果切换的是新底图开关组，更新底图
        if ([...baseImageKeys, 'special8', 'special11', 'special12'].includes(layerName)) {
            updateBaseImage();
        }

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

        // 当特殊开关（8/11/12）开启时，将基础要素开关项标记为禁用样式
        const isPriorityOn = ['special8', 'special11', 'special12'].some(k => layerStates[k]);
        const baseKeys = ['rivers', 'admin', 'grid', 'mountain'];
        baseKeys.forEach(key => {
            const item = document.querySelector(`.layer-drawer [data-layer="${key}"]`);
            if (item) {
                item.classList.toggle('disabled', isPriorityOn);
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb) cb.disabled = isPriorityOn;
            }
        });

        // 当基础开关开启时，将特殊开关（8/11）标记为禁用
        const anyBaseOn = baseKeys.some(k => layerStates[k]);
        ['special8', 'special11'].forEach(key => {
            const item = document.querySelector(`.layer-drawer [data-layer="${key}"]`);
            if (item) {
                item.classList.toggle('disabled', anyBaseOn);
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb) cb.disabled = anyBaseOn;
            }
        });
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

            // 使用 change 事件避免 label 的浏览器默认行为与 click 冲突导致双次切换
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
