const { Plugin, ItemView, WorkspaceLeaf, Setting, PluginSettingTab, Notice } = require('obsidian');
const path = require('path');
const fs = require('fs');

const VIEW_TYPE = 'vibecodingsop-view';

/**
 * VibeCodingSOP 自定义视图
 * 在 WorkspaceLeaf 中嵌入 iframe，加载本地 HTTP Server
 */
class VibeCodingSOPView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'VibeCodingSOP';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('vibecodingsop-view');

    // 等待 server 启动完成
    if (!this.plugin.serverPort) {
      try {
        await this.plugin.waitForServer();
      } catch (err) {
        new Notice('VibeCodingSOP Server 启动失败: ' + err.message, 5001);
        container.createEl('div', {
          text: 'Server 启动失败，请检查控制台日志。',
          cls: 'vibecodingsop-error'
        });
        return;
      }
    }

    const iframe = document.createElement('iframe');
    iframe.src = `http://localhost:${this.plugin.serverPort}`;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
    iframe.setAttribute('allow', 'clipboard-write');
    container.appendChild(iframe);
  }

  async onClose() {
    // 视图关闭时无需特殊清理，iframe 会自动销毁
  }
}

/**
 * VibeCodingSOP 设置面板
 */
class VibeCodingSOPSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'VibeCodingSOP 设置' });

    new Setting(containerEl)
      .setName('数据目录')
      .setDesc('相对于 Vault 根目录的数据存储路径。修改后需重启 Obsidian 或重新加载插件才能生效。')
      .addText(text => text
        .setPlaceholder('EdPau3')
        .setValue(this.plugin.settings.dataDir)
        .onChange(async (value) => {
          this.plugin.settings.dataDir = value.trim() || 'EdPau3';
          await this.plugin.saveData(this.plugin.settings);
        }));
  }
}

/**
 * VibeCodingSOP 插件主类
 */
