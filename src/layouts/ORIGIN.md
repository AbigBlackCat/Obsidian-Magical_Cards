# 卡片布局来源与适配

本插件复用本地 UI 仓的 `coverflow-carousel`、`album-rail`、`scroll-bend` 和 `skewed-carousel` 几何算法与 Scroll Bend 的 WebGL shader。对应原始来源说明原样保存在本目录的 `*-origin.md` 文件中。

适配只使用用户笔记与封面，不带 UI 仓的专辑、照片、SVG 示例资源、预览入口或全局主题。三维布局沿用卡片插件的选择、翻面、摘要编辑、草稿恢复与无障碍入口。Album Rail 只显示封套，删除唱片、播放和抽出交互。所有布局均由用户浏览，不自动播放或漂移。

Scroll Bend 保留原径向逆镜头 shader 和速度驱动的弯曲响应，图集由最多七张邻居卡片的现有封面、标题与摘要生成；三卡视图共享普通布局的可见范围。WebGL 不可用、图片不能进入纹理或上下文丢失时回到可操作的 DOM 卡片；上下文恢复后重新创建 GPU 资源。当前卡片用明确的按钮打开笔记与编辑摘要。

Coverflow、Album Rail 与 Skewed Carousel 只保留固定默认几何和现有卡片设置；动画复用插件现有弹簧计算，不引入 Motion、Lucide、Tailwind 或 shadcn 运行依赖。Skewed Carousel 的远端倾角限制在 82°，让远端卡片保持正面；原始参考素材本身也属于独立复现，不承诺逐像素一致。
