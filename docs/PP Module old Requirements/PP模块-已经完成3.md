以下是 6 个 Phase 的详细实施计划，每个 Phase 都包含具体的文件清单、API 设计、UI 结构、数据结构和验收标准。

---

## Phase 1：基础框架 + 通信机制 + 后端 API

### 目标
搭建 Optimization 和 HistoryLog 两个独立页面的空壳，建立 iframe ↔ 父页面通信协议，完成后端基础 API。

### 具体事项

**A. 新建文件**
1. `prompt-optimization.html` — Optimization 页面空壳
   - 基础 HTML 结构：`<!DOCTYPE html>` + `<head>`（引入样式）+ `<body>`（4 个区域占位 div）
   - 引入 `styles/prompt-optimization.css`
   - 内联 JS：监听 `message` 事件接收父页面数据
2. `styles/prompt-optimization.css` — Optimization 页面基础样式
   - 页面布局：100% 宽度，暗色主题（与项目整体风格一致）
   - 区域标题栏样式
   - 底部固定栏样式
3. `prompt-historylog.html` — HistoryLog 页面空壳
   - 基础 HTML 结构：搜索栏占位 + 结果列表占位 + 分页占位
   - 引入 `styles/prompt-historylog.css`
4. `styles/prompt-historylog.css` — HistoryLog 页面基础样式

**B. 修改 index.html**
1. Prompt 面板 Tab 重构：
   - Tab 1 "Optimization"：iframe 嵌入 `prompt-optimization.html?`
   - Tab 2 "HistoryLog"：iframe 嵌入 `prompt-historylog.html`
   - Tab 3 "Library"：保持现有 iframe 嵌入 `prompt-library.html`
2. Tab 切换逻辑：点击 Tab 时，如果是 Optimization Tab，且没有选中节点，Toast 提示"必须选择节点才能实施优化"，阻止 iframe 加载
3. 选中节点数据发送：Optimization iframe 加载完成后（或 Tab 激活时），通过 `postMessage` 发送选中节点数据
   - 数据字段：`id`, `uuid`, `text`, `meta`, `children`（完整子树）
4. 接收 iframe 消息：监听 `message` 事件，处理 `UPDATE_JOURNAL` 类型消息
   - 更新每个被选中节点的 Journal 字段
   - 更新节点元数据中的 `AITaskJournal`

**C. 修改 server.js**
1. 新增 `GET /api/files/tree` API：
   - 参数：`?path=`（相对路径，默认空）
   - 读取指定目录，递归遍历子目录
   - 应用 `promptTemplateConfig.json` 中的 `excluded_patterns` 过滤
   - 返回 JSON：`[{name, type:'file'|'dir', children:[...]}, ...]`
2. 新增 `POST /api/prompt/historylog` API：
   - Body：`{fileName, content, type:'md'|'json'}`
   - 保存到 `./prompt/.historylog/` 目录（目录不存在则自动创建）
   - 返回：`{success, file}`
3. 新增 `GET /api/prompt/historylog` API：
   - 参数：`?page=1&limit=30`
   - 读取 `./prompt/.historylog/` 目录
   - 按文件名中的时间戳排序（新的在前）
   - 返回：`{files:[{name, time}], total, page, totalPages}`
4. 新增 `GET /api/prompt/historylog/:file` API：
   - 读取单个 history log 文件内容
   - 返回：`{content}`

**D. 修改节点元数据模板（index.html）**
1. 在 `generateMetadata` 函数中，frontmatter 最后添加 `AITaskJournal` 字段（初始为空）
2. 在节点基础信息栏（`updateBasicInfo` 相关区域），最后添加 "Journal" 行：
   - 标签："Journal"
   - 控件：只读文本框，显示该节点的 Journal 内容（`[[xxx.md]]` 格式）
