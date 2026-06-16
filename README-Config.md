## 启动/打包命令

### 1. 独立 HTTP Server（本地浏览器直接访问）

```bash
# 开发模式启动（热更新，端口 5000）
cd /workspace/projects && coze dev

# 或直接启动 Node.js 服务
cd /workspace/projects && node server.js
```

启动后访问 `http://localhost:5000/`。

---

### 2. VS Code 插件

```bash
# 一键打包（生成 release/vibecodingsop-{version}.vsix）
npm run build:vscode

# 或完整统一构建（VS Code + Obsidian）
npm run build:release
```

打包后产物位于 `release/vibecodingsop-{version}.vsix`，在 VS Code 扩展面板中选择「从 VSIX 安装」。

---

### 3. Obsidian 插件（Mac 桌面端）

```bash
# 一键构建（生成 release/vibecodingsop/ 目录，无需重命名）
npm run build:obsidian

# 构建并直接安装到指定 Vault
node scripts/build-obsidian.js --install=/path/to/Vault/.obsidian/plugins/vibecodingsop
```

构建后产物位于 `release/vibecodingsop/`，复制到 Vault 的 `.obsidian/plugins/vibecodingsop/` 目录下即可。

---

## 配置项清单

### 配置优先级说明
- **环境变量** > **运行时配置文件** > **前端设置面板**
- `server.js` 启动时读取 `MD2MIND_WORK_DIR` 环境变量作为数据根目录

---

### 配置文件 1：`package.json`（版本号唯一来源）

| 配置项 | 说明 |
|--------|------|
| `version` | **唯一版本号来源**，自动同步到 `obsidian/manifest.json` |
| `scripts.build:release` | `node scripts/build-release.js` |
| `scripts.build:vscode` | `node scripts/build-release.js --vscode-only` |
| `scripts.build:obsidian` | `node scripts/build-release.js --obsidian-only` |

---

### 配置文件 2：`config.json`（运行时配置）

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `isProd` | boolean | 是否生产环境（自动判断） |
| `currentWorkDir` | string | 当前工作目录 |
| `localTodoDir` | string | 本地开发环境 todo 文件存放路径 |
| `prodTodoDir` | string | 生产环境 todo 文件存放路径（`/tmp/todo`） |
| `debugLog` | boolean | 调试日志开关 |

---

### 配置文件 3：`obsidian/manifest.json`（Obsidian 插件元数据）

| 配置项 | 说明 |
|--------|------|
| `id` | 插件 ID（`vibecodingsop`） |
| `version` | **由构建脚本自动从 `package.json` 同步** |
| `isDesktopOnly` | `true`，阻止移动端加载 |

---

### 配置文件 4：`prompt/promptTemplateConfig.json`（Prompt 模板配置）

| 配置项 | 说明 |
|--------|------|
| `version` | 模板配置版本 |
| `excluded_patterns` | 文件扫描排除列表（`.git`、`node_modules` 等） |
| `AIAutomaticallySelectsFiles` | AI 自动选中文件列表（如 `AGENTS.md`） |
| `promptTemplateType` | 模板类型枚举（格式化输出、需求分析等） |
| `promptTemplateTags` | 模板标签枚举 |

---

### 配置文件 5：`.vscodeignore`（VS Code 插件打包排除规则）

控制哪些文件/目录**不打包**进 `.vsix`：
- `obsidian/`、`obsidian-dist/`、`scripts/`、`docs/`、`release/`
- `.historylog/`（历史日志，运行时生成）

---

### 运行时动态配置（通过 `/api/config` 接口暴露给前端）

| 配置项 | 来源 |
|--------|------|
| `workDir` | `MD2MIND_WORK_DIR` 环境变量，或 `server.js` 所在目录 |
| `maxBackups` | `server.js` 中变量，默认 `100`，可通过 API 修改 |
| `debugLog` | VS Code `settings.json` 中 `md2mind.debugLog`，或 `config.json` |

---

### 各模式特有的配置入口

| 模式 | 配置入口 | 说明 |
|------|----------|------|
| **VS Code** | `settings.json` → `md2mind.debugLog` | 调试日志开关 |
| **VS Code** | Activity Bar 面板 →「选择工作目录」 | 工作目录持久化到 `globalState` |
| **Obsidian** | 设置面板 → `dataDir` | 默认 `EdPau3/`，可修改 |
| **Obsidian** | 设置面板 → `dataDir` | 实际工作目录 = `Vault 根目录 + dataDir` |
| **Standalone** | 环境变量 `MD2MIND_WORK_DIR` | 独立运行时手动设置 |
Now I have all the information I need. Let me provide a clear, well-structured answer about:
