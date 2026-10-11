# Scroll Bend · 滚动弯曲画廊

参考：[React Bits Pro · Scroll Bend](https://pro.reactbits.dev/docs/components/scroll-bend?browse=components&category=new)。2026-10-11 浏览公开 Preview 与 Props，并实际操作纵向滚轮、Fisheye 预设、横向切换、拖拽和全屏预览。

原站 Code 页要求付费解锁。本素材依据公开行为独立编写，不包含原站付费源码，不声称算法、预设或像素与原版完全一致。

## 画面与交互

黑色舞台中的图片带默认纵向自动漂移。速度驱动整条带子的径向镜头变形：正向鼓起，反向收紧；也可固定为凸面或凹面。边缘轮廓、图片内部和间隙共同弯曲，带弹性回弹、两端渐隐、遮暗与轻微色散。

支持滚轮/触控板、鼠标与触屏拖拽、惯性、首尾循环或边界回弹、自动漂移、悬停暂停与吸附。聚焦时暂停自动漂移，沿排列方向的方向键及 Page Up/Down 切换图片，Home/End 跳转首尾；无人操作的自动漂移不播报图片变化，键盘聚焦后礼貌播报当前位置。Ctrl + 滚轮保留浏览器缩放。减少动效偏好关闭漂移和弯曲，键盘与滚轮即时切换。

Velocity 默认参数与公开文档一致；Fisheye 采用公开交互观察到的静止弯曲 0.22、轴向偏向 1、镜头半径 0.85。Bulge、Pinch、Reel、Calm 为本地等效参数组合，未验证与原站每个预设数值逐项一致。工作台预设由 item.json 的参数包承载，切换后仍可编辑各参数。

## 资源与复用

8 张 SVG 是本地原创几何构图，参考公开演示的紫、玫红、橙黄色调与抽象主题；没有复制原图。资源均在 assets/，无外部字体、图片或网络依赖。

入口 entry.tsx 包含离线图片与预览背景。核心 ScrollBend.tsx 接受 `items: (string | { src, alt? })[]`，支持自定义图片、onIndexChange、className 和 style。通过 React ref 可调用 next()、previous()、goTo(index)、impulse(velocity)；速度单位为像素/秒。核心填满父容器，最小高 420px，父容器应提供明确高度。仅依赖 React，WebGL 与图片图集由浏览器原生 API 实现。

自定义远程图片需要允许跨域绘制；无法加载时对应位置显示占位。WebGL 不可用或上下文丢失时显示当前原图并保留切换操作，上下文恢复后自动恢复变形。页面不可见时暂停绘制，卸载时释放 GPU 与事件资源。质量控制渲染分辨率，DPR 最大为 2。素材源码、样式、几何图与说明均随本地 registry 完整导出。
