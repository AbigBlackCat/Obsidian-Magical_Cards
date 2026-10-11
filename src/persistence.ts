import { type App, type TFile, type MarkdownView } from 'obsidian';
import type { Work } from './types';
const marker = (key: string, edge: 'start' | 'end') => `<!-- barry:${key}:${edge} -->`;
export function managedContent(text: string, key: string): string {
  const start = text.indexOf(marker(key, 'start')), end = text.indexOf(marker(key, 'end'));
  return start >= 0 && end > start ? text.slice(start + marker(key, 'start').length, end).trim() : '';
}
export function replaceManaged(text: string, key: string, content: string): string {
  const begin = marker(key, 'start'), end = marker(key, 'end');
  const starts = text.split(begin).length - 1, ends = text.split(end).length - 1;
  if (starts !== ends || starts > 1) throw new Error('笔记区块标记不完整，请先在原生编辑器修复后重试。');
  const block = `${begin}\n${content.trim()}\n${end}`;
  if (!starts) return `${text.trimEnd()}\n\n${block}\n`;
  const from = text.indexOf(begin), to = text.indexOf(end, from);
  if (to < from) throw new Error('笔记区块顺序异常，请在原生编辑器修复。');
  return text.slice(0, from) + block + text.slice(to + end.length);
}
export function appendEntry(text: string, key: string, heading: string, entry: string): string {
  const previous = managedContent(text, key);
  return replaceManaged(text, key, previous ? `${previous}\n\n${entry}` : `${heading}\n\n${entry}`);
}
export function sourceMarkdown(entity: Work): string {
  const safe = (v: string) => v.replace(/<!--/g, '&lt;!--');
  if (entity.type === 'book' && entity.sourceId) return `## 微信读书来源\n\n作者：${safe(entity.author)} · 进度：${entity.progress}%\n\n${entity.notes.map(n => `### ${safe(n.chapter || (n.kind === 'highlight' ? '划线' : '来源想法'))}${n.date ? ` · ${n.date.slice(0,10)}` : ''}\n\n${n.quote ? `> ${safe(n.quote).replace(/\n/g, '\n> ')}\n\n` : ''}${safe(n.text)}`).join('\n\n')}`;
  return '';
}
export function entityFields(entity: Work): Record<string, unknown> {
  const {id,type,title,path: _path,body: _body,revision:_revision,createdAt,updatedAt,...data} = entity;
  return {bw_id:id,bw_type:type,bw_title:title,bw_created:createdAt,bw_updated:updatedAt,bw_data:data,
    ...((type==='book'||type==='film')?{bw_cover:entity.cover}:{})};
}
export function coverPath(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text=value.trim(),link=text.match(/^!?\[\[([\s\S]*?)\]\]$/);
  if(link)return link[1].split('|',1)[0].split('#',1)[0].trim();
  if(!text.startsWith('![')||!text.endsWith(')'))return text;
  let start=-1,brackets=1;
  for(let i=2;i<text.length;i++){
    if(text[i]==='\\'){i++;continue;}
    if(text[i]==='[')brackets++;
    if(text[i]===']'&&!--brackets){if(text[i+1]==='(')start=i+2;break;}
  }
  if(start<0)return text;
  const body=text.slice(start,-1).trimStart();let end=0,depth=0;
  const angled=body.startsWith('<');
  for(end=angled?1:0;end<body.length;end++){
    const char=body[end];
    if(char==='\\'){if(end+1>=body.length)return text;end++;continue;}
    if(angled){if(char==='>')break;if(char==='<'||char==='\n'||char==='\r')return text;}
    else{
      if(/\s/.test(char))break;
      if(char==='(')depth++;
      if(char===')'&&--depth<0)return text;
    }
  }
  if(depth||angled&&body[end]!=='>')return text;
  const tail=body.slice(end+(angled?1:0)).trim();
  if(tail&&!/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/s.test(tail))return text;
  let path=body.slice(angled?1:0,end).replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,'$1');
  if(!/^[a-z][a-z\d+.-]*:/i.test(path))try{path=decodeURIComponent(path);}catch{/* Keep a literal filename when its percent encoding is malformed. */}
  return path;
}
export function entityFromFields(fm: Record<string, unknown>, path: string, text: string): Work | null {
  if (typeof fm.bw_id !== 'string' || !['book','film'].includes(yamlText(fm.bw_type))) return null;
  if (!fm.bw_data || typeof fm.bw_data !== 'object' || Array.isArray(fm.bw_data)) throw new Error('实体属性不完整');
  const data={...fm.bw_data as Record<string,unknown>};
  if(fm.bw_type==='book'||fm.bw_type==='film'){
    if(data.moduleId!==undefined&&(typeof data.moduleId!=='string'||!data.moduleId.trim()))throw new Error('卡片所属模块无效。');
    if(data.cardTitleAlign === undefined)data.cardTitleAlign='left';
    if(data.cardSummaryAlign === undefined)data.cardSummaryAlign='left';
    if(typeof data.rating==='string'){
      const rating=data.rating.trim();
      if(!rating)data.rating=null;
      else if(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(rating))data.rating=Number(rating);
    }
    if(typeof data.pinned==='string'){
      const pinned=data.pinned.trim().toLowerCase();
      if(pinned==='true'||pinned==='false')data.pinned=pinned==='true';
    }
  }
  return {...data,
    ...((fm.bw_type==='book'||fm.bw_type==='film')?{cover:coverPath(Object.hasOwn(fm,'bw_cover')?fm.bw_cover:(fm.bw_data as Record<string,unknown>).cover)}:{}),
    id:fm.bw_id,type:fm.bw_type,title:yamlText(fm.bw_title || '未命名'),path,
    createdAt:yamlText(fm.bw_created || ''),updatedAt:yamlText(fm.bw_updated || ''),body:managedContent(text,'details'),revision:contentRevision(text)} as Work;
}
// Historical metadata uses native String coercion, including YAML aliases and custom scalar values.
// Keep that behavior at one checked boundary rather than rejecting previously readable notes.
function yamlText(value: unknown): string {
  const text: unknown = Reflect.apply(String, undefined, [value]);
  if (typeof text !== 'string') throw new Error('笔记属性文字转换失败。');
  return text;
}
export function contentRevision(text:string):string { let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `${text.length}:${a>>>0}:${b>>>0}`; }
export function validFolder(path: string): boolean {
  const deviceName=/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i;
  return Boolean(path.trim()) && !path.startsWith('/') && !/[\\:*?"<>|]/.test(path) && !Array.from(path).some(char => char.charCodeAt(0) < 32)
    && path.split('/').every(s => s && s !== '.' && s !== '..' && !s.startsWith('.') && !/[. ]$/.test(s) && !deviceName.test(s));
}
export function safeFilePart(value: string): string { return Array.from(value, char => char.charCodeAt(0) < 32 || '\\/:*?"<>|#[]'.includes(char) ? '-' : char).join('').replace(/\s+/g, ' ').trim().slice(0,70) || '未命名'; }

export async function prepareNativeWrite(app: App, file: TFile, active: () => void = () => {}): Promise<(text: string) => void> {
  const views = () => app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view as MarkdownView).filter(view => view.file?.path === file.path);
  const assertCurrent = (text: string) => { if (views().some(view => view.getViewData() !== text)) throw new Error('原生正文或磁盘内容已变化，草稿已保留，请等待原生保存完成后重试。'); };
  for (let attempt = 0; attempt <= 14; attempt++) {
    const disk = await app.vault.read(file); active();
    const buffers = views().map(view => view.getViewData());
    if (new Set(buffers).size > 1) throw new Error('同一笔记的编辑窗口内容不一致，请先统一各窗口草稿后重试。');
    if (buffers.every(buffer => buffer === disk)) return assertCurrent;
    if (attempt < 14) await new Promise(resolve => app.workspace.containerEl.win.setTimeout(resolve, 250));
  }
  throw new Error('等待原生正文保存超时，草稿与磁盘内容均已保留，请先完成原生保存或协调外部修改后重试。');
}
