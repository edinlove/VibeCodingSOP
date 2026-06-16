#!/usr/bin/env node
/**
 * VibeCodingSOP VS Code 插件打包脚本
 *
 * 功能：
 * 1. 运行 npx @vscode/vsce package 打包 .vsix 文件
 * 2. 将生成的 .vsix 移动到 release/ 目录
 *
 * 用法：
 *   node scripts/build-vscode.js
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

function build() {
  console.log('=== VibeCodingSOP VS Code 插件打包 ===\n');

  // 读取版本号
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;

  // 确保 release 目录存在
  ensureDir(RELEASE_DIR);

  // 清理旧的 .vsix 文件
  const oldFiles = fs.readdirSync(RELEASE_DIR).filter(f => f.endsWith('.vsix'));
  for (const file of oldFiles) {
    fs.unlinkSync(path.join(RELEASE_DIR, file));
    console.log(`[CLEAN] 删除旧包: ${file}`);
  }

  // 执行 vsce package
  const outputName = `vibecodingsop-${version}.vsix`;
  const outputPath = path.join(RELEASE_DIR, outputName);

  try {
    console.log(`[BUILD] 执行: npx @vscode/vsce package --no-dependencies --allow-missing-repository -o ${outputPath}`);
    execSync(`npx @vscode/vsce package --no-dependencies --allow-missing-repository -o "${outputPath}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    console.log('\n=== 打包完成 ===');
    console.log('版本号:', version);
    console.log('输出文件:', outputPath);
  } catch (err) {
    console.error('\n[ERROR] 打包失败:', err.message);
    process.exit(1);
  }
}

build();