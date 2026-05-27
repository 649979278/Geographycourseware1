/**
 * 通用工具函数集合
 * 以传统脚本方式提供，兼容 file:// 协议下的无构建环境
 */

/**
 * 防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟毫秒数
 * @returns {Function}
 */
function debounce(fn, delay = 200) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 节流函数
 * @param {Function} fn - 要执行的函数
 * @param {number} limit - 间隔毫秒数
 * @returns {Function}
 */
function throttle(fn, limit = 100) {
    let inThrottle = false;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * 创建带渐显动画的 DOM 元素
 * @param {string} tag - 标签名
 * @param {Object} styles - CSS 样式对象
 * @param {string} text - 文本内容
 * @returns {HTMLElement}
 */
function createFadeElement(tag, styles = {}, text = '') {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    Object.assign(el.style, {
        opacity: '0',
        transition: 'opacity 0.3s ease',
        ...styles
    });
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.opacity = '1';
        });
    });
    return el;
}

/**
 * 显示临时提示消息（Toast）
 * @param {string} message - 消息内容
 * @param {string} type - 类型: success | error | info
 * @param {number} duration - 显示时长(ms)
 */
function showToast(message, type = 'info', duration = 2000) {
    const colors = {
        success: '#43a047',
        error: '#e53935',
        info: '#2196f3'
    };

    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%) translateY(-20px)',
        background: colors[type] || colors.info,
        color: '#fff',
        padding: '10px 24px',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: '3000',
        opacity: '0',
        transition: 'all 0.3s ease',
        pointerEvents: 'none'
    });

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * 格式化秒数为 mm:ss
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * 生成随机洗牌后的数组（Fisher-Yates）
 * @param {Array} arr
 * @returns {Array}
 */
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * 异步加载 JSON 数据
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function loadJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.json();
}

/**
 * 将对象导出为 JSON 文件并触发下载
 * @param {Object} data
 * @param {string} filename
 */
function exportJSON(data, filename = 'data.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
