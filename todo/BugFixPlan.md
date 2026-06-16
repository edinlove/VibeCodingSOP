# 全面审查报告：节点元数据逻辑问题、实施状态与解决方案

## 一、已实施修复的审查

### ✅ BUG #1：`doCreateNewFile()` 默认内容格式 — 已正确实施
[doCreateNewFile()](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L2592) 中已使用 `requirement` 前缀和 UUID 字段，格式正确。

### ✅ BUG #3/#4：request 提取正则 — 已正确实施
[extractRequestFromNodeInfo()](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L780) 和 [extractCodeBlockFromNodeInfo()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L793) 已用位置索引替代正则，已在以下位置正确使用：
- `tempSaveNodeInfoBtn` (L6218)
- `tempSaveNodeInfoPanelBtn` (L4857)
- `applyAllTempSaves()` (L6371)
- `syncPanelToNode()` (L1805)
- `syncPanelFromNode()` (L1747)
- `updateNodeJournal()` (L1909)

### ✅ BUG #5：`updateNodeJournal()` 覆盖用户修改 — 已部分实施
[updateNodeJournal()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1909) 中已添加轻量级同步逻辑（L1933-L1955），先从 textarea 提取 request 和代码块字段再重新生成。

### ✅ BUG #6：`updateNodeJournal()` 清除暂存 — 已正确实施
L1958-L1961 已改为更新暂存内容而非清除。

### ✅ BUG #2：`parseMD()` 容错处理 — 已正确实施
[parseMD()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L2322) L2322-L2362 已添加 `fallbackMatch` 正则处理非标准前缀。

---

## 二、发现的问题清单

### 🔴 问题 A（遗漏）：`tempSaveNodeInfoPanelBtn` 暂存时未同步元数据字段到 node 对象

**位置**：[index.html:4857](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L4857)

**现状**：
```javascript
var reqPart = extractRequestFromNodeInfo(text);
node.request = reqPart;
node.nodeInfo = text;
```
只更新了 `node.request` 和 `node.nodeInfo`，**没有解析代码块中的 Status、Priority、Mainline 等字段**同步到 node 对象。

**对比**：`tempSaveNodeInfoBtn`（L6218）和 `applyAllTempSaves()`（L6371）和 `syncPanelToNode()`（L1805）都已经有解析代码块字段的逻辑，但 `tempSaveNodeInfoPanelBtn` 遗漏了。

**影响**：用户在"节点信息面板"中修改了 Status/Priority 等字段后点击暂存，这些修改只存在于 `node.nodeInfo` 文本中，不会同步到 `node.status`/`node.priority` 等结构化字段。后续 `generateMetadata()` 或 `exportMD()` 会用旧的字段值重新生成，覆盖用户修改。

**解决方案**：在 `tempSaveNodeInfoPanelBtn` 的点击事件中，添加与 `tempSaveNodeInfoBtn` 相同的代码块解析逻辑：
```javascript
var codeBlock = extractCodeBlockFromNodeInfo(text);
if (codeBlock) {
  var codeLines = codeBlock.split('\n');
  var typeLabel = TYPE_LABELS[node.type] || 'requirement';
  for (var k = 0; k < codeLines.length; k++) {
    var ci = codeLines[k].indexOf('::');
    if (ci === -1) continue;
    var mkey = codeLines[k].substring(0, ci).trim();
    var mval = codeLines[k].substring(ci + 2).trim();
    if (mkey === typeLabel + 'Status') node.status = STATUS_REVERSE[mval] || 'N';
    else if (mkey === typeLabel + 'Priority') { if (mval) node.priority = mval; }
    else if (mkey === typeLabel + 'Mainline') node.mainline = mval || '🟢';
    else if (mkey === typeLabel + 'Module') node.module = mval || '';
    else if (mkey === typeLabel + 'UUID') { if (mval) node.uuid = mval; }
    else if (mkey === typeLabel + 'AITaskJournal') node.aiTaskJournal = mval || '';
  }
}
```

