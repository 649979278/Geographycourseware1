# 闯关模式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有地形模块页面中新增闯关模式，支持按难度星级逐关挑战，答错即失败。

**Architecture:** 在 `terrain.html` 现有状态机基础上新增 `challenge` 模式分支，复用拖拽答题、地图渲染、图层控制等核心逻辑。新增独立的 `generateLevels()` 关卡生成算法。编辑器新增 `difficulty` 字段维护。

**Tech Stack:** 纯前端 HTML/CSS/JS，无构建工具，数据以 JS 全局变量存储。

---

## 文件结构

| 文件 | 变更 | 职责 |
|---|---|---|
| `terrain.html` | 修改 | 核心文件：新增闯关模式状态机、关卡生成算法、UI切换、结算逻辑 |
| `css/game.css` | 可选修改 | 若新增UI元素需要样式支持时添加 |

---

## Task 1: 编辑器增加 difficulty 字段

**Files:**
- Modify: `terrain.html:218-233`（编辑器表单区域）
- Modify: `terrain.html:1803-1857`（saveEditorItem 调用处）

**背景：** 坐标采集编辑器目前维护了采集点的名称、描述、坐标、目标关卡等字段，需要新增难度星级。

- [ ] **Step 1: 在编辑器表单中新增难度选择**

在 `editorTargetLevel` 下方插入：

```html
<div class="editor-form-row">
    <label>难度星级</label>
    <select id="editorDifficulty">
        <option value="1">⭐ 1星（简单）</option>
        <option value="2">⭐⭐ 2星（中等）</option>
        <option value="3">⭐⭐⭐ 3星（困难）</option>
    </select>
</div>
```

- [ ] **Step 2: 修改编辑器添加逻辑，保存 difficulty 字段**

在 `editorAddBtn` 的 click 事件处理中，构建 `item` 对象时添加：

```js
const item = {
    id: pinyinId(name),
    name: name,
    description: editorDesc.value.trim(),
    targetLevel: document.getElementById('editorTargetLevel').value,
    difficulty: parseInt(document.getElementById('editorDifficulty').value) || 1
};
```

- [ ] **Step 3: 测试编辑器功能**

手动测试步骤：
1. 打开 `terrain.html?editor=1`
2. 添加一个新的采集点，选择难度为 2 星
3. 点击"导出 JSON"
4. 检查导出的数据文件中是否包含 `"difficulty": 2`
5. 确认默认选中 1 星

- [ ] **Step 4: Commit**

```bash
git add terrain.html
git commit -m "feat: 编辑器增加采集点难度星级字段"
```

---

## Task 2: 数据加载时兼容默认难度

**Files:**
- Modify: `terrain.html:942-968`（dataManager.load 方法）
- Modify: `terrain.html:971-993`（loadEditorStorage 方法）

**背景：** 现有数据文件中的采集点没有 `difficulty` 字段，加载时需要默认赋值为 1。

- [ ] **Step 1: 修改 dataManager.load，为缺失 difficulty 的采集点赋默认值**

在 `dataManager.load` 方法中，深拷贝后添加：

```js
if (typeof copy.difficulty !== 'number') {
    copy.difficulty = 1;
}
```

具体位置在 `if (!copy.targetLevel) copy.targetLevel = 'mountains';` 之后。

- [ ] **Step 2: 修改 loadEditorStorage，同样添加默认值处理**

在三个 `if (!data.targetLevel)` 判断之后，各添加：

```js
if (typeof data.difficulty !== 'number') {
    data.difficulty = 1;
}
```

- [ ] **Step 3: 验证数据加载**

手动测试步骤：
1. 打开 terrain.html 正常模式
2. 在浏览器控制台执行：`console.log(window.GEO_DATA.mountains)`
3. 确认每个采集点都有 `difficulty: 1`

- [ ] **Step 4: Commit**

```bash
git add terrain.html
git commit -m "feat: 数据加载时为缺失difficulty的采集点默认赋1星"
```

---

