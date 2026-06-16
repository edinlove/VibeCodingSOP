BugFixPlan

```
requirementUUID::37abb1a5-8c2f-42ef-ad17-1101def2c23a
requirementID::n79
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

22

## 一、已实施修复的审查2

```
requirementUUID::d6a22b59-940a-44a1-8932-203956cc1548
requirementID::n80
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

> goal & principle
>
> description
>

### ✅ BUG #11：`doCreateNewFile()` 默认内容格式 — 已正确实施

```
requirementUUID::cf220e7b-f604-4ba8-9e55-e0248e62026d
requirementID::n81
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

[doCreateNewFile()](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L2592) 中已使用 `requirement` 前缀和 UUID 字段，格式正确。

### ✅ BUG #3/#4：request 提取正则 — 已正确实施

```
requirementUUID::cddaf44c-7e60-45ce-97ed-55cebeef7600
requirementID::n82
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

[extractRequestFromNodeInfo()](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L780) 和 [extractCodeBlockFromNodeInfo()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L793) 已用位置索引替代正则，已在以下位置正确使用：
- `tempSaveNodeInfoBtn` (L6218)
- `tempSaveNodeInfoPanelBtn` (L4857)
- `applyAllTempSaves()` (L6371)
- `syncPanelToNode()` (L1805)
- `syncPanelFromNode()` (L1747)
- `updateNodeJournal()` (L1909)

### ✅ BUG #5：`updateNodeJournal()` 覆盖用户修改 — 已部分实施

```
requirementUUID::f4cbb066-01a2-491c-b82d-bb406b0949bf
requirementID::n83
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

[updateNodeJournal()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1909) 中已添加轻量级同步逻辑（L1933-L1955），先从 textarea 提取 request 和代码块字段再重新生成。

### ✅ BUG #6：`updateNodeJournal()` 清除暂存 — 已正确实施

```
requirementUUID::cae40ebd-a1c3-40ba-9290-cd78f01b5203
requirementID::n84
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

L1958-L1961 已改为更新暂存内容而非清除。

### ✅ BUG #2：`parseMD()` 容错处理 — 已正确实施

```
requirementUUID::0fc865c5-1228-4151-9858-bb0f0657e74f
requirementID::n85
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

[parseMD()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L2322) L2322-L2362 已添加 `fallbackMatch` 正则处理非标准前缀。

---

## 二、发现的问题清单

```
requirementUUID::4e62def4-a101-42c7-9a92-3a90d820e7bf
requirementID::n86
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

> goal & principle
>
> description
>

### 🔴 问题 A（遗漏）：`tempSaveNodeInfoPanelBtn` 暂存时未同步元数据字段到 node 对象

```
requirementUUID::085628e3-96ae-423c-a83f-46c035914936
requirementID::n87
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:4857](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L4857)

**现状**：
```javascript
var reqPart = extractRequestFromNodeInfo(text);
node.request = reqPart;
node.nodeInfo = text;

---

### 🔴 问题 B（遗漏）：`mdNodeTextarea` 编辑后未同步回 node 对象

```
requirementUUID::7d952b7a-f186-44b9-aa5c-345bdf4c3e14
requirementID::n88
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:4403](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L4403)

**现状**：
```javascript
mdNodeTextarea.addEventListener('input', function() {
  if (!mdNodeEditMode) {
    updateNodePreview();
  }
});

---

### 🔴 问题 C（遗漏）：`nodeInfoTextarea` 编辑后未同步回 node 对象

```
requirementUUID::e617b59e-218e-420b-8c15-a2920f6a3e2d
requirementID::n89
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:4881](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L4881)

**现状**：
```javascript
nodeInfoTextarea.addEventListener('input', function() {
  // 编辑模式下不实时更新预览，切换到预览时更新
});

### 🟡 问题 D（错误）：`updateNodeJournal()` 中的逻辑顺序问题 — request 被覆盖

```
requirementUUID::d5d18aa8-bc70-4435-9aed-b2e24bbeb522
requirementID::n90
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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

### 🟡 问题 E（边界问题）：`extractCodeBlockFromNodeInfo()` 不处理多代码块

```
requirementUUID::xxx
requirementID::n91
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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
标题