---

### 🔴 问题 B（遗漏）：`mdNodeTextarea` 编辑后未同步回 node 对象

**位置**：[index.html:4403](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L4403)

**现状**：
```javascript
mdNodeTextarea.addEventListener('input', function() {
  if (!mdNodeEditMode) {
    updateNodePreview();
  }
});
```
`mdNodeTextarea`（MD面板中的节点信息编辑框）的 `input` 事件只更新预览，**完全没有同步回 node 对象**。

**对比**：`nodeTextarea`（右侧信息栏的编辑框）的 `input` 事件会调用 `syncPanelToNode()`，完整同步。

**影响**：用户在 MD 面板的节点信息编辑框中修改内容后，如果不手动暂存，所有修改不会被同步到 node 对象。保存时这些修改会丢失。

**解决方案**：为 `mdNodeTextarea` 的 `input` 事件添加同步逻辑：
```javascript
mdNodeTextarea.addEventListener('input', function() {
  // 同步到 node 对象
  var node = getSelected();
  if (node) {
    var text = mdNodeTextarea.value;
    var reqPart = extractRequestFromNodeInfo(text);
    node.request = reqPart;
    node.nodeInfo = text;
    // 解析代码块字段
    var codeBlock = extractCodeBlockFromNodeInfo(text);
    if (codeBlock) {
      // ... 同样的解析逻辑
    }
  }
  if (!mdNodeEditMode) {
    updateNodePreview();
  }
});
```

---

### 🔴 问题 C（遗漏）：`nodeInfoTextarea` 编辑后未同步回 node 对象

**位置**：[index.html:4881](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L4881)

**现状**：
```javascript
nodeInfoTextarea.addEventListener('input', function() {
  // 编辑模式下不实时更新预览，切换到预览时更新
});
```
`nodeInfoTextarea`（节点信息面板的编辑框）的 `input` 事件**完全为空**，既不更新预览，也不同步到 node 对象。

**影响**：与问题 B 相同，用户在此编辑框中的修改不会同步到 node 对象。

**解决方案**：同问题 B，添加同步逻辑。

---

### 🟡 问题 D（错误）：`updateNodeJournal()` 中的逻辑顺序问题 — request 被覆盖

**位置**：[index.html:1909](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1909)

**现状**：`updateNodeJournal()` 的执行顺序是：
1. L1925-L1931：在 `node.request` 中追加 journal 引用
2. L1933-L1955：从 textarea 提取 request 和代码块字段（**会覆盖步骤1中追加的 journal 引用**）
3. L1956：`node.nodeInfo = generateMetadata(node)`

**问题**：步骤2中 `node.request = extractRequestFromNodeInfo(metaVal)` 会把 textarea 中的旧 request（不含 journal 引用）覆盖步骤1中已追加 journal 引用的新 request。**结果：journal 引用丢失。**

**解决方案**：调整步骤顺序——先从 textarea 同步（步骤2），再追加 journal 引用（步骤1），最后重新生成 nodeInfo（步骤3）：

```javascript
function updateNodeJournal(nodeId, fileName, filePath) {
  // 步骤1：先同步 UI 到 node 对象
  if (nodeId === selectedId) {
    // ... 现有的同步逻辑（L1933-L1955）
  }
  
  // 步骤2：追加 journal 引用到 node.aiTaskJournal / node.journal / node.request
  // ... 现有的追加逻辑（L1917-L1931）
  
  // 步骤3：重新生成 nodeInfo
  node.nodeInfo = generateMetadata(node);
  
  // 步骤4：更新暂存和刷新 UI
  // ...
}
```

---

### 🟡 问题 E（边界问题）：`extractCodeBlockFromNodeInfo()` 不处理多代码块

**位置**：[index.html:793](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L793)

