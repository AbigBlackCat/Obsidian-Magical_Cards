# Skewed Carousel · 倾斜轮播

视觉与交互参考：https://pro.reactbits.dev/docs/components/skewed-carousel

根据公开网页的可见效果与参数独立编写，未使用付费组件源码。通过 CSS 3D 的逐步 rotateY、每卡片透视和横向位移复现。默认第 4 张居中、宽度 200px、比例 3 / 4、每步旋转 60°、非活动卡片缩放 0.85、透视 800px，活动标题在图片底部淡入。

支持点击卡片、箭头、进度条、鼠标或触摸拖动、方向键、循环和自动播放。悬停或获得焦点时自动播放暂停；系统要求减少动态效果时关闭过渡和自动播放。UI 仓面板可编辑外观及交互参数，自定义图片可从组件的 items 属性传入 `{ image, title, alt? }[]`。

```tsx
import SkewedCarousel from './SkewedCarousel';

<SkewedCarousel items={items} initialIndex={0} loop />
```

示例图片来自参考网页公开使用的 Unsplash 图片，已保存为本地 JPG；路径与原始地址见 assets.json。组件仅依赖 React，源码、CSS、图片随 UI 仓导出。动画曲线为独立实现，未做逐帧一致性校验。
