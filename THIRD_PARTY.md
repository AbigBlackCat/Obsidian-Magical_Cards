# 第三方来源

四种布局依据所有者本地 UI registry 的组件适配，没有引入 shadcn、Tailwind、Motion 或 Lucide 运行依赖。原始来源说明保存在[已公开的 0.7.0 布局来源记录](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/tree/0.7.0/src/layouts)，包含 Coverflow 用户提供代码、以及 Album Rail / Scroll Bend / Skewed Carousel 依据 React Bits Pro 公开演示独立复现的说明。原说明提到的演示图片、专辑及入口文件没有纳入本插件。

布局适配沿用现有卡片作品数据与编辑会话：新布局不自动浏览，Album Rail 删除播放和唱片抽出动画，Scroll Bend 增加明确打开入口与 WebGL 降级。未声称与参考站逐像素一致。

Coverflow 原始代码未附许可证，来源说明不额外授予其许可。Magical Cards 从 0.9.0 起的[作者代码许可](LICENSE)只适用于作者有权许可的代码，不改变第三方许可或已经以 MIT 发布的旧版权利。示例封面及预览图片不受作者代码许可授权，原图来源与权利说明见 [examples/SOURCES.md](examples/SOURCES.md)。

## 横向操作菜单

横向菜单参考所有者本地 registry 的 `radial.json`（2026-10-14）展开动画：弹性位移、逐项延迟、收起零延迟。根据现有 React、图标与 Obsidian 主题独立实现水平工具行，未引入半圆手势、Lucide、Tailwind 或参考组件的全局主题。原组件说明记载其用户提供代码未附许可证；此处仅记录参考来源，不授予第三方代码许可。

The horizontal action menu independently adapts the motion pattern of the owner's local Radial registry item. It uses existing React, icons and Obsidian theme tokens, without importing the radial gesture code or global theme.

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