**现状**：
```javascript
function extractCodeBlockFromNodeInfo(text) {
  var firstIdx = text.indexOf('```\n');
  if (firstIdx === -1) firstIdx = text.indexOf('```');
  if (firstIdx === -1) return null;
  var endIdx = text.indexOf('\n```', firstIdx + 3);
  if (endIdx === -1) return null;
  var codeContent = text.substring(firstIdx + 4, endIdx);
  return codeContent;
}
```

**问题**：如果 `node.request` 正文内容中包含代码块（如用户写了示例代码），`extractCodeBlockFromNodeInfo` 会匹配到**正文中的代码块开始标记**而非元数据代码块的结束标记。例如：

```
标题

```
requirementUUID::xxx
...
```

正文中有代码示例：
```python
print("hello")
```
```

此时 `text.indexOf('\n```', firstIdx + 3)` 会匹配到正文中的 ` ``` ` 而非元数据代码块的结束标记。

**影响**：元数据代码块被截断，只解析到部分字段；正文中的代码块内容被误当作元数据解析。

**解决方案**：`extractCodeBlockFromNodeInfo` 应该只匹配**紧跟在标题后的第一个代码块**，且该代码块应包含 `::` 格式的元数据行。改进方案：

```javascript
function extractCodeBlockFromNodeInfo(text) {
  if (!text) return null;
  var firstIdx = text.indexOf('```\n');
  if (firstIdx === -1) firstIdx = text.indexOf('```');
  if (firstIdx === -1) return null;
  // 从 firstIdx+4 开始，逐行查找，找到第一个只含 ``` 的行作为结束
  var afterStart = firstIdx + 4;
  var lines = text.substring(afterStart).split('\n');
  var codeLines = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      // 找到结束标记
      return codeLines.join('\n');
    }
    codeLines.push(lines[i]);
  }
  return null; // 没有找到结束标记
}
```

同理，`extractRequestFromNodeInfo` 也需要配套修改，确保从正确的代码块结束位置开始提取 request。

---

### 🟡 问题 F（遗漏）：`tempSaveNodeInfoBtn` 暂存时未同步到 `nodeInfoTextarea`

**位置**：[index.html:6218](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L6218)

**现状**：`tempSaveNodeInfoBtn` 暂存后只调用了 `syncMdPanelFromCanvas()`，但没有同步更新 `nodeInfoTextarea`（节点信息面板的编辑框）。

**对比**：`tempSaveNodeInfoPanelBtn`（L4857）暂存后同步了 `nodeTextarea`：
```javascript
document.getElementById('nodeTextarea').value = text;
```

**影响**：用户在右侧信息栏点击暂存后，切换到节点信息面板时，`nodeInfoTextarea` 显示的仍是旧内容。

**解决方案**：在 `tempSaveNodeInfoBtn` 暂存成功后，同步更新 `nodeInfoTextarea`：
```javascript
// 同步到节点信息面板
if (nodeInfoTextarea) nodeInfoTextarea.value = text;
// 同步到MD面板的节点编辑框
if (mdNodeTextarea) mdNodeTextarea.value = text;
```

---

### 🟡 问题 G（遗漏）：`syncPanelFromNode()` 暂存恢复时未解析代码块字段

**位置**：[index.html:1747](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1747)

**现状**：
```javascript
if (tempText !== null) {
  var reqPart = extractRequestFromNodeInfo(metadataText);
  node.request = reqPart;
  node.nodeInfo = metadataText;
}
```

只更新了 `node.request` 和 `node.nodeInfo`，**没有解析代码块中的 Status/Priority 等字段**。

**影响**：暂存恢复时，如果用户在暂存前修改了 Status 等字段，恢复后这些修改只存在于 `node.nodeInfo` 文本中，不会同步到结构化字段。后续操作可能覆盖。

**解决方案**：添加与 `applyAllTempSaves()` 相同的代码块解析逻辑。

---

### 🟢 问题 H（过度延展）：`updateNodeJournal()` 中的轻量级同步过于复杂

**位置**：[index.html:1933](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1933)

**现状**：`updateNodeJournal()` 中内联了一大段从 textarea 提取 request 和解析代码块的逻辑（L1933-L1955），与 `syncPanelToNode()` 中的逻辑高度重复。

**建议**：这不是错误，但属于代码重复。建议将"从 textarea 文本同步到 node 对象"的逻辑提取为独立函数 `syncTextareaToNode(node, text)`，在多处复用，减少维护成本和出错概率。

---

## 三、尚未发现的潜在问题

### 🔴 新发现 #1：`nodeTextarea` 和 `nodeInfoTextarea` / `mdNodeTextarea` 三个编辑框之间缺乏双向同步

**现状**：系统中有三个可以编辑节点元数据的文本框：
1. `nodeTextarea`（右侧信息栏）— 有 `input` → `syncPanelToNode()` 同步
2. `nodeInfoTextarea`（节点信息面板）— `input` 事件为空
3. `mdNodeTextarea`（MD面板中的节点编辑框）— `input` 只更新预览

**问题**：用户在任一编辑框中修改内容后，其他两个编辑框不会自动更新。只有在切换节点或调用 `syncPanelFromNode()` 时才会刷新。

**解决方案**：建立统一的同步机制——任一编辑框的 `input` 事件都应：
1. 同步内容到 node 对象
2. 通知其他编辑框更新（但不触发它们的 input 事件，避免循环）

---

### 🔴 新发现 #2：`saveFile()` 保存后清除暂存，但 `updateNodeJournal()` 更新暂存后未触发保存

**现状**：
- `saveFile()` 保存成功后调用 `clearTempSavesForFile()` 清除暂存
- `updateNodeJournal()` 更新暂存内容但不触发保存

**问题**：Builder 操作后，journal 引用被追加到了 node 对象和暂存中，但**没有自动保存到文件**。如果用户在 Builder 操作后关闭浏览器或切换文件，journal 引用会丢失。

**解决方案**：在 `updateNodeJournal()` 完成后，自动触发保存：
```javascript
// 在 updateNodeJournal() 末尾
if (currentFileName) {
  saveFile();
}
```
或者至少提示用户保存。

---

### 🟡 新发现 #3：`parseMD()` 中 `fallbackMatch` 的类型推断可能不准确

**位置**：[index.html:2322](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L2322)

**现状**：`fallbackMatch` 正则 `/^(\S+?)(UUID|ID|Status|Priority|Mainline|Module|Created|EstDays|AITaskJournal)::(.*)$/` 不区分前缀类型，直接将值赋给 `currentNode`。

**问题**：如果文件中混合了不同类型前缀的元数据行（如 `requirementStatus::new` 和 `featureStatus::ongoing`），fallback 逻辑无法区分，后面的行会覆盖前面的行。

**解决方案**：在 fallback 逻辑中，根据 `currentNode.type` 推断正确的前缀，只接受匹配的前缀或无前缀的行：
```javascript
var expectedLabel = TYPE_LABELS[currentNode.type] || 'requirement';
var fallbackMatch = line.match(/^(\S+?)(UUID|ID|Status|Priority|Mainline|Module|Created|EstDays|AITaskJournal)::(.*)$/);
if (fallbackMatch) {
  var prefix = fallbackMatch[1];
  // 只接受正确前缀或通用前缀
  if (prefix === expectedLabel || prefix === '') {
    // ... 处理
  }
}
```

---

### 🟡 新发现 #4：`exportMD()` 中 request 为空时的默认模板与 `generateMetadata()` 不一致

**位置**：
- [exportMD()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L2440)：空 request 时输出 `> goal & principle\n>\n> description\n>\n\n***`
- [generateMetadata()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L854)：空 request 时输出 `\n> goal & principle\n>\n> description\n>\n\n***\n`

**问题**：两者的格式略有差异（换行符数量不同），可能导致 `syncPanelToNode()` 中 `metaVal !== generatedMeta` 判断不稳定，产生不必要的同步。

**解决方案**：统一两处的默认模板格式。

---

### 🟡 新发现 #5：`applyAllTempSaves()` 中 `node.nodeInfo = text` 可能覆盖已同步的字段

**位置**：[index.html:6371](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L6371)

**现状**：
```javascript
node.request = reqPart;
// ... 解析代码块字段到 node.status, node.priority 等
node.nodeInfo = text; // ← 最后一步用暂存文本覆盖 nodeInfo
```

**问题**：`node.nodeInfo = text` 将暂存的原始文本设为 nodeInfo，但此时 `node.status` 等字段已经从代码块解析更新了。如果暂存文本中的 Status 与解析出的 Status 不一致（理论上不应该，但边界情况可能存在），`nodeInfo` 和结构化字段之间就不一致了。

**建议**：将 `node.nodeInfo = text` 改为 `node.nodeInfo = generateMetadata(node)`，确保 nodeInfo 与结构化字段始终一致。但这需要确保 `extractRequestFromNodeInfo` 和 `extractCodeBlockFromNodeInfo` 的提取是准确的。

---

## 四、开发计划

按优先级排序：

| 阶段 | 优先级 | 问题 | 工作量 | 说明 |
|------|--------|------|--------|------|
| **Phase 1** | P0 | 问题 D：updateNodeJournal 逻辑顺序 | 0.5h | **最紧急**，当前代码会导致 journal 引用丢失 |
| **Phase 1** | P0 | 问题 A：tempSaveNodeInfoPanelBtn 缺少字段同步 | 0.5h | 暂存后字段不一致 |
| **Phase 2** | P0 | 问题 B+C：mdNodeTextarea / nodeInfoTextarea 未同步 | 1h | 两个编辑框修改后不生效 |
| **Phase 2** | P0 | 问题 G：syncPanelFromNode 暂存恢复缺字段同步 | 0.5h | 恢复暂存后字段不一致 |
| **Phase 3** | P1 | 问题 E：多代码块边界处理 | 1h | 用户正文中含代码块时解析错误 |
| **Phase 3** | P1 | 新发现 #1：三编辑框双向同步 | 1.5h | 编辑体验一致性 |
| **Phase 3** | P1 | 新发现 #2：Builder 后自动保存 | 0.5h | 防止 journal 引用丢失 |
| **Phase 4** | P2 | 问题 F：暂存后同步其他编辑框 | 0.5h | UI 一致性 |
| **Phase 4** | P2 | 新发现 #3：fallbackMatch 类型推断 | 0.5h | 边界情况容错 |
| **Phase 4** | P2 | 新发现 #4：默认模板格式统一 | 0.5h | 避免不必要的同步触发 |
| **Phase 5** | P3 | 问题 H：重构提取公共函数 | 1h | 代码质量优化 |
| **Phase 5** | P3 | 新发现 #5：applyAllTempSaves nodeInfo 一致性 | 0.5h | 数据一致性保障 |

**总预估工作量**：约 8 小时

**建议实施顺序**：
1. **Phase 1**（1h）：修复问题 D 和 A，这两个是当前最严重的数据丢失问题
2. **Phase 2**（1.5h）：修复问题 B+C+G，确保所有编辑入口都能正确同步
3. **Phase 3**（3h）：修复问题 E + 新发现 #1 + #2，提升健壮性和用户体验
4. **Phase 4**（1.5h）：修复问题 F + 新发现 #3 + #4，边界情况处理
5. **Phase 5**（1.5h）：重构和新发现 #5，代码质量提升

每个 Phase 完成后进行一轮测试，测试用例覆盖：
- 新建文件 → 修改标题 → 暂存 → 保存
- 修改节点元数据 → 暂存 → Builder-md → 验证 journal 引用存在且正文未被覆盖
- 在三个不同编辑框中修改内容 → 保存 → 重新打开 → 验证修改保留
- 正文包含代码块的节点 → 暂存 → 保存 → 重新打开 → 验证元数据和正文正确