## 位置：第三个Tab选项卡，名称为“Library”，该选项卡下有所有的提示词模板文件，也是所有的提示词模板文件的管理中心。
该功能，是要在工具栏“Prompt”页面的第三个选项卡中开发的。不独立跳转。第三个Tab选项卡，名称为“Library”，该选项卡是所有的提示词模板文件的管理中心。

### 分组
按照PromptType分组。默认折叠。所有分组并列，每个分组有模板，每行3个模板文件。

promptType和promptTags的信息（为枚举配置，变更频率低），都在promptTemplateConfig.json中配置：
promptType选项:FormattedOutput、Requirement、FeatureDesign、Architecture、Development、Bugfix、Refactoring、CodeReview、Testing、Security、DevOps、Documentation、PromptStudio。
promptTags选项:常用、VC、WM、电商。

每个分组下有多个模板，每个模板包含：模板ID、模板名称、模板版本号、模板类型、模板标签、模板作用域、模板描述、模板支持模型、模板内容；“编辑”按钮（该按钮使用的是“./assets/icon-edit-node-info.png”图标，点击“编辑”按钮可以编辑“模板名称、模板版本号、模板类型、模板标签、模板作用域、模板描述、模板支持模型、模板排序、模板是否生效、模板是否收藏、模板作者”的信息）。排列紧凑。窄边距，每行排练3个模板。默认折叠所有分组。
所有模板的json数据， 属于业务数据（变更频率高），都在promptTemplateLibrary.json中维护。通过分组内的每个模板的“编辑”按钮进行promptTemplateLibrary.json配置与维护。

所有的模板文件，都只出现在一个唯一分组，也即每个模板的promptType是唯一的。但是一个模板可以有多个promptTags。

### 导入
导入的是PromptTemplate的json文件，该文件与PromptTemplate的md文件同名。
PromptTemplate的模板文件的json文件示例：
模板文件的json文件，要在promptTemplateLibrary.json注册的示例：
PromptTemplate的模板文件的md文件示例：

其中Tags、Type都是在配置文件中标记。配置文件最好用一套，否则散乱各处不好收集整理。

页面最上方有“打开”按钮，左对齐。使用的是项目根目录的“./assets/icon-open.png”作为图标，鼠标点击该按钮时，向下显示toast弹窗，内容为“打开”。点击“打开”按钮，点击后仅打开md格式文件。弹窗选择本地文件后，将会把md文件加载到“打开”按钮后面的文本区内，文件名显示在“打开”按钮后方的文本区。
同时，弹出“Prompt模板元数据”弹窗页面，包含以下字段：
- 模板ID:{{promptTemplateID}}   //promptTemplate的唯一标识，示例：p-121。该字段是不可编辑的，不能修改。如果ID变了，说明是新建模板，而不是更新原模板。序号是继续从promptTemplateLibrary.json注册的模板ID中累加的。
- 模板名称:{{promptTemplateTitle}}   //文本框
- 模板版本号:{{promptTemplateVersion}}   //版本号分成三组，每组一个文本框。示例：16.24.12，要分为三个文本框来输入，分别是Major（主版本）为16，Minor（次版本）为24，Patch（补丁）为12。
- 模板类型:{{promptTemplateType}}   //下拉菜单从“Type选项”中选择。单选。Type选项：FormattedOutput、Requirement、FeatureDesign、Architecture、Development、Bugifx、Refactoring、CodeReview、Testing、Security、DevOps、Documentation、PromptStudio
- 模板标签:{{promptTemplateTags}}   //下拉菜单从“Tags选项”中选择。多选。Tags选项：常用、VC、WM、电商。
- 模板作用域:{{promptTemplateScope}}   //下拉菜单从“Scope选项”中选择。Scrope选项:Global、Project、Task。
- 模板描述:{{promptTemplateDescription}}   //文本框。
- 模板支持模型:{{promptTemplateModel}} //文本框。可以多选，逗号分隔。
- 模板内容:{{promptTemplateContent}}   //文本框。是同级目录下的同名md文件的路径，使用相对路径。
- 模板排序:{{promptTemplateTypeOrder}}   //数字框。该模板在该分组下的排序。默认值为1，表示在该分组内的第一个模板。
- 模板是否生效:{{promptTemplateEnabled}}   //复选框。默认为true。
- 模板是否收藏:{{promptTemplateFavorite}}   //复选框。默认为false。
- 模板作者:{{promptTemplateAuthor}}   //文本框。
- 模板更新时间:{{promptTemplateUpdatedTime}}   //文本框。示例："2026-06-04 10:30:00"。默认为创建时间。如果对该模板的信息编辑过，更新时间会自动更新。如果未编辑过，更新时间与创建时间相同。

