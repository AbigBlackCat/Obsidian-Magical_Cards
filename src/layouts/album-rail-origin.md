# Album Rail · 黑胶专辑轨道

参考页面：https://pro.reactbits.dev/docs/components/album-rail?browse=components&category=new

根据 React Bits Pro 公开演示的视觉与交互，以及公开 Props 文档独立复现（2026-10-11）。本次未访问或下载官方组件源码；此素材不是 React Bits Pro 官方源码。保留扇形展开的专辑封套、插在封套中的黑胶唱片、封面取色、当前专辑信息，以及拖拽、滚轮、方向键、自动切换和播放动画交互。

封套使用 CSS 3D transforms，切换使用弹簧运动；唱片凹槽与中心标签由 CSS 绘制。此实现不使用 WebGL，因此原文档的 `dpr` 参数不适用。几何与弹簧曲线按公开演示近似，视觉效果并不保证与原站逐像素相同。

主要默认参数沿用公开文档：`startIndex=0`、`aspect=1`、`size=0.62`、`spread=0.58`、`stack=0.5`、`fan=6`、`turn=22`、`depth=0.5`、`visible=3`、`radius=14`、`dim=0.45`、`shadow=0.6`、`vinyl=true`、`vinylColor="#131116"`、`accentColor="#b19eef"`、`rpm=33`、`autoplay=true`、`interval=4`、`pauseOnHover=true`、`loop=true`、`draggable=true`、`wheel=true`、`captions=true`、`controls=true`。预览补充封面自动取色、背景色、暂停和无障碍名称参数。

播放按钮和 Enter 控制抽出唱片与旋转动画，不播放音频，素材也不包含音频文件。`autoplay` 控制自动浏览专辑，与唱片播放动画分别设置。支持减少动态效果偏好；专辑详情数组通过 `entry.tsx` 编辑，标量设置可在 UI 仓 Customize 中调整。

`entry.tsx` 是 UI 仓默认预览入口，导出 `ALBUMS` 演示数据；`AlbumRail.tsx` 为可单独使用的具名组件。入口默认使用 12 张演示专辑，也可传入 `items` 替换。独立使用请导入 `AlbumRail.css` 并给父元素明确尺寸。源码、样式与全部图片随 registry 一起导出，可离线预览。

```tsx
import { AlbumRail } from "./AlbumRail";
import "./AlbumRail.css";

<AlbumRail
  items={[{ src: "/my-album.jpg", alt: "My album", title: "My album", subtitle: "Artist" }]}
  autoplay={false}
/>
```

以下封面来自公开演示已经加载的 iTunes / Apple Music CDN 文件，保留原图并下载到本地；12 张 JPEG 均为 800 × 800，已完整解码检查。仅记录图像来源，未单独核验专辑封面授权，不另行授予或转移封面权利。

| 本地文件 | 专辑 | 歌手 | 原始 URL |
| --- | --- | --- | --- |
| `assets/album-01.jpg` | Currents | Tame Impala | https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/800x800bb.jpg |
| `assets/album-02.jpg` | Scaled And Icy | twenty one pilots | https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/f2/15/24f215e3-52cc-078b-d799-d58d606feddd/075679786210.jpg/800x800bb.jpg |
| `assets/album-03.jpg` | Plastic Beach | Gorillaz | https://is1-ssl.mzstatic.com/image/thumb/Music/v4/b8/f9/b9/b8f9b9f8-a609-bde2-0302-349436ffc508/825646291038.jpg/800x800bb.jpg |
| `assets/album-04.jpg` | Moral Panic | Nothing But Thieves | https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/73/92/05/73920581-0801-84b2-bd1c-7f802696dcde/886448371342.jpg/800x800bb.jpg |
| `assets/album-05.jpg` | Persona | half•alive | https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c0/72/b6/c072b6c0-4fa9-cf72-4160-dddfcc0e1619/00198704156670_Cover.jpg/800x800bb.jpg |
| `assets/album-06.jpg` | The Slow Rush | Tame Impala | https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/e3/e7/65e3e740-b69f-f5cb-f2e6-7dedb5265ac9/19UMGIM96748.rgb.jpg/800x800bb.jpg |
| `assets/album-07.jpg` | Humanz | Gorillaz | https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/59/cd/b0/59cdb036-be24-a2ae-5c50-12e79acb7aa4/190295824853.jpg/800x800bb.jpg |
| `assets/album-08.jpg` | Now, Not Yet | half•alive | https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d9/f5/5d/d9f55d68-c60b-e3ce-559d-75cd63a7f591/886447791950.jpg/800x800bb.jpg |
| `assets/album-09.jpg` | Trench | twenty one pilots | https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a3/c0/2b/a3c02b76-baa1-e575-dcba-247509200424/075679864789.jpg/800x800bb.jpg |
| `assets/album-10.jpg` | Dead Club City | Nothing But Thieves | https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/91/36/57/91365765-5ee4-f8cc-f645-f4112a662e2d/196589839190.jpg/800x800bb.jpg |
| `assets/album-11.jpg` | Cracker Island | Gorillaz | https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b3/b9/bb/b3b9bbdf-8d38-661e-f70b-2eb5e9765bb7/5054197315893.jpg/800x800bb.jpg |
| `assets/album-12.jpg` | Blurryface | twenty one pilots | https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8e/e2/89/8ee28904-0821-610d-5011-a61845f62756/075679926951.jpg/800x800bb.jpg |
