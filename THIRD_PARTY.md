# 第三方来源

折页轮播、扇形卡架、滚动弯曲画廊、倾斜轮播及新增三种布局依据所有者本地 UI registry 的组件适配，没有引入 shadcn、Tailwind、Motion 或 Lucide 运行依赖。旧布局原始来源说明保存在[已公开的 0.7.0 布局来源记录](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/tree/0.7.0/src/layouts)，包含 Coverflow 用户提供代码、以及 Album Rail / Scroll Bend / Skewed Carousel 依据 React Bits Pro 公开演示独立复现的说明。原说明提到的演示图片、专辑及入口文件没有纳入本插件。

布局适配沿用现有卡片作品数据与编辑会话：五种旧布局继续手动浏览，3D转轮提供默认关闭的自动旋转开关；Album Rail 删除播放和唱片抽出动画，Scroll Bend 增加明确打开入口与 WebGL 降级。未声称与参考站逐像素一致。

Coverflow 原始代码未附许可证，来源说明不额外授予其许可。Magical Cards 从 0.9.0 起的[作者代码许可](LICENSE)只适用于作者有权许可的代码，不改变第三方许可或已经以 MIT 发布的旧版权利。示例封面及预览图片不受作者代码许可授权，原图来源与权利说明见 [examples/SOURCES.md](examples/SOURCES.md)。

## 3D Wheel / Slide Curtain / Magazine Scroller

2026-10-22 从所有者提供的本地 registry 提取以下 `source/ORIGIN.md`，按原文保留：

- 3D Wheel 来源记录：[Skecher UI 3D Wheel Carousel](https://skecher-ui.com/docs/3d-wheel-carousel)，registry 作者字段为 `CoDesign-Spa27`。原记录说明未取得可确认适用的独立许可证文本，也未发现示例图片的单独授权声明。
- Magazine Scroller 来源记录：[Skecher UI Magazine Scroller](https://skecher-ui.com/docs/magazine-scroller)，原记录核对的源码版本为 `0a7d4a9e392328d092a8f74157acfdad6542b9d2`。该记录未发现明确的组件代码或示例封面许可证。
- Slide Curtain 来源记录：[Hologram Slide Curtain 公开场景](https://scenes.makehologram.com/KgmKSgCrnD3hyxHVXH1nEw@1/)。原记录保留场景与照片清单的来源说明，不额外授予原场景或图片许可。

Magical Cards 只接入用户已有封面与卡片文字，复用现有 React、弹簧计算及编辑会话；转轮和杂志布局不引入上游 Motion/Tailwind 运行环境，胶片帘不加载 Hologram 平台脚本。未复制 registry 的八张转轮封面、十二张杂志封面、胶片帘照片与缩略图、演示入口或全局主题。来源记录中的资产描述属于 UI 仓归档，并不表示这些资产随 Magical Cards 分发。

转轮保留圆环浏览与可选自动旋转，杂志布局保留纸片变形与重复正面绘制，胶片帘适配 WebGL 2 shader 与链条物理并提供可操作卡片降级。减少动态效果会停用自动旋转、摆动与纸片弯曲；这些调整不改变第三方授权边界。上述三条记录均不构成本插件对第三方代码或图片的许可授予，不将其标记为 MIT。

## 横向操作菜单

横向菜单参考所有者本地 registry 的 `radial.json`（2026-10-14）展开动画：弹性位移、逐项延迟、收起零延迟。根据现有 React、图标与 Obsidian 主题独立实现水平工具行，未引入半圆手势、Lucide、Tailwind 或参考组件的全局主题。原组件说明记载其用户提供代码未附许可证；此处仅记录参考来源，不授予第三方代码许可。

The horizontal action menu independently adapts the motion pattern of the owner's local Radial registry item. It uses existing React, icons and Obsidian theme tokens, without importing the radial gesture code or global theme.

## Seek / Apple Mail Tabs 与设置分类

2026-10-23 的操作栏改用所有者提供的 Seek 圆形入口到胶囊的弹簧节奏；Dashboard 分类栏参考 Skecher UI Apple Mail Tabs 的选中名称展开。详细参考路径、来源和参数保存在私有工程的弹簧控件来源记录中。适配使用原生 RAF、现有 React、内置 SVG 与 Obsidian 图标，保留当前操作、分类排序和草稿流程；没有导入演示搜索业务、磁吸交互、Motion、Tailwind、Lucide 或全局主题。来源记录未确认原组件代码的独立许可证，此处不将其标记为 MIT。

设置分类借鉴本机 Home 0.1.12 的分组入口、图标说明行及返回结构，使用 Magical Cards 自有控制器和样式实现；没有复制 Home 的设置代码或改动 Home 插件。

## Welcome Tour 弹窗与更新日志

2026-10-23 的模块编辑弹窗参考所有者本地 `welcome-tour.json` 归档的 [Jeet / Jitendra Nirnejak Welcome Tour](https://interfaces.show/welcome-tour/)：浅灰外壳、内嵌面板、圆角与柔和阴影。原参考是分步内联卡片，本插件仅依据视觉自行实现原生 dialog，不复制步骤状态、Motion、字体、演示入口或全局样式。归档未确认原界面独立许可证；此处仅记录参考来源，不额外授予许可。弹窗继续使用现有 React、图标、Obsidian 主题和草稿逻辑。

更新日志借鉴本机 Home 0.1.12 的版本折叠与分类信息结构，使用 Magical Cards 自己的历史记录和已读流程实现，没有复制 Home 代码或打赏入口。胶片帘仅作为「关于 → 拓展动效」的内存预览开放；普通模块和嵌入继续兼容其旧 ID，但使用圆柱弧面展示。

## React / React DOM / Scheduler

React 与 React DOM 固定为 19.3.0，与随其打包的 Scheduler 继续采用原始 MIT 许可证。构建仅适配 `react-dom-client.production.js` 的三个脚本资源创建入口：普通脚本预初始化、模块脚本预初始化及异步 script 元素资源。适配后这些入口直接抛错，拒绝加载可执行脚本资源。版本、上游文件 SHA-256 及匹配数量均在构建时校验；上游变化须重新审查后才能构建。卡片渲染、SVG 清洗及 React 的惰性 script 元素保护继续保留。

React and React DOM 19.3.0, together with the bundled Scheduler, are distributed under their original MIT license. The build adapts only the three executable script-resource creation paths in the production client renderer. Those paths explicitly throw instead of creating a script resource. The version, upstream source SHA-256, and expected match count are checked at build time; an upstream change requires another review. The private build process checks this adaptation with refusal and build-mismatch tests.

### React / React DOM / Scheduler license

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Google Brotli decoder

Six sample covers are stored as Brotli-compressed image bytes and decoded by the bundled Google Brotli JavaScript decoder on desktop and mobile. No decoder code is downloaded at runtime. Only image assets are compressed. Each decoded image is verified against its original SHA-256 before it is written; original cover bytes and rights remain unchanged.

Pinned source: [Google Brotli decode.js](https://github.com/google/brotli/blob/86ee1f65f62d6272345dee751d49e7d1f01c2b11/js/decode.js), Copyright 2017 Google Inc. The local adaptations initialize the decoder lazily and stop decoding when output exceeds the expected image size. The upstream MIT license is preserved below and in the distributed plugin.

### Brotli license

```text
Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
