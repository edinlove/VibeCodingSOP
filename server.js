const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.DEPLOY_RUN_PORT || '5501', 10);
const BASE_DIR = __dirname;
// WORK_DIR：数据存储根目录，可通过环境变量 MD2MIND_WORK_DIR 配置
// 默认与 BASE_DIR（插件代码目录）相同，保持独立部署兼容
const WORK_DIR = process.env.MD2MIND_WORK_DIR || BASE_DIR;

// 日志级别控制：debug | info | silent，通过环境变量 MD2MIND_LOG_LEVEL 或 config.json 设置
const logLevel = process.env.MD2MIND_LOG_LEVEL || 'info';
function logDebug(...args) { if (logLevel === 'debug') console.log('[DEBUG]', ...args); }
function logInfo(...args)  { if (logLevel === 'info' || logLevel === 'debug') console.log(...args); }
function logError(...args) { console.error(...args); }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// 在生产环境中使用/tmp目录存储数据
const isProd = process.env.COZE_PROJECT_ENV === 'PROD';
const DATA_ROOT = isProd ? '/tmp' : WORK_DIR;

const TODO_DIR = path.join(DATA_ROOT, 'todo');
const BAK_DIR = path.join(TODO_DIR, '.bak');
const PROD_BAK_DIR = '/tmp/todo/.bak';
const PROMPT_DIR = path.join(DATA_ROOT, 'prompt');
const PROMPT_TEMPLATE_DIR = path.join(PROMPT_DIR, 'template');
const PROMPT_CONFIG_PATH = path.join(PROMPT_DIR, 'promptTemplateConfig.json');
const PROMPT_LIBRARY_PATH = path.join(PROMPT_DIR, 'promptTemplateLibrary.json');
let maxBackups = 100;
const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB

// 文件名净化函数
function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return null;
  // 使用 path.basename 去除路径信息
  let safe = path.basename(name);
  // 移除控制字符
  safe = safe.replace(/[\x00-\x1f\x7f]/g, '');
  // 确保以 .md 结尾
  if (!safe.toLowerCase().endsWith('.md')) return null;
  // 防止空文件名
  const base = safe.slice(0, -3);
  if (!base.trim()) return null;
  return safe;
}

