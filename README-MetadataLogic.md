# 节点元数据业务逻辑分析文档

原始问题：

分析该项目的整个工程空间 #Workspace 的与以下问题相关的文件，尤其是仔细阅读 `/Users/ed/Documents/edwin/Paucode/VibeCodingSOP/README.md` 和 `/Users/ed/Documents/edwin/Paucode/VibeCodingSOP/AGENTS.md` 文件。 
 我现在要解决todo文件夹和prompt文件夹内的MD文件，在新建、备份、暂存和保存的时候，文件内生成内容的”节点元数据块“格式不对，文件被错误覆盖，文件的节点元数据块的内容被冲掉的问题。目前看，该项目中，新建、暂存和保存的逻辑混乱、错误和漏洞很多。 
 最好在整体分析该工程文件的过程中，把”新建“、”打开“、”暂存“、”保存“、”Builder-md“、”Builder-json“等涉及md文件保存、备份、暂存、插入、备份节点元数据的操作时，具体的业务逻辑是怎样的，把这些结论以中文的方式写入到 `/Users/ed/Documents/edwin/Paucode/VibeCodingSOP/README-MetadataLogic.md` 文件中。 
 
 --- 
 
 举例： 
 1、当我在左侧工具栏点击”新建“按钮，创建了思维导图”根节点“的时候，我修改了根节点的标题，点击了暂存按钮，之后，又点击了工具栏的“保存”按钮。在todo文件夹下面创建的文件，根节点的元数据是错误的，因为。修改前的根节点的”节点元数据“的一部分内容依然保留在MD文件中。如："```paulo(1)ID::n1 
 paulo(1)Priority::2️⃣ 
 paulo(1)Mainline::🟢 
 paulo(1)Status::new 
 paulo(1)Module:: 
 paulo(1)Created::2026-06-16 18:26 
 paulo(1)EstDays::0"。这段内容本应该被替换和覆盖的，但是却被保存到了MD文件中。 
 
 2、在"test washed away and covered.md"文件中，当我在“思维导图页面”中创建了子节点，子节点内的标题为：“modify metadata”，我更改了子节点的节点元数据。更改为：“test modify metadata”，选择了暂存，保存，节点元数据被保存。 
 然后我点击工具栏的"Prompt"按钮，然后点击“Builder-md”按钮，在根目录下的todo文件夹下的，"test washed away and covered.md"文件中的“modify metadata”节点的节点元数据的最后，追加类似"[[/Users/ed/Documents/edwin/Paucode/VibeCodingSOP/prompt/.historylog/prompt-20260616184903-953abae8.md]]"的文件，重点：往往追加的内容会把"test modify metadata"这段节点元数据的内容覆盖掉，把我修改的”test modify metadata“的内容，覆盖为“> goal & principle 
 > 
 > description 
 >”。 
 但是我始终没有排查和定位出来原因，也没有找到规律。 
 总之，该工程文件中的“暂存”、“保存”等按钮，经常会把一些节点元数据文件莫名其妙的覆盖，导致文件内容的丢失。 
 

## 一、核心数据结构

### 1.1 节点对象（Node）关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | 运行时节点ID，如 `n1`、`n2` |
| `uuid` | String | 持久化唯一标识，如 `6c7e1fe8-bb5e-4491-bc5b-f00fa89caa0a` |
| `title` | String | 节点标题 |
| `type` | String | 节点类型：`R`=requirement, `F`=feature, `P`=prompt |
| `status` | String | 状态：`N`=new, `O`=ongoing, `D`=done, `U`=update, `C`=cancel |
| `priority` | String | 优先级：1️⃣~5️⃣ |
| `mainline` | String | 主线标记：🟢/🔴 |
| `module` | String | 模块名 |
| `created` | String | 创建时间 |
| `estDays` | String | 预估天数 |
| `aiTaskJournal` | String | AITaskJournal引用，如 `[[../prompt/.historylog/xxx.md]]` |
| `request` | String | **节点正文内容**（代码块之后的所有文本） |
| `nodeInfo` | String | **完整的节点元数据文本**（标题 + 代码块 + 正文），由 `generateMetadata()` 生成 |
| `journal` | String | UI显示用的journal字段（独立于aiTaskJournal） |

### 1.2 MD文件格式

每个节点在MD文件中的格式如下：

```markdown
标题文本（根节点无#前缀，子节点用##/###等）

\`\`\`
requirementUUID::xxx
requirementID::n1
requirementPriority::2️⃣
requirementMainline::🟢
requirementStatus::new
requirementModule::
requirementCreated::2026-06-16 18:26
requirementEstDays::0
requirementAITaskJournal::
\`\`\`

节点正文内容（即 request 字段）
```

**关键约定**：代码块中的元数据前缀由节点类型决定：
- `R` → `requirement`前缀
- `F` → `feature`前缀
- `P` → `prompt`前缀