## Task 3: 关卡生成算法

**Files:**
- Modify: `terrain.html`（在 `dataManager` 下方新增 `challengeManager`）

**背景：** 需要独立的关卡生成逻辑，从所有采集点中按难度分组、计算关卡数、分配题目、每关洗牌。

- [ ] **Step 1: 在 dataManager 下方添加 challengeManager**

在 `terrain.html:968` 之后（dataManager 结束位置）插入：

```js
// ============================================================
// 闯关模式关卡生成器
// ============================================================

const challengeManager = {
    /**
     * 从所有采集点生成闯关关卡
     * @returns {Object} { totalLevels, levels: [{ items }] }
     */
    generateLevels() {
        const allItems = [];
        const mountains = window.GEO_DATA?.mountains || [];
        const lines = window.GEO_DATA?.lines || [];
        const regions = window.GEO_DATA?.regions || [];

        [...mountains, ...lines, ...regions].forEach(d => {
            const copy = JSON.parse(JSON.stringify(d));
            if (typeof copy.difficulty !== 'number') copy.difficulty = 1;
            if (!copy.targetLevel) {
                copy.targetLevel = d.point || d.points ? 'mountains' : 'terrain-regions';
            }
            allItems.push(copy);
        });

        if (allItems.length === 0) {
            return { totalLevels: 0, levels: [] };
        }

        // 计算关卡数：优先每关5题，但每关至少3题、最多8题；关卡数最少2关、最多10关
        let totalLevels = Math.min(10, Math.max(2, Math.ceil(allItems.length / 5)));
        let perLevel = Math.ceil(allItems.length / totalLevels);

        // 如果每关不足3题，减少关卡数
        if (perLevel < 3) {
            totalLevels = Math.min(10, Math.max(2, Math.floor(allItems.length / 3)));
            perLevel = Math.ceil(allItems.length / totalLevels);
        }

        // 如果每关超过8题，增加关卡数（或截断）
        if (perLevel > 8) {
            totalLevels = Math.min(10, Math.ceil(allItems.length / 8));
            perLevel = Math.ceil(allItems.length / totalLevels);
        }

        // 按难度升序排序
        allItems.sort((a, b) => a.difficulty - b.difficulty);

        // 分配到各关卡
        const levels = [];
        let itemIdx = 0;
        for (let i = 0; i < totalLevels; i++) {
            const remainingLevels = totalLevels - i;
            const remainingItems = allItems.length - itemIdx;
            const count = Math.min(remainingItems, Math.ceil(remainingItems / remainingLevels));
            const levelItems = allItems.slice(itemIdx, itemIdx + count);
            // 每关内部随机洗牌
            levels.push({
                levelNumber: i + 1,
                items: shuffleArray(levelItems)
            });
            itemIdx += count;
        }

        return { totalLevels: levels.length, levels };
    }
};
```

- [ ] **Step 2: 在浏览器控制台测试关卡生成算法**

打开 terrain.html，在控制台执行：

```js
const result = challengeManager.generateLevels();
console.log('总关卡数:', result.totalLevels);
result.levels.forEach((lv, i) => {
    const difficulties = lv.items.map(it => it.difficulty);
    console.log(`第${i+1}关: ${lv.items.length}题, 难度分布:`, difficulties);
});
```

验证：
- 每关至少3题，最多8题
- 关卡数在 2~10 之间
- 前面的关卡难度总体低于后面的关卡
- 每关内部是随机顺序

- [ ] **Step 3: Commit**

```bash
git add terrain.html
git commit -m "feat: 新增闯关模式关卡生成算法"
```

---

## Task 4: 模式切换栏与开始界面UI

**Files:**
- Modify: `terrain.html:37-41`（模式切换按钮区域）
- Modify: `terrain.html:106-138`（开始覆盖层）

**背景：** 需要在UI上提供进入闯关模式的入口，以及闯关模式专属的开始界面。

- [ ] **Step 1: 新增"闯关模式"按钮**

