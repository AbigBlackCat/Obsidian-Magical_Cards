import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import WorkCarousel from './WorkCarousel';
import {CoverImage} from './CoverImage';
import {createWork} from './domain';
import type {CardLayout,CardRatio,Work} from './types';
import {CARD_LAYOUTS,CARD_RATIOS} from './settings';
import manifest from '../examples/covers.json';
import lostSvg from '../examples/vault/示例/附件/demo-film-lost.svg';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
if(!Array.isArray(manifest))throw new Error('示例封面清单无效。');
const works:Work[]=manifest.map((item:unknown)=>{
 if(!record(item)||typeof item.id!=='string'||(item.type!=='book'&&item.type!=='film')||typeof item.title!=='string'||typeof item.cover!=='string')throw new Error('示例封面条目无效。');
 return {...createWork(item.type),id:item.id,title:item.title,cover:`/examples/vault/示例/附件/${item.cover}`};
});
const readPreviewSvg=(source:string)=>source.endsWith('/demo-film-lost.svg')?Promise.resolve(lostSvg):Promise.reject(new Error('示例 SVG 不存在。'));
function Preview(){
 const [layout,setLayout]=useState<CardLayout>('cylinder'),[orientation,setOrientation]=useState<'horizontal'|'vertical'>('horizontal'),[ratio,setRatio]=useState<CardRatio>('2:3'),[fit,setFit]=useState<'contain'|'cover'>('cover'),[three,setThree]=useState(true),[count,setCount]=useState(6),[open,setOpen]=useState(''),[active,setActive]=useState<string|null>(''),[drafts,setDrafts]=useState<Record<string,string>>({});
 return <main className="bw-app bw-preview"><header><h1>Magical Cards</h1><p>六张离线封面 · 拖动或使用方向键浏览 · F 编辑摘要</p></header><nav aria-label="布局">{Object.entries(CARD_LAYOUTS).map(([id,label])=><button key={id} aria-pressed={layout===id} onClick={()=>setLayout(id as CardLayout)}>{label}</button>)}</nav><div className="bw-preview-controls"><label>方向<select aria-label="弯曲画廊方向" value={orientation} onChange={event=>setOrientation(event.target.value as typeof orientation)}><option value="horizontal">横向</option><option value="vertical">竖向</option></select></label><label>比例<select aria-label="卡片比例" value={ratio} onChange={event=>setRatio(event.target.value as CardRatio)}>{Object.entries(CARD_RATIOS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>图片<select aria-label="图片显示方式" value={fit} onChange={event=>setFit(event.target.value as typeof fit)}><option value="contain">完整显示</option><option value="cover">填满裁切</option></select></label><label>数量<select aria-label="卡片数量" value={count} onChange={event=>setCount(Number(event.target.value))}><option value={6}>6 张</option><option value={1}>1 张</option><option value={0}>空集合</option></select></label><label><input type="checkbox" checked={three} onChange={event=>setThree(event.target.checked)}/>仅三张</label></div><section className="bw-work-stack bw-module"><h2>{CARD_LAYOUTS[layout]}</h2><WorkCarousel works={works.slice(0,count)} label="六张示例封面" appearance={{material:'paper',style:'cover',layout,orientation}} ratio={ratio} imageFit={fit} threeCardView={three} onActiveChange={setActive} renderWork={work=><><div className="bw-paper-image"><CoverImage src={work.cover} readSvg={readPreviewSvg} title={work.title} showFailure/></div><div className="bw-paper-copy"><div className="bw-top"><h3>{work.title}</h3></div></div></>} renderBack={(work,isActive,flip)=><div className="bw-card-back-content"><h3>{work.title}</h3><label>示例摘要<textarea aria-label={`${work.title}的背面文字`} rows={5} value={drafts[work.id]??''} onChange={event=>setDrafts(current=>({...current,[work.id]:event.target.value}))}/></label><button onClick={flip}>返回正面</button></div>} open={work=>setOpen(work.title)} empty={<p className="bw-empty">空集合：添加第一张卡片。</p>}/></section><p role="status">{open?`打开当前卡：${open}`:`当前卡：${works.find(work=>work.id===active)?.title??'无'}`}</p><footer>示例摘要仅存在于当前预览内存。封面版权与来源见 examples/SOURCES.md。</footer></main>;
}
const container=document.getElementById('root');
if(!container)throw new Error('预览容器不存在。');
createRoot(container).render(<Preview/>);