---

## 二、各操作的业务逻辑详解

### 2.1 新建文件（`doCreateNewFile()`）

**触发**：点击工具栏"新建"按钮

**流程**：
1. 基础文件名 `Paulo.md`，如已存在则加序号 `Paulo(1).md`
2. **构造默认MD内容**（硬编码格式）：
   ```
   # Paulo(1)\n\n```paulo(1)ID::n1\npaulo(1)Priority::2️⃣...\n```\n\n
   ```
3. 调用 `POST /api/todo/save` 将默认内容写入文件
4. 调用 `loadTodoFile(uniqueFileName)` 加载文件

**🔴 BUG #1：默认MD内容格式错误**

`doCreateNewFile()` 中构造的默认内容使用**文件名小写**作为元数据前缀：
```javascript
var defaultContent = '# ' + baseName + '\n\n```' + baseName.toLowerCase() + 'ID::n1\n'...
```
例如文件名 `Paulo(1).md`，生成的前缀是 `paulo(1)`，即：
```
```paulo(1)ID::n1
paulo(1)Priority::2️⃣
```

但 `parseMD()` 中解析元数据的正则是：
```javascript
var metaMatch = line.match(/^(requirement|feature|prompt)(\w+)::(.*)$/);
```
**只识别 `requirement`、`feature`、`prompt` 三种前缀**，不识别 `paulo(1)` 这种前缀。

**后果**：
- `parseMD()` 无法解析这些元数据行，所有元数据字段（Status、Priority等）都不会被读取
- 这些无法识别的行会被当作 `request` 内容（代码块外的文本）收集
- `createNode()` 创建新节点时使用默认值（type='R', status='N'等），与文件内容不一致
- `generateMetadata()` 生成新的元数据时使用 `requirement` 前缀，与文件中残留的 `paulo(1)` 前缀不同
- **最终MD文件中同时存在两套元数据**：旧的 `paulo(1)` 前缀（无法被解析和替换）和新的 `requirement` 前缀

**这就是用户反馈的"修改前的根节点的节点元数据的一部分内容依然保留在MD文件中"的根本原因。**

---

### 2.2 打开文件（`loadTodoFile()` / `loadTodoFileWithEnv()`）

**触发**：文件选择器中选择文件

**流程**：
1. `GET /api/todo/read?file=xxx` 读取MD文件内容
2. `parseMD(result.content)` 解析MD文本为节点树
3. 强制设置 `data.title = rawName`（文件名去掉.md）
4. `refreshSeq()` 重新编号
5. `fullRender()` 渲染
6. `exportMD()` 重新生成MD文本并更新面板

**parseMD() 解析逻辑**：
1. 按行扫描，识别 `#` 标题行
2. 遇到 ` ``` ` 切换 `inCodeBlock` 状态
3. 在代码块内，用正则 `/^(requirement|feature|prompt)(\w+)::(.*)$/` 匹配元数据
4. 代码块外的非标题行收集为 `request` 内容
5. **不识别的元数据前缀行会被当作 request 内容**

**🔴 BUG #2：parseMD 对不识别前缀的处理缺陷**

当MD文件中存在 `paulo(1)ID::n1` 这样的行时：
- 正则不匹配 → 被当作 request 内容
- 但这些行在代码块**内部**，`inCodeBlock=true` 时不走 request 收集分支
- 实际上这些行被**静默丢弃**了
- 代码块关闭后，如果紧跟的文本是空行，`request` 为空
- `generateMetadata()` 会为空的 request 生成默认模板（`> goal & principle...`）

**后果**：用户修改的正文内容丢失，被默认模板覆盖。

---

### 2.3 暂存节点元数据（`tempSaveNodeInfoBtn` 点击事件）

**触发**：点击右侧信息栏的"暂存"按钮

**流程**：
1. 获取 `nodeTextarea.value`（当前节点元数据文本框内容）
2. 存入 localStorage：`tempSave_nodeInfo_{fileName}_{nodeId}`
3. 从文本中提取 request 部分（代码块之后的内容）
4. 更新 `node.request` 和 `node.nodeInfo`
5. 调用 `syncMdPanelFromCanvas()` 同步MD面板

**🔴 BUG #3：暂存时 request 提取逻辑有缺陷**

提取 request 的正则：
```javascript
var codeBlockMatch = text.match(/^```[\s\S]*?^```/m);
```

这个正则的问题：
- `^```` 要求反引号必须在行首
- `[\s\S]*?` 是非贪婪匹配
- `/m` 标志使 `^` 匹配行首
- **但如果 nodeTextarea 中的文本不是以 ` ``` ` 开头**（例如以标题行开头），则匹配失败
- 匹配失败时，**整个文本被当作 request**，覆盖了原有的元数据结构

**实际场景**：`generateMetadata()` 生成的 nodeInfo 格式是：
```
标题文本\n\n```\n元数据\n```\n\n正文
```
文本以标题开头，不是以 ` ``` ` 开头，所以正则 `^```[\s\S]*?^```` **永远匹配不到**。

