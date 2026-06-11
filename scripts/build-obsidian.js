#!/usr/bin/env node
/**
 * VibeCodingSOP Obsidian 插件构建脚本
 *
 * 功能：
 * 1. 从 package.json 读取版本号，自动同步到 obsidian/manifest.json
 * 2. 将前端资源 + Obsidian 插件入口打包到 release/vibecodingsop/ 目录
 * 3. 支持 --install 参数直接安装到 Vault
 *
 * 用法：
 *   node scripts/build-obsidian.js
 *   node scripts/build-obsidian.js --install /path/to/Vault/.obsidian/plugins/vibecodingsop
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'release');
const DIST_DIR = path.join(RELEASE_DIR, 'vibecodingsop');

// 需要复制到插件目录的文件列表
const filesToCopy = [
  // Obsidian 插件入口文件
  { src: 'obsidian/manifest.json', dst: 'manifest.json' },
  { src: 'obsidian/main.js', dst: 'main.js' },
  { src: 'obsidian/styles.css', dst: 'styles.css' },

  // HTTP Server（核心后端）
  { src: 'server.js', dst: 'server.js' },

  // 前端页面
  { src: 'index.html', dst: 'index.html' },
  { src: 'table-viewer.html', dst: 'table-viewer.html' },
  { src: 'prompt-library.html', dst: 'prompt-library.html' },
  { src: 'prompt-optimization.html', dst: 'prompt-optimization.html' },
  { src: 'prompt-historylog.html', dst: 'prompt-historylog.html' },

  // 配置文件
  { src: 'config.json', dst: 'config.json' }
];

// 需要复制的目录列表
const dirsToCopy = [
  { src: 'styles', dst: 'styles' },
  { src: 'assets', dst: 'assets' },
  { src: 'js', dst: 'js' },
  { src: 'prompt', dst: 'prompt' }
];

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
  if (manifest.version !== version) {
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[SYNC] 版本号已同步: ${version} (package.json -> obsidian/manifest.json)`);
  } else {
    console.log(`[SYNC] 版本号已一致: ${version}`);
  }
  return version;
}

function copyFile(src, dst) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const dstPath = path.join(DIST_DIR, dst);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[SKIP] 源文件不存在: ${src}`);
    return;
  }
  ensureDir(path.dirname(dstPath));
  fs.copyFileSync(srcPath, dstPath);
  console.log(`[COPY] ${src} -> ${dst}`);
}

function copyDir(src, dst) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const dstPath = path.join(DIST_DIR, dst);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[SKIP] 源目录不存在: ${src}`);
    return;
  }
  ensureDir(dstPath);

  function walk(currentSrc, currentDst) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const srcEntry = path.join(currentSrc, entry.name);
      const dstEntry = path.join(currentDst, entry.name);
      if (entry.isDirectory()) {
        ensureDir(dstEntry);
        walk(srcEntry, dstEntry);
      } else {
        fs.copyFileSync(srcEntry, dstEntry);
      }
    }
  }

  walk(srcPath, dstPath);
  console.log(`[COPY] ${src}/ -> ${dst}/`);
}

function build() {
  console.log('=== VibeCodingSOP Obsidian 插件构建 ===\n');

  // 同步版本号
  const version = syncVersion();

  // 清理旧构建产物
  if (fs.existsSync(DIST_DIR)) {
    console.log('清理旧构建产物...');
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);

  // 复制文件
  for (const item of filesToCopy) {
    copyFile(item.src, item.dst);
  }

  // 复制目录
  for (const item of dirsToCopy) {
    copyDir(item.src, item.dst);
  }

  console.log('\n=== 构建完成 ===');
  console.log('版本号:', version);
  console.log('输出目录:', DIST_DIR);

  // 统计文件数
  let fileCount = 0;
  function countFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        countFiles(fullPath);
      } else {
        fileCount++;
      }
    }
  }
  countFiles(DIST_DIR);
  console.log('总文件数:', fileCount);

  // --install 参数：直接安装到指定 Vault
  const installArg = process.argv.find(arg => arg.startsWith('--install='));
  if (installArg) {
    const installPath = installArg.split('=')[1];
    if (installPath) {
      console.log('\n安装到:', installPath);
      ensureDir(installPath);
      const entries = fs.readdirSync(DIST_DIR);
      for (const entry of entries) {
        const src = path.join(DIST_DIR, entry);
        const dst = path.join(installPath, entry);
        if (fs.statSync(src).isDirectory()) {
          if (fs.existsSync(dst)) {
            fs.rmSync(dst, { recursive: true });
          }
          fs.cpSync(src, dst, { recursive: true });
        } else {
          fs.copyFileSync(src, dst);
        }
      }
      console.log('安装完成！请重启 Obsidian 或重新加载插件。');
    }
  } else {
    console.log('\n使用方式:');
    console.log('  将 release/vibecodingsop/ 复制到 Vault 目录:');
    console.log('     cp -r release/vibecodingsop /path/to/Vault/.obsidian/plugins/');
    console.log('  或在构建时直接安装:');
    console.log('     node scripts/build-obsidian.js --install=/path/to/Vault/.obsidian/plugins/vibecodingsop');
  }
}

build();