在 `terrain.html:37` 的 `#modeSwitch` 中，在 `双人PK` 按钮后插入：

```html
<button data-mode="challenge" id="challengeBtn">闯关模式</button>
```

- [ ] **Step 2: 新增闯关模式开始界面内容**

在 `#startOverlay` 内部（`terrain.html:106-138`），在现有 `#nameInputGroup` 之后、按钮之前插入一个闯关模式专属信息区域：

```html
<div id="challengeInfo" style="display:none;margin:12px 0;font-size:14px;color:#666;">
    共 <strong id="challengeTotalLevels">0</strong> 关，答错一题即失败，闯过一关获得 1 次提示！
</div>
```

- [ ] **Step 3: 修改 bindModeSwitch，处理闯关模式切换**

在 `bindModeSwitch` 函数（`terrain.html:651`）中，在 `if (mode === 'pk')` 分支旁增加 `challenge` 分支：

```js
if (mode === 'pk') {
    enterPkMode();
} else if (mode === 'challenge') {
    enterChallengeMode();
} else {
    exitPkMode();
    exitChallengeMode();
}
```

- [ ] **Step 4: 添加 enterChallengeMode 和 exitChallengeMode 函数**

在 `exitPkMode` 函数（`terrain.html:755`）之后添加：

```js
function enterChallengeMode() {
    state.mode = 'challenge';
    document.getElementById('pkInfo').style.display = 'none';
    els.scoreDisplay.parentElement.style.display = '';
    els.timerDisplay.parentElement.style.display = '';
    els.hintBtn.style.display = '';
    document.getElementById('startTitle').textContent = '闯关模式';
    document.getElementById('startDesc').textContent = '准备好迎接挑战了吗？';
    document.getElementById('nameInputSingle').style.display = '';
    document.getElementById('nameInputPk').style.display = 'none';
    // 生成关卡数据
    const challengeData = challengeManager.generateLevels();
    state.challenge.totalLevels = challengeData.totalLevels;
    state.challenge.levels = challengeData.levels;
    document.getElementById('challengeTotalLevels').textContent = challengeData.totalLevels;
}

function exitChallengeMode() {
    state.challenge.active = false;
    document.getElementById('challengeInfo').style.display = 'none';
    // 恢复单人模式的开始界面文案
    document.getElementById('startTitle').textContent = '选择关卡';
    document.getElementById('startDesc').textContent = '请选择要挑战的关卡类型';
}
```

- [ ] **Step 5: 在状态对象中初始化 challenge 字段**

在 `terrain.html:330` 的 `state` 对象中，在 `pk` 字段之后添加：

```js
// 闯关模式
challenge: {
    active: false,
    totalLevels: 0,
    currentLevelIdx: 0,
    currentQuestionIdx: 0,
    levels: [],
    hintsAvailable: 0,
    playerName: '',
    totalScore: 0,
    totalTimer: 0,
    totalInterval: null
}
```

- [ ] **Step 6: 手动测试UI切换**

1. 打开 terrain.html
2. 点击"闯关模式"按钮
3. 确认按钮高亮，开始界面标题变为"闯关模式"
4. 确认关卡选择卡片仍然可见（下一 Task 处理隐藏）
5. 切回"单人练习"，确认UI恢复

- [ ] **Step 7: Commit**

```bash
git add terrain.html
git commit -m "feat: 新增闯关模式入口按钮与开始界面UI"
```

---

## Task 5: 闯关模式开始界面改造与关卡加载

**Files:**
- Modify: `terrain.html:106-138`（开始覆盖层）
- Modify: `terrain.html:833-905`（setupLevel 函数）

**背景：** 闯关模式不需要选择山脉/地形区关卡，开始界面需要动态控制各元素的显隐。

- [ ] **Step 1: 改造 startGame，支持闯关模式**

在 `startGame` 函数（`terrain.html:1033`）中，在 `if (state.pk.active)` 之前增加 `challenge` 分支：