**但代码中 `syncPanelFromNode()` 显示 nodeTextarea 时，调用的是 `generateMetadata(node)`，其输出格式确实以标题开头。暂存按钮获取的也是这个完整文本。**

**然而**，`syncPanelFromNode()` 中有一段处理暂存恢复的逻辑：
```javascript
var codeBlockMatch = metadataText.match(/^```[\s\S]*?^```/m);
```
这个正则同样无法匹配以标题开头的文本。

**更严重的问题**：`applyAllTempSaves()` 中也用了同样的正则来提取 request，同样会失败。

---

### 2.4 暂存Markdown面板（`tempSaveMdBtn` 点击事件 / Ctrl+S）

**触发**：点击MD面板的"暂存"按钮或按 Ctrl+S

**流程**：
1. 获取 `mdTextarea.value`（MD面板文本框内容）
2. 存入 localStorage：`tempSave_mdPanel_{fileName}`
3. 调用 `parseMD(text, data)` 解析MD文本
4. 用解析结果替换当前 `data` 树
5. `fullRender()` 重新渲染

**此路径相对安全**，因为 `parseMD()` 是完整的解析器，能正确处理标准格式的MD。

---

### 2.5 保存文件（`saveFile()`）

**触发**：点击工具栏"保存"按钮

**流程**：
1. 如果没有 `currentFileName`，用 `data.title + '.md'` 作为文件名
2. 调用 `applyAllTempSaves()` 将所有暂存内容合并到数据树
3. 调用 `exportMD()` 从数据树生成MD文本
4. 检查根节点标题是否与文件名不同，决定是否重命名
5. `POST /api/todo/save` 或 `POST /api/todo/rename` 写入文件

**exportMD() 逻辑**：
- 遍历节点树，对每个节点：
  - 输出标题行
  - 输出代码块（用 `TYPE_LABELS[node.type]` 作为前缀）
  - 输出 `node.request`（正文内容）
  - 如果 request 为空，输出默认模板

**🔴 BUG #4：applyAllTempSaves() 的 request 提取失败导致数据丢失**

`applyAllTempSaves()` 中提取 request 的逻辑：
```javascript
var codeBlockMatch = text.match(/^```[\s\S]*?^```/m);
if (codeBlockMatch) {
  var reqPart = text.substring(codeBlockMatch.index + codeBlockMatch[0].length)
    .replace(/^\n+/, '').replace(/\n+$/, '');
  if (reqPart.endsWith('***')) reqPart = reqPart.slice(0, -3).replace(/\n+$/, '');
  node.request = reqPart;
} else {
  node.request = text;  // 整个文本当作request
}
```

