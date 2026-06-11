/**
 * TOC (Table of Contents) Module
 * 目录生成和处理函数
 * 
 * 依赖：无
 * 全局变量：mdTocHeadings（在index.html中定义）
 */

// 确保全局变量存在
if (typeof window.mdTocHeadings === 'undefined') {
  window.mdTocHeadings = [];
}

/**
 * 从Markdown文本生成目录HTML
 * @param {string} mdText - Markdown文本
 * @returns {string} 目录HTML
 */
function generateToc(mdText) {
  var headings = [];
  var lines = (mdText || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (m) {
      var level = m[1].length;
      var text = m[2].replace(/[*_`~]/g, '').trim();
      var id = 'toc-h-' + headings.length;
      headings.push({ level: level, text: text, id: id, lineIdx: i });
    }
  }
  // 保存到全局变量
  window.mdTocHeadings = headings;
  // 也赋值给本地变量（兼容旧代码）
  if (typeof mdTocHeadings !== 'undefined') {
    mdTocHeadings = headings;
  }
  if (!headings.length) return '<div style="color:#888;">暂无标题</div>';
  var html = '<ul>';
  for (var i = 0; i < headings.length; i++) {
    var h = headings[i];
    var indent = (h.level - 1) * 16;
    html += '<li style="padding-left:' + indent + 'px;"><a href="#" data-toc-idx="' + i + '">' + h.text + '</a></li>';
  }
  html += '</ul>';
  return html;
}

/**
 * 处理目录点击事件
 * @param {Event} e - 点击事件
 */
function handleTocClick(e) {
  if (e.target.tagName === 'A' && e.target.hasAttribute('data-toc-idx')) {
    e.preventDefault();
    var idx = parseInt(e.target.getAttribute('data-toc-idx'), 10);
    // 获取全局变量mdTocHeadings
    if (typeof mdTocHeadings !== 'undefined' && mdTocHeadings[idx]) {
      var heading = mdTocHeadings[idx];
      // 切换到预览tab
      var mdTabPreview = document.getElementById('mdTabPreview');
      if (mdTabPreview) mdTabPreview.click();
      // 滚动到对应标题
      setTimeout(function() {
        var headingEl = document.getElementById(heading.id);
        if (headingEl) {
          headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }
}
