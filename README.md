# Barry Cards

把现有书籍、影视和收藏笔记展示成可编辑、可拖拽的封面卡片。可单独打开卡片视图，也可通过 `barry-cards` 代码块嵌入笔记；阅读模式与实时预览共用卡片数据。

支持原有圆柱弧面、Coverflow、黑胶封套轨道、横／竖滚动弯曲画廊和倾斜轮播。新布局不自动轮播；黑胶轨道只展示封套。所有布局保留键盘浏览、翻面摘要、搜索、作品排序、封面处理、比例、材质和三卡视图。

## 安装

从 [Releases](https://github.com/AbigBlackCat/barry-cards/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入笔记库的 `.obsidian/plugins/barry-cards/`，然后在 Obsidian 社区插件中启用。需要 Obsidian 桌面版 1.11.4 或更新版本。

打开命令「Barry Cards: 打开卡片视图」。卡片目录默认「工作台」；与 Barry 工作台使用相同目录时，两插件共用作品笔记、排序与编辑会话。独立插件不执行任务、日记或联网同步。

## 笔记嵌入

执行「插入卡片模块」会生成稳定且唯一的代码块及模块 ID。也可手写：

````markdown
```barry-cards
id: reading-and-films
modules:
  - id: books
    collection: book
    layout: coverflow-carousel
  - id: films
    collection: film
    layout: album-rail
```
````

`collection` 引用 `book`、`film` 或设置中已有自定义集合的 ID，不复制作品数据。`layout` 可为 `cylinder`、`coverflow-carousel`、`album-rail`、`scroll-bend`、`skewed-carousel`。弯曲画廊可额外设置 `orientation: vertical`（默认 `horizontal`）。布局覆盖只影响该处展示；同一集合可以在多个笔记中采用不同布局。

拖动标题前的手柄调整模块顺序，或聚焦手柄后按 Alt / Option + ↑ / ↓。笔记排序只原子更新对应代码块的 `modules`，保留其余正文。重复 ID、源码冲突或未保存的原生编辑会拒绝覆盖并保留排序草稿。独立视图保存自己的模块顺序。

## 数据与恢复

卡片外观、集合及顺序保存在 `<卡片目录>/_数据/卡片配置.md`。首次启用会从旧工作台设置无损迁移；旧设置和作品笔记保留。作品仍采用现有 `bw_*` Markdown 格式，可在 Obsidian 原生编辑器中编辑。

两个插件同时启用时，嵌入、排序语言及作品属性编辑区由共享运行时注册一次。停用其中一个插件后仍可使用；最后一个插件停用时会尝试保存草稿，冲突草稿写入插件目录的恢复 JSON 并显示位置。

Scroll Bend 在 WebGL 不可用、纹理无法加载或上下文丢失时降级为可操作的普通卡片；减少动态效果偏好关闭弯曲和过渡。卡片有明确的「打开当前卡」与摘要入口。

## 示例与开发

[示例笔记库](examples/vault/) 含 3 张影视及 5 张书籍原始封面。用 Obsidian 打开该目录，将卡片目录设为「示例」即可离线查看 `卡片布局示例.md`。

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

浏览器预览位于 `http://127.0.0.1:4319`，包含八张本地封面、五种布局及横竖切换。

| Coverflow | 黑胶封套 |
| --- | --- |
| ![Coverflow](previews/coverflow-carousel.png) | ![黑胶封套](previews/album-rail.png) |
| 弯曲画廊 | 倾斜轮播 |
| ![弯曲画廊](previews/scroll-bend.png) | ![倾斜轮播](previews/skewed-carousel.png) |

本仓库只包含独立卡片源码、文档与隔离示例，不包含工作台完整历史、个人摘要或阅读记录。封面不属于代码许可证，见 [来源与版权](examples/SOURCES.md)；布局来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。
