import React, { useEffect, useRef, useState } from 'react';
import { createCoverSvg, decodeSvgDataUrl, staticCoverSvg } from './covers';
import type { CardsAPI } from './types';
import { useOwnerWindow } from './owner-window';

export function CoverImage({ src, source = src, sourcePath, readSvg, title, alt = '', className, loading = 'lazy', showFailure = false }: { src: string; source?: string; sourcePath?: string; readSvg?: CardsAPI['readCoverSvg']; title: string; alt?: string; className?: string; loading?: 'lazy' | 'eager'; showFailure?: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  const owner = useOwnerWindow(image);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [staticImage, setStaticImage] = useState<{ source: string; url: string } | null>(null);
  const isSvg = /^data:image\/svg\+xml[;,]/i.test(src) || /\.svg(?:$|[?#])/i.test(src);
  useEffect(() => {
    if (!owner) return;
    const preference = owner.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    change();
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, [owner]);
  useEffect(() => {
    if (!reduced || !isSvg) return;
    let current = true;
    const read = /^data:image\/svg\+xml[;,]/i.test(src)
      ? Promise.resolve().then(() => decodeSvgDataUrl(src))
      : readSvg ? Promise.resolve().then(() => readSvg(source, sourcePath)) : Promise.reject(new Error('SVG 封面无法读取。'));
    void read.then(svg => {
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(staticCoverSvg(svg))}`;
      if (current) setStaticImage({ source: src, url });
    }).catch(() => { if (current) setFailedSource(src); });
    return () => { current = false; };
  }, [src, source, sourcePath, readSvg, reduced, isSvg]);
  const fallback = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverSvg('pages', title, '#b54e39', false))}`;
  const shown = !src || failedSource === src ? fallback : reduced && isSvg ? staticImage?.source === src ? staticImage.url : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCoverSvg('pages', title, '#b54e39', false))}` : src;
  return <><img ref={image} src={shown} alt={alt} className={className} loading={loading} draggable={false} onError={() => setFailedSource(src)} />{showFailure && (!src || failedSource === src) && <span className="bw-cover-error" role="status">图片未加载，请检查链接或重试。</span>}</>;
}

