# AGENTS.md

## 项目概述

VibeCodingSOP（VCSOP-md2mind）是一个思维导图编辑器，支持 Markdown 导入导出、节点元数据管理、Prompt 模板库，可在三种模式下运行：独立 HTTP Server / VS Code 插件 / Obsidian 插件。

## 技术栈

- 前端：原生 HTML/CSS/JavaScript
- 依赖：marked.js（Markdown 渲染，通过 CDN 引入）
- 存储：localStorage（暂存）+ 文件系统（持久化）
- 运行模式：独立 HTTP Server / VS Code 插件（Extension Host + iframe）/ Obsidian 插件（Electron + iframe，桌面端 only）

## 目录结构

```
/workspace/projects/
├── index.html                  # 主页面（思维导图 + Markdown面板 + 节点信息）
├── table-viewer.html           # Table视图独立页面（Tabulator表格）
├── prompt-library.html         # Prompt Library独立页面（iframe嵌入Prompt面板第3个Tab）
├── prompt-optimization.html    # Prompt Optimization页面（iframe嵌入Prompt面板第2个Tab）
├── prompt-historylog.html      # Prompt History Log页面（iframe嵌入Prompt面板第4个Tab）
├── styles/
│   ├── main.css                # 主样式
│   ├── theme-enhanced.css      # 增强主题（设置开关控制）
│   ├── table-viewer.css        # Table视图样式
│   ├── prompt-library.css      # Prompt Library样式
│   ├── prompt-optimization.css # Prompt Optimization样式
│   └── prompt-historylog.css   # Prompt History Log样式
├── assets/                     # 图标资源（仅保留被引用的文件）
│   ├── marked.min.js           # Markdown渲染库（被 index.html / prompt-historylog.html 引用）
│   ├── icon-logo.png           # 插件图标 / 工具栏图标
│   ├── icon-open.png           # 打开文件夹按钮图标
│   └── ...                     # 各类功能图标（详见 assets/ 目录）
├── js/
│   ├── config.js               # 全局配置参数（已内联到 index.html，保留参考）
│   ├── toc.js                  # 目录生成工具
│   └── utils.js                # 通用工具函数
├── server.js                   # HTTP 服务（支持独立运行 / 被 extension.js require）
├── extension.js                # VS Code 插件入口（WebviewProvider + Server 管理）
├── package.json                # VS Code Extension Manifest + npm 脚本
├── .vscodeignore               # 打包 .vsix 时排除的文件
├── config.json                 # 运行时配置（debugLog 等）
├── data/                       # 数据目录（运行时生成）
│   └── todo/                   # Markdown文件存储
│       └── .bak/               # 自动备份目录
├── prompt/                     # Prompt模板库
│   ├── promptTemplateConfig.json   # 模板类型/标签枚举配置
│   ├── promptTemplateLibrary.json  # 模板业务数据
│   └── template/               # 模板MD文件存储
├── obsidian/                   # Obsidian 插件源码
│   ├── manifest.json           # 插件元数据（id / version / isDesktopOnly）
│   ├── main.js                 # 插件入口（启动 Server / Ribbon Icon / 设置面板）
│   └── styles.css              # 插件样式（iframe 容器尺寸）
├── scripts/                    # 构建脚本
│   └── build-obsidian.js       # Obsidian 插件打包脚本（复制前端资源到 obsidian-dist/）
├── docs/                       # 文档
│   └── obsidian-plugin-assessment.md  # Obsidian 插件可行性评估报告
├── obsidian-dist/              # 构建输出（gitignore，Obsidian 插件安装包）
└── DESIGN.md                   # 设计规范
```

**已删除的遗留文件（不影响功能）：**
- `assets/node.css` / `assets/node.html` —— 旧版独立节点编辑器，功能已合并到 index.html 弹窗
- `assets/icon-F.jpg` / `assets/icon-P.jpg` / `assets/icon-R.jpg` —— 未被引用，项目中只使用 -mini.jpg 版本
- `js/event-bus.js` —— 未被任何文件引用

## 模块索引

### VS Code 插件模块（extension.js）

| 模块名 | 主要函数/类 | 职责 |
|--------|------------|------|
| Sidebar Provider | `VibeCodingSOPSidebarProvider` | Activity Bar 控制面板（启动/停止/打开设置） |
| Server 管理 | `ensureServer(context, workDir)` | 动态加载 server.js，启动 HTTP Server |
| 工作目录 | `selectWorkDir()` / `ensurePromptDefaults()` | 文件夹选择器 + 首次运行时复制默认模板到工作目录 |
| Webview | `openEditorPanel()` | 创建 WebviewPanel，iframe 嵌入本地服务 |
| 命令注册 | `activate()` | 注册 open / selectWorkDir / stopServer 命令 |