```js
if (state.challenge.active || state.mode === 'challenge') {
    const name = document.getElementById('playerNameSingle').value.trim();
    if (!name) {
        showToast('请填写挑战者姓名', 'error');
        return;
    }
    if (!nameRegex.test(name)) {
        showToast('姓名只能包含数字、英文、中文和常见标点符号', 'error');
        return;
    }
    state.challenge.playerName = name;
    state.challenge.active = true;
    state.challenge.currentLevelIdx = 0;
    state.challenge.currentQuestionIdx = 0;
    state.challenge.hintsAvailable = 0;
    state.challenge.totalScore = 0;
    state.challenge.totalTimer = 0;
    state.playerName = name;

    // 启动总计时器
    state.challenge.totalInterval = setInterval(() => {
        state.challenge.totalTimer++;
    }, 1000);

    startChallengeLevel(0);
    return;
}
```

- [ ] **Step 2: 添加 startChallengeLevel 函数**

在 `startGame` 函数之后添加：

```js
function startChallengeLevel(levelIdx) {
    if (levelIdx >= state.challenge.levels.length) {
        // 全部通过
        endChallenge(true);
        return;
    }

    state.challenge.currentLevelIdx = levelIdx;
    state.challenge.currentQuestionIdx = 0;
    const levelData = state.challenge.levels[levelIdx];
    state.items = JSON.parse(JSON.stringify(levelData.items));
    state.level = 'challenge'; // 虚拟关卡ID
    state.placedIds.clear();
    state.score = 0;
    state.timer = 0;
    state.hintsUsed = 0;
    state.correctCount = 0;
    state.wrongCount = 0;

    els.levelName.textContent = '第 ' + (levelIdx + 1) + ' / ' + state.challenge.totalLevels + ' 关';
    els.startOverlay.style.display = 'none';
    els.sidebar.style.display = '';
    state.isPlaying = true;

    // 重置地图标记
    state.mapEngine.layers.mountains.innerHTML = '';
    state.mapEngine.layers.lines.innerHTML = '';
    state.mapEngine.layers.regions.innerHTML = '';
    state.mapEngine.clearDropZones();
    state.mapEngine.clearAnswers();

    // 渲染地图标记
    state.items.forEach(item => {
        if (item.point) {
            state.mapEngine.addMountainMarker(item, showDescription, true);
            state.mapEngine.addDropZone(item, 'mountain');
        } else if (item.points && item.points.length) {
            state.mapEngine.addPolyline(item, showDescription, true);
        } else if (item.center || (item.boundary && item.boundary.length)) {
            state.mapEngine.addRegionBoundary(item, showDescription, true);
            state.mapEngine.addDropZone(item, 'region');
        }
    });

    renderLabels();
    updateCounts();
    setupDragAndDrop();
    updateUI();
}
```

- [ ] **Step 3: 改造 enterChallengeMode，隐藏关卡选择**

在 `enterChallengeMode` 中，在设置文案之后添加：

```js
// 隐藏关卡选择卡片，显示闯关信息
document.getElementById('levelSelect').style.display = 'none';
document.getElementById('challengeInfo').style.display = '';
```

在 `exitChallengeMode` 中添加恢复逻辑：

```js
document.getElementById('levelSelect').style.display = '';
document.getElementById('challengeInfo').style.display = 'none';
```

- [ ] **Step 4: 手动测试关卡加载**

1. 进入闯关模式
2. 输入姓名，点击开始
3. 确认侧边栏显示了题目（混合了山脉/地形区）
4. 确认状态栏显示"第 1 / N 关"

- [ ] **Step 5: Commit**

```bash
git add terrain.html
git commit -m "feat: 闯关模式开始界面与关卡加载逻辑"
```

---

## Task 6: 答题正确与关卡切换

**Files:**
- Modify: `terrain.html:1345`（handleCorrect 函数）
- Modify: `terrain.html:1458`（handleWrong 函数）

**背景：** 闯关模式下答对一题继续，答完全部进入下一关或成功；答错一题直接失败。