3. 添加 `updateNodeJournal(nodeId, fileName)` 函数：
   - 在节点基础信息栏的 Journal 文本框追加 `[[fileName]]`（逗号分隔）
   - 在节点元数据 frontmatter 中更新 `AITaskJournal::[[fileName]]`（逗号分隔）
   - 在节点元数据正文最后追加一行 `[[fileName]]`

### 验收标准
- [ ] 打开 Prompt 面板，3 个 Tab 都能正常切换
- [ ] 未选中节点时点击 Optimization Tab，显示 Toast 提示
- [ ] 选中节点后点击 Optimization Tab，iframe 能接收到完整的节点数据（通过 console.log 验证）
- [ ] `/api/files/tree` 返回正确的文件树（排除规则生效）
- [ ] `/api/prompt/historylog` POST 能创建文件，GET 能列表分页
- [ ] 节点元数据模板中已包含 `AITaskJournal` 字段
- [ ] 节点基础信息栏已显示 Journal 行

---

## Phase 2：元数据整合区

### 目标
实现元数据整合区的完整功能，包括节点排序算法、祖宗/子孙节点选择、整合内容生成和导出。

### 具体事项

**A. 数据结构**
```javascript
// 从父页面接收的数据
selectedNodes = [
  {
    id: 'n4',
    uuid: 'xxx',
    text: '节点4',
    meta: '完整的节点元数据文本',
    children: [...]  // 完整子树
  }
]

// 计算后的排序信息
nodeOrderMap = {
  'n1': {preorderIndex: 0, level: 0, levelOrder: 0},
  'n2': {preorderIndex: 1, level: 1, levelOrder: 0},
  'n4': {preorderIndex: 2, level: 2, levelOrder: 0},
  ...
}
```

**B. 算法实现**
1. `computePreorderIndex(tree)` — DFS 先序遍历，给每个节点分配 `preorderIndex`
2. `getAncestors(tree, nodeId)` — 获取从根到该节点父节点的路径
3. `getDescendants(node)` — 获取该节点的所有子孙节点（DFS）
4. `getNodePromptContent(metaText)` — 提取"提示词内容"：
   - 按 `` ``` `` 分割文本
   - 去掉 frontmatter 块（第 1 个 `` ``` `` 到第 2 个 `` ``` `` 之间）
   - 去掉空行
   - 返回剩余内容
5. `generateIntegrationContent(selectedNodes, checkedMap)` — 生成元数据整合内容：
   - 遍历所有相关节点，按 `preorderIndex` 排序
   - 只保留 `checkedMap` 中被勾选的节点
   - 每个节点内容前添加 `# 节点标题\n`
   - 拼接为完整文本，前缀为 `# Core Task Instructions\n`

**C. UI 实现**
1. 标题栏："元数据整合" + 导出按钮（icon-table-export.png）
2. 每个选中节点的可折叠卡片（默认只展开第一个）：
   - 卡片标题：节点标题 + 折叠/展开图标
   - 文本区：显示该节点的"提示词内容"（只读）
   - "祖宗节点元数据集"：
     - 显示祖宗节点列表（按从根到父的顺序）
     - 每个节点前有复选框，默认只勾选最后一个（直接父节点）
   - "子孙节点元数据集"：
     - 按分支分组（每个子节点为一个分支，递归到叶节点）
     - 显示子孙节点列表
     - 每个节点前有复选框，默认全选
3. 底部预览区：实时显示当前的"元数据整合内容"（随着勾选变化实时更新）

**D. 导出功能**
1. 点击导出按钮，生成 md 文件
2. 文件名：`元数据整合内容-YYYYMMDDHHmmss.md`
3. 下载到本地

### 验收标准
- [ ] 选中多个节点后，Optimization 页面正确显示每个节点的卡片
- [ ] 祖宗节点列表正确（从根到父）
- [ ] 子孙节点按分支正确分组
- [ ] 默认勾选状态正确（父节点勾选，子孙全选）
- [ ] 勾选/取消勾选实时更新整合内容预览
- [ ] 导出文件内容正确，命名正确
- [ ] 卡片可折叠/展开，默认只展开第一个

