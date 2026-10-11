import React, { useEffect, useState } from 'react';
import { createCoverSvg, staticCoverSvg } from './covers';

export function CoverImage({ src, title, alt = '', className, loading = 'lazy', showFailure = false }: { src: string; title: string; alt?: string; className?: string; loading?: 'lazy' | 'eager'; showFailure?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [staticImage, setStaticImage] = useState<{ source: string; url: string } | null>(null);
  const isSvg = /^data:image\/svg\+xml[;,]/i.test(src) || /\.svg(?:$|[?#])/i.test(src);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!reduced || !isSvg) return;
    const controller = new AbortController();
    fetch(src, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('封面读取失败'); return response.text(); }).then(svg => { const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(staticCoverSvg(svg))}`; if (!controller.signal.aborted) setStaticImage({ source: src, url }); }).catch(() => { if (!controller.signal.aborted) setFailedSource(src); });
    return () => controller.abort();
  }, [src, reduced, isSvg]);
  const fallback = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverSvg('pages', title, '#b54e39', false))}`;
  const shown = !src || failedSource === src ? fallback : reduced && isSvg ? staticImage?.source === src ? staticImage.url : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverSvg('pages', title, '#b54e39', false))}` : src;
  return <><img src={shown} alt={alt} className={className} loading={loading} draggable={false} onError={() => setFailedSource(src)} />{showFailure && (!src || failedSource === src) && <span className="bw-cover-error" role="status">图片未加载，请检查链接或重试。</span>}</>;
}

