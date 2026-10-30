# Magical Cards changelog

## 1.2.0 — 2026-10-30

- 新建普通卡片模块默认选择通用类型，适用于游戏、音乐等收藏；也可选择书籍或影视，已有模块的类型保持不变。
- 通用卡片使用独立作品笔记，支持封面、摘要、评分、链接、可改名的创作者字段及时间线。微信读书继续导入书籍模块。
- 左侧栏入口更新为金色实体卡片图标。
- 修复倾斜轮播关闭三卡限制时第四张卡片隐藏的问题，并使四张卡片整体居中。
- 邻卡悬停提示改为“切换到”，说明点击后的操作。

## 1.1.1 — 2026-10-28

- 改进插件与 Obsidian 界面的兼容性，调整部分界面样式与文档，处理社区审核警告。
- 根目录说明增加英文安装及使用指引；保留现有许可、卡片、模块设置和数据。

## 1.1.0 — 2026-10-28

- 新增独立 3D 时间线，按收藏／记录日期或作品日期浏览阅读、影视、自定义卡片和图片橱窗；日期支持年、年月和年月日，时间线排序不改变模块顺序。
- 拖动时卡片跟随指针，松手和滚轮停止后平滑吸附；详情保留盒体材质并返回原位。搜索、日期设置及补充缺失日期收纳在展厅操作菜单中。
- 日期设置按模块记住上次选择，作品日期可自定义名称；修改和冲突保留草稿，失败项目可重试。
- 新增盒装封面、3D 斜列漫游布局与影像盒材质，按封面稳定混合透明光盘盒和哑黑 VHS 盒，也可按模块或单卡指定。
- 微信读书电子书导入时读取可用的出版时间；已有微信读书来源卡片可在时间线设置中补全，确认保存后写入笔记。详情不可用时仍可导入，并可手动补录。
- 卡片笔记预警集中显示可检查的问题与相关笔记，可逐项忽略；问题修复后自动消失，分类页和作品页继续不展示全局预警。

## 1.0.0 — 2026-10-23

- Dashboard 操作栏可搜索、多选并加入已有模块，或新建卡片模块后直接加入当前分类；保存失败保留草稿，分类冲突可重新载入。
- Dashboard 操作栏支持搜索、多选并移出当前分类的模块，保留模块、其他分类归属和卡片笔记；新建 Dashboard 与新建卡片模块使用不同图标。

- 将卡片模块管理和操作栏样式编辑移入主题自适应弹窗，固定右下角保存按钮；设置弹窗保留草稿，不挂载卡片预览。
- 将三种布局显示名称改为折页轮播、扇形卡架、纸片卷曲，保留配置 ID。胶片帘移至关于中的只读拓展预览，旧模块和嵌入使用圆柱弧面展示，原配置不自动改写。
- 关于提供可重复打开的版本分类更新日志，右下角勾选图标确认，无打赏入口。
- 新增 3D 转轮和纸片卷曲，优化转轮展示数量、杂志分片接缝与纹理加载；胶片帘保留为独立拓展预览。
- 提供杂志、金属、玻璃和玉石材质，改善磨砂与全息封面清晰度。
- Dashboard 分类支持自选图标，操作栏采用弹簧收展；桌面隐藏常驻翻页栏，手机与 iPad 保留。
- Magical Cards 分类页及模块作品页不再展示笔记库全局预警，保留具体操作失败及重试提示。
- 保留已有模块、卡片笔记、图片与草稿；旧胶片帘布局使用圆柱弧面展示，不自动改写配置。

## 0.9.1 — 2026-10-17

- Fix transparent module deletion confirmations in native Settings, including separate settings windows and conflicting legacy plugin styles.
- Give the dialog its own theme-aware background, centered layout, wrapping controls and bounded scrolling on narrow panels.
- Close the native modal before unmounting, restore its entry focus, and keep Escape from closing the Settings window.
- Update the version-specific release notice. No work-data or module-configuration migration.

修复删除模块时确认信息与背景重叠的问题，适配明暗主题及窄面板。

## 0.9.0 — 2026-10-17

- Import selected ebooks and audio albums from your current WeRead shelf in Settings. Save the API Key in Obsidian SecretStorage, search by title or author, select books and choose a valid book module. Nothing is selected automatically.
- Skip duplicate source books within the same module without changing existing notes. Other book modules can keep independent copies; failed imports remain selected for retry.
- Open a standalone module works Dashboard from the portal icon immediately before search. Browse statistics, a recent work, filters, temporary sorting and a compact cover grid; Return restores the source position.
- Choose Film or Book when creating an ordinary module. Existing module types remain unchanged.
- Show version-specific update notes in Settings while preserving the first-use starter guide.
- Maintain author source privately. Personal and business use remains free, including private backups and modifications; redistribution, rebranding and sale require written permission. Earlier MIT grants and third-party licenses remain in effect.

微信读书入口位于「设置 → Magical Cards → 微信读书」，默认收起。读取书架后勾选导入；未选择目标时使用内置阅读模块，目标已删除则需重新选择。当前只导入书目，不自动同步划线、想法或阅读时长。

Earlier public release notes remain available at:
https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases
