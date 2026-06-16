/**
 * 工具函数模块
 * 包含通用的辅助函数
 */

// 显示Toast提示
// position: 可选，'center'(默认，页面中间) 或 {x, y}(指定坐标) 或 'element'(配合targetElement使用)
// targetElement: 可选，当position为'element'时，显示在元素下方
function showToastMsg(msg, duration, position, targetElement) {
  duration = duration || 3000;
  var existing = document.getElementById('globalToast');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.id = 'globalToast';
  el.textContent = msg;
  
  var baseStyle = 'background:#555;color:#fff;padding:6px 12px;border-radius:4px;font-size:12px;' +
    'z-index:10004;pointer-events:none;white-space:nowrap;';
  
  if (position === 'element' && targetElement) {
    // 显示在元素下方
    var rect = targetElement.getBoundingClientRect();
    var left = rect.left + rect.width / 2;
    var top = rect.bottom + 4;
    el.style.cssText = 'position:fixed;left:' + left + 'px;top:' + top + 'px;transform:translateX(-50%);' + baseStyle;
  } else if (typeof position === 'object' && position.x !== undefined && position.y !== undefined) {
    // 显示在指定坐标
    el.style.cssText = 'position:fixed;left:' + position.x + 'px;top:' + position.y + 'px;transform:translate(-50%,-50%);' + baseStyle;
  } else {
    // 默认显示在页面中间
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' + baseStyle;
  }
  
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, duration);
}

// 获取当前时间字符串
function now() {
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

// 深拷贝对象
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 生成UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 转义HTML特殊字符
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