---

## Phase 3：工作目录配置区

### 目标
实现工作目录配置区的完整功能，包括文件树展示、排除规则、快捷选项和导出。

### 具体事项

**A. UI 结构**
1. 标题栏："工作目录（可读写）配置"
   - 右侧："配置"按钮（显示配置文件路径文本）+ "导出"按钮（icon-table-export.png）
2. 文件树区域：
   - 递归展示文件和文件夹
   - 文件夹前有展开/折叠图标
   - 每个文件/文件夹前有复选框
   - 文件夹复选框：勾选=选中该文件夹内所有文件
   - 默认所有文件夹折叠且不勾选，文件不勾选
3. 快捷选项区域：
   - "全选"按钮
   - "全不选"按钮
   - "AI智选"复选框

**B. 交互逻辑**
1. 文件夹勾选：
   - 勾选文件夹 → 该文件夹内所有子孙文件自动勾选
   - 取消勾选文件夹 → 该文件夹内所有子孙文件自动取消勾选
2. 文件勾选：
   - 单独勾选/取消勾选文件
3. 快捷选项：
   - "全选"：所有文件和文件夹勾选
   - "全不选"：所有文件和文件夹取消勾选
   - "AI智选"：读取 `promptTemplateConfig.json` 中的 `AIAutomaticallySelectsFiles`，只勾选这些文件，其他全部取消勾选

**C. 整合内容生成**
1. 收集所有勾选的文件路径
2. 如果勾选了 AI智选，追加额外文本到工作目录整合内容
3. 前缀：`# Workspace & File Access Rules\n## Read & Write Files Included\n`
4. 每个文件路径一行：`- path/to/file`

**D. 导出功能**
1. 文件名：`工作目录整合内容-YYYYMMDDHHmmss.md`

### 验收标准
- [ ] 文件树正确展示（排除规则生效，node_modules 等被排除）
- [ ] 文件夹可展开/折叠
- [ ] 勾选文件夹自动勾选/取消所有子孙文件
- [ ] 全选/全不选/AI智选功能正常
- [ ] 导出文件内容正确

---

## Phase 4：模板配置区

### 目标
实现模板配置区的完整功能，包括模板列表、上移/下移排序、下拉联动和导出。

### 具体事项

**A. UI 结构**
1. 标题栏："模板配置" + 导出按钮
2. 模板配置选择区（列表）：
   - 表头：模板名称 | 模板类型 | 模板标签 | 模板作用域 | 模板ID | 模板版本号
   - 每行最后有"上移"和"下移"按钮（替代拖动手柄）
   - 每行可删除（删除按钮）
3. 常用模板配置区：
   - 横向排列的复选框（收藏模板名称）
   - 超出宽度可左右滚动
4. 通用模板配置区：
   - 第一行："模板类型"下拉菜单（单选，可选空）
   - 第二行："模板名称-Type"下拉菜单（单选，联动）
   - 第三行："模板标签"下拉菜单（单选，可选空）
   - 第四行："模板名称-Tags"下拉菜单（单选，联动）
   - 第五行："添加"按钮（icon-list-add.png）

**B. 交互逻辑**
1. 列表排序：
   - 上移按钮：与该行的上一行交换位置
   - 下移按钮：与该行的下一行交换位置
   - 删除按钮：从列表中移除该行
2. 下拉联动：
   - 选择"模板类型"后，"模板名称-Type"下拉只显示该类型的模板
   - 选择"模板标签"后，"模板名称-Tags"下拉只显示含该标签的模板
3. 添加逻辑：
   - 点击"添加"按钮
   - 如果"模板名称-Type"有选中值，添加对应模板到列表
   - 如果"模板名称-Tags"有选中值，添加对应模板到列表
   - 如果两个都有选中值，同时添加两个（去重）

**C. 常用模板区交互**
1. 复选框勾选/取消勾选
2. 勾选的模板自动添加到列表顶部（或按顺序添加）
3. 取消勾选从列表中移除

