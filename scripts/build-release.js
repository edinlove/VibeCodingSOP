#!/usr/bin/env node
/**
 * VibeCodingSOP 统一发布构建脚本
 *
 * 功能：
 * 1. 同步版本号：以 package.json 为唯一来源，自动同步到 obsidian/manifest.json
 * 2. 构建 VS Code 插件：生成 release/vibecodingsop-{version}.vsix
 * 3. 构建 Obsidian 插件：生成 release/vibecodingsop/ 目录（直接可用，无需重命名）
 *
 * 用法：
 *   node scripts/build-release.js
 *   node scripts/build-release.js --vscode-only   仅构建 VS Code 插件
 *   node scripts/build-release.js --obsidian-only 仅构建 Obsidian 插件
 *   node scripts/build-release.js --install=/path/to/Vault/.obsidian/plugins/vibecodingsop
 *
 * 版本号管理：
 *   只需修改根目录 package.json 中的 "version" 字段，运行本脚本即可自动同步到所有平台。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function syncVersion() {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  const manifestPath = path.join(PROJECT_ROOT, 'obsidian', 'manifest.json');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const version = pkg.version;
  let changed = false;

  if (manifest.version !== version) {
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[SYNC] obsidian/manifest.json <- ${version}`);
    changed = true;
  }

  if (!changed) {
    console.log(`[SYNC] 版本号已一致: ${version}`);
  }
  return version;
}

function buildObsidian(installPath) {
  console.log('\n--- 构建 Obsidian 插件 ---\n');
  const args = ['node', 'scripts/build-obsidian.js'];
  if (installPath) {
    args.push(`--install=${installPath}`);
  }
  execSync(args.join(' '), {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
}

function buildVSCode() {
  console.log('\n--- 构建 VS Code 插件 ---\n');
  execSync('node scripts/build-vscode.js', {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
}

function main() {
  console.log('=== VibeCodingSOP 统一发布构建 ===\n');

  // 确保 release 目录
  ensureDir(RELEASE_DIR);

  // 同步版本号（以 package.json 为唯一来源）
  const version = syncVersion();
  console.log(`当前版本: ${version}\n`);

  // 解析参数
  const args = process.argv.slice(2);
  const vscodeOnly = args.includes('--vscode-only');
  const obsidianOnly = args.includes('--obsidian-only');
  const installArg = args.find(arg => arg.startsWith('--install='));
  const installPath = installArg ? installArg.split('=')[1] : null;

  // 构建
  if (vscodeOnly) {
    buildVSCode();
  } else if (obsidianOnly) {
    buildObsidian(installPath);
  } else {
    buildVSCode();
    buildObsidian(installPath);
  }

  console.log('\n=== 全部构建完成 ===');
  console.log('版本号:', version);
  console.log('发布目录:', RELEASE_DIR);
  console.log('\n产物清单:');

  if (fs.existsSync(RELEASE_DIR)) {
    const files = fs.readdirSync(RELEASE_DIR);
    for (const file of files) {
      const stat = fs.statSync(path.join(RELEASE_DIR, file));
      if (stat.isDirectory()) {
        console.log(`  [DIR]  ${file}/`);
      } else {
        const size = (stat.size / 1024).toFixed(1);
        console.log(`  [FILE] ${file} (${size} KB)`);
      }
    }
  }

  console.log('\n安装说明:');
  console.log('  VS Code:  在 VS Code 扩展面板中点击 "从 VSIX 安装"，选择 .vsix 文件');
  console.log('  Obsidian: cp -r release/vibecodingsop /path/to/Vault/.obsidian/plugins/');
}

main();