当正则匹配失败时（因为文本以标题开头而非 ` ``` `），**整个 nodeInfo 文本（包含标题、代码块、正文）被当作 request**。

然后 `exportMD()` 输出时：
1. 先输出标题行
2. 再输出代码块（从节点字段重新生成）
3. 再输出 `node.request`（此时包含了标题+代码块+正文的混合内容）

**结果**：MD文件中出现重复的标题和代码块，旧的元数据内容被当作正文保留。

---

### 2.6 Builder-md / Builder-json（`prompt-optimization.html`）

**触发**：在Prompt面板中点击"Builder-md"或"Builder-json"按钮

**流程**（在 prompt-optimization.html iframe 中）：
1. 收集选中节点的信息 + 模板内容
2. 构建 MD/JSON 内容
3. `POST /api/prompt/historylog` 保存到 `prompt/.historylog/` 目录
4. 调用 `sendUpdateJournal(fileName)` 发送 `postMessage` 到父页面

**sendUpdateJournal()**：
```javascript
function sendUpdateJournal(fileName) {
  var filePath = WORK_DIR ? (WORK_DIR + '/prompt/.historylog/' + fileName) : ('../prompt/.historylog/' + fileName);
  parent.postMessage({
    type: 'UPDATE_JOURNAL',
    fileName: fileName,
    filePath: filePath,
    selectedNodeIds: selectedNodeIds
  }, '*');
}
```

**父页面接收 UPDATE_JOURNAL**（index.html）：
```javascript
if (event.data.type === 'UPDATE_JOURNAL') {
  var fileName = event.data.fileName;
  var filePath = event.data.filePath;
  var nodeIds = event.data.selectedNodeIds || [];
  nodeIds.forEach(function(nodeId) {
    updateNodeJournal(nodeId, fileName, filePath);
  });
}
```

**updateNodeJournal() 逻辑**：
1. 更新 `node.aiTaskJournal`（追加 `[[filePath]]`）
2. 更新 `node.journal`（追加 `[[filePath]]`）
3. **更新 `node.request`**：在 `***` 分隔符前或末尾追加 `[[filePath]]`
4. 调用 `generateMetadata(node)` 重新生成 `node.nodeInfo`
5. 清除该节点的暂存（`localStorage.removeItem`）
6. 刷新UI

**🔴 BUG #5：updateNodeJournal 中 generateMetadata 覆盖了用户修改的元数据**

步骤4中，`generateMetadata(node)` 会**完全重新生成** nodeInfo 文本，包括：
- 标题行
- 代码块（从 node 的字段值重新生成）
- request 正文（从 `node.request` 获取）

问题在于：
- 如果用户在 nodeTextarea 中修改了元数据但**没有暂存**，这些修改只存在于 nodeTextarea 中，并未同步回 node 对象的字段
- `updateNodeJournal()` 读取的是 node 对象的字段值，不是 textarea 的值
- `generateMetadata()` 基于旧的字段值重新生成，**用户的修改被丢弃**
- 步骤5清除了暂存，所以即使之前暂存过，也会被清除

**🔴 BUG #6：request 中追加 journal 引用后，generateMetadata 重新生成的模板覆盖了用户修改的正文**

更严重的情况：
1. 用户修改了节点正文（request），如将默认的 `> goal & principle\n>\n> description\n>` 改为 `test modify metadata`
2. 用户暂存了修改（此时 node.request = "test modify metadata"）
3. 用户点击 Builder-md
4. `updateNodeJournal()` 在 node.request 中追加 `[[filePath]]`
5. `generateMetadata(node)` 重新生成 nodeInfo

如果步骤2的暂存没有正确更新 node.request（因为 BUG #3），那么 node.request 仍然是旧的默认模板内容。`generateMetadata()` 就会用旧内容重新生成，**覆盖用户修改**。

---

## 三、问题根因总结

### 3.1 核心问题：双重数据源冲突

系统中存在**两套数据表示**：
1. **结构化数据**：node 对象的字段（title, type, status, priority, request, aiTaskJournal 等）
2. **文本数据**：nodeInfo（完整的元数据文本）和 nodeTextarea.value（UI文本框内容）

两者之间没有可靠的同步机制：
- `generateMetadata()` 从结构化数据 → 文本数据（单向）
- `syncPanelToNode()` 尝试从文本数据 → 结构化数据，但提取逻辑有缺陷
- `applyAllTempSaves()` 同样尝试从文本数据 → 结构化数据，同样的缺陷

### 3.2 具体Bug清单

| 编号 | Bug | 位置 | 影响 |
|------|-----|------|------|
| BUG #1 | `doCreateNewFile()` 使用文件名小写作为元数据前缀，不符合 `requirement/feature/prompt` 规范 | index.html L2525 | 新建文件的元数据无法被 parseMD 解析，残留旧元数据 |
| BUG #2 | `parseMD()` 对不识别前缀的元数据行静默丢弃 | index.html L2220 | 旧元数据内容丢失，被默认模板覆盖 |
| BUG #3 | 暂存节点元数据时，request 提取正则 `^```[\s\S]*?^```` 无法匹配以标题开头的 nodeInfo 文本 | index.html L6170 | 暂存时整个文本被当作 request，元数据结构被破坏 |
| BUG #4 | `applyAllTempSaves()` 同样使用错误的正则提取 request | index.html L6315 | 保存时暂存内容无法正确应用，元数据被覆盖 |
| BUG #5 | `updateNodeJournal()` 调用 `generateMetadata()` 重新生成 nodeInfo，覆盖了用户未暂存的修改 | index.html L1949 | Builder 操作覆盖用户修改 |
| BUG #6 | `updateNodeJournal()` 清除了暂存数据，导致即使之前暂存也无法恢复 | index.html L1953 | 暂存数据丢失，无法回退 |

### 3.3 数据流图

```
用户操作 → nodeTextarea.value → [暂存] → localStorage
                                         ↓