对于特殊情况的补充说明：
1. 模板描述:{{promptTemplateDescription}}   //文本框。模板文件的一句话描述，不是模板文件的全文内容。
2. 模板内容:{{promptTemplateContent}}   //文本框。指向的是该模板md文件的路径，使用相对路径。弹窗的 "模板内容" 字段是只读路径，用户不能编辑。用户只能查看。如果当前只是首次导入文件，还没有模板内容的信息，这个地方留空。如果是从模板的分组栏里面找到的这个模板，点击该模板的“编辑”按钮，可以加载该模板的json信息，在弹窗中可以编辑已经导入过的模板的json信息， "模板内容"中显示的是模板文件的路径，用户不能编辑，但是不为空。

弹出“Prompt模板元数据”弹窗页面有“取消”按钮和“保存并导入”按钮，点击“保存并导入”按钮，会把弹窗中已经修改的信息，按照“PromptTemplate的模板文件的json文件示例”的规则，在./prompt文件夹下的promptTemplateLibrary.json文件中注册该模板的json信息。同时把选中的md文件上传导入到./prompt/template文件夹下，重命名为：{{promptTemplateTitle}}-{{promptTemplateVersion}}-创建时间戳（年月日）.md。其中，该文件名，就是“模板内容:{{promptTemplateContent}}”中除了路径之外的文件名。注意不能出错漏，因为维护promptTemplateConfig.json、 promptTemplateLibrary.json是本次开任务的核心工作。
如果保存并导入成功，则toast弹窗反馈“PromptTemplate上传、保存、导入成功”，如果失败，反馈具体的错误信息。

自动刷新页面，显示最新的模板列表。

该功能上传md文件的实现与交互方式、可以参考工具栏“打开”文件的弹窗中的上传功能实现逻辑。比如导入md文件可以类比成打开文件弹窗中的上传功能，需要有进度条和类似的提示。
该功能的页面样式风格，保持与工具栏“打开”文件的弹窗中的样式保持一致。

重要提醒：当前生产环境在/tmp目录，重新部署时，请务把模板库和所有json都作为持久化数据，需要可靠存储。一方面要能访问的到，另一方面不能因为重新部署而丢失。请你针对这方面，提出有效的解决方案，并且实施好，解决好该问题。此外，目前该选项卡内没有删除模板的功能，如果确实要删除模板，是直接在配置文件与模板库中手动操作的。如果要在该选项卡页面新增或者设计删除模板的功能，需确保在删除之前，要把文件先备份到todo文件夹下的.bak文件夹下，打好时间戳，然后再实施删除动作。

重要提醒：该功能的实现，一定不能是在现有的index.html折腾了，而是一个新的，像Table视图一样，必须是一个全新的、独立的html。因为现有index.html页面，已经非常复杂了，耦合太严重，必须处理这种风险，否则以后重构的时候非常困难。针对本次开发新增的功能和改动的功能，需要同步更新AGENTS.md文件，以免以后每次提出需求之后都需要很长的思考时间，既消耗Token，又浪费时间。