module.exports = class VibeCodingSOPPlugin extends Plugin {
  async onload() {
    console.log('VibeCodingSOP 插件加载中...');

    // 加载设置
    await this.loadSettings();

    // 启动 HTTP Server
    try {
      await this.startServer();
    } catch (err) {
      new Notice('VibeCodingSOP Server 启动失败: ' + err.message, 10000);
      console.error('VibeCodingSOP Server 启动失败:', err);
      return;
    }

    // 复制默认 Prompt 模板到工作目录
    this.ensurePromptDefaults();

    // 注册自定义视图
    this.registerView(VIEW_TYPE, (leaf) => new VibeCodingSOPView(leaf, this));

    // 左侧功能区 Ribbon Icon（使用自定义图标）
    const ribbonIcon = this.addRibbonIcon('git-branch', 'VibeCodingSOP', () => {
      this.openView();
    });

    // 替换 Ribbon Icon 为自定义图片（base64 内联，避免 Electron 安全策略限制）
    try {
      const iconPath = path.join(this.getPluginDir(), 'assets', 'icon-logo.png');
      if (fs.existsSync(iconPath)) {
        const iconData = fs.readFileSync(iconPath);
        const ext = path.extname(iconPath).replace('.', '') || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext;
        const iconBase64 = 'data:' + mimeType + ';base64,' + iconData.toString('base64');

        ribbonIcon.empty();
        const img = document.createElement('img');
        img.src = iconBase64;
        img.style.width = '20px';
        img.style.height = '20px';
        img.style.display = 'block';
        ribbonIcon.appendChild(img);
      }
    } catch (err) {
      console.warn('加载自定义 Ribbon 图标失败:', err.message);
    }

    // 命令面板命令
    this.addCommand({
      id: 'open-vibecodingsop',
      name: '打开 VibeCodingSOP',
      callback: () => this.openView()
    });

    // 设置面板
    this.addSettingTab(new VibeCodingSOPSettingTab(this.app, this));

    console.log('VibeCodingSOP 插件加载完成，Server 端口:', this.serverPort);
  }

  async loadSettings() {
    this.settings = Object.assign({ dataDir: 'EdPau3' }, await this.loadData());
  }

  /**
   * 获取插件安装目录（Vault/.obsidian/plugins/{id}/）
   */
  getPluginDir() {
    let vaultPath = '';
    const adapter = this.app.vault.adapter;
    if (adapter && adapter.basePath) {
      vaultPath = adapter.basePath;
    } else if (adapter && adapter.getBasePath) {
      vaultPath = adapter.getBasePath();
    }
    return path.join(vaultPath, '.obsidian', 'plugins', this.manifest.id);
  }

  /**
   * 获取工作目录（Vault 根目录 + dataDir）
   */
  getWorkDir() {
    let vaultPath = '';
    const adapter = this.app.vault.adapter;
    if (adapter && adapter.basePath) {
      vaultPath = adapter.basePath;
    } else if (adapter && adapter.getBasePath) {
      vaultPath = adapter.getBasePath();
    }
    return path.join(vaultPath, this.settings.dataDir);
  }

  /**
   * 启动 HTTP Server（复用项目根目录的 server.js）
   */
  async startServer() {
    const workDir = this.getWorkDir();

    // 确保工作目录存在
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    // 设置环境变量
    process.env.MD2MIND_WORK_DIR = workDir;
    process.env.MD2MIND_LOG_LEVEL = 'silent';

    // 加载 server.js
    const pluginDir = this.getPluginDir();
    const serverPath = path.join(pluginDir, 'server.js');
    if (!fs.existsSync(serverPath)) {
      throw new Error('未找到 server.js，请确保插件目录包含该文件: ' + serverPath);
    }

    const serverModule = require(serverPath);

    // 检查 server 是否已在运行（避免重复启动）
    if (serverModule.server && serverModule.server.listening) {
      this.serverInstance = serverModule.server;
      this.serverPort = this.serverInstance.address().port;
      console.log('VibeCodingSOP Server 已在运行，端口:', this.serverPort);
      return;
    }

    // 启动 server
    this.serverInstance = serverModule.startServer(0);
    await this.waitForServer();
    console.log('VibeCodingSOP Server 启动成功，端口:', this.serverPort);
  }

  /**
   * 等待 Server 启动完成并获取端口
   */
  waitForServer() {
    return new Promise((resolve, reject) => {
      if (this.serverPort) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('HTTP Server 启动超时（10秒）'));
      }, 10000);

      const onListening = () => {
        try {
          const addr = this.serverInstance.address();
          if (addr && addr.port) {
            this.serverPort = addr.port;
            clearTimeout(timeout);
            this.serverInstance.off('listening', onListening);
            this.serverInstance.off('error', onError);
            resolve();
          }
        } catch (err) {
          // 忽略
        }
      };

      const onError = (err) => {
        clearTimeout(timeout);
        this.serverInstance.off('listening', onListening);
        this.serverInstance.off('error', onError);
        reject(err);
      };

      this.serverInstance.on('listening', onListening);
      this.serverInstance.on('error', onError);

      // 如果已经处于 listening 状态，立即 resolve
      if (this.serverInstance.listening) {
        onListening();
      }
    });
  }

  /**
   * 将插件自带的默认 Prompt 模板复制到工作目录
   * 仅当目标文件不存在时才复制，避免覆盖用户自定义内容
   */
  ensurePromptDefaults() {
    const workDir = this.getWorkDir();
    const pluginDir = this.getPluginDir();
    const promptDir = path.join(workDir, 'prompt');
    const templateDir = path.join(promptDir, 'template');
    const bakDir = path.join(workDir, 'todo', '.bak');

    // 创建必要的子目录
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }
    if (!fs.existsSync(bakDir)) {
      fs.mkdirSync(bakDir, { recursive: true });
    }

    // 复制配置文件
    const defaultFiles = [
      {
        src: path.join(pluginDir, 'prompt', 'promptTemplateConfig.json'),
        dst: path.join(promptDir, 'promptTemplateConfig.json')
      },
      {
        src: path.join(pluginDir, 'prompt', 'promptTemplateLibrary.json'),
        dst: path.join(promptDir, 'promptTemplateLibrary.json')
      }
    ];

    defaultFiles.forEach(({ src, dst }) => {
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        try {
          fs.copyFileSync(src, dst);
        } catch (err) {
          console.warn('复制默认文件失败:', src, '->', dst, err.message);
        }
      }
    });

    // 复制模板 MD 文件
    const srcTemplateDir = path.join(pluginDir, 'prompt', 'template');
    if (fs.existsSync(srcTemplateDir)) {
      try {
        const files = fs.readdirSync(srcTemplateDir);
        files.forEach(file => {
          const srcFile = path.join(srcTemplateDir, file);
          const dstFile = path.join(templateDir, file);
          if (fs.statSync(srcFile).isFile() && !fs.existsSync(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
          }
        });
      } catch (err) {
        console.warn('复制默认模板失败:', err.message);
      }
    }
  }

  /**
   * 打开或激活 VibeCodingSOP 视图
   */
  async openView() {
    const { workspace } = this.app;

    // 查找是否已有该视图的 leaf
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];

    if (!leaf) {
      // 在中间标签页区域创建新的 leaf
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    } else {
      // 激活已有视图
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  /**
   * 插件卸载时关闭 Server
   */
  onunload() {
    console.log('VibeCodingSOP 插件卸载中...');
    if (this.serverInstance) {
      try {
        this.serverInstance.close(() => {
          console.log('VibeCodingSOP Server 已关闭');
        });
      } catch (err) {
        console.warn('关闭 Server 时出错:', err.message);
      }
    }
  }
};
