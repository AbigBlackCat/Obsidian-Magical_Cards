# Magical Cards

在 Obsidian 中浏览、编辑书籍和影视封面。卡片可以独立打开，也能嵌入笔记；阅读模式与实时预览共用同一份作品数据。

## 安装与开始

从 [Releases](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入笔记库的 `.obsidian/plugins/magical-cards/`，然后启用 **Magical Cards**。需要 Obsidian 桌面版 1.11.4 或更新版本。

第一次在空目录启用，会创建 `卡片库/Magical_Cards示例及用法说明.md` 并打开它。阅读和影视包含 8 张可编辑的离线示例封面，初始采用圆柱弧面、整幅封面、填满裁切、纸感、2:3，以及同屏最多三张卡片。可以浏览全部作品；删除示例后重启不会补回。已有卡片库不会重新导入示例，也不会改动原外观。

使用侧栏卡片图标或命令「Magical Cards: 打开卡片视图」。命令「查看示例及用法说明」可再次打开说明页；初始化中途失败时也可通过此命令重试。

## 设置

填写当前笔记库内的相对目录，例如 `卡片库`。作品保存在其下的书籍／观影目录，配置保存在 `_数据/卡片配置.md`。切换目录不会搬运原有作品。

展开「示例」，可实时预览阅读、影视，并依次选择卡片样式、显示方式、材质、比例和动效布局；点击保存后生效。滚动弯曲画廊才显示横／竖方向。「仅显示三张卡片」限制同屏邻卡数量，作品数量不变。「添加卡片模块」使用相同的五项设置，保存后收起；之后可展开已有模块修改。新模块始终从初始外观开始。

支持圆柱弧面、封面流轮播、黑胶专辑架、横／竖滚动弯曲画廊和倾斜轮播。卡片不自动轮播，黑胶样式只展示封套。可搜索、添加、编辑、关联笔记、排序和翻面编辑摘要。WebGL 不可用或纹理加载失败时，弯曲画廊降级为普通卡片；系统的减少动态效果偏好会关闭弯曲和过渡。

## 笔记嵌入

展开设置中的「笔记代码块生成」，或执行「插入卡片模块」命令，选择一个或多个已有模块并生成、复制代码。每次生成新的代码块 ID 和模块实例 ID；代码引用原作品，默认继承集合设置。

````markdown
```magical-cards
id: reading-and-films
modules:
  - id: reading-instance
    collection: book
  - id: films-instance
    collection: film
```
````

`collection` 引用 `book`、`film` 或已有自定义集合的稳定 ID。手写时可增加 `layout`：`cylinder`、`coverflow-carousel`、`album-rail`、`scroll-bend` 或 `skewed-carousel`；弯曲画廊可增加 `orientation: vertical`。这些覆盖仅影响该处展示。复制到同一笔记时，请重新生成 ID。

拖动标题前的手柄调整模块顺序，或聚焦手柄按 Alt / Option + ↑ / ↓。笔记排序只更新对应代码块的 `modules`，保留其余正文。重复 ID、源码冲突或未保存的原生编辑会阻止覆盖并保留草稿。独立视图保存自己的模块顺序。

## 升级与数据

原 `barry-cards` 代码块、作品 ID、`bw_*` 属性、视图和恢复草稿继续兼容。旧插件配置中的目录及未知字段会保留。首次展示的进度保存在插件本地 `data.json`，切换目录不会重新播种。卡片外观及模块顺序保存在卡片目录的 `_数据/卡片配置.md`，作品是普通 Markdown 笔记。

由旧 Barry Cards 升级时，先备份原 `.obsidian/plugins/barry-cards/` 与卡片目录，再将三个新文件安装到 `magical-cards`，把原 `data.json` 和恢复 JSON 一并保留到新目录，最后按原启用状态启用新插件、停用旧插件。不要同时启用两个独立插件。旧安装目录可保存在备份中。

兼容的宿主插件可以共享同一运行时；新的代码块语言只增量注册，现有作品及编辑、排序草稿不会重建。最终停用时保存失败的草稿会写入插件目录的恢复 JSON 并提示位置。

本插件不连接账户，不执行联网同步。示例封面均在 `main.js` 中打包，只需三个文件即可离线安装。用户自行填写远程封面 URL 时，Obsidian 会向该图片服务器加载资源。

## 示例与开发

[示例笔记库](examples/vault/) 仅含 5 本书、3 部影视及隔离的示例 ID；将三个插件文件放到该示例库的 `.obsidian/plugins/magical-cards/`，用 Obsidian 打开即可。其卡片目录为「示例」。[说明页模板](examples/Magical_Cards示例及用法说明.md) 用于首次体验。

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

浏览器预览位于 `http://127.0.0.1:4319`，可切换布局、比例、图片显示方式、横竖方向以及空／单卡集合。

| 封面流轮播 | 黑胶专辑架 |
| --- | --- |
| ![封面流轮播](previews/coverflow-carousel.png) | ![黑胶专辑架](previews/album-rail.png) |
| 弯曲画廊 | 倾斜轮播 |
| ![弯曲画廊](previews/scroll-bend.png) | ![倾斜轮播](previews/skewed-carousel.png) |

本仓库只包含卡片源码、必要文档和公开示例。第三方封面及其预览图片不属于代码许可证，见 [来源与版权](examples/SOURCES.md)；布局来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。社区提交说明见 [COMMUNITY.md](COMMUNITY.md)。