1. 生产环境持久化方案
平台已提供 S3 SDK（coze-coding-dev-sdk），可直接接入。
回答：我对这种方案非常不满意。因为这会增加额外的维护成本。如果现阶段没有更好的方案，可以暂时忽略这个问题。因为我打算在工具栏的“Markdown预览”的“日志”页面，在“当前文件”这一行的下面，新增一行“Prompt模板库”，列出来当前“Prompt模板库”的文件夹路径，参考备份节点md文件定时备份的逻辑，把备份文件备份到todo文件夹下的.bak文件夹下，也打好时间戳。
这也就意味着，你提到的“Phase 3：编辑与 S3 持久化”这个阶段可以不要做了。而是探讨我上面的这个思路，找出解决方案。

2. md 文件命名规范
回答：接受你的建议，复盘项目-16.24.12-20250604.md（标题 - 版本 - 日期）

3. ./ 相对路径基于哪个目录	./prompt/template/
回答：这是项目根目录下的prompt文件夹下的template文件夹。
类似./assets/icon-open.png的路径，是基于项目根目录的。

4. 删除模板时是否同时删 md 文件？
回答：是。但是我强调过，目前该选项卡内没有删除模板的功能，如果确实要删除模板，是直接在配置文件与模板库中手动操作的。如果要在该选项卡页面新增或者设计删除模板的功能，需确保在删除之前，要把文件先备份到todo文件夹下的.bak文件夹下，打好时间戳，然后再实施删除动作。

5. 修改标题时是否提示重命名 md？
回答：是的。无需弹窗确认，直接重命名md文件即可。

先不用实现该功能，先评估该功能的完整性、可行性，以及异常情况。如果你发现了需求中的错误，请及时提出来。如果你有更好的建议，请及时提出来。请分析代码并及时补充。

---

Library

1、Bug: “模板标签”功能没有开发成功么？“Prompt模板元数据”页面的“模板标签”功能有问题，目前没有加载数据也不可以被编辑，也没有加载成功预设的“promptTemplateTags”标签。
具体的值，在promptTemplateConfig.json中配置中的这部分：
	"promptTemplateTags": [{
			"id": "常用",
			"order": 1,
            "promptTemplateTagName": "常用"
		},
		{
			"id": "VC",
			"order": 2,
            "promptTemplateTagName": "VC"
		},
		{
			"id": "WM",
			"order": 3,
            "promptTemplateTagName": "WM"
		},
		{
			"id": "电商",
			"order": 4,
            "promptTemplateTagName": "电商"
            
		}
	]

  此外，“编辑模板”页面的页面的“模板标签”功能有问题，目前没有加载数据也不可以被编辑，也没有加载成功预设的“promptTemplateTags”标签。模板的promptTemplateTags标签在promptTemplateLibrary.json中的这部分中：

  	"promptTemplateTags": [
			"常用",
			"VC"
		],

    最后，在Library选项卡页面的分组中，模板卡片的上包含必须包含该模板的“promptTemplateTags”字段。而不用放“promptTemplateType”字段。模板卡片的“promptTemplateType”字段的位置，应该放“promptTemplateTags”字段的信息。此外，优化一个功能。模板卡片的版本号的左边，新增“收藏模板”按钮，使用“”作为该按钮的图标，点击该按钮后，可以配置promptTemplateLibrary.json中该节点的“promptTemplateFavorite”字段。该字段表明“收藏模板”。

    ---

  2、“Prompt模板元数据”页面的“模板ID”、“模板名称”、“模板标签”、“模板作用域”、“模板内容”、“模板版本号”等的功能这些元数的名称的内容，全部左对齐。尽可能让每一行的间距都紧凑。

  ---

  3、“Prompt模板元数据”页面的“模板是否生效”和“模板是否收藏”都改为滑动开关的样式。其次“模板是否生效”、“模板是否收藏”、“模板排序”三行合并在一行内，尽可能紧凑。
  
  ---

  4、在Library选项卡页面的分组中，每一个分组的图标使用“”图标，位置在分组名称的左侧。把分组栏的“展开”与“折叠”按钮，放到改行的最后面，右对齐。此外，不要给“展开”与“折叠”按钮，增加旋转效果，只需要简单的把按钮图标摆正就好。

