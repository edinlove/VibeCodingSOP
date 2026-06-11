# VibeCodingSOP — Markdown 思维导图编辑器

一个面向 Vibe Coding 工作流的思维导图编辑器，支持 Markdown 导入导出、节点元数据管理、Prompt 模板库。同时支持三种运行模式：独立服务端、VS Code 插件、Obsidian 插件。

## 功能特性

### 思维导图核心
- **Markdown 双向转换**：支持从 Markdown 导入生成思维导图，也支持将思维导图导出为 Markdown
- **节点元数据**：每个节点支持 Status、Priority、Mainline、Module、AITaskJournal 等元数据字段
- **拖拽与布局**：支持节点拖拽、自动对齐布局、缩放平移
- **批量操作**：框选多节点、批量编辑
- **撤销/重做**：完整的历史记录栈

### Prompt 模板库
- **模板管理**：支持导入、编辑、禁用 Prompt 模板
- **分组展示**：按 PromptType 自动分组，支持收藏置顶
- **版本控制**：模板支持版本号管理，自动备份历史版本
- **Builder 功能**：一键将选中的节点信息生成为 Markdown/JSON，自动追加到节点元数据
- **History Log**：记录所有 Builder 生成的文件，支持追加到节点正文

### 多平台支持
- **独立服务端**：`node server.js` 直接启动，浏览器访问
- **VS Code 插件**：Activity Bar 集成，Webview iframe 嵌入
- **Obsidian 插件**：Ribbon Icon 集成，WorkspaceLeaf iframe 嵌入，支持桌面端（Mac/Windows）

### 其他功能
- **Table 视图**：独立页面展示节点表格（Tabulator.js）
- **自动保存**：定时自动保存到文件
- **本地备份**：保存前自动备份到 `todo/.bak/`
- **主题切换**：支持增强主题（通过设置开关控制）

## 安装与使用

### 方式一：Obsidian 插件（桌面端）

1. 克隆本仓库到本地
2. 构建插件：
   ```bash
   npm run build:obsidian
   ```
3. 将构建产物复制到 Vault 的插件目录：
   ```bash
   cp -r release/vibecodingsop /path/to/Vault/.obsidian/plugins/
   ```
4. 重启 Obsidian
5. 进入 `设置 → 社区插件 → 已安装插件`，启用 **VibeCodingSOP**
6. 点击左侧 Ribbon 栏的 VibeCodingSOP 图标即可打开

**数据路径配置**：进入 `设置 → 社区插件 → VibeCodingSOP`，可修改数据目录（默认 `EdPau3/`，相对于 Vault 根目录）。

### 方式二：VS Code 插件

1. 克隆本仓库到本地
2. 构建插件：
   ```bash
   npm run build:vscode
   ```
3. 在 VS Code 中安装生成的 `.vsix` 文件：
   - 打开 VS Code
   - 点击左侧活动栏最下方的扩展图标
   - 点击右上角的 `...` → `从 VSIX 安装`
   - 选择生成的 `release/vibecodingsop-{version}.vsix`
4. 安装完成后，左侧活动栏会出现 VibeCodingSOP 图标，点击即可启动

### 方式三：独立运行

```bash
pnpm install
pnpm start
```

然后打开浏览器访问 `http://localhost:5000`

## 统一构建系统

本项目提供一键构建脚本，支持同时生成 VS Code 和 Obsidian 两个插件：

```bash
# 一键构建两个插件
npm run build:release

# 仅构建 VS Code 插件
npm run build:vscode

# 仅构建 Obsidian 插件
npm run build:obsidian
```

构建产物位于 `release/` 目录下：

```
release/
├── vibecodingsop-{version}.vsix   ← VS Code 插件
└── vibecodingsop/                  ← Obsidian 插件目录（直接复制到 Vault）
    ├── manifest.json
    ├── main.js
    ├── styles.css
    ├── server.js
    ├── index.html
    ├── ...
```

### 版本号管理

版本号以 `package.json` 中的 `version` 字段为唯一来源。运行构建脚本时，会自动同步到 `obsidian/manifest.json`。**只需修改 `package.json` 一处即可。**

## 目录结构

