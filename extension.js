const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function logInfo(...args) { console.log('[VibeCodingSOP]', ...args); }
function logError(...args) { console.error('[VibeCodingSOP]', ...args); }

let serverModule = null;
let serverInstance = null;
let serverPort = null;
let currentPanel = null;

// ============ 工作目录管理 ============

function getWorkDir(context) {
  // 1. 优先读取 globalState 中保存的
  const saved = context.globalState.get('md2mind.workDir');
  if (saved && fs.existsSync(saved)) return saved;

  // 2.  fallback 到当前 VS Code workspace 根目录
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }

  // 3. 最后 fallback 到 extension 路径下的 lib/
  return path.join(context.extensionPath, 'lib');
}

async function setWorkDir(context, newDir) {
  await context.globalState.update('md2mind.workDir', newDir);
  vscode.window.showInformationMessage(`[VibeCodingSOP] 工作目录已更新：${newDir}`);
}

// ============ Prompt 模板默认文件复制 ============

function ensurePromptDefaults(context, workDir) {
  const srcPromptDir = path.join(context.extensionPath, 'prompt');
  const destPromptDir = path.join(workDir, 'prompt');

  if (!fs.existsSync(srcPromptDir)) {
    logInfo('插件目录下没有 prompt/ 默认模板，跳过复制');
    return;
  }

  // 确保目标 prompt/ 目录存在
  if (!fs.existsSync(destPromptDir)) {
    fs.mkdirSync(destPromptDir, { recursive: true });
  }

  // 需要复制的顶层文件
  const filesToCopy = ['promptTemplateConfig.json', 'promptTemplateLibrary.json'];
  for (const file of filesToCopy) {
    const src = path.join(srcPromptDir, file);
    const dest = path.join(destPromptDir, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      logInfo(`已复制默认模板文件：${file}`);
    }
  }

  // 复制 template/ 目录下的 .md 文件
  const srcTemplateDir = path.join(srcPromptDir, 'template');
  const destTemplateDir = path.join(destPromptDir, 'template');
  if (fs.existsSync(srcTemplateDir)) {
    if (!fs.existsSync(destTemplateDir)) {
      fs.mkdirSync(destTemplateDir, { recursive: true });
    }
    const templateFiles = fs.readdirSync(srcTemplateDir);
    for (const file of templateFiles) {
      if (file.endsWith('.md')) {
        const src = path.join(srcTemplateDir, file);
        const dest = path.join(destTemplateDir, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          logInfo(`已复制默认模板：template/${file}`);
        }
      }
    }
  }
}

// ============ Server 管理 ============