**D. 整合内容生成**
1. 按列表顺序，读取每个模板的 MD 文件内容
2. 拼接为完整文本
3. 前缀：`# Common Implementation Specifications\n`

**E. 导出功能**
1. 文件名：`prompt-YYYYMMDDHHmmss.md`

### 验收标准
- [ ] 列表正确显示已添加的模板
- [ ] 上移/下移/删除功能正常
- [ ] 下拉联动正确（Type→Name, Tag→Name）
- [ ] 添加按钮正确添加模板到列表
- [ ] 常用模板勾选自动添加/移除
- [ ] 导出文件包含所有模板的完整内容

---

## Phase 5：底部按钮区 + Builder

### 目标
实现底部固定栏、Builder-md、Builder-json 和节点 Journal 更新。

### 具体事项

**A. UI 结构**
1. 底部固定栏（始终固定在页面底部）：
   - 左对齐统计信息：
     - `选中节点数：X`
     - `相关节点数：X`（勾选的祖宗 + 子孙节点总数）
     - `选中文件夹数：X`
     - `选中文件数：X`
     - `选中模板数：X`
   - 右对齐按钮：
     - "取消"按钮（关闭 Optimization Tab）
     - "Builder-md"按钮
     - "Builder-json"按钮

**B. 统计信息实时更新**
1. 监听所有勾选状态变化，实时更新统计数字

**C. Builder-md 实现**
1. 收集三部分内容：
   - 模板配置整合内容（Phase 4 生成）
   - 元数据整合内容（Phase 2 生成）
   - 工作目录整合内容（Phase 3 生成）
2. 按顺序拼接：
   ```
   # Common Implementation Specifications
   [模板内容]
   
   # Core Task Instructions
   [元数据内容]
   
   # Workspace & File Access Rules
   ## Read & Write Files Included
   [工作目录内容]
   ```
3. 生成文件名：`prompt-YYYYMMDDHHmmss-{uuid1-uuid2-...}.md`
   - uuid 为所有被选中节点的 UUID 后 8 位，按元数据整合算法顺序连接
4. 通过 `POST /api/prompt/historylog` 保存文件
5. 保存成功后，通过 `postMessage` 发送 `UPDATE_JOURNAL` 消息给父页面
   - 消息内容：`{type:'UPDATE_JOURNAL', fileName:'xxx.md', selectedNodeIds:['n4','n3']}`

**D. Builder-json 实现**
1. 同样的三部分内容
2. Markdown 转 JSON 层级：
   - `# 一级标题` → JSON 根节点
   - `## 二级标题` → 一级子对象
   - `### 三级标题` → 二级子对象
   - 标题下方正文 → 对应字段的 `content`
   - 四级及以下标题 → 合并到三级标题的 `content`
3. 生成文件名：`prompt-YYYYMMDDHHmmss-{uuid1-uuid2-...}.json`
4. 通过 `POST /api/prompt/historylog` 保存文件
5. 同样发送 `UPDATE_JOURNAL` 消息

**E. 父页面接收 UPDATE_JOURNAL**
1. 接收消息后，对每个 `selectedNodeIds` 中的节点：
   - 在基础信息栏 Journal 文本框追加 `[[fileName]]`（逗号分隔）
   - 在节点元数据 frontmatter 中更新 `AITaskJournal::[[fileName]]`（逗号分隔）
   - 在节点元数据正文最后追加一行 `[[fileName]]`

### 验收标准
- [ ] 底部栏始终固定，其他区域滚动时不动
- [ ] 统计信息实时更新正确
- [ ] Builder-md 生成正确文件，保存到 historylog 目录
- [ ] Builder-json 生成正确文件，Markdown 转 JSON 层级正确
- [ ] 父页面正确更新 Journal 字段（文本框、frontmatter、正文）
- [ ] 多次 Builder 后 Journal 正确追加（逗号分隔）