### Obsidian 插件模块（obsidian/main.js）

| 模块名 | 主要函数/类 | 职责 |
|--------|------------|------|
| 插件主类 | `VibeCodingSOPPlugin` | 继承 Obsidian `Plugin`，管理生命周期 |
| Server 管理 | `startServer()` / `waitForServer()` | 复用 `server.js`，设置 `MD2MIND_WORK_DIR` 环境变量 |
| 工作目录 | `getWorkDir()` | Vault 根目录 + `settings.dataDir`（默认 `EdPau3`） |
| 视图容器 | `VibeCodingSOPView` | `ItemView` 子类，WorkspaceLeaf 中嵌入 iframe |
| Ribbon 图标 | `addRibbonIcon()` | 左侧功能区按钮，点击打开视图 |
| 设置面板 | `VibeCodingSOPSettingTab` | `PluginSettingTab` 子类，配置 `dataDir` |
| 默认模板 | `ensurePromptDefaults()` | 首次启动将插件自带 `prompt/` 复制到工作目录 |

### 后端 API（server.js）

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/prompt/config` | GET | 读取 `prompt/promptTemplateConfig.json` |
| `/api/prompt/library` | GET | 读取 `prompt/promptTemplateLibrary.json` |
| `/api/prompt/library` | POST | 保存模板库 JSON（自动备份到 `todo/.bak/`） |
| `/api/prompt/template` | POST | 保存模板 MD 文件（自动备份到 `todo/.bak/`） |
| `/api/prompt/template/:file` | GET | 读取单个模板 MD 文件内容 |

### Prompt Library 模块（prompt-library.html）

| 模块名 | 主要函数 | 职责 |
|--------|----------|------|
| 数据获取 | `loadConfig()`, `loadLibrary()` | 从服务器获取配置和模板库 |
| 分组渲染 | `renderLibrary()` | 按 PromptType 分组，过滤禁用项，收藏置顶 |
| 分组折叠 | `toggleGroup()` | 展开/收起分组 |
| 导入流程 | `openImportModal()`, `handleFileSelect()`, `saveTemplate()` | 打开文件、读取 MD、填写元数据、保存入库 |
| 编辑流程 | `openEditModal()` | 加载现有模板数据到弹窗表单 |
| ID 生成 | `generateNextId()` | 从现有模板 ID 中累加生成新 ID |
| 文件名生成 | `generateFileName()` | `标题-版本-日期.md` |

### JavaScript 模块（index.html 按行号范围）

| 模块名 | 行号范围 | 主要函数 | 职责 |
|--------|----------|----------|------|
| 全局变量 | 340-385 | - | 配置参数、全局状态 |
| 工具函数 | 386-440 | showToastMsg, now, deepClone, buildParentMap, isAncestorOf | 通用工具 |
| 节点创建 | 444-560 | createNode, generateMetadata, refreshMetadata, cascadeInherit | 创建节点、元数据生成 |
| 树操作 | 541-575 | findNode, findParent, removeChild, getLevel, getLevelOrder | 树结构操作 |
| 历史记录 | 577-600 | saveState, undo, redo | 撤销/重做 |
| 布局算法 | 602-652, 1954-2067 | layoutNode, layoutNodeVariableWidth, alignLayout, relayout | 节点布局计算 |
| 节点渲染 | 654-887 | createNodeEl, fullRender, renderNodes, renderConnections | DOM 渲染 |
| 拖拽/移动 | 889-925 | recordSubtreeStartPos, moveSubtree, updateSubtreeDOMPositions | 节点移动 |
| 节点事件 | 927-1105 | bindSingleNodeEvents, bindNodeEvents, selectNode | 事件绑定 |
| 批量选择 | 1107-1263 | selectNodesByIds, showBatchSelectPanel, syncBatchPanel | 多选操作 |
| 节点信息栏 | 1267-1490 | syncPanelFromNode, syncPanelToNode, setupPanelEvents | 右侧信息栏 |
| 节点操作 | 1492-1608 | addChild, addSibling, confirmDelete, doDelete | 添加/删除节点 |
| Markdown 解析 | 1610-1728 | parseMD, savePrevDesc, updateNodeInfo | MD 导入 |
| Markdown 导出 | 1730-1794 | syncMdPanelFromCanvas, exportMD | MD 导出 |
| 文件操作 | 1796-1935 | showFilePicker, loadTodoFile, openFile, saveFile | 文件管理 |
| 画布操作 | 1930-2273 | initCanvas, centerCanvas, expandAllNodes, zoomIn/Out | 画布控制 |
| 框选功能 | 2275-2371 | getDescendantIds, getNodesInRect | 拖拽框选 |
| Markdown 面板 | 2515-2860 | updateMdPreview, updateMdToc, updateLogPanel | MD 预览面板 |
| 日志功能 | 2744-2942 | updateLogPanel, renderLogList, addLog, autoSave | 日志与自动保存 |
| 节点信息面板 | 2989-3210 | updateNodeInfoPanelContent, updateNodeInfoPreview | 节点信息面板 |
| 弹窗功能 | 3212-3595 | openModal, closeModal, setNodeModalMode, generateToc | 弹窗管理 |
| 暂存功能 | 3486-3595 | restoreTempSave, clearTempSavesForFile, applyAllTempSaves | 暂存管理 |
| Builder 功能 | 1876-1920 | updateNodeJournal, sendUpdateJournal | 追加 History Log 引用到节点 |
| iframe 通信 | 5800-5880 | postMessage 监听（SELECTED_NODES_DATA / REQUEST_NODES / UPDATE_JOURNAL） | 与 prompt-optimization.html 通信 |

### CSS 模块（styles/main.css）

| 模块名 | 行号范围 | 职责 |
|--------|----------|------|
| 基础样式 | 1-40 | 重置、全局样式 |
| 工具栏 | 42-80 | 左侧工具栏 |
| 画布 | 82-126 | 思维导图画布 |
| 面板基础 | 127-200 | 面板容器、标题栏 |
| Markdown 面板 | 212-300 | MD 预览面板样式 |
| 节点信息面板 | 302-400 | 节点信息面板样式 |
| 弹窗 | 402-500 | 模态弹窗样式 |
| 节点样式 | 502-700 | 节点 DOM 样式 |
| 表单控件 | 702-900 | 输入框、下拉框等 |
| 目录样式 | 902-1000 | 目录显示样式 |
| 日志面板 | 1000-1100 | 日志/自动保存/备份配置/模板库路径 |

### CSS 模块（styles/prompt-library.css）

| 模块名 | 职责 |
|--------|------|
| 页面布局 | Library 容器、工具栏、分组、卡片网格 |
| 分组折叠 | 分组标题栏、展开/收起、箭头动画 |
| 模板卡片 | 3 列网格、信息行、标签、编辑按钮 |
| 导入弹窗 | 模态遮罩、表单字段、版本号 3 段输入 |
| Toast 提示 | 成功/失败消息提示 |

### HTML 结构（index.html）

| 区域 | 行号范围 | 内容 |
|------|----------|------|
| HEAD | 1-40 | meta、样式引入 |
| 工具栏 | 45-75 | 左侧工具栏按钮 |
| 画布 | 76-115 | SVG 画布 |
| Markdown 面板 | 116-175 | MD 预览面板 HTML |
| 节点信息面板 | 176-230 | 节点信息面板 HTML |
| 节点信息栏 | 231-340 | 右侧固定信息栏 |
| 弹窗 | 341-360 | 各类弹窗 |
| JavaScript | 361-6000+ | 所有 JS 代码 |

## 快速修改指南

### 常见修改场景

| 修改目标 | 文件 | 行号/位置 | 修改方式 |
|---------|------|----------|----------|
| 修改节点间距 | index.html | 340-344行 | 修改 NODE_W/H_GAP/V_GAP |
| 修改面板宽度 | styles/main.css | 搜索 `.md-panel` | 修改 width 属性 |
| 修改目录链接颜色 | styles/main.css | 搜索 `.md-toc-content a` | 修改 color 属性 |
| 修改自动保存间隔 | index.html | 搜索 `autoSaveIntervalTime` | 修改默认值 |
| 添加工具栏按钮 | index.html | 搜索 `class="toolbar"` | 添加 button 元素 |
| 修改节点选中样式 | styles/main.css | 搜索 `.node.selected` | 修改样式 |

### 布局参数调整

```javascript
// index.html 第340-344行
var NODE_W = 130;   // 节点宽度
var H_GAP = 60;     // 水平间距（父子节点）
var V_GAP = 16;     // 垂直间距（兄弟节点）
var EST_H = 58;     // 估计高度
```

### 事件绑定位置

| 事件 | 绑定位置 | 处理函数 |
|------|---------|----------|
| 节点点击 | createNodeEl() | selectNode() |
| 节点拖拽 | bindSingleNodeEvents() | handleDrag |
| 画布框选 | canvas.addEventListener('mousedown') | 框选逻辑 |
| 面板切换 | mdPreviewBtn/nodeInfoBtn | 面板滑出逻辑 |

## 关键函数快速定位

### 布局相关
- `alignLayout()`: 第1954行 - 对齐布局
- `relayout()`: 第2000行 - 重新布局
- `layoutNodeVariableWidth()`: 第2095行 - 变宽布局算法
- `computeSubtreeH()`: 第2103行 - 计算子树高度
- `assignPositions()`: 第2119行 - 分配节点位置

### 渲染相关
- `fullRender()`: 第787行 - 完整渲染
- `renderNodes()`: 第838行 - 渲染节点
- `renderConnections()`: 第851行 - 渲染连线
- `createNodeEl()`: 第654行 - 创建节点DOM

### 节点操作
- `selectNode()`: 第1064行 - 选中节点
- `addChild()`: 第1492行 - 添加子节点
- `doDelete()`: 第1573行 - 删除节点

### 面板操作
- `updateMdPreview()`: 第2515行 - 更新MD预览
- `updateNodeInfoPanelContent()`: 第2989行 - 更新节点信息面板
- `openModal()`: 第3338行 - 打开弹窗

### 文件操作
- `loadTodoFile()`: 第1844行 - 加载文件
- `saveFile()`: 第1901行 - 保存文件
- `autoSave()`: 第2907行 - 自动保存

### Builder 相关
- `updateNodeJournal()`: 第1876行 - 接收 UPDATE_JOURNAL，追加 History Log 引用
- `sendUpdateJournal()`: prompt-optimization.html - 发送 postMessage 到父页面

## 全局变量说明

```javascript
// 布局参数（index.html 第340-344行，或 js/config.js）
var NODE_W = 130;    // 节点默认宽度
var H_GAP = 60;      // 水平间距
var V_GAP = 16;      // 垂直间距
var EST_H = 58;      // 估计高度