async function ensureServer(context) {
  if (serverInstance) return serverPort;

  const vsConfig = vscode.workspace.getConfiguration('md2mind');
  const debugLog = vsConfig.get('debugLog', false);
  const workDir = getWorkDir(context);

  // 将插件自带的默认 Prompt 模板复制到工作目录（仅首次）
  ensurePromptDefaults(context, workDir);

  // 设置环境变量
  process.env.MD2MIND_LOG_LEVEL = debugLog ? 'debug' : 'silent';
  process.env.MD2MIND_WORK_DIR = workDir;
  process.env.DEPLOY_RUN_PORT = '0';

  // 动态加载 server.js
  const extensionPath = context.extensionPath;
  const libPath = path.join(extensionPath, 'lib');
  const serverPath = path.join(libPath, 'server.js');
  const fallbackPath = path.join(extensionPath, 'server.js');
  const actualServerPath = fs.existsSync(serverPath) ? serverPath : fallbackPath;

  if (!fs.existsSync(actualServerPath)) {
    throw new Error(`找不到 server.js：${actualServerPath}`);
  }

  delete require.cache[require.resolve(actualServerPath)];
  serverModule = require(actualServerPath);

  serverInstance = serverModule.startServer(0);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    serverInstance.on('listening', () => {
      clearTimeout(timeout);
      const addr = serverInstance.address();
      serverPort = addr ? addr.port : 0;
      logInfo(`[VibeCodingSOP] Server started at port ${serverPort}, workDir=${workDir}`);
      resolve();
    });
    serverInstance.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return serverPort;
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        serverPort = null;
        serverModule = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function getServerUrl() {
  if (!serverPort) return null;
  const localUri = vscode.Uri.parse(`http://localhost:${serverPort}`);
  const externalUri = await vscode.env.asExternalUri(localUri);
  return externalUri.toString();
}

// ============ WebviewViewProvider（Activity Bar 侧边栏） ============

class VibeCodingSOPSidebarProvider {
  constructor(context) {
    this.context = context;
    this.view = null;
  }

  resolveWebviewView(webviewView, context, _token) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this.context.extensionPath)]
    };

    webviewView.webview.html = this.getSidebarHtml(webviewView.webview);

    // 监听消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'openEditor':
          await openEditorPanel(this.context);
          this.refresh();
          break;
        case 'selectWorkDir':
          await handleSelectWorkDir(this.context);
          this.refresh();
          break;
        case 'stopServer':
          await stopServer();
          vscode.window.showInformationMessage('[VibeCodingSOP] 服务已停止');
          this.refresh();
          break;
        case 'copyUrl':
          const url = await getServerUrl();
          if (url) {
            await vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage(`地址已复制：${url}`);
          }
          break;
        case 'getStatus':
          this.refresh();
          break;
      }
    });

    // 初始刷新
    this.refresh();
  }

  refresh() {
    if (!this.view) return;
    const workDir = getWorkDir(this.context);
    const running = !!serverInstance;
    this.view.webview.postMessage({
      command: 'updateStatus',
      workDir,
      running,
      port: serverPort
    });
  }

  getSidebarHtml(webview) {
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon-logo.png'));
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      margin: 0; padding: 12px;
    }
    .logo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .logo-row img { width: 24px; height: 24px; }
    .logo-row span { font-weight: 600; font-size: 14px; }
    .btn {
      display: block; width: 100%; padding: 6px 10px;
      margin-bottom: 8px; border: none; border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer; font-size: 13px; text-align: center;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .btn.secondary {
      background: transparent;
      border: 1px solid var(--vscode-button-background);
      color: var(--vscode-button-background);
    }
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 11px; text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px; letter-spacing: 0.5px;
    }
    .info-row {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 0; font-size: 12px;
    }
    .info-label { color: var(--vscode-descriptionForeground); min-width: 48px; }
    .info-value {
      flex: 1; word-break: break-all;
      color: var(--vscode-foreground);
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block; margin-right: 4px;
    }
    .status-dot.on { background: #4ec9b0; }
    .status-dot.off { background: #f48771; }
    .url-row {
      display: flex; align-items: center; gap: 4px;
      background: var(--vscode-textBlockQuote-background);
      padding: 4px 6px; border-radius: 3px; font-size: 11px;
    }
    .url-row span { flex: 1; word-break: break-all; }
    .url-row button {
      background: transparent; border: none; color: var(--vscode-textLink-foreground);
      cursor: pointer; font-size: 11px; padding: 2px 4px;
    }
  </style>
</head>
<body>
  <div class="logo-row">
    <img src="${logoUri}" alt="logo">
    <span>VibeCodingSOP</span>
  </div>

  <div class="section">
    <button class="btn" id="btnOpen">打开思维导图</button>
    <button class="btn secondary" id="btnSelectDir">选择工作目录</button>
  </div>

  <div class="section">
    <div class="section-title">工作目录</div>
    <div class="info-row">
      <span class="info-value" id="workDir">加载中...</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">服务状态</div>
    <div class="info-row">
      <span class="status-dot off" id="statusDot"></span>
      <span id="statusText">已停止</span>
    </div>
    <div class="url-row" id="urlRow" style="display:none;">
      <span id="serverUrl">-</span>
      <button id="btnCopy">复制</button>
    </div>
    <button class="btn secondary" id="btnStop" style="display:none; margin-top:6px;">停止服务</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('btnOpen').addEventListener('click', () => {
      vscode.postMessage({ command: 'openEditor' });
    });
    document.getElementById('btnSelectDir').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectWorkDir' });
    });
    document.getElementById('btnStop').addEventListener('click', () => {
      vscode.postMessage({ command: 'stopServer' });
    });
    document.getElementById('btnCopy').addEventListener('click', () => {
      vscode.postMessage({ command: 'copyUrl' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'updateStatus') {
        document.getElementById('workDir').textContent = msg.workDir || '-';
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusText');
        const urlRow = document.getElementById('urlRow');
        const btnStop = document.getElementById('btnStop');
        if (msg.running) {
          dot.className = 'status-dot on';
          txt.textContent = '运行中 (端口 ' + (msg.port || '?') + ')';
          urlRow.style.display = 'flex';
          document.getElementById('serverUrl').textContent = 'http://localhost:' + msg.port;
          btnStop.style.display = 'block';
        } else {
          dot.className = 'status-dot off';
          txt.textContent = '已停止';
          urlRow.style.display = 'none';
          btnStop.style.display = 'none';
        }
      }
    });

    // 初始请求状态
    vscode.postMessage({ command: 'getStatus' });
  </script>
</body>
</html>`;
  }
}

// ============ 编辑器面板 ============

async function openEditorPanel(context) {
  try {
    await ensureServer(context);
  } catch (err) {
    vscode.window.showErrorMessage(`[VibeCodingSOP] 启动服务失败: ${err.message}`);
    return;
  }

  const serverUrl = await getServerUrl();

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    currentPanel.webview.postMessage({ command: 'updateUrl', url: serverUrl });
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'vibecodingsop',
    '思维导图',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  currentPanel.webview.html = getEditorHtml(serverUrl);
  currentPanel.onDidDispose(() => { currentPanel = null; });
}

function getEditorHtml(serverUrl) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>思维导图</title>
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#1e1e1e; }
    #container { width:100%; height:100%; display:flex; flex-direction:column; }
    #toolbar { height:28px; background:#2d2d2d; border-bottom:1px solid #3a3a3a; display:flex; align-items:center; padding:0 8px; flex-shrink:0; }
    #toolbar span { color:#cccccc; font-size:12px; font-family:sans-serif; }
    #toolbar .url { color:#808080; margin-left:8px; font-size:11px; user-select:text; }
    iframe { flex:1; width:100%; border:none; background:#1e1e1e; }
  </style>
</head>
<body>
  <div id="container">
    <div id="toolbar">
      <span>VibeCodingSOP 思维导图编辑器</span>
      <span class="url">${serverUrl}</span>
    </div>
    <iframe id="appFrame" src="${serverUrl}"></iframe>
  </div>
  <script>
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg && msg.command === 'updateUrl') {
        const f = document.getElementById('appFrame');
        if (f && f.src !== msg.url) f.src = msg.url;
      }
    });
  </script>
</body>
</html>`;
}

