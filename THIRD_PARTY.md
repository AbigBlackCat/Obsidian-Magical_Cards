# 第三方来源

四种布局依据所有者本地 UI registry 的组件适配，没有引入 shadcn、Tailwind、Motion 或 Lucide 运行依赖。原始来源说明保存在 [src/layouts/](src/layouts/)，包含 Coverflow 用户提供代码、以及 Album Rail / Scroll Bend / Skewed Carousel 依据 React Bits Pro 公开演示独立复现的说明。原说明提到的演示图片、专辑及入口文件没有纳入本插件。

布局适配沿用现有卡片作品数据与编辑会话：新布局不自动浏览，Album Rail 删除播放和唱片抽出动画，Scroll Bend 增加明确打开入口与 WebGL 降级。未声称与参考站逐像素一致。

Coverflow 原始代码未附许可证，来源说明不额外授予其许可；MIT 文件仅授予本仓库作者有权许可的代码。示例封面及预览图片明确不受 MIT 许可，原图来源与权利说明见 [examples/SOURCES.md](examples/SOURCES.md)。
