# Obsidian 插件改造评估报告

> 版本：v2（基于 Mac 端优先、iPad 暂缓、前端零改动的约束条件）

## 一、需求修正确认

基于沟通，需求修正为以下约束条件：

| 约束项 | 原需求 | 修正后 |
|--------|--------|--------|
| 优先级 | Mac + iPad 同时开发 | **Mac 优先，iPad 暂缓** |
| 前端改动 | 零改动 | **尽可能零改动，最少改动** |
| 数据路径 | `Vault/EdPau3/` 硬编码 | **`EdPau3/` 可配置，默认 `EdPau3/`** |

---

## 二、Mac 端可行性分析

### 2.1 技术可行性：**完全可行**

Obsidian 桌面端（Mac/Windows/Linux）基于 Electron，具备完整的 Node.js 运行时环境：
- `require('http')` 可用 → 可启动 HTTP Server（复用 `server.js`）
- `require('fs')` 可用 → 文件读写与 VS Code 完全一致
- `require('path')` 可用 → 路径处理无差异

### 2.2 推荐方案：iframe + HTTP Server（与 VS Code 完全一致）

```
┌─────────────────────────────────────────┐
│  Obsidian 主窗口（Electron WebView）     │
│  ┌─────────────────────────────────┐    │
│  │  WorkspaceLeaf / ItemView       │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │ iframe src="localhost:xxx"│  │    │
│  │  │ ┌─────────────────────┐   │  │    │
│  │  │ │ 前端（index.html）   │   │  │    │
│  │  │ │ 完全零改动           │   │  │    │
│  │  │ └─────────────────────┘   │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│  ↑ Ribbon Icon 点击触发打开              │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Obsidian Plugin（main.js）              │
│  • 获取 Vault 根目录                      │
│  • 计算 WORK_DIR = Vault/EdPau3/         │
│  • 设置 MD2MIND_WORK_DIR 环境变量         │
│  • require('./server.js') 启动 HTTP      │
│  • 提供 SettingTab 配置面板               │
└─────────────────────────────────────────┘
```

**核心结论**：前端确实可以做到**严格零改动**。所有差异集中在 Obsidian 插件入口层（`main.js` + `manifest.json` + `styles.css`），不触碰任何前端代码。

---

## 三、前端零改动边界验证

### 3.1 需要验证的边界点

| 边界点 | 当前实现 | Obsidian iframe 中行为 | 结论 |
|--------|---------|----------------------|------|
| **同源策略** | 所有子页面通过 `iframe.contentWindow.postMessage` / `parent.postMessage` 通信 | iframe 与 parent 同源（`http://localhost:port`），postMessage 正常工作 | 无需改动 |
| **localStorage** | 用于暂存节点编辑内容 | iframe 的 localStorage 与 Obsidian 主页面隔离（按域名），不同 Vault 间共享 localhost localStorage | 与 VS Code Webview 行为一致，无需改动 |
| **文件上传** | `showFilePicker` + `loadTodoFile` | 浏览器 File System Access API 在 Electron iframe 中可用 | 无需改动 |
| **静态资源加载** | `<img src="assets/xxx.png">` | server.js 静态文件服务正常提供 | 无需改动 |
| **Markdown 渲染** | `marked.parse()`（CDN / assets） | iframe 内正常执行 | 无需改动 |
| **拖拽事件** | `mousedown`/`mousemove`/`mouseup` | Electron iframe 中鼠标事件正常 | 无需改动（Mac 端不涉及触摸） |

### 3.2 唯一需要 Obsidian 层处理的 CSS

iframe 需要占满 WorkspaceLeaf 容器，这在 Obsidian 插件的 `styles.css` 中设置：

```css
/* obsidian/styles.css */
.vibecodingsop-view iframe {
  width: 100%;
  height: 100%;
  border: none;
}
```

**不影响前端代码**。

---

## 四、Obsidian 插件文件结构

在现有项目根目录下新增 `obsidian/` 目录：