正文中有代码示例：
```python
print("hello")

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

### 🟡 问题 F（遗漏）：`tempSaveNodeInfoBtn` 暂存时未同步到 `nodeInfoTextarea`

```
requirementUUID::b715ec63-f5b5-4dad-a96f-1bd9b88292b4
requirementID::n92
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:6218](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L6218)

**现状**：`tempSaveNodeInfoBtn` 暂存后只调用了 `syncMdPanelFromCanvas()`，但没有同步更新 `nodeInfoTextarea`（节点信息面板的编辑框）。

**对比**：`tempSaveNodeInfoPanelBtn`（L4857）暂存后同步了 `nodeTextarea`：
```javascript
document.getElementById('nodeTextarea').value = text;

---

### 🟡 问题 G（遗漏）：`syncPanelFromNode()` 暂存恢复时未解析代码块字段

```
requirementUUID::46a857d3-0053-47e7-92f4-5d2eddf8da11
requirementID::n93
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:1747](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1747)

**现状**：
```javascript
if (tempText !== null) {
  var reqPart = extractRequestFromNodeInfo(metadataText);
  node.request = reqPart;
  node.nodeInfo = metadataText;
}

### 🟢 问题 H（过度延展）：`updateNodeJournal()` 中的轻量级同步过于复杂

```
requirementUUID::484cca6e-360e-4d6d-afb2-b75b016cec17
requirementID::n94
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:1933](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L1933)

**现状**：`updateNodeJournal()` 中内联了一大段从 textarea 提取 request 和解析代码块的逻辑（L1933-L1955），与 `syncPanelToNode()` 中的逻辑高度重复。

**建议**：这不是错误，但属于代码重复。建议将"从 textarea 文本同步到 node 对象"的逻辑提取为独立函数 `syncTextareaToNode(node, text)`，在多处复用，减少维护成本和出错概率。

---

## 三、尚未发现的潜在问题

```
requirementUUID::4350e10e-2d0f-4b24-8844-20c40c10fa67
requirementID::n95
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

> goal & principle
>
> description
>

### 🔴 新发现 #1：`nodeTextarea` 和 `nodeInfoTextarea` / `mdNodeTextarea` 三个编辑框之间缺乏双向同步

```
requirementUUID::95631689-9a25-44ab-bab3-f65303253f56
requirementID::n96
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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

```
requirementUUID::23dc5bf4-be7d-41e6-b82b-ac7b07d24021
requirementID::n97
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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

### 🟡 新发现 #3：`parseMD()` 中 `fallbackMatch` 的类型推断可能不准确

```
requirementUUID::922cd4d0-1bc6-4971-8194-4868f0b42dd9
requirementID::n98
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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

### 🟡 新发现 #4：`exportMD()` 中 request 为空时的默认模板与 `generateMetadata()` 不一致

```
requirementUUID::1700ca45-77c9-42f8-9f1c-08d7c8fdcf82
requirementID::n99
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：
- [exportMD()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L2440)：空 request 时输出 `> goal & principle\n>\n> description\n>\n\n***`
- [generateMetadata()](file:///Users/edwin/Paucode/VibeCodingSOP/index.html#L854)：空 request 时输出 `\n> goal & principle\n>\n> description\n>\n\n***\n`

**问题**：两者的格式略有差异（换行符数量不同），可能导致 `syncPanelToNode()` 中 `metaVal !== generatedMeta` 判断不稳定，产生不必要的同步。

**解决方案**：统一两处的默认模板格式。

---

### 🟡 新发现 #5：`applyAllTempSaves()` 中 `node.nodeInfo = text` 可能覆盖已同步的字段

```
requirementUUID::f87064b0-9e29-42f0-bf7b-264082979ebc
requirementID::n100
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

**位置**：[index.html:6371](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L6371)

**现状**：
```javascript
node.request = reqPart;
// ... 解析代码块字段到 node.status, node.priority 等
node.nodeInfo = text; // ← 最后一步用暂存文本覆盖 nodeInfo

## 四、开发计划

```
requirementUUID::1163de03-15ee-458b-a002-92cc995916cf
requirementID::n101
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 22:18
requirementEstDays::0
requirementAITaskJournal::
```

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