logInfo('Server config:', { isProd, DATA_ROOT, TODO_DIR, BAK_DIR });

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // --- Todo File APIs ---

  // GET /api/todo/files — list .md files in todo directory
  if (urlPath === '/api/todo/files' && req.method === 'GET') {
    try {
      if (!fs.existsSync(TODO_DIR)) {
        fs.mkdirSync(TODO_DIR, { recursive: true });
      }
      const files = fs.readdirSync(TODO_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(TODO_DIR, f));
          return { name: f, size: stat.size, modified: stat.mtime };
        });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ files }));
    } catch (err) {
      console.error('[files] Error:', err.message);
      try {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      } catch(e) {}
    }
    return;
  }

  // GET /api/todo/read?file=xxx — read a file from todo directory
  if (urlPath === '/api/todo/read' && req.method === 'GET') {
    const params = new URL(req.url, 'http://localhost');
    const file = params.searchParams.get('file');
    const safeFile = sanitizeFileName(file);
    if (!safeFile) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Invalid file name' }));
      return;
    }
    const filePath = path.join(TODO_DIR, safeFile);
    if (!filePath.startsWith(TODO_DIR)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ file, content }));
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
    return;
  }

  // POST /api/todo/save — save content to a file in todo directory
  if (urlPath === '/api/todo/save' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Request too large' }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      let backupInfo = null;
      let responseSent = false;
      try {
        const { file, content } = JSON.parse(body);
        const safeFile = sanitizeFileName(file);
        if (!safeFile) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        const filePath = path.join(TODO_DIR, safeFile);
        if (!filePath.startsWith(TODO_DIR)) {
          responseSent = true;
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        if (!fs.existsSync(TODO_DIR)) {
          fs.mkdirSync(TODO_DIR, { recursive: true });
        }
        
        // 备份原文件（如果存在）
        if (fs.existsSync(filePath)) {
          // 确保bak目录存在
          if (!fs.existsSync(BAK_DIR)) {
            fs.mkdirSync(BAK_DIR, { recursive: true });
          }
          // 生成带时间戳的备份文件名
          const now = new Date();
          const timestamp = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + '-' + 
            String(now.getHours()).padStart(2, '0') + '-' + 
            String(now.getMinutes()).padStart(2, '0');
          const ext = path.extname(file);
          const basename = path.basename(file, ext);
          const backupFile = basename + '_' + timestamp + ext;
          const backupPath = path.join(BAK_DIR, backupFile);
          
          // 复制原文件到备份目录
          fs.copyFileSync(filePath, backupPath);
          
          // 清理旧备份，只保留最近100个
          cleanupOldBackups();
          
          // 记录备份信息
          backupInfo = { backupFile: backupFile, backupPath: backupPath };
        }
        
        fs.writeFileSync(filePath, content, 'utf-8');
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, backup: backupInfo }));
      } catch (err) {
        console.error('[save] Error:', err.message, 'stack:', err.stack);
        console.error('[save] TODO_DIR:', TODO_DIR, 'exists:', fs.existsSync(TODO_DIR));
        console.error('[save] BAK_DIR:', BAK_DIR, 'exists:', fs.existsSync(BAK_DIR));
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message, details: 'Check server logs for more info' }));
        }
      }
    });
    return;
  }

  // POST /api/todo/rename — 重命名文件（备份原文件+创建新文件）
  if (urlPath === '/api/todo/rename' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let backupInfo = null;
      let responseSent = false;
      try {
        const { oldFile, newFile, content } = JSON.parse(body);
        
        // 参数验证
        if (!oldFile || !newFile || !oldFile.endsWith('.md') || !newFile.endsWith('.md')) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file names' }));
          return;
        }
        if (oldFile.includes('..') || oldFile.includes('/') || newFile.includes('..') || newFile.includes('/')) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name characters' }));
          return;
        }
        
        const oldFilePath = path.join(TODO_DIR, oldFile);
        const newFilePath = path.join(TODO_DIR, newFile);
        
        // 安全检查
        if (!oldFilePath.startsWith(TODO_DIR) || !newFilePath.startsWith(TODO_DIR)) {
          responseSent = true;
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        
        // 确保todo目录存在
        if (!fs.existsSync(TODO_DIR)) {
          fs.mkdirSync(TODO_DIR, { recursive: true });
        }
        
        // 备份原文件
        if (fs.existsSync(oldFilePath)) {
          if (!fs.existsSync(BAK_DIR)) {
            fs.mkdirSync(BAK_DIR, { recursive: true });
          }
          const now = new Date();
          const timestamp = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + '-' + 
            String(now.getHours()).padStart(2, '0') + '-' + 
            String(now.getMinutes()).padStart(2, '0');
          const backupFile = oldFile.replace('.md', '_' + timestamp + '.md');
          const backupPath = path.join(BAK_DIR, backupFile);
          
          fs.copyFileSync(oldFilePath, backupPath);
          cleanupOldBackups();
          backupInfo = { backupFile: backupFile, backupPath: backupPath };
        }
        
        // 写入新文件
        fs.writeFileSync(newFilePath, content || '', 'utf-8');
        
        // 删除原文件（如果文件名不同）
        if (oldFile !== newFile && fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
        
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
          success: true, 
          backup: backupInfo,
          oldFile: oldFile,
          newFile: newFile
        }));
      } catch (err) {
        console.error('[rename] Error:', err.message, 'stack:', err.stack);
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // POST /api/todo/backup — 备份暂存文件到.bak目录
  if (urlPath === '/api/todo/backup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let responseSent = false;
      try {
        const { file, content } = JSON.parse(body);
        const safeFile = sanitizeFileName(file);
        if (!safeFile) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        
        // 确保.bak目录存在
        if (!fs.existsSync(BAK_DIR)) {
          fs.mkdirSync(BAK_DIR, { recursive: true });
        }
        
        const backupPath = path.join(BAK_DIR, safeFile);
        fs.writeFileSync(backupPath, content || '', 'utf-8');
        cleanupOldBackups();
        
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, backupFile: file }));
      } catch (err) {
        console.error('[backup] Error:', err.message);
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // 清理旧备份文件（本地环境）
  function cleanupOldBackups(limit) {
    const keep = limit || maxBackups;
    try {
      if (!fs.existsSync(BAK_DIR)) return;
      
      const files = fs.readdirSync(BAK_DIR)
        .filter(f => f.endsWith('.md') || f.endsWith('.json'))
        .map(f => {
          const stat = fs.statSync(path.join(BAK_DIR, f));
          return { name: f, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length > keep) {
        const toDelete = files.slice(keep);
        toDelete.forEach(f => {
          fs.unlinkSync(path.join(BAK_DIR, f.name));
        });
        logInfo('Cleaned up', toDelete.length, 'old backups in', BAK_DIR, '(kept', keep, ')');
      }
    } catch (err) {
      console.error('Backup cleanup error:', err.message);
    }
  }

  // 清理旧备份文件（生产环境）
  function cleanupOldBackupsProd(limit) {
    const keep = limit || maxBackups;
    try {
      if (!fs.existsSync(PROD_BAK_DIR)) return;
      
      const files = fs.readdirSync(PROD_BAK_DIR)
        .filter(f => f.endsWith('.md') || f.endsWith('.json'))
        .map(f => {
          const stat = fs.statSync(path.join(PROD_BAK_DIR, f));
          return { name: f, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length > keep) {
        const toDelete = files.slice(keep);
        toDelete.forEach(f => {
          fs.unlinkSync(path.join(PROD_BAK_DIR, f.name));
        });
        logInfo('Cleaned up', toDelete.length, 'old prod backups in', PROD_BAK_DIR, '(kept', keep, ')');
      }
    } catch (err) {
      console.error('Prod backup cleanup error:', err.message);
    }
  }

  // GET /api/todo/files-prod — list .md files in prod todo directory
  if (urlPath === '/api/todo/files-prod' && req.method === 'GET') {
    const PROD_TODO_DIR = '/tmp/todo';
    try {
      if (!fs.existsSync(PROD_TODO_DIR)) {
        fs.mkdirSync(PROD_TODO_DIR, { recursive: true });
      }
      const files = fs.readdirSync(PROD_TODO_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(PROD_TODO_DIR, f));
          return { name: f, size: stat.size, modified: stat.mtime };
        });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ files }));
    } catch (err) {
      console.error('[files-prod] Error:', err.message);
      try {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      } catch(e) {}
    }
    return;
  }

  // GET /api/todo/read-prod?file=xxx — read a file from prod todo directory
  if (urlPath === '/api/todo/read-prod' && req.method === 'GET') {
    const PROD_TODO_DIR = '/tmp/todo';
    const params = new URL(req.url, 'http://localhost');
    const file = params.searchParams.get('file');
    const safeFile = sanitizeFileName(file);
    if (!safeFile) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Invalid file name' }));
      return;
    }
    const filePath = path.join(PROD_TODO_DIR, safeFile);
    if (!filePath.startsWith(PROD_TODO_DIR)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ file, content }));
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'File not found' }));
    }
    return;
  }

  // POST /api/todo/save-prod — save content to a file in prod todo directory
  if (urlPath === '/api/todo/save-prod' && req.method === 'POST') {
    const PROD_TODO_DIR = '/tmp/todo';
    const PROD_BAK_DIR = path.join(PROD_TODO_DIR, '.bak');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let backupInfo = null;
      let responseSent = false;
      try {
        const { file, content, newFile } = JSON.parse(body);
        const targetFile = sanitizeFileName(newFile || file);
        if (!targetFile) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        const filePath = path.join(PROD_TODO_DIR, targetFile);
        if (!filePath.startsWith(PROD_TODO_DIR)) {
          responseSent = true;
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        if (!fs.existsSync(PROD_TODO_DIR)) {
          fs.mkdirSync(PROD_TODO_DIR, { recursive: true });
        }
        
        // 备份原文件（如果存在）
        if (fs.existsSync(filePath)) {
          if (!fs.existsSync(PROD_BAK_DIR)) {
            fs.mkdirSync(PROD_BAK_DIR, { recursive: true });
          }
          const now = new Date();
          const timestamp = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + '-' + 
            String(now.getHours()).padStart(2, '0') + '-' + 
            String(now.getMinutes()).padStart(2, '0');
          const backupFile = targetFile.replace('.md', '_' + timestamp + '.md');
          const backupPath = path.join(PROD_BAK_DIR, backupFile);
          fs.copyFileSync(filePath, backupPath);
          backupInfo = { backupFile, backupPath };
        }
        
        fs.writeFileSync(filePath, content, 'utf-8');
        
        // 如果重命名，删除旧文件
        if (newFile && newFile !== file && fs.existsSync(path.join(PROD_TODO_DIR, file))) {
          fs.unlinkSync(path.join(PROD_TODO_DIR, file));
        }
        
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, backup: backupInfo, renamed: newFile !== file }));
      } catch (err) {
        console.error('[save-prod] Error:', err.message);
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // POST /api/todo/upload — upload file to todo directory
  if (urlPath === '/api/todo/upload' && req.method === 'POST') {
    const PROD_TODO_DIR = '/tmp/todo';
    
    let body = [];
    let isFormData = false;
    
    req.on('data', chunk => { 
      body.push(chunk); 
      if (chunk.length > 10 * 1024 * 1024) { // 10MB threshold
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'File too large' }));
        req.destroy();
      }
    });
    
    req.on('end', () => {
      try {
        const rawData = Buffer.concat(body);
        
        // Get boundary from Content-Type header
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid upload format: no boundary' }));
          return;
        }
        
        const boundary = boundaryMatch[1];
        const rawDataStr = rawData.toString();
        const parts = rawDataStr.split('--' + boundary).filter(p => p.trim() && !p.includes('--'));
        
        let uploadedFileName = 'unknown.md';
        let uploadedContent = '';
        let targetEnv = 'local';
        
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          
          const headers = part.substring(0, headerEnd);
          const content = part.substring(headerEnd + 4);
          
          if (headers.includes('filename=')) {
            const nameMatch = headers.match(/filename="([^"]+)"/);
            if (nameMatch) {
              uploadedFileName = nameMatch[1];
            }
          }
          
          if (headers.includes('name="env"')) {
            targetEnv = content.trim();
          }
          
          if (headers.includes('name="file"') && !headers.includes('filename=')) {
            // Regular form field
          }
          
          // Content-Disposition with filename means file upload
          if (headers.includes('name="file"') && headers.includes('filename=')) {
            uploadedContent = content;
          }
        }
        
        // Sanitize and validate file name
        const safeUploadedName = sanitizeFileName(uploadedFileName);
        if (!safeUploadedName) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        uploadedFileName = safeUploadedName;
        
        // Determine target directory
        const targetDir = targetEnv === 'prod' ? PROD_TODO_DIR : TODO_DIR;
        
        // Ensure directory exists
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // Handle filename conflict
        let finalFileName = uploadedFileName;
        let counter = 1;
        while (fs.existsSync(path.join(targetDir, finalFileName))) {
          const ext = path.extname(uploadedFileName);
          const base = path.basename(uploadedFileName, ext);
          finalFileName = base + '(' + counter + ')' + ext;
          counter++;
        }
        
        const filePath = path.join(targetDir, finalFileName);
        fs.writeFileSync(filePath, uploadedContent, 'utf-8');
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, filename: finalFileName }));
      } catch (err) {
        console.error('[upload] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    
    return;
  }

  // POST /api/todo/archive — archive and backup a file in local todo
  if (urlPath === '/api/todo/archive' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    let bodySize = 0;
    req.on('data', chunk => { 
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Request too large' }));
        req.destroy();
        return;
      }
      body += chunk; 
    });
    req.on('end', () => {
      let responseSent = false;
      try {
        const { file } = JSON.parse(body);
        const safeFile = sanitizeFileName(file);
        if (!safeFile) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        
        const filePath = path.join(TODO_DIR, safeFile);
        if (!filePath.startsWith(TODO_DIR)) {
          responseSent = true;
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        
        if (!fs.existsSync(BAK_DIR)) {
          fs.mkdirSync(BAK_DIR, { recursive: true });
        }
        
        // Generate timestamped backup filename
        const now = new Date();
        const timestamp = now.getFullYear() + '-' + 
          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
          String(now.getDate()).padStart(2, '0') + '-' + 
          String(now.getHours()).padStart(2, '0') + '-' + 
          String(now.getMinutes()).padStart(2, '0');
        const backupFile = safeFile.replace('.md', '_' + timestamp + '.md');
        const backupPath = path.join(BAK_DIR, backupFile);
        
        // Copy file to backup
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, backupPath);
        }
        
        // Delete original file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        cleanupOldBackups();
        
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, backup: backupFile }));
      } catch (err) {
        console.error('[archive] Error:', err.message);
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // POST /api/todo/archive-prod — archive and backup a file in prod todo
  if (urlPath === '/api/todo/archive-prod' && req.method === 'POST') {
    const PROD_TODO_DIR = '/tmp/todo';
    const PROD_BAK_DIR = path.join(PROD_TODO_DIR, '.bak');
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Request too large' }));
        }
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      let responseSent = false;
      try {
        const { file } = JSON.parse(body);
        const safeFile = sanitizeFileName(file);
        if (!safeFile) {
          responseSent = true;
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        
        const filePath = path.join(PROD_TODO_DIR, safeFile);
        if (!filePath.startsWith(PROD_TODO_DIR)) {
          responseSent = true;
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        
        if (!fs.existsSync(PROD_BAK_DIR)) {
          fs.mkdirSync(PROD_BAK_DIR, { recursive: true });
        }
        
        // Generate timestamped backup filename
        const now = new Date();
        const timestamp = now.getFullYear() + '-' + 
          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
          String(now.getDate()).padStart(2, '0') + '-' + 
          String(now.getHours()).padStart(2, '0') + '-' + 
          String(now.getMinutes()).padStart(2, '0');
        const backupFile = safeFile.replace('.md', '_' + timestamp + '.md');
        const backupPath = path.join(PROD_BAK_DIR, backupFile);
        
        // Copy file to backup
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, backupPath);
        }
        
        // Delete original file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        responseSent = true;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, backup: backupFile }));
      } catch (err) {
        console.error('[archive-prod] Error:', err.message);
        if (!responseSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
    return;
  }

  // /download — dynamically create and serve a tar.gz of all project files
  if (urlPath === '/download') {
    try {
      const tmpArchive = '/tmp/project-export.tar.gz';
      // Get all tracked files from git
      const files = execSync('git ls-files', { cwd: BASE_DIR, encoding: 'utf-8' })
        .trim().split('\n').filter(Boolean);
      // Create tar.gz from git-tracked files
      execSync(`tar -czf "${tmpArchive}" ${files.map(f => '"' + f.replace(/"/g, '\\"') + '"').join(' ')}`, { cwd: BASE_DIR, stdio: 'pipe' });
      const stat = fs.statSync(tmpArchive);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="project.tar.gz"',
        'Content-Length': stat.size,
      });
      const stream = fs.createReadStream(tmpArchive);
      stream.pipe(res);
      stream.on('end', () => { try { fs.unlinkSync(tmpArchive); } catch(e) {} });
    } catch (err) {
      console.error('Download error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to generate download');
    }
    return;
  }

  // --- Prompt Template APIs ---

  // GET /api/prompt/config — read prompt template config
  if (urlPath === '/api/prompt/config' && req.method === 'GET') {
    try {
      if (!fs.existsSync(PROMPT_CONFIG_PATH)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Config not found' }));
        return;
      }
      const content = fs.readFileSync(PROMPT_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (err) {
      console.error('Prompt config read error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // GET /api/prompt/library — read prompt template library
  if (urlPath === '/api/prompt/library' && req.method === 'GET') {
    try {
      if (!fs.existsSync(PROMPT_LIBRARY_PATH)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ template: [] }));
        return;
      }
      const content = fs.readFileSync(PROMPT_LIBRARY_PATH, 'utf-8');
      const library = JSON.parse(content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(library));
    } catch (err) {
      console.error('Prompt library read error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /api/prompt/library — save prompt template library
  if (urlPath === '/api/prompt/library' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request too large' }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        const library = JSON.parse(body);
        if (!fs.existsSync(PROMPT_DIR)) {
          fs.mkdirSync(PROMPT_DIR, { recursive: true });
        }
        fs.writeFileSync(PROMPT_LIBRARY_PATH, JSON.stringify(library, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Prompt library save error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/prompt/template — save a prompt template md file
  if (urlPath === '/api/prompt/template' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request too large' }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { fileName, content } = JSON.parse(body);
        const safeFile = path.basename(fileName);
        if (!safeFile || !safeFile.toLowerCase().endsWith('.md')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        const filePath = path.join(PROMPT_TEMPLATE_DIR, safeFile);
        if (!fs.existsSync(PROMPT_TEMPLATE_DIR)) {
          fs.mkdirSync(PROMPT_TEMPLATE_DIR, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, file: safeFile }));
      } catch (err) {
        console.error('Prompt template save error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/prompt/template/:file — read a prompt template md file
  if (urlPath.startsWith('/api/prompt/template/') && req.method === 'GET') {
    try {
      const filePath = decodeURIComponent(urlPath.replace('/api/prompt/template/', ''));
      // Security: prevent directory traversal
      const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.join(BASE_DIR, safePath);
      // Ensure the resolved path is still within project root
      if (!fullPath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(content);
    } catch (err) {
      console.error('Prompt template read error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /api/prompt/backup — backup a prompt file before modification
  if (urlPath === '/api/prompt/backup' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request too large' }));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { file, sourceDir } = JSON.parse(body);
        const safeFile = path.basename(file);
        if (!safeFile) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid file name' }));
          return;
        }
        const srcDir = sourceDir === 'template' ? PROMPT_TEMPLATE_DIR : PROMPT_DIR;
        const filePath = path.join(srcDir, safeFile);
        if (!filePath.startsWith(srcDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        if (!fs.existsSync(BAK_DIR)) {
          fs.mkdirSync(BAK_DIR, { recursive: true });
        }
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + '-' +
          String(now.getHours()).padStart(2, '0') + '-' +
          String(now.getMinutes()).padStart(2, '0');
        const ext = path.extname(safeFile);
        const base = safeFile.slice(0, -ext.length);
        const backupFile = base + '_' + timestamp + ext;
        const backupPath = path.join(BAK_DIR, backupFile);
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, backupPath);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, backup: backupFile }));
      } catch (err) {
        console.error('Prompt backup error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // /api/config — Read project configuration
  if (urlPath === '/api/config') {
    try {
      const configPath = path.join(BASE_DIR, 'config.json');
      let config = {};
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        // Remove comments before parsing JSON
        config = JSON.parse(content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...config,
        isProd: isProd,
        workDir: WORK_DIR,
        localTodoDir: path.join(WORK_DIR, 'todo'),
        prodTodoDir: '/tmp/todo',
        maxBackups: maxBackups
      }));
    } catch (err) {
      console.error('Config read error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to read config');
    }
    return;
  }

  // /api/config/max-backups - Update max backups count
  if (urlPath === '/api/config/max-backups' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const newVal = parseInt(parsed.maxBackups, 10);
        if (isNaN(newVal) || newVal < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid value' }));
          return;
        }
        maxBackups = newVal;
        logInfo('maxBackups updated to', maxBackups);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, maxBackups: maxBackups }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // /api/config/max-backups - Get current max backups count
  if (urlPath === '/api/config/max-backups' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ maxBackups: maxBackups }));
    return;
  }

  // /api/files/tree - Get directory tree with exclusion support
  if (urlPath === '/api/files/tree' && req.method === 'GET') {
    try {
      const configPath = path.join(PROMPT_DIR, 'promptTemplateConfig.json');
      let excludedPatterns = [];
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const configData = JSON.parse(configContent);
        excludedPatterns = configData.excluded_patterns || [];
      }
      const queryPath = new URL(req.url, 'http://localhost').searchParams.get('path');
      const targetPath = queryPath ? path.join(BASE_DIR, queryPath) : BASE_DIR;
      if (!targetPath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }

      function buildTree(dirPath, relPath) {
        const items = [];
        let entries;
        try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch (e) { return items; }
        for (const entry of entries) {
          const name = entry.name;
          const itemRelPath = relPath ? relPath + '/' + name : name;
          let excluded = false;
          for (const pattern of excludedPatterns) {
            if (name === pattern || itemRelPath === pattern || itemRelPath.startsWith(pattern + '/')) {
              excluded = true; break;
            }
          }
          if (excluded) continue;
          if (entry.isDirectory()) {
            const children = buildTree(path.join(dirPath, name), itemRelPath);
            items.push({ name: name, type: 'dir', path: itemRelPath, children: children });
          } else {
            items.push({ name: name, type: 'file', path: itemRelPath });
          }
        }
        return items;
      }

      const tree = buildTree(targetPath, queryPath || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tree));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // /api/prompt/historylog - Create or list history log files
  const historyLogMatch = urlPath.match(/^\/api\/prompt\/historylog\/?$/);
  if (historyLogMatch) {
    const HISTORY_DIR = path.join(PROMPT_DIR, '.historylog');
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

    if (req.method === 'GET') {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const page = parseInt(urlObj.searchParams.get('page') || '1');
        const limit = parseInt(urlObj.searchParams.get('limit') || '30');
        const searchType = urlObj.searchParams.get('searchType') || '';
        const search = urlObj.searchParams.get('search') || '';
        let files = [];
        if (fs.existsSync(HISTORY_DIR)) {
          files = fs.readdirSync(HISTORY_DIR)
            .filter(f => f.endsWith('.md') || f.endsWith('.json'))
            .map(f => {
              const stat = fs.statSync(path.join(HISTORY_DIR, f));
              return { name: f, time: stat.mtime.getTime() };
            })
            .sort((a, b) => b.time - a.time);
        }
        // Apply search filter
        if (search) {
          const s = search.toLowerCase();
          if (searchType === 'uuid') {
            files = files.filter(f => f.name.toLowerCase().indexOf(s) >= 0);
          } else {
            // keyword: search file content
            files = files.filter(f => {
              try {
                const content = fs.readFileSync(path.join(HISTORY_DIR, f.name), 'utf-8');
                return content.toLowerCase().indexOf(s) >= 0;
              } catch (e) { return false; }
            });
          }
        }
        const total = files.length;
        const start = (page - 1) * limit;
        const paginated = files.slice(start, start + limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          files: paginated,
          total: total,
          page: page,
          totalPages: Math.ceil(total / limit)
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const data = JSON.parse(body);
          const fileName = data.fileName || ('prompt-' + now() + '.md');
          const filePath = path.join(HISTORY_DIR, fileName);
          fs.writeFileSync(filePath, data.content || '', 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, file: fileName }));
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // /api/prompt/historylog/:file - Get single history log file content
  const historyLogFileMatch = urlPath.match(/^\/api\/prompt\/historylog\/(.+)$/);
  if (historyLogFileMatch && req.method === 'GET') {
    try {
      const HISTORY_DIR = path.join(PROMPT_DIR, '.historylog');
      const fileName = decodeURIComponent(historyLogFileMatch[1]);
      const filePath = path.join(HISTORY_DIR, fileName);
      if (!filePath.startsWith(HISTORY_DIR)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
      }
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: content }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(BASE_DIR, urlPath);
  // Prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ct = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

function startServer(customPort) {
  const listenPort = customPort !== undefined ? customPort : PORT;
  server.listen(listenPort, '0.0.0.0', () => {
    const addr = server.address();
    const actualPort = addr ? addr.port : listenPort;
    console.log(`Server running at http://0.0.0.0:${actualPort}/`);
    // Schedule hourly cleanup of backup directories
    setInterval(function() {
      try {
        cleanupOldBackups(maxBackups);
        cleanupOldBackupsProd(maxBackups);
        if (logLevel !== 'silent') {
          console.log('Hourly backup cleanup completed. maxBackups =', maxBackups);
        }
      } catch (err) {
        console.error('Hourly backup cleanup error:', err.message);
      }
    }, 60 * 60 * 1000); // every hour
    if (logLevel !== 'silent') {
      console.log('Hourly backup cleanup scheduled');
    }
  });
  return server;
}

if (require.main === module) {
  var cmdPort = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
  startServer(cmdPort);
}

module.exports = { startServer, server };