```
obsidian/
├── manifest.json          # 插件元数据（id / name / version / isDesktopOnly）
├── main.js                # 插件入口（纯 JavaScript，无需 TypeScript 编译）
├── styles.css             # 插件样式（仅 iframe 容器尺寸）
└── README.md              # Obsidian 插件专用说明
```

**打包时**，构建脚本将以下文件复制到 Obsidian 插件目录：
- `server.js` → `obsidian-dist/server.js`
- `index.html` → `obsidian-dist/index.html`
- `table-viewer.html` → `obsidian-dist/table-viewer.html`
- `prompt-*.html` → `obsidian-dist/prompt-*.html`
- `styles/` → `obsidian-dist/styles/`
- `assets/` → `obsidian-dist/assets/`
- `js/` → `obsidian-dist/js/`
- `prompt/` → `obsidian-dist/prompt/`
- `obsidian/manifest.json` → `obsidian-dist/manifest.json`
- `obsidian/main.js` → `obsidian-dist/main.js`
- `obsidian/styles.css` → `obsidian-dist/styles.css`

最终安装到 Vault：`.obsidian/plugins/vibecodingsop/`

---

## 五、需要指出的需求问题与风险

### 5.1 问题 1：Obsidian 插件安装路径与项目结构的差异

VS Code 插件是一个独立项目（有自己的 `package.json`），通过 `.vsix` 安装。
Obsidian 插件是 Vault 的一部分，安装在 `.obsidian/plugins/vibecodingsop/` 下。

**建议**：
- 在现有项目根目录下新增 `obsidian/` 开发目录
- 提供构建脚本（如 `build-obsidian.js`）自动将前端资源复制到插件目录
- 不将 Obsidian 插件文件混入根目录（避免与 VS Code 插件文件冲突）

### 5.2 问题 2：`isDesktopOnly` 标记

由于暂缓 iPad 端，`manifest.json` 中必须设置：
```json
{ "isDesktopOnly": true }
```
这样 Obsidian 移动端不会加载该插件，避免用户误以为 iPad 可用。

### 5.3 问题 3：设置修改后的 Server 重启

用户修改 `dataDir` 后，`MD2MIND_WORK_DIR` 环境变量已改变，需要重启 HTTP Server 才能生效。

**建议**：在 `main.js` 中实现自动重启逻辑：
```javascript
async restartServer() {
  if (this.serverInstance) {
    await new Promise(r => this.serverInstance.close(r));
  }
  // 重新设置环境变量并启动
  process.env.MD2MIND_WORK_DIR = this.getWorkDir();
  this.serverInstance = serverModule.startServer(0);
}
```

### 5.4 问题 4：Vault 根目录路径获取的兼容性

```javascript
const vaultPath = this.app.vault.adapter.basePath;
```

- **正常情况**：桌面端返回 Vault 的绝对路径（如 `/Users/ed/Documents/ObsidianVault`）
- **异常情况**：某些同步方案（如 iCloud Drive、Syncthing）可能返回虚拟路径或 undefined
- **风险**：如果 `basePath` 为 undefined，插件无法确定数据存储位置

**建议**：增加 fallback 逻辑：
```javascript
let vaultPath = this.app.vault.adapter.basePath;
if (!vaultPath) {
  vaultPath = this.app.vault.getRoot().path;
  // 或使用 Obsidian API 的 adapter 其他属性
}
```

### 5.5 问题 5：文件冲突（与 Obsidian 编辑器同时编辑）

如果用户在 Obsidian 原生编辑器中打开了 `todo/xxx.md`，同时插件也在编辑同一文件，可能产生冲突。

**现状**：`server.js` 使用原子写入（临时文件 + rename），可减少部分冲突，但不是完美的并发控制。

**建议**：在 README 中明确告知用户：避免同时在 Obsidian 编辑器和本插件中编辑同一个文件。

### 5.6 问题 6：Prompt 模板默认文件复制路径

VS Code 插件中，`ensurePromptDefaults` 将 `extensionPath/prompt/` 复制到 `workDir/prompt/`。

在 Obsidian 中：
- 源目录：`.obsidian/plugins/vibecodingsop/prompt/`
- 目标目录：`Vault/EdPau3/prompt/`