// 画布状态
var scale = 1;       // 缩放比例
var panX = 0;        // 水平平移
var panY = 0;        // 垂直平移

// 节点状态
var data = null;     // 树形数据
var selectedId = null;      // 单选节点ID
var selectedIds = new Set(); // 多选节点ID集合

// 文件状态
var currentFileName = null; // 当前文件名
var autoSaveInterval = null; // 自动保存定时器
```

## 配置文件说明

`js/config.js` 包含所有可配置参数的定义，可作为配置参考。
当前配置值已内联到 index.html 中，修改时请注意两边同步。

`config.json` 是运行时配置文件：
- `debugLog`: 调试日志开关（boolean）

## 开发指南

### 添加新功能
1. 在对应模块区域添加函数
2. 如需 UI，在 HTML 对应区域添加元素
3. 如需样式，在 CSS 对应区域添加规则
4. 更新本文件索引

### 修改布局参数
修改第340-344行的全局变量：
```javascript
var NODE_W = 130;  // 节点宽度
var H_GAP = 60;    // 水平间距
var V_GAP = 16;    // 垂直间距
```

### VS Code 插件相关
- **修改模板存储路径**：`server.js` 中 `PROMPT_DIR` 和 `PROMPT_TEMPLATE_DIR`
- **修改备份保留数量**：`server.js` 中 `maxBackups`（默认100，与MD备份共用）
- **修改配置/库文件名**：`server.js` 中 `PROMPT_CONFIG_FILE` / `PROMPT_LIBRARY_FILE`
- **修改模板卡片样式**：`styles/prompt-library.css` 中 `.template-card`
- **修改弹窗表单字段**：`prompt-library.html` 中 `#importModal` 表单
- **修改 Activity Bar 图标**：`package.json` 中 `viewsContainers`
- **修改默认模板释放逻辑**：`extension.js` 中 `ensurePromptDefaults()`