- [ ] **Step 1: 修改 handleCorrect，增加闯关模式分支**

在 `handleCorrect` 函数中，在 `updateCounts()` 之后、检查是否全部完成之前，插入闯关模式的得分和提示逻辑：

```js
// 闯关模式：累计得分
if (state.mode === 'challenge' && state.challenge.active) {
    state.challenge.totalScore += scoreCfg.correct;
}
```

在检查是否全部完成的逻辑中（`if (state.placedIds.size >= state.items.length)`），修改为：

```js
// 检查是否全部完成
if (state.placedIds.size >= state.items.length) {
    if (state.mode === 'challenge' && state.challenge.active) {
        // 关卡通过，短暂延迟后进入下一关
        setTimeout(() => {
            state.challenge.hintsAvailable++;
            showToast('第 ' + (state.challenge.currentLevelIdx + 1) + ' 关通过！获得 1 次提示', 'success', 1500);
            setTimeout(() => {
                startChallengeLevel(state.challenge.currentLevelIdx + 1);
            }, 1500);
        }, 600);
    } else {
        setTimeout(endGame, 800);
    }
}
```

- [ ] **Step 2: 修改 handleWrong，增加闯关模式失败逻辑**

在 `handleWrong` 函数中，将现有的 PK 和单人分支改造为三段式：

```js
function handleWrong(labelEl) {
    if (state.mode === 'editor') {
        labelEl.classList.add('shake');
        setTimeout(() => labelEl.classList.remove('shake'), 400);
        showToast('位置不对，再试一次', 'error');
        return;
    }

    state.wrongCount++;
    labelEl.classList.add('shake');
    setTimeout(() => labelEl.classList.remove('shake'), 400);

    const rect = labelEl.getBoundingClientRect();

    if (state.pk.active) {
        // 原有PK逻辑不变
        const name = state.pk.playerNames[state.pk.currentPlayer - 1] || ('玩家' + state.pk.currentPlayer);
        showFeedbackBadge(rect.left + rect.width / 2, rect.top, '换对手！', 'wrong');
        showToast(name + '答错，换对手！', 'error');
        switchTurn();
    } else if (state.mode === 'challenge' && state.challenge.active) {
        // 闯关模式：答错即失败
        showFeedbackBadge(rect.left + rect.width / 2, rect.top, '失败！', 'wrong');
        showToast('答错了，闯关失败！', 'error');
        endChallenge(false);
    } else {
        // 原有单人模式逻辑不变
        const scoreCfg = state.gameConfig.terrain.levels.find(l => l.id === state.level).score;
        state.score = Math.max(0, state.score + scoreCfg.wrong);
        showFeedbackBadge(rect.left + rect.width / 2, rect.top, scoreCfg.wrong + '', 'wrong');
        showToast('位置不对，再试一次', 'error');
        updateUI();
    }
}
```

- [ ] **Step 3: 添加 endChallenge 函数**

在 `endGame` 函数（`terrain.html:1144`）之后添加：

```js
function endChallenge(success) {
    stopGame();
    clearInterval(state.challenge.totalInterval);
    if (success) {
        showChallengeSuccess();
    } else {
        showChallengeFail();
    }
}
```

- [ ] **Step 4: 手动测试答题流程**

1. 进入闯关模式，开始挑战
2. 答对一题，确认继续在本关
3. 答完本关所有题目，确认出现"第X关通过"提示，然后自动加载下一关
4. 在新的一关中故意答错，确认立即弹出失败结算

- [ ] **Step 5: Commit**

```bash
git add terrain.html
git commit -m "feat: 闯关模式答题正确切换关卡与答错即失败逻辑"
```

---

## Task 7: 结算弹窗改造

**Files:**
- Modify: `terrain.html:1161-1213`（showResult / showPkResult 区域）

**背景：** 闯关模式需要独立的结算弹窗：成功时显示总用时和总得分；失败时显示在第几关第几题答错。

- [ ] **Step 1: 添加 showChallengeSuccess 函数**