逻辑完全一致，只需适配路径获取方式。

### 5.7 问题 7：Obsidian 插件发布流程差异

VS Code 插件发布到 VS Code Marketplace（需 Microsoft 账号）。
Obsidian 插件发布到社区插件列表（需 GitHub Release + PR 到 obsidian-releases 仓库）。

**建议**：如果未来要发布到 Obsidian 社区，需要：
1. 在 GitHub 上创建 Release，包含 `main.js`、`manifest.json`、`styles.css`
2. 向 `obsidian-releases` 仓库提交 PR
3. 等待审核（通常几天到几周）

---

## 六、与 VS Code 插件的差异对比

| 维度 | VS Code 插件 | Obsidian 插件（Mac） |
|------|-------------|---------------------|
| 入口文件 | `extension.js` | `obsidian/main.js` |
| 元数据文件 | `package.json` | `obsidian/manifest.json` |
| 启动按钮位置 | Activity Bar | Ribbon Icon（左侧功能区） |
| 容器 | `WebviewPanel` / `WebviewView` | `WorkspaceLeaf` / `ItemView` |
| 工作目录获取 | `vscode.workspace.workspaceFolders` | `app.vault.adapter.basePath` |
| 设置面板 | `vscode.workspace.getConfiguration` | `PluginSettingTab` |
| 前端加载方式 | iframe → `http://localhost:port` | iframe → `http://localhost:port` |
| 文件系统 | Node.js `fs`（Electron） | Node.js `fs`（Electron） |
| 前端改动 | 零改动 | **零改动** |
| iPad 支持 | 不适用 | **不支持（`isDesktopOnly: true`）** |

---

## 七、实施顺序建议（Mac 端）

| 阶段 | 任务 | 工作量 | 说明 |
|------|------|--------|------|
| 1 | 创建 `obsidian/` 目录结构 | 小 | manifest.json + main.js + styles.css |
| 2 | 编写 `obsidian/main.js`（插件入口） | 中等 | 复用 extension.js 逻辑，适配 Obsidian API |
| 3 | 编写 `obsidian/settings.ts`（设置面板） | 小 | 数据目录配置，默认 `EdPau3/` |
| 4 | 编写构建脚本（复制前端资源） | 小 | 将 server.js / index.html / assets 等复制到插件目录 |
| 5 | 本地测试（Obsidian 开发者模式） | 中等 | 加载未打包插件，验证功能 |
| 6 | 验证前端零改动边界 | 小 | postMessage、localStorage、文件上传、拖拽 |
| 7 | 编写 Obsidian 安装说明 | 小 | 如何复制到 `.obsidian/plugins/` |

---

## 八、最终结论

### 8.1 Mac 端 Obsidian 插件：**完全可行，工作量与 VS Code 插件相当**

- 前端可以做到**严格零改动**
- 复用现有 `server.js`（无需任何修改）
- 复用 VS Code 插件的启动逻辑（仅需适配 Obsidian API）
- 核心差异仅在插件入口层（`main.js` 替代 `extension.js`）

### 8.2 需求完整性评估

| 需求项 | 评估结果 | 说明 |
|--------|---------|------|
| Mac 端功能区按钮 + iframe | 完整可行 | Ribbon Icon + WorkspaceLeaf iframe |
| 前端零改动 | 可实现 | iframe 方案完全隔离 |
| 数据路径 `EdPau3/` 可配置 | 完整可行 | PluginSettingTab 实现 |
| 暂缓 iPad | 合理 | `isDesktopOnly: true` 即可 |

### 8.3 唯一需要确认的决策点

**是否接受在现有项目中新增 `obsidian/` 目录？**

- 该目录包含 `manifest.json`、`main.js`、`styles.css` 三个文件
- 构建脚本会将前端资源复制到 Obsidian 插件目录
- 不影响 VS Code 插件和独立服务端的现有功能

**建议**：接受。这是 Obsidian 插件的标准结构，与 VS Code 插件的 `extension.js` + `package.json` 类似，属于平台适配层。