// ============ 工作目录选择 ============

async function handleSelectWorkDir(context) {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: '选择工作目录',
    defaultUri: vscode.Uri.file(getWorkDir(context))
  });

  if (!result || result.length === 0) return;

  const newDir = result[0].fsPath;
  await setWorkDir(context, newDir);

  // 如果 server 正在运行，提示需要重启
  if (serverInstance) {
    const choice = await vscode.window.showInformationMessage(
      '工作目录已更改，需要重启服务才能生效。是否立即重启？',
      '立即重启', '稍后手动重启'
    );
    if (choice === '立即重启') {
      await stopServer();
      vscode.window.showInformationMessage('[VibeCodingSOP] 服务已重启');
    }
  }
}

// ============ Activate / Deactivate ============

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // 注册 Activity Bar 侧边栏视图
  const sidebarProvider = new VibeCodingSOPSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibecodingsop.sidebar', sidebarProvider)
  );

  // 命令：打开思维导图（编辑器面板）
  context.subscriptions.push(
    vscode.commands.registerCommand('md2mind.open', () => openEditorPanel(context))
  );

  // 命令：选择工作目录
  context.subscriptions.push(
    vscode.commands.registerCommand('md2mind.selectWorkDir', () => handleSelectWorkDir(context))
  );

  // 命令：停止服务
  context.subscriptions.push(
    vscode.commands.registerCommand('md2mind.stopServer', async () => {
      await stopServer();
      vscode.window.showInformationMessage('[VibeCodingSOP] 服务已停止');
      sidebarProvider.refresh();
    })
  );
}

function deactivate() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

module.exports = { activate, deactivate };