在 `showPkResult` 函数之后添加：

```js
function showChallengeSuccess() {
    const name = state.challenge.playerName || '挑战者';
    document.getElementById('resultTitle').textContent = '🎉 ' + name + '，闯关成功！';
    document.getElementById('resultStars').style.display = 'none';

    document.querySelector('.result-stats').innerHTML = `
        <div class="result-stat"><div class="stat-value" id="statScore">0</div><div class="stat-label">总得分</div></div>
        <div class="result-stat"><div class="stat-value" id="statTime">00:00</div><div class="stat-label">总用时</div></div>
        <div class="result-stat"><div class="stat-value" id="statLevels">0</div><div class="stat-label">闯过关卡</div></div>
        <div class="result-stat"><div class="stat-value" id="statTotalLevels">0</div><div class="stat-label">总关卡数</div></div>
    `;

    document.getElementById('statScore').textContent = state.challenge.totalScore;
    document.getElementById('statTime').textContent = formatTime(state.challenge.totalTimer);
    document.getElementById('statLevels').textContent = state.challenge.totalLevels;
    document.getElementById('statTotalLevels').textContent = state.challenge.totalLevels;

    els.resultModal.classList.add('active');
}
```

- [ ] **Step 2: 添加 showChallengeFail 函数**

```js
function showChallengeFail() {
    const name = state.challenge.playerName || '挑战者';
    const level = state.challenge.currentLevelIdx + 1;
    const question = state.challenge.currentQuestionIdx + 1;
    const passedLevels = state.challenge.currentLevelIdx;

    document.getElementById('resultTitle').textContent = '💔 ' + name + '，闯关失败';
    document.getElementById('resultStars').style.display = 'none';

    document.querySelector('.result-stats').innerHTML = `
        <div class="result-stat"><div class="stat-value" id="statFailLevel">0</div><div class="stat-label">失败关卡</div></div>
        <div class="result-stat"><div class="stat-value" id="statFailQuestion">0</div><div class="stat-label">失败题号</div></div>
        <div class="result-stat"><div class="stat-value" id="statPassed">0</div><div class="stat-label">已通过关</div></div>
        <div class="result-stat"><div class="stat-value" id="statTotalTime">00:00</div><div class="stat-label">总用时</div></div>
    `;

    document.getElementById('statFailLevel').textContent = level;
    document.getElementById('statFailQuestion').textContent = question;
    document.getElementById('statPassed').textContent = passedLevels;
    document.getElementById('statTotalTime').textContent = formatTime(state.challenge.totalTimer);

    els.resultModal.classList.add('active');
}
```

- [ ] **Step 3: 改造结果弹窗按钮行为**

修改 `resultRestartBtn` 的点击事件（`terrain.html:813` 附近），使其支持闯关模式的重新开始：

```js
document.getElementById('resultRestartBtn').addEventListener('click', () => {
    document.getElementById('resultModal').classList.remove('active');
    if (state.mode === 'challenge' && state.challenge.active) {
        // 闯关模式：重新生成关卡并回到开始界面
        state.challenge.active = false;
        enterChallengeMode();
        els.startOverlay.style.display = '';
        els.sidebar.style.display = 'none';
    } else {
        restartGame();
    }
});
```

- [ ] **Step 4: 手动测试结算弹窗**

1. 闯关成功：确认弹窗显示"闯关成功"、总得分、总用时、闯过关卡数
2. 闯关失败：确认弹窗显示"闯关失败"、失败关卡、失败题号、已通过关数
3. 点击"再玩一次"：确认重新生成关卡，回到开始界面

- [ ] **Step 5: Commit**

```bash
git add terrain.html
git commit -m "feat: 闯关模式成功与失败结算弹窗"
```

---

## Task 8: 提示机制适配闯关模式

**Files:**
- Modify: `terrain.html:930-936`（updateUI 函数）
- Modify: `terrain.html:1502-1574`（useHint 函数）