---

Bug与优化项:
1、Library选项卡页面的“Prompt模板元数据”弹窗和“编辑模板”弹窗中，模板标签这个输入下给你，这样的布局，最对这样只能展示4～5个选项，虽然这种方式确实可以支持“多选”。但是这种输入方式确实不行，需要寻找其他样式。
2、Library选项卡页面的“Prompt模板元数据”弹窗和“编辑模板”弹窗，“模板作者”这一行，放到“排序”后面，节省一行空间。此外，“模板ID”和“模板版本号”，合并放到同一行，节省一行空间。
4、Library选项卡页面点击“收藏”按钮，不要折叠分组。收藏成功之后，按钮变“红心”，如果没有图标，可以使用这个图标“”。
5、Library选项卡页面的“编辑模板”弹窗，不能再用“保存并导入”，因为没有导入的了，该按钮上的文字改为“保存”，表明已经把“编辑模板”弹窗中的信息，保存并更新到了promptTemplateLibrary.json配置文件中。
6、工具栏的“Prompt”页面的“X”关闭按钮，要缩小尺寸，尽可能缩小这一行的上下边距。
7、Library选项卡页面，在“打开”按钮这一行，记录当前分组数、模板数、多少模板在生效、收藏了多少模板。


优化：
1、Library选项卡页面点击“收藏”按钮，位置和“收藏”按钮/“取消收藏”按钮对换一下位置。

2、Library选项卡页面的“Prompt模板元数据”弹窗和“编辑模板”弹窗中，“模板ID / 版本号”这一行，分开放到两列。第一列是模板ID，占弹窗页面的30%宽度。第二列是模板版本号，占弹窗页面的70%宽度。另外，“生效”、“收藏”、“排序”、“作者”，这一行右对齐。改放到最后一行。

3、Library选项卡页面的，“打开”按钮这一行，右对齐的“分组 13 | 模板 3 | 生效 3 | 收藏 3”这些显示，最好能够有个边框背景，中间不要用“｜”来分隔。虽然有这样的改动，但是不能改变当前这一行的高度。维持当前紧凑的页面。

4、在工具栏中增加一个“搜索”按钮，使用“”作为图标，鼠标悬停在该按钮上显示向右Toast弹窗“搜索”。位置在工具栏“打开”按钮的下面。点击该按钮后，可以打开“搜索”弹窗。搜索弹窗的第一行有搜索栏，可以选择搜索内容，搜索项可以是UUID（后8位）、Mainline、Status、Priority、Title（包含），搜索项目的样式，可以通过下拉菜单选出“UUID（后8位、Mainline、Status、Priority、Title（包含））”其中之一，然后在该行后面的文本框中输入内容。比如，选中“UUID后8位”下拉菜单，在该行的文本区，输入了节点的“UUID后8位”的内容，那么搜索结果就是该UUID后8位所对应的节点。在搜索结果页面里面，选中该节点。
该节点在思维导图页面中，该节点高亮且闪烁，思维导图页面的布局是选中该节点后的“重新布局”的展示布局。
其次，搜索结果页面的样式，可以参考工具栏的“Todolist”页面的样式，排序结果按照搜索结果的优先级排序，从高到低排序，其中5级是最高级。如果搜索不到匹配的结果，那么就在该页面中显示“没有搜索到匹配结果。”
最后，在右侧“元数据基础信息”这行，增加“复制UUID后8位”按钮，使用根目录下的“./assets//icon-copy-metadata.png”作为图标。位置在该行的“折叠基础信息”按钮的左侧，样式与右侧的其他按钮一致。点击“复制UUID后8位”按钮，可以复制该节点的UUID的后8位到剪贴板中。鼠标悬停在“复制UUID后8位”按钮上，可以向下显示Toast弹窗“复制UUID后8位”。

先不用实现该功能，先评估上述4个功能的完整性、可行性，以及异常情况。如果你发现了需求中的错误，请及时提出来。如果你有更好的建议，请及时提出来。请分析代码并及时补充。

