/**
 * 通用工具函数集合
 * 以传统脚本方式提供，兼容 file:// 协议下的无构建环境
 */

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