---

## Phase 6：HistoryLog 选项卡

### 目标
实现 HistoryLog 页面的搜索、列表展示和分页功能。

### 具体事项

**A. UI 结构**
1. 搜索栏（顶部，紧凑）：
   - 左对齐：下拉菜单（Type / Tags / UUID）+ 文本输入框
   - 右对齐："搜索"按钮
2. 搜索结果列表（左下，50% 宽度）：
   - 显示 history log 文件列表
   - 每行显示：文件名、时间
   - 按时间排序（新的在前）
   - 右侧滚动条
   - 底部：分页栏（每页 30 条）
3. 文件内容预览（右下，50% 宽度）：
   - 点击列表中的文件，右侧显示文件内容

**B. 交互逻辑**
1. 页面加载时，请求 `/api/prompt/historylog?page=1&limit=30`
2. 列表显示文件
3. 点击分页按钮加载更多
4. 搜索时，根据下拉选择的类型过滤：
   - Type：文件名中包含对应类型
   - Tags：文件名中包含对应标签
   - UUID：文件名中包含对应 UUID 后 8 位
   - （简单字符串匹配即可，因为文件名中已经包含了这些信息）

**C. API 对接**
1. `GET /api/prompt/historylog?page=X&limit=30`
2. `GET /api/prompt/historylog/:file`（查看内容）

### 验收标准
- [ ] 列表正确显示 history log 文件（时间倒序）
- [ ] 分页功能正常（每页 30 条）
- [ ] 搜索过滤正确
- [ ] 点击文件右侧显示内容
- [ ] 页面紧凑，行高最小化

---

## 新增/修改文件清单汇总

| Phase | 新建文件 | 修改文件 |
|-------|----------|----------|
| 1 | `prompt-optimization.html`, `styles/prompt-optimization.css`, `prompt-historylog.html`, `styles/prompt-historylog.css` | `index.html`, `server.js`, `styles/main.css` |
| 2 | — | `prompt-optimization.html`, `styles/prompt-optimization.css` |
| 3 | — | `prompt-optimization.html`, `styles/prompt-optimization.css`, `server.js` |
| 4 | — | `prompt-optimization.html`, `styles/prompt-optimization.css` |
| 5 | — | `prompt-optimization.html`, `styles/prompt-optimization.css`, `index.html` |
| 6 | — | `prompt-historylog.html`, `styles/prompt-historylog.css` |

---

## 关键风险与缓解