### Obsidian 插件相关
- **修改数据目录默认值**：`obsidian/main.js` 中 `loadSettings()` 的默认 `dataDir`
- **修改 Ribbon 图标**：`obsidian/main.js` 中 `addRibbonIcon()` 第一个参数
- **修改视图类型 ID**：`obsidian/main.js` 中 `VIEW_TYPE` 常量
- **修改 manifest**：`obsidian/manifest.json` 中 `id` / `name` / `version`
- **修改 iframe 样式**：`obsidian/styles.css` 中 `.vibecodingsop-view iframe`
- **修改默认模板释放逻辑**：`obsidian/main.js` 中 `ensurePromptDefaults()`
- **构建插件**：`node scripts/build-obsidian.js`
- **构建并安装**：`node scripts/build-obsidian.js --install=/path/to/Vault/.obsidian/plugins/vibecodingsop`

### 修改面板宽度
修改 CSS 第127-200行的面板样式：
```css
.md-panel { width: 40%; }
.node-info-panel { width: 40%; }
```

## 测试清单

### 核心功能
- [ ] 思维导图：添加/删除/拖拽节点
- [ ] 思维导图：展开/折叠
- [ ] 思维导图：框选多节点
- [ ] 布局：对齐布局/重新布局
- [ ] 节点信息栏：编辑/暂存
- [ ] Markdown 面板：编辑/预览/目录/保存
- [ ] 节点信息面板：编辑/预览/暂存
- [ ] 文件：打开/保存/自动保存
- [ ] 撤销/重做