**背景：** 闯关模式下提示次数从 `hintsAvailable` 扣减，不扣分；同时隐藏"目标提示"图层开关。

- [ ] **Step 1: 修改 updateUI，支持闯关模式提示次数显示**

在 `updateUI` 函数中：

```js
function updateUI() {
    els.scoreDisplay.textContent = state.score;
    els.timerDisplay.textContent = formatTime(state.timer);
    if (state.mode === 'challenge' && state.challenge.active) {
        els.hintCount.textContent = state.challenge.hintsAvailable;
    } else {
        els.hintCount.textContent = Math.max(0, state.hintsMax - state.hintsUsed);
    }
    const dropZonesEnabled = state.layerManager ? state.layerManager.getState('dropZones') : false;
    // 闯关模式下不依赖dropZones开关，只要有可用提示就可以使用
    if (state.mode === 'challenge' && state.challenge.active) {
        els.hintBtn.disabled = state.challenge.hintsAvailable <= 0 || !state.isPlaying;
    } else {
        els.hintBtn.disabled = state.hintsUsed >= state.hintsMax || !state.isPlaying || !dropZonesEnabled;
    }
}
```

- [ ] **Step 2: 修改 useHint，支持闯关模式不扣分**

在 `useHint` 函数开头增加闯关模式分支：

```js
function useHint() {
    if (!state.isPlaying) return;

    // 闯关模式：从 hintsAvailable 扣减，不扣分
    if (state.mode === 'challenge' && state.challenge.active) {
        if (state.challenge.hintsAvailable <= 0) return;

        const unplaced = state.items.find(i => !state.placedIds.has(i.id));
        if (!unplaced) return;

        state.challenge.hintsAvailable--;
        // 复用提示高亮逻辑（不扣分的版本）
        showHintForItem(unplaced);
        showToast('已提示一个目标位置', 'info');
        updateUI();
        return;
    }

    // 原有单人/PK模式的提示逻辑保持不变...
```

注意：由于 `useHint` 内部的高亮逻辑较长，为避免重复代码，可以将高亮部分抽取为 `showHintForItem(item)` 辅助函数。但由于原有逻辑已有 60+ 行，为保持最小改动，可以直接复制或保留原逻辑路径。

更简单的方式是：在 `useHint` 中仅修改入口判断和扣减逻辑，高亮逻辑共用。具体实现时，将 `state.hintsUsed++` 和 `state.score = Math.max(0, state.score + scoreCfg.hint);` 包裹在非闯关条件中。

为了保持代码清晰，建议将高亮逻辑抽取：

```js
function useHint() {
    if (!state.isPlaying) return;

    const unplaced = state.items.find(i => !state.placedIds.has(i.id));
    if (!unplaced) return;

    if (state.mode === 'challenge' && state.challenge.active) {
        if (state.challenge.hintsAvailable <= 0) return;
        state.challenge.hintsAvailable--;
        showHintForItem(unplaced);
        showToast('已提示一个目标位置', 'info');
        updateUI();
        return;
    }

    // 原有单人模式逻辑
    if (state.hintsUsed >= state.hintsMax) return;
    state.hintsUsed++;
    const scoreCfg = state.gameConfig.terrain.levels.find(l => l.id === state.level).score;
    state.score = Math.max(0, state.score + scoreCfg.hint);
    showHintForItem(unplaced);
    showToast('已提示一个目标位置 -' + Math.abs(scoreCfg.hint) + '分', 'info');
    updateUI();
}

function showHintForItem(unplaced) {
    // 将原有的高亮逻辑（dropZone / points / boundary）移到这里
    // ... 原有高亮代码 ...
    // 左侧待标注栏同步高亮
    const labelEl = document.querySelector(`.drag-label[data-id="${unplaced.id}"]`);
    if (labelEl) {
        labelEl.classList.add('label-hint-highlight');
        setTimeout(() => labelEl.classList.remove('label-hint-highlight'), 3000);
    }
}
```

- [ ] **Step 3: 隐藏闯关模式下的目标提示图层开关**

