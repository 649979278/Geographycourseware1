# 测试规范

## 截图存放目录

使用 Playwright 进行测试时，生成的截图必须放入专用子目录，禁止平铺到项目根目录或随意散落在各处。

**推荐做法：**
- 统一目录：`.playwright-mcp/screenshots/`
- 命名格式：`{feature}-{step}-{timestamp}.png`
- 测试结束后及时清理不再需要的截图

**禁止：**
- 将 `*.png` 直接放在项目根目录
- 测试截图混入源代码目录（`js/`、`css/`、`data/` 等）