| 风险 | 缓解方案 |
|------|----------|
| 节点数据量大导致 iframe 加载慢 | 正常传递，不优化（用户确认） |
| 文件树递归遍历慢 | API 层面应用排除规则，用户可自行添加排除项 |
| Builder 文件名过长 | 用户确认无限制，直接实现 |
| iframe 中 postMessage 被拦截 | 验证 origin，添加错误处理 |
| 元数据 frontmatter 格式变化 | 提取逻辑基于 `` ``` `` 边界，格式无关 |

---

请确认以上计划后，我将从 **Phase 1** 开始实施。
用户要求我详细列出每个阶段要干的具体事项。我需要制定一个非常详细的计划，包括每个阶段的具体文件、API、UI组件、数据结构等。让我仔细整理。
用户确认了多项优化建议，并要求我：
1. 分阶段实施
2. 把每个阶段要干的具体事项详细列清楚
3. 等用户确认后再开始实现

我需要根据之前的评估，制定详细的阶段计划。

回顾之前的评估，我分了 6 个 Phase：
1. 基础框架
2. 元数据整合区
3. 工作目录配置区
4. 模板配置区
5. 底部按钮区
6. HistoryLog

现在我需要根据用户的确认，细化每个阶段的具体事项。

用户确认的修改：
1. 每个选中节点使用可折叠卡片式布局
2. 文件树递归遍历，API 返回时应用 excluded_patterns
3. 拖动手柄改为"上移/下移"按钮
4. 不考虑节点数据传递优化（正常传递完整节点数据）
5. 提示词内容提取逻辑正确

让我详细列出每个阶段的具体事项。

**Phase 1：基础框架与通信机制**

需要做的事情：
1. 创建 `prompt-optimization.html` 基础页面结构
2. 创建 `prompt-historylog.html` 基础页面结构
3. 修改 `index.html` 的 Prompt 面板 Tab 结构：
   - Tab 1: Optimization → iframe 嵌入 prompt-optimization.html
   - Tab 2: HistoryLog → iframe 嵌入 prompt-historylog.html
   - Tab 3: Library → 保持现有
4. 实现 iframe ↔ 父页面 postMessage 通信协议：
   - 父页面发送选中节点数据给 Optimization iframe
   - Optimization iframe 发送 Builder 结果给父页面更新 Journal
5. 新增后端 API：
   - `GET /api/files/tree` — 返回工作目录文件树
   - `POST /api/prompt/historylog` — 创建 history log
   - `GET /api/prompt/historylog` — 获取 history log 列表
6. 修改节点元数据模板：
   - 在 `generateMetadata` 中添加 `AITaskJournal` 字段
   - 在节点配置信息栏添加 "Journal" 行

**Phase 2：元数据整合区**

需要做的事情：
1. 实现"节点元数据整合算法"：
   - 计算每个节点的 DFS 先序遍历序号
   - 收集祖宗节点、选中节点、子孙节点
   - 去重并按先序序号排序
2. 实现元数据"提示词内容"提取函数：
   - 去掉 ``` 到 ``` 之间的 frontmatter
   - 去掉空行
   - 保留所有正文内容
3. 实现 UI：
   - 标题栏（"元数据整合" + 导出按钮）
   - 每个选中节点的可折叠卡片：
     - 节点元数据文本区（只读）
     - 祖宗节点元数据集（复选框，默认只勾选父节点）
     - 子孙节点元数据集（按分支分组，复选框，默认全选）
   - 实时生成的"元数据整合内容"预览区
4. 导出功能：
   - 下载 md 文件，命名：元数据整合内容 + 时间戳.md

**Phase 3：工作目录配置区**

需要做的事情：
1. 实现 `GET /api/files/tree` API：
   - 递归遍历工作目录
   - 应用 `excluded_patterns` 过滤
   - 返回文件树 JSON
2. 实现 UI：
   - 标题栏（"工作目录配置" + 配置按钮显示路径 + 导出按钮）
   - 文件树展示（文件夹可折叠，文件/文件夹前有复选框）
   - 快捷选项区：全选、全不选、AI智选
3. AI智选逻辑：
   - 读取 `promptTemplateConfig.json` 中的 `AIAutomaticallySelectsFiles`
   - 只勾选这些文件，其他全部取消
   - 勾选 AI智选时追加额外文本到整合内容
4. 导出功能：
   - 下载 md 文件，命名：工作目录整合内容 + 时间戳.md

**Phase 4：模板配置区**

需要做的事情：
1. 实现 UI：
   - 标题栏（"模板配置" + 导出按钮）
   - 模板配置选择区（列表，含上移/下移按钮）
   - 常用模板配置区（收藏模板复选框）
   - 通用模板配置区：
     - 模板类型下拉菜单（单选）
     - 模板名称-Type 下拉菜单（联动）
     - 模板标签下拉菜单（单选）
     - 模板名称-Tags 下拉菜单（联动）
     - 添加按钮
2. 下拉联动逻辑：
   - 选择类型后，名称下拉只显示该类型的模板
   - 选择标签后，名称下拉只显示含该标签的模板
3. 列表管理：
   - 上移/下移按钮调整顺序
   - 列表项可删除
4. 导出功能：
   - 下载 md 文件，命名：prompt + 时间戳.md

**Phase 5：底部按钮区 + Builder**

需要做的事情：
1. 实现底部固定栏 UI：
   - 左对齐：统计信息（选中节点数、相关节点数、选中文件夹数、选中文件数、选中模板数）
   - 右对齐：取消、Builder-md、Builder-json 按钮
2. 实现 Builder-md：
   - 整合三部分内容（模板配置 + 元数据整合 + 工作目录）
   - 生成 md 文件保存到 `./prompt/.historylog/`
   - 文件名：prompt-时间戳-uuid后8位连接.md
   - 通过 postMessage 通知父页面更新 Journal
3. 实现 Builder-json：
   - 同样的内容结构
   - 将 Markdown 转换为 JSON 层级结构
   - 保存到 `./prompt/.historylog/`
4. 父页面接收 postMessage：
   - 更新每个被选中节点的 Journal 字段
   - 更新节点元数据 frontmatter 中的 AITaskJournal
   - 更新节点元数据正文

**Phase 6：HistoryLog 选项卡**

需要做的事情：
1. 实现 `GET /api/prompt/historylog` API：
   - 读取 `./prompt/.historylog/` 目录
   - 按时间排序
   - 支持分页（每页 30 条）
2. 实现搜索栏：
   - 下拉选择搜索类型：Type、Tags、UUID
   - 搜索按钮
3. 实现搜索结果列表：
   - 显示文件名、时间
   - 右侧滚动条
   - 分页栏
4. 点击文件可查看内容

现在让我详细列出每个阶段的具体事项，包括文件修改、API 设计、UI 结构等。

我需要确保每个阶段的输出是可独立验收的。

让我组织这些内容。
1. 元数据整合区 UI 优化当前需求描述中，每个选中节点都有自己的 "祖宗节点集" 和 "子孙节点集"。如果选中节点较多（如 5~10 个），页面会很长。
建议： 每个选中节点使用可折叠的卡片式布局，默认只展开第一个节点，其他折叠。减少初始页面长度。

回答：同意。


2. 工作目录文件树性能如果项目根目录下文件很多（如 node_modules），递归遍历会很慢。
建议：
API 返回时已经应用 excluded_patterns 过滤，不返回被排除的目录内容
文件树默认只展开第一层，深层目录懒加载
或者在 API 层面就排除 node_modules、.git 等常见大目录

回答：node_modules、.git 等文件夹肯定是在excluded_patterns 过滤的。这个地方不要用懒加载，递归遍历就好，如果加载速度慢，我会把影响速度的文件夹手动添加到excluded_patterns中的。

3. 模板配置区拖动手柄HTML5 原生拖拽在 iframe 中表现可能不稳定。
建议： 使用简单的 "上移 / 下移" 按钮替代拖动手柄，实现更简单、更可靠。如果坚持拖拽，建议引入 SortableJS 库。

回答：同意，接受你的建议。

4. 节点数据传递大小如果选中的是根节点，其子孙节点可能非常多，postMessage 传递的数据量会很大。
建议：
只传递必要字段：id, uuid, text, meta, children（children 只传 id 列表，不传完整节点）
祖宗 / 子孙节点的完整数据在 iframe 内通过另一个 API 请求获取

回答：咱不用考虑该项，因为选择根节点的事情不会发生，是小概率事件，不用现在考虑。同时，删除了已经选择的节点，也不用考虑。这种情况也是小概率事件，不用这个节点就面面俱到。


5. 元数据 "提示词内容" 提取逻辑确认：
去掉 ``` 到 ``` 之间的 frontmatter 块
去掉剩余内容中的所有空行
保留 > request 等正文内容是否正确？

回答：正确。但是注意，节点元数据中不一定都是“> request ”的内容，有可能有其他内容，不管形式和内容变成什么样，都要全部提取。

新要求：
针对上述我给你的回复与确认。请你分阶段实施。但是要求你把每个阶段要干的具体事项，都给我详细的列清楚。等我确认后你再开始实现。

[[../.snapshots/snapshot-2026-05-31T12_39_39_459Z.md]]