在 `enterChallengeMode` 中添加：

```js
// 隐藏目标提示开关
document.querySelector('.layer-toggle[data-layer="dropZones"]').style.display = 'none';
```

在 `exitChallengeMode` 中恢复：

```js
document.querySelector('.layer-toggle[data-layer="dropZones"]').style.display = '';
```

- [ ] **Step 4: 手动测试提示功能**

1. 进入闯关模式，通过第一关获得1次提示
2. 第二关中点击提示按钮，确认消耗1次提示次数，地图上高亮显示目标
3. 确认没有"目标提示"图层开关
4. 切回单人模式，确认目标提示开关恢复显示

- [ ] **Step 5: Commit**

```bash
git add terrain.html
git commit -m "feat: 闯关模式提示机制适配（不扣分、隐藏图层开关）"
```

---

## Task 9: 整合测试与边界修复

**Files:**
- Modify: `terrain.html`（多处边界处理）

**背景：** 处理各种边界情况，确保模式切换、重新开始等场景下状态正确。

- [ ] **Step 1: 确保 restartGame 支持闯关模式**

在 `restartGame` 函数（`terrain.html:1127`）中：

```js
function restartGame() {
    stopGame();
    if (state.mode === 'challenge' && state.challenge.active) {
        // 闯关模式重开 = 回到当前关开始界面
        els.startOverlay.style.display = '';
        els.sidebar.style.display = 'none';
        state.challenge.active = false;
        enterChallengeMode();
    } else {
        setupLevel(state.level);
    }
}
```

- [ ] **Step 2: 确保 stopGame 清理闯关计时器**

在 `stopGame` 函数（`terrain.html:1132`）中增加：

```js
clearInterval(state.challenge.totalInterval);
```

- [ ] **Step 3: 确保 handleCorrect 中记录当前题号**

在 `handleCorrect` 中，在 `state.correctCount++` 之后添加：

```js
if (state.mode === 'challenge' && state.challenge.active) {
    state.challenge.currentQuestionIdx++;
}
```

- [ ] **Step 4: 完整手动测试矩阵**

| 场景 | 预期结果 |
|---|---|
| 0个采集点时点击开始 | Toast提示"暂无采集数据" |
| 单人模式正常答题 | 原有逻辑不受影响 |
| PK模式正常答题 | 原有逻辑不受影响 |
| 闯关模式答对 → 答完全部 → 下一关 | 自动加载下一关，提示次数+1 |
| 闯关模式最后一关答完 | 显示"闯关成功" |
| 闯关模式答错一题 | 立即显示"闯关失败"，显示具体关卡题号 |
| 闯关模式使用提示 | 消耗提示次数，不扣分，地图高亮 |
| 模式切换（闯关↔单人↔PK） | UI正确切换，状态正确重置 |
| 编辑器新增/修改难度 | 数据正确保存，导出包含difficulty |
| 重新挑战 | 关卡重新随机生成 |

- [ ] **Step 5: Commit**

```bash
git add terrain.html
git commit -m "fix: 闯关模式边界情况处理与整合测试"
```

---

## 实施顺序总结

1. **Task 1** → 编辑器增加 difficulty 字段
2. **Task 2** → 数据加载兼容默认难度
3. **Task 3** → 关卡生成算法
4. **Task 4** → 模式切换UI
5. **Task 5** → 开始界面与关卡加载
6. **Task 6** → 答题正确/错误处理
7. **Task 7** → 结算弹窗
8. **Task 8** → 提示机制适配
9. **Task 9** → 整合测试与边界修复

---

## 回滚方案

若需要回滚闯关模式：
1. 删除 `challengeManager` 及相关函数
2. 删除 `#challengeBtn` 按钮
3. 删除 `state.challenge` 字段
4. 恢复 `handleCorrect` / `handleWrong` / `useHint` / `updateUI` 到原始逻辑
5. 保留编辑器 `difficulty` 字段（不影响原有功能）