[保存] → applyAllTempSaves() → node.request (BUG #3/#4: 提取失败)
                                         ↓
         exportMD() → MD文件 (BUG #1: 双重元数据)

[Builder] → updateNodeJournal() → node.request (追加引用)
                                → generateMetadata() (BUG #5: 覆盖修改)
                                → 清除暂存 (BUG #6: 数据丢失)
                                → exportMD() → MD文件
```

---

## 四、解决方案

### 4.1 修复 BUG #1：`doCreateNewFile()` 默认内容格式

**问题**：使用文件名小写作为元数据前缀，不符合规范。

**方案**：默认内容应使用 `requirement` 前缀（因为默认类型是 R），且包含 UUID 字段：

```javascript
var defaultContent = '# ' + baseName + '\n\n```requirementUUID::' + generateUUID() + '\nrequirementID::n1\nrequirementPriority::2️⃣\nrequirementMainline::🟢\nrequirementStatus::new\nrequirementModule::\nrequirementCreated::' + now() + '\nrequirementEstDays::0\nrequirementAITaskJournal::\n```\n\n> goal & principle\n>\n> description\n>\n\n***\n';
```

### 4.2 修复 BUG #3/#4：request 提取正则

**问题**：`^```[\s\S]*?^```` 无法匹配以标题开头的 nodeInfo 文本。

**方案**：修改正则，允许代码块前有任意文本：

```javascript
// 旧：var codeBlockMatch = text.match(/^```[\s\S]*?^```/m);
// 新：
var codeBlockMatch = text.match(/```[\s\S]*?```/);
```

或者更健壮的方式——先找到第一个 ` ``` ` 开始的位置，再找到匹配的结束 ` ``` `：

```javascript
function extractRequestFromNodeInfo(text) {
  var startIdx = text.indexOf('```\n');
  if (startIdx === -1) startIdx = text.indexOf('```');
  if (startIdx === -1) return text;
  var endIdx = text.indexOf('\n```', startIdx + 3);
  if (endIdx === -1) return text;
  var afterBlock = text.substring(endIdx + 4); // skip \n```
  var reqPart = afterBlock.replace(/^\n+/, '').replace(/\n+$/, '');
  if (reqPart.endsWith('***')) reqPart = reqPart.slice(0, -3).replace(/\n+$/, '');
  return reqPart;
}
```

**需要修改的位置**：
1. `tempSaveNodeInfoBtn` 点击事件（L6170）
2. `applyAllTempSaves()`（L6315）
3. `syncPanelFromNode()` 中的暂存恢复逻辑（L1689）
4. `syncPanelToNode()` 中的 request 提取逻辑（L1824）

### 4.3 修复 BUG #5：`updateNodeJournal()` 不应完全重新生成 nodeInfo

**问题**：`generateMetadata()` 完全重新生成 nodeInfo，覆盖用户修改。

**方案A（推荐）**：在 `updateNodeJournal()` 中，先同步当前 UI 状态到 node 对象，再更新：

```javascript
function updateNodeJournal(nodeId, fileName, filePath) {
  // 先同步当前选中节点的UI状态
  if (nodeId === selectedId) {
    syncPanelToNode(); // 确保UI修改已同步到node对象
  }
  // ... 后续逻辑不变
}
```

**方案B**：不调用 `generateMetadata()` 重新生成整个 nodeInfo，而是直接修改 nodeInfo 文本中的 AITaskJournal 行：

```javascript
// 替换 nodeInfo 中的 AITaskJournal 行
var typeLabel = TYPE_LABELS[node.type] || 'requirement';
var journalKey = typeLabel + 'AITaskJournal::';
var lines = node.nodeInfo.split('\n');
for (var i = 0; i < lines.length; i++) {
  if (lines[i].startsWith(journalKey)) {
    lines[i] = journalKey + (node.aiTaskJournal || '');
    break;
  }
}
node.nodeInfo = lines.join('\n');
```

### 4.4 修复 BUG #6：`updateNodeJournal()` 不应清除暂存

**问题**：清除暂存导致用户之前的修改无法恢复。

**方案**：不清除暂存，而是更新暂存内容以反映 journal 的变更：

```javascript
// 旧：localStorage.removeItem('tempSave_nodeInfo_' + currentFileName + '_' + nodeId);
// 新：更新暂存内容
if (currentFileName) {
  var key = 'tempSave_nodeInfo_' + currentFileName + '_' + nodeId;
  safeLocalStorageSet(key, JSON.stringify({ text: node.nodeInfo, time: Date.now() }));
}
```

### 4.5 修复 BUG #2：`parseMD()` 容错处理

**问题**：不识别的元数据前缀行被静默丢弃。

**方案**：在代码块内，如果遇到不符合 `requirement/feature/prompt` 前缀的 `::` 行，尝试从上下文推断类型：

```javascript
// 在 parseMD() 的 inCodeBlock 分支中
var metaMatch = line.match(/^(requirement|feature|prompt)(\w+)::(.*)$/);
if (!metaMatch) {
  // 尝试匹配任意前缀的元数据行
  var genericMatch = line.match(/^(\w[\w()]*)::(.+)$/);
  if (genericMatch && currentNode) {
    var key = genericMatch[1];
    var val = genericMatch[2];
    // 从 key 中提取属性名（去掉前缀）
    var typeLabel = TYPE_LABELS[currentNode.type] || 'requirement';
    if (key.endsWith('UUID')) { if (val) currentNode.uuid = val; }
    else if (key.endsWith('Status')) { currentNode.status = STATUS_REVERSE[val] || 'N'; }
    else if (key.endsWith('Priority')) { if (val) currentNode.priority = val; }
    else if (key.endsWith('Mainline')) { currentNode.mainline = val || '🟢'; }
    else if (key.endsWith('Module')) { currentNode.module = val || ''; }
    else if (key.endsWith('Created')) { currentNode.created = val || ''; }
    else if (key.endsWith('EstDays')) { currentNode.estDays = val || '0'; }
    else if (key.endsWith('AITaskJournal')) { currentNode.aiTaskJournal = val || ''; }
  }
}
```

### 4.6 架构层面建议：统一数据源

**长期方案**：消除"结构化数据"和"文本数据"的双重数据源问题。

1. **nodeInfo 应该始终由 `generateMetadata()` 生成**，不应该被手动编辑后直接存回
2. **用户在 nodeTextarea 中的编辑应该实时同步到 node 对象字段**，然后由 `generateMetadata()` 重新生成 nodeInfo
3. **`syncPanelToNode()` 应该是唯一的数据回流通道**，确保文本编辑 → 结构化字段的转换是可靠的
4. **所有需要更新 nodeInfo 的操作都应该先更新 node 字段，再调用 `generateMetadata()`**

---

## 五、操作流程时序图

### 5.1 新建文件流程（当前，有BUG）

```
用户点击"新建"
  → doCreateNewFile()
    → 构造默认MD（使用 paulo(1) 前缀）❌
    → POST /api/todo/save 写入文件
    → loadTodoFile()
      → parseMD() 解析
        → paulo(1)前缀不匹配正则 ❌
        → 元数据行被丢弃
        → request 为空
      → createNode() 使用默认值
      → generateMetadata() 生成 requirement 前缀的元数据
      → exportMD() 输出
        → 文件中同时存在 paulo(1) 和 requirement 两套元数据 ❌
```

### 5.2 暂存+保存流程（当前，有BUG）

```
用户修改节点元数据 → nodeTextarea.value 变化
  → syncPanelToNode()
    → 提取request：正则 ^```[\s\S]*?^``` 匹配失败 ❌
    → 整个文本被当作 request

用户点击"暂存"
  → localStorage 存储 nodeTextarea.value
  → 提取request：同样正则匹配失败 ❌
  → node.request = 整个文本（含标题+代码块）

用户点击"保存"
  → applyAllTempSaves()
    → 提取request：同样正则匹配失败 ❌
    → node.request = 整个文本
  → exportMD()
    → 输出标题行
    → 输出代码块（从字段重新生成）
    → 输出 node.request（包含标题+代码块的混合内容）❌
    → 文件中出现重复元数据
```

### 5.3 Builder-md 流程（当前，有BUG）

```
用户点击 Builder-md
  → prompt-optimization.html
    → 构建内容
    → POST /api/prompt/historylog 保存
    → sendUpdateJournal() postMessage

  → index.html 接收 UPDATE_JOURNAL
    → updateNodeJournal()
      → 更新 node.aiTaskJournal
      → 更新 node.request（追加引用）
      → generateMetadata() 重新生成 nodeInfo ❌
        → 如果用户修改未暂存/未同步，修改被覆盖
      → 清除暂存 ❌
      → syncPanelFromNode(true) 刷新UI
        → 显示重新生成的 nodeInfo（用户修改已丢失）
```

---

## 六、修复优先级建议

| 优先级 | Bug | 修复难度 | 影响范围 |
|--------|-----|---------|---------|
| P0 | BUG #3/#4：request 提取正则错误 | 低 | 所有暂存和保存操作 |
| P0 | BUG #1：新建文件默认内容格式错误 | 低 | 新建文件操作 |
| P1 | BUG #5：updateNodeJournal 覆盖用户修改 | 中 | Builder 操作 |
| P1 | BUG #6：updateNodeJournal 清除暂存 | 低 | Builder 操作 |
| P2 | BUG #2：parseMD 容错处理 | 中 | 打开含有非标准前缀的文件 |


---

# 问题：根据上述描述，对于没有暂存的节点元数据，我点击保存按钮的时候，会被丢弃么？

## 结论：不是简单"丢弃"，而是"错乱"

没有暂存的节点元数据，点击保存时**不会被直接丢弃**，但会因为 BUG #3（正则提取失败）导致**更严重的数据错乱**。具体取决于你**在哪里编辑了元数据**：

---

### 情况1：通过UI选择器修改（Status/Priority/Mainline/Type的图标按钮）

**✅ 不会被丢弃，能正确保存。**

因为 `syncPanelToNode()` 在每次点击选择器时都会被调用，直接将选择器的值写入 node 对象字段：

```javascript
// syncPanelToNode() 中（L1810-1850）
node.title = document.getElementById('titleInput').value;
node.module = document.getElementById('moduleInput').value;
// ... 选择器的值直接赋给 node.status, node.priority 等
var ts = document.querySelector('#typeSelect .type-icon-item.selected');
if (ts && ts.getAttribute('data-value') !== node.type) node.type = ts.getAttribute('data-value');
```

点击保存时，`exportMD()` 从 `node.status`、`node.priority` 等字段读取，输出正确的元数据。

---

### 情况2：直接在 nodeTextarea（节点元数据文本框）中修改

**❌ 不会丢弃，但会错乱。** 这是 BUG #3 的核心影响。

追踪完整流程：

**第一步：你在 nodeTextarea 中输入时**

`input` 事件触发 `syncPanelToNode()`，执行以下逻辑（[index.html:1824](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L1824)）：

```javascript
var metaVal = document.getElementById('nodeTextarea').value;
var generatedMeta = generateMetadata(node);
if (metaVal !== generatedMeta) {
  // 你编辑了文本框 → 尝试提取 request
  var codeBlockMatch = metaVal.match(/^```[\s\S]*?^```/m);  // ← BUG #3: 永远匹配失败
  if (codeBlockMatch) {
    // 匹配成功 → 正确提取 request（但永远不会走到这里）
  } else {
    node.request = metaVal;  // ← 整个文本框内容被当作 request！
  }
}
// 然后 UI 选择器的值覆盖 node 字段
```

**关键**：正则 `^```[\s\S]*?^```` 要求文本以 ` ``` ` 开头，但 `generateMetadata()` 生成的格式是：

```
标题文本          ← 不是 ``` 开头！

```
requirementUUID::xxx
...
```

正文内容
```

所以正则**永远匹配失败**，`node.request` 被设为**整个文本框内容**（包含标题+代码块+正文）。

**第二步：你点击保存按钮**

`saveFile()` → `exportMD()` 输出时（[index.html:2334](file:///Users/ed/Documents/edwin/Paucode/VibeCodingSOP/index.html#L2334)）：

```javascript
function writeNode(node, level) {
  lines.push(node.title || '');           // ① 输出标题
  lines.push('```');                      // ② 输出代码块开始
  lines.push(typeLabel + 'UUID::' + ...); //    从 node.status 等字段读取
  lines.push(typeLabel + 'Status::' + ...);
  // ...
  lines.push('```');                      // ③ 输出代码块结束
  var reqText = node.request;             // ④ 输出 node.request
  if (reqText) {
    lines.push(reqText);                  // ← 此时 request = 整个旧文本框内容！
  }
}
```

**最终MD文件输出**：

```markdown
标题文本                    ← ① 从 node.title 生成（正确）

```                         ← ② 从 node 字段重新生成（可能是旧值）
requirementUUID::xxx
requirementID::n1
requirementStatus::new      ← 从 UI 选择器的值，不是你在文本框中改的值
...
```                         ← ③ 代码块结束

标题文本                    ← ④ node.request 中的内容（重复！）

```                         ← ④ node.request 中的旧代码块（重复！）
requirementUUID::xxx
requirementStatus::ongoing  ← 你在文本框中改的值，被当作"正文"保留
...
```

你修改的正文内容           ← ④ node.request 中的正文
```

---

### 总结对比

| 编辑方式 | 不暂存直接保存的结果 |
|---------|-------------------|
| UI选择器改Status/Priority等 | ✅ 正确保存 |
| 文本框改元数据字段（如Status） | ❌ 文本框中的修改被UI选择器的旧值覆盖，但旧值作为"正文"残留在文件中 |
| 文本框改正文内容（request） | ❌ 正文被标题+代码块+正文的混合内容污染，文件出现重复元数据 |
| 文本框改标题 | ❌ 同上，触发文本框≠生成文本的比较，导致request被污染 |

**所以问题的本质不是"丢弃"，而是"错位"**：你在文本框中修改的元数据字段值，没有被正确提取回 node 对象，而是被当作正文（request）的一部分保留，同时 `exportMD()` 又从 node 对象的旧字段值重新生成了代码块，导致MD文件中同时出现**两套元数据**——一套是旧的（从字段生成），一套是你修改的（被当作正文残留）。

这就是你在 `Paulo(1).md` 和 `test washed away and covered.md` 中看到的 `paulo(1)ID::n1` 残留的根本原因。

---

## 八、第二轮修复实施记录（2026-06-16）

### 8.1 实施概览

基于全面审查，发现并修复了以下问题：

| 编号 | 问题 | 优先级 | 状态 |
|------|------|--------|------|
| D | `updateNodeJournal()` 逻辑顺序错误，journal引用被覆盖 | P0 | ✅ 已修复 |
| A | `tempSaveNodeInfoPanelBtn` 暂存时未同步元数据字段 | P0 | ✅ 已修复 |
| B | `mdNodeTextarea` 编辑后未同步到 node 对象 | P0 | ✅ 已修复 |
| C | `nodeInfoTextarea` 编辑后未同步到 node 对象 | P0 | ✅ 已修复 |
| G | `syncPanelFromNode` 暂存恢复时缺代码块字段解析 | P0 | ✅ 已修复 |
| E | `extractCodeBlockFromNodeInfo` 多代码块边界处理 | P1 | ✅ 已修复 |
| F | `tempSaveNodeInfoBtn` 暂存后未同步其他编辑框 | P2 | ✅ 已修复 |
| H | 代码重复：提取公共函数 `syncCodeBlockFieldsToNode` | P3 | ✅ 已完成 |
| 新#1 | 三编辑框双向同步 | P1 | ✅ 已修复 |
| 新#2 | Builder 操作后提示用户保存 | P1 | ✅ 已修复 |
| 新#3 | `parseMD()` fallbackMatch 类型推断 | P2 | ⏭ 评估后不需要修改 |
| 新#4 | 默认模板格式统一 | P2 | ⏭ 评估后不需要修改 |
| 新#5 | `applyAllTempSaves` nodeInfo 一致性 | P3 | ⏭ 评估后不需要修改 |
| 遗漏 | modal弹窗暂存按钮缺少字段同步 | P0 | ✅ 已修复 |

### 8.2 核心修改详情

#### 8.2.1 新增公共函数 `syncCodeBlockFieldsToNode(node, text)`

**位置**：index.html L820

**功能**：统一处理"从文本解析代码块字段到 node 对象"的逻辑，替代之前散落在 9 处的重复代码。

```javascript
function syncCodeBlockFieldsToNode(node, text) {
  var reqPart = extractRequestFromNodeInfo(text);
  node.request = reqPart;
  var codeBlock = extractCodeBlockFromNodeInfo(text);
  if (codeBlock) {
    // 解析 Status/Priority/Mainline/Module/UUID/AITaskJournal 等字段
    // 同步到 node 对象的结构化字段
  }
  node.nodeInfo = text;
}
```

**调用点**（9处）：
1. `syncPanelFromNode()` — 暂存恢复时
2. `syncPanelToNode()` — UI同步时
3. `updateNodeJournal()` — journal更新时
4. `mdNodeTextarea.input` — MD面板编辑时
5. `tempSaveNodeInfoPanelBtn.click` — 节点信息面板暂存时
6. `nodeInfoTextarea.input` — 节点信息面板编辑时
7. `tempSaveNodeInfoBtn.click` — 右侧信息栏暂存时
8. `applyAllTempSaves()` — 保存前应用所有暂存时
9. modal弹窗暂存按钮 — 弹窗暂存时

#### 8.2.2 `updateNodeJournal()` 逻辑顺序修正

**修复前**：先追加 journal 引用到 `node.request`，再从 textarea 提取 request（覆盖已追加的引用）

**修复后**：先从 textarea 同步 UI 到 node 对象（Step 1），再追加 journal 引用（Step 2-4），最后重新生成 nodeInfo（Step 5）

#### 8.2.3 `extractRequestFromNodeInfo` / `extractCodeBlockFromNodeInfo` 改用逐行匹配

**修复前**：使用 `text.indexOf('\n```', firstIdx + 3)` 查找代码块结束标记，可能匹配到正文中的代码块

**修复后**：逐行扫描，匹配 `lines[i].trim() === '```'` 作为代码块结束标记，确保只匹配独立一行的 ` ``` `

#### 8.2.4 三编辑框双向同步

**修复前**：
- `nodeTextarea`（右侧信息栏）有 input → syncPanelToNode 同步
- `nodeInfoTextarea`（节点信息面板）input 事件为空
- `mdNodeTextarea`（MD面板）input 只更新预览

**修复后**：
- 三个编辑框的 input 事件都会同步到 node 对象和其他编辑框
- `syncPanelFromNode()` 也会同步到三个编辑框
- 程序化设置 `.value` 不会触发 input 事件，无循环风险

#### 8.2.5 Builder 操作后提示保存

**修复前**：toast 消息只显示 "Journal 已更新：xxx"

**修复后**：toast 消息显示 "Journal 已更新：xxx，请点击保存按钮以持久化变更"

### 8.3 未修改项说明

| 编号 | 原因 |
|------|------|
| 新#3 | `parseMD()` 的 fallback 逻辑只处理非标准前缀（如 `paulo(1)Status::new`），标准前缀已被 metaMatch 处理，不会走到 fallback 分支，不存在类型推断问题 |
| 新#4 | `exportMD()` 和 `generateMetadata()` 的默认模板实际输出格式一致，差异仅在于实现方式（数组join vs 字符串拼接） |
| 新#5 | `syncCodeBlockFieldsToNode` 保持 `nodeInfo = text`（尊重用户编辑），只要解析逻辑正确，结构化字段与文本应一致 |