```
.
├── index.html                  # 主页面
├── table-viewer.html           # Table 视图
├── prompt-library.html         # Prompt 模板库
├── prompt-optimization.html    # Prompt Optimization
├── prompt-historylog.html      # Prompt History Log
├── server.js                   # HTTP 服务（三平台复用）
├── extension.js                # VS Code 插件入口
├── package.json                # VS Code 扩展配置 + 版本号唯一来源
├── config.json                 # 运行时配置
├── .vscodeignore               # VS Code 打包排除配置
├── styles/                     # 样式文件
├── assets/                     # 图标资源
├── js/                         # 独立 JS 模块
├── prompt/                     # Prompt 模板库数据
│   ├── promptTemplateConfig.json
│   ├── promptTemplateLibrary.json
│   └── template/               # 模板 MD 文件
├── obsidian/                   # Obsidian 插件源码
│   ├── manifest.json
│   ├── main.js
│   └── styles.css
├── scripts/                    # 构建脚本
│   ├── build-release.js        # 统一构建脚本
│   ├── build-vscode.js         # VS Code 构建
│   └── build-obsidian.js       # Obsidian 构建
├── release/                    # 构建产物（自动生成，不入 git）
├── data/                       # 运行时数据（自动生成）
│   └── todo/
│       └── .bak/               # 自动备份
└── todo/                       # Markdown 文件存储
```

## 节点元数据字段说明

| 字段 | 说明 | 示例值 |
|------|------|--------|
| UUID | 唯一标识符 | `a1b2c3d4` |
| ID | 节点编号 | `n1`, `n1.1` |
| Status | 状态 | N=new, O=ongoing, D=done, U=update, C=cancel |
| Priority | 优先级 | 1️⃣~5️⃣，默认 2️⃣ |
| Mainline | 主线标记 | true/false |
| Module | 模块名 | 继承父节点 |
| AITaskJournal | 任务日志引用 | `[[../prompt/.historylog/xxx.md]]` |

## 三平台运行模式对比

| 特性 | 独立运行 | VS Code 插件 | Obsidian 插件 |
|------|---------|-------------|--------------|
| 启动方式 | `node server.js` / `pnpm start` | 点击 Activity Bar 图标 | 点击 Ribbon Icon |
| 工作目录 | 当前目录 | 通过文件夹选择器配置 | Vault 根目录 + 配置项 |
| 数据存储 | `./todo/` / `./prompt/` | 工作目录下的 `todo/` / `prompt/` | `Vault/{dataDir}/todo/` / `prompt/` |
| 前端代码 | 完全相同 | 完全相同（iframe 嵌入） | 完全相同（iframe 嵌入） |
| 后端代码 | server.js | server.js（复用） | server.js（复用） |
| 适用平台 | 所有支持 Node.js 的平台 | 桌面端（Mac/Windows/Linux） | 桌面端（Mac/Windows），iPad 暂不支持 |

## 开发指南

### 技术栈
- 前端：原生 HTML/CSS/JavaScript（无框架依赖）
- Markdown 渲染：[marked.js](https://marked.js.org/)
- 表格组件：[Tabulator](https://tabulator.info/)
- VS Code API：[Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- Obsidian API：[Plugin API](https://docs.obsidian.md/Reference/TypeScript+API/Plugin)

### 关键文件
| 文件 | 说明 |
|------|------|
| `index.html` | 主页面，包含所有核心 JS 逻辑（约 6000+ 行） |
| `server.js` | HTTP 服务，支持独立运行或被 VS Code/Obsidian 插件 require |
| `extension.js` | VS Code 插件入口 |
| `obsidian/main.js` | Obsidian 插件入口 |
| `styles/main.css` | 主样式文件 |
| `js/config.js` | 全局配置参数参考 |

### 添加新功能
1. 在 `index.html` 对应模块区域添加函数
2. 如需 UI，在 HTML 对应区域添加元素
3. 如需样式，在 `styles/main.css` 对应区域添加规则
4. 更新 `AGENTS.md` 索引
5. 重新运行 `npm run build:release` 生成两个平台插件

## 打包配置

`.vscodeignore` 已配置排除以下文件（不会打包进 `.vsix`）：
- 版本控制文件（`.git/`, `.gitignore`）
- 开发文档（`AGENTS.md`, `DESIGN.md`, `docs/`）
- 包管理缓存（`node_modules/`, `pnpm-lock.yaml`）
- 运行时数据（`todo/`, `data/`, `prompt/.historylog/`）
- Obsidian 构建源码（`obsidian/`）
- 构建脚本（`scripts/`）
- 构建产物（`release/`, `obsidian-dist/`）

## 许可证

MIT