### VS Code 插件
- [ ] 插件安装后 Activity Bar 出现图标
- [ ] 点击图标启动 HTTP Server
- [ ] 首次启动自动复制默认 Prompt 模板到工作目录
- [ ] 工作目录切换功能正常
- [ ] iframe 正确加载本地服务

### Obsidian 插件
- [ ] 插件安装后 Ribbon 出现图标（git-branch 图标）
- [ ] 点击图标启动 HTTP Server，WorkspaceLeaf 中嵌入 iframe
- [ ] 首次启动自动复制默认 Prompt 模板到 Vault/EdPau3/
- [ ] 设置面板可修改数据目录（默认 `EdPau3`）
- [ ] 数据目录修改后重启插件生效
- [ ] iframe 中 postMessage 通信正常（prompt-optimization ↔ index.html）
- [ ] manifest.json 中 `isDesktopOnly: true` 阻止移动端加载

### Prompt Library
- [ ] Library Tab：iframe 正确加载 prompt-library.html
- [ ] 分组展示：按 PromptType 分组，默认折叠
- [ ] 收藏置顶：收藏模板在分组内优先显示
- [ ] 禁用隐藏：Enabled=false 的模板不显示
- [ ] 导入流程：打开 MD 文件 → 填写元数据 → 保存入库
- [ ] 编辑流程：点击编辑按钮 → 修改元数据 → 保存
- [ ] 自动备份：保存前自动备份到 todo/.bak/
- [ ] ID 生成：新模板 ID 正确累加
- [ ] 文件名：格式为 `标题-版本-日期.md`

### Builder 功能
- [ ] Builder-md / Builder-json 点击后生成文件
- [ ] 生成的文件自动追加到节点 frontmatter 的 AITaskJournal
- [ ] 生成的文件引用自动追加到节点正文最后（*** 之前）
- [ ] 多次点击 Builder 正确追加多条引用
- [ ] 节点正文不会被覆盖

### 面板交互
- [ ] 工具栏按钮：所有按钮可点击
- [ ] 面板滑出：思维导图右移
- [ ] 面板关闭：思维导图恢复

## 核心函数依赖关系图

```
用户操作
    │
    ├─► addChild() ─► saveState() + createNode() + generateMetadata() + fullRender()
    │
    ├─► doDelete() ─► saveState() + removeChild() + fullRender() + syncPanelFromNode()
    │
    ├─► fullRender() ─► renderNodes() + renderConnections() + updateTransform()
    │       │
    │       └─► renderNodes() ─► layoutNodeVariableWidth() + createNodeEl()
    │
    ├─► parseMD() ─► buildParentMap() + createNode() + fullRender()
    │
    ├─► exportMD() ─► buildMarkdown()
    │
    ├─► selectNode() ─► syncPanelFromNode() + updateBasicInfo()
    │
    └─► updateNodeJournal() ─► update node.aiTaskJournal + node.request ─► syncPanelFromNode(true)
```

## 全局变量说明

| 变量名 | 类型 | 用途 | 读写 |
|--------|------|------|------|
| `data` | Object | 树形数据根节点 | 读写 |
| `selectedId` | String | 当前选中节点ID | 读写 |
| `selectedIds` | Set | 多选节点ID集合 | 读写 |
| `panX, panY` | Number | 画布平移量 | 读写 |
| `scale` | Number | 画布缩放比例 | 读写 |
| `history` | Array | 撤销历史栈 | 读写 |
| `currentFileName` | String | 当前文件名 | 读写 |
| `currentServer` | Object | VS Code 模式下运行的 HTTP Server 实例 | 只读（extension.js） |
| `currentWorkDir` | String | VS Code 模式下当前工作目录 | 只读（extension.js） |
