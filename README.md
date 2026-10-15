# Magical Cards

Magical Cards is a desktop Obsidian plugin for book, film, and image showcase cards, with draggable modules and note embeds. It works offline with six editable starter examples. The interface is currently in Chinese; see the [full English guide](README_en.md).

[简体中文说明](#中文说明) · [Full English guide](README_en.md)

## Overview

Choose five layouts, organize modules into Dashboards, and edit summaries on the back of a card. Removing a module from a Dashboard changes that category only. Deleting a module preserves its notes and images. Works remain local Markdown notes; appearance and ordering are stored in the selected card directory. Remote covers load only from their image servers. The linked-note picker searches vault paths when invoked. Copy writes generated embed code only after a click, and pasting reads plain text from that paste event; the plugin does not monitor the clipboard or upload note contents.

## Usage

The Chinese instructions below cover all settings, screenshots and the author's development notes. The [full English guide](README_en.md) includes the same operations and the original interface labels. Desktop macOS has been tested; Windows has not been tested on physical hardware.

## 中文说明

<p align="center">把阅读、观影与图片收藏，变成可以浏览、编辑、嵌入笔记的卡片。</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/AbigBlackCat/Obsidian-Magical_Cards?style=flat-square"></a>
  <a href="LICENSE"><img alt="Code license: MIT" src="https://img.shields.io/badge/code-MIT-blue?style=flat-square"></a>
</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest">下载插件</a> ·
  <a href="#开始使用">使用说明</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases">更新日志</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/issues">反馈问题</a>
</p>

<p align="center"><strong>阅读影视推荐卡片风格:</strong></p>

<p align="center">
 <img width="600" height="480" alt="阅读影视演示3秒" src="https://github.com/user-attachments/assets/cd1d7a3a-fed2-4612-ac7c-b4785c300218" />
</p>

<p align="center"><strong>番剧游戏dashboard演示</strong></p>

<p align="center">
<img width="600" height="480" alt="番剧游戏" src="https://github.com/user-attachments/assets/676f7587-8d7d-4153-8ef1-5e786c76e47c" />
</p>

<p align="center"><strong>橱窗展示功能：明星小卡演示</strong></p>

<p align="center">
<img width="600" height="480" alt="8小" src="https://github.com/user-attachments/assets/981b0095-e2e8-470d-98eb-caafe2137bfa" />
</p>

| 番剧游戏演示 | 明星小卡演示 |
| --- | --- |
| ![原生笔记中的封面流轮播](<img width="600" height="480" alt="番剧游戏" src="https://github.com/user-attachments/assets/676f7587-8d7d-4153-8ef1-5e786c76e47c" />) | ![原生笔记中的黑胶专辑架，仅展示封套](<img width="600" height="480" alt="8小" src="https://github.com/user-attachments/assets/981b0095-e2e8-470d-98eb-caafe2137bfa" />) |



**已上传Obsidian社区，我会不定时维护和更新，欢迎体验插件，希望你喜欢～**
https://community.obsidian.md/plugins/magical-cards


**插件的开发思路** 

我开发了一个工作台，改造到obsidian后发现，这个卡片轮播的视觉效果出奇的好，大大提高了我的记录动力，不得不说颜值是第一生产力。
以前经常想要写读书笔记、观影笔记，最后总因为笔记长期维护难度大，反馈小而拖延放弃，而这个卡片轮播像集卡收藏一样，
书籍影视就这么美丽地展现到我面前，我一回忆起曾经阅读或者观看的画面就忍不住点击进入笔记写上一两句作为记录。

进一步思考，我想到这个卡片轮播也可以单纯的只展示不记录，于是新增了橱窗功能，大家喜欢的照片、角色、明星等可以通过用橱窗功能，呈现在Magical Cards窗口以及你的任意笔记里。

这个插件是从我的Obsidian工作台里独立出来的，等我的工作台开发完善了我会带它和大家见面。关于这个插件，如果你有任何建议和反馈，欢迎给我提issue,或者作为contributor参与进一步开发我的插件，你也可以fork我的插件去自定义你的功能。

传送门:https://github.com/AbigBlackCat/Obsidian-Magical_Cards/ 

## 目录

- [开始使用](#开始使用)
- [功能](#功能)
- [外观与设置](#外观与设置)
- [嵌入笔记](#嵌入笔记)
- [常见问题与数据](#常见问题与数据)
- [开发与版权](#开发与版权)

## 开始使用

首次在空目录启用，插件会在 `卡片库` 中创建说明页、3 本书与 3 部影视，并自动打开说明页。六张封面随插件打包，断网也能查看；示例作品可以编辑或删除。

起步外观为 **圆柱弧面、整幅封面、填满裁切、纸感、2:3、同屏最多三张卡片**。滑动或使用方向键，仍可浏览全部六张作品。

1. **打开卡片**：点击侧栏卡片图标，或执行「Magical Cards: 打开卡片视图」。
2. **添加作品**：点击模块右上角的 `+`，填写标题、封面及作品信息。
3. **记录感想**：翻到卡片背面编辑摘要，或打开关联的作品笔记。

再次查看说明，执行「查看示例及用法说明」。初始化中途失败也可通过此命令重试。已有卡片库不会重复导入示例，也不会修改原外观；删除示例后重启不会补回。

## 功能

| 功能 | 操作 |
| --- | --- |
| 浏览与搜索 | 滑动、滚轮或方向键切换卡片；点击放大镜搜索作品。 |
| 管理作品 | 添加、编辑封面和信息、关联笔记、删除作品、调整排序。 |
| 翻面摘要 | 翻到背面记录感想；布局切换保留当前卡和摘要草稿。 |
| 图片橱窗 | 每个模块共用一篇笔记，批量导入图片、可选名称及翻面描述。 |
| Dashboard 分类 | 在顶部切换同等分类、拖动分类标签；在设置选择已有模块，各分类独立排序。 |
| 模块排序 | 拖动标题前的手柄；键盘聚焦手柄后按 Alt / Option + ↑ / ↓。 |
| 笔记嵌入 | 阅读模式和实时预览均可展示集合，同一集合可以重复引用。 |

### Dashboard 分类

Dashboard 用来分类卡片模块，每个分类同等，可以放入任意数量的模块。同一模块可主动加入多个分类，笔记和图片仍共用一份。标签页没有固定“全部”页；未分类模块保留在设置中，仍可嵌入笔记。

打开标签页的横向操作菜单，可以新建、重命名或删除 Dashboard。删除分类只删除分类引用，保留模块和资料。拖动顶部标签，或聚焦后按 Alt / Option + ←、→，可以调整分类顺序；每个 Dashboard 内的模块顺序独立保存。

模块归属统一在**插件设置**中管理：

- **放入 Dashboard**：展开模块，选择已有分类，也可新建分类并随模块一起保存。新建模块不选择分类时，先留在设置中。
- **移出 Dashboard**：所属分类右侧的退出箭头只移出该分类，其他分类和笔记嵌入继续显示。
- **删除模块**：展开标题右侧的垃圾桶删除模块配置、全部分类引用及模块位置。作品笔记、橱窗笔记、图片和作品 ID 保留；原嵌入会提示模块已删除，没有模块恢复入口。
- **删除当前卡片／图片**：在模块横向菜单中操作，仅针对当前单张卡片。删除前确认窗口会明确显示名称。

新用户首次安装会得到可改名、可删除的普通“示例” Dashboard，包含阅读和影视。

### 五种动效布局

| 封面流轮播 | 黑胶专辑架 |
| --- | --- |
| ![原生笔记中的封面流轮播](previews/coverflow-carousel.png) | ![原生笔记中的黑胶专辑架，仅展示封套](previews/album-rail.png) |
| 横向滚动弯曲画廊 | 倾斜轮播 |
| ![原生笔记中的横向滚动弯曲画廊](previews/scroll-bend.png) | ![原生笔记中的倾斜轮播](previews/skewed-carousel.png) |


## 外观与设置

设置依次为：**卡片目录 → 示例 → 添加卡片模块 → 添加图片橱窗 → 已有模块 → 笔记代码块生成**。

按用途展开“添加卡片模块”或“添加图片橱窗”，填写**模块名称**、选择**比例**，可选一个或多个 Dashboard，也可新建分类并放入，然后点击**保存并收起**。不选择分类也能保存。两个入口的类型固定、草稿独立；高级样式仅选择整幅封面或简约，不转换存储类型。保存后点击左侧紫色叠卡图标，在 **Magical Cards** 标签页体验。设置中的预览仅能浏览和滑动，不会翻面或打开描述编辑。


“高级设置”依次包含：**卡片样式 → 显示方式 → 卡片材质 → 动效布局 → 仅显示三张卡片**。弯曲画廊才显示方向。新模块预设为 **整幅封面、填满裁切、纸感、2:3、倾斜轮播、关闭仅三张**；阅读／影视示例和已有模块保留原外观。三卡选项分别作用于各模块，仍可浏览全部图片。


### 普通卡片批量导入与资料

阅读、影视和自定义普通模块的菜单提供 **批量导入图片／SVG**。一次选择多张，每张生成独立卡片与作品笔记，名称取文件名，摘要留空。支持 PNG、JPEG、WebP、GIF 和安全 SVG；每图最多 10 MB，SVG 最多 2 MB。

部分失败时，仅重试未完成图片，成功卡片不会重复创建，也不会覆盖后来编辑的名称、摘要或封面。切换分类和删除模块前需完成导入或明确放弃重试；放弃保留已写入的笔记和图片。文件重试队列仅在当前共享卡片库保持打开期间存在，完整退出后重新选图属于新导入。

作品笔记默认只展开 **名称、摘要**，其他属性在 **更多信息**。观看日期、观看状态不再提供控件，旧值保留。每张影视类型卡片都能单独修改“导演”字段名称，例如“开发商”；空标签恢复为“导演”。

比例新增 **32:15 宽幅横图**，适合约 2.13:1 的横幅；**2:3 竖向封面**适用于竖版图片。选择“完整显示”保留全部图像，“填满裁切”贴满卡片并可能裁切边缘。

### 图片橱窗

橱窗适合只展示图片的收藏。在设置中展开独立的**添加图片橱窗**，填写名称、选择比例并保存。此入口始终创建橱窗，已有作品模块不转换为橱窗。保存失败时保留草稿与已经创建的橱窗笔记，重试不会重复建笔记。

- 点击橱窗的添加图片按钮批量选择图片，也可拖入图片。不会自动扫描文件夹；支持 PNG、JPEG、WebP、GIF 和安全 SVG，每张最大 10 MB，SVG 最大 2 MB。
- 每个橱窗独用一个文件夹与一篇 `橱窗.md`，导入图片复制到该文件夹。打开笔记即可看到全部图片、可选名称与描述。图片名称可以留空。
- 高级设置可关闭翻面，或把名称放在正面、背面、不显示。默认开启翻面、名称放在背面，正面聚焦图片。正面名称模式的背面仅显示描述；不显示名称会保留已填写文字。
- 背面描述为最多 400 字纯文本，自动保存；输入法输入期间等待确认，冲突或失败保留草稿并提供重试。关闭翻面后仍可通过“编辑当前图片”或共享笔记修改资料。
- 删除单张卡片仅移除其笔记区块，图片文件保留。图片顺序也保存在共享笔记中；修改目标字段和排序保留其他区块及未知属性。请保留卡片 ID 和管理标记。笔记缺失或标记损坏时提示修复，不会重建空笔记。

## 嵌入笔记

展开设置中的「笔记代码块生成」，选择一个或多个已有模块，然后生成并复制代码，粘贴进笔记即可。也可在笔记内执行「插入卡片模块」命令，选择模块后直接插入代码块。每次生成新的代码块 ID 和模块实例 ID；引用原作品，默认继承集合设置。

同一集合可以出现在多篇笔记中。嵌入中的模块顺序只影响该代码块；排序原子更新 `modules` 数组，保留其余正文。重复 ID、源码冲突或未保存的原生编辑会阻止覆盖并保留草稿。复制代码到同一笔记时，请重新生成 ID。

<details>
<summary>高级：在一个嵌入中覆盖布局</summary>

`collection` 引用 `book`、`film` 或已有自定义集合的稳定 ID。模块可增加 `layout`：`cylinder`、`coverflow-carousel`、`album-rail`、`scroll-bend` 或 `skewed-carousel`；弯曲画廊可增加 `orientation: vertical`。这些覆盖只影响该处展示。省略时继承集合设置。

</details>

## 常见问题与数据

**开启三卡后，其他作品会消失吗？**

不会。同屏最多显示当前卡和两张邻卡；仍可浏览全部作品，作品数量不会改变。

**封面为什么留边？**

「完整显示」保留图片全部内容，比例不同时可能留边；「填满裁切」贴满卡片，会裁切部分图片。原图自身的白边属于图片内容，插件会保留它。

**数据保存在哪里？**

作品是卡片目录中的普通 Markdown 笔记；外观与模块顺序保存在 `_数据/卡片配置.md`。插件本地配置保存目录、首次体验状态及必要恢复信息。切换目录不会重新导入示例或迁移原作品。

**修改外观后标签页黑屏怎么办？**

先等待保存完成，再退出并重新启动 Obsidian，打开原笔记库。外观已保存，作品和图片保留；修改现有模块外观时也会显示这条恢复提示。

**是否联网或读取剪贴板？**

插件不连接账户，不执行联网同步。内置示例离线可用；自行填写远程封面 URL 时会向相应图片服务器加载资源。「复制」只在用户点击后写入生成的代码；编辑标题时，主动粘贴仅读取该次粘贴的纯文本，不在后台读取剪贴板。关联笔记选择器搜索笔记库中的笔记路径，不向外发送笔记内容。

**可以在手机上使用吗？**

目前仅支持桌面版。原生验收使用 macOS；Windows 尚未实机验证。插件界面目前为中文。

<details>
<summary>由旧 Barry Cards 升级与草稿恢复</summary>

原 `barry-cards` 代码块、作品 ID、`bw_*` 属性、视图和恢复草稿继续兼容；旧目录及未知配置字段保留。

先备份原 `.obsidian/plugins/barry-cards/` 与卡片目录，再停用旧插件，等待未保存修改写入完成。将三个新文件安装到 `magical-cards`，把原 `data.json` 和恢复 JSON 一并保留到新目录，最后按原启用状态启用新插件。不要同时启用两个独立插件。

兼容宿主可以共享同一运行时。新版仅补充缺少的代码块语言与封面读取能力，保留现有作品、编辑和排序草稿。最终停用时保存失败的草稿会写入插件目录的恢复 JSON，并提示位置。

</details>

**0.3.0 更新**：新增橱窗式卡片，支持批量图片、可选名称与翻面描述；模块设置简化为名称和比例，高级项默认收起，三卡分别按模块设置；阅读、影视和自定义模块可移除展示并恢复，保留原数据和顺序。设置预览仅供浏览，编辑请使用左侧紫色卡片图标打开 Magical Cards 标签页。

**0.3.1 更新**：修正弯曲画廊退出时的 WebGL 上下文释放，比例和方向变化复用画布；首次说明页采用作者修订的正文；新建橱窗的选项改为“添加图片橱窗”；补充外观更改后的黑屏恢复提示。

**0.4.0 更新**：添加卡片模块与添加图片橱窗分为独立折叠入口，各自保留草稿；卡片标签页新增“全部”和 Dashboard 分类，可主动选择已有模块、编辑或删除分类，并分别保存模块顺序。分类共用原资料，新模块不自动加入，模块隐藏仍全局生效。

**0.4.2 更新**：区分隐藏、移出分类和真正移除模块。隐藏仍可恢复；“移出此 Dashboard”仅取消当前分类引用；“移除模块”经确认删除模块配置、全部分类引用及模块位置，保留作品笔记和图片，原有嵌入提示模块已移除，不提供模块恢复入口。删除前检查未保存编辑与排序，失败或冲突保留原模块和草稿。兼容宿主为 **0.1.37**。

**0.5.0 更新**：Dashboard 分类同等，取消固定“全部”页和隐藏操作。分类标签可以拖动排序；模块加入、移出与删除集中在设置，创建模块可同时创建分类。普通卡片、橱窗和创建入口采用不同样式，工具栏合并为横向动画菜单。历史隐藏模块转为未分类，清空旧隐藏状态，相关嵌入和兼容宿主恢复展示。兼容宿主为 **0.1.38**。

## 开发与版权

[示例笔记库](examples/vault/) 仅包含三本书、三部影视及独立示例 ID；安装三个插件文件后用 Obsidian 打开即可。其卡片目录为「示例」。[说明页模板](examples/Magical_Cards示例及用法说明.md) 用于首次体验。

代码采用 [MIT](LICENSE)。第三方封面及含封面的预览图不受代码许可证授权，其权利归各自权利人；请保留[封面来源与版权](examples/SOURCES.md)。布局、React 及构建适配说明见 [THIRD_PARTY.md](THIRD_PARTY.md)。
