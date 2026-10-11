import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {stringify} from 'yaml';
const root=new URL('../examples/vault/',import.meta.url);
const covers=JSON.parse(await readFile(new URL('../examples/covers.json',import.meta.url),'utf8'));
for(const item of covers){
 const folder=item.type==='book'?'书籍':'影视';await mkdir(new URL(`示例/${folder}/`,root),{recursive:true});
 const data=item.type==='book'?{sourceId:'',author:'',progress:0,lastRead:'',status:'want',notes:[],deepLink:'',summary:'',rating:null,pinned:false}:{director:'',year:'',date:'',status:'want',summary:'',rating:null,pinned:false,link:''};
 const fields={bw_id:item.id,bw_type:item.type,bw_title:item.title,bw_created:'2026-10-11T00:00:00.000Z',bw_updated:'2026-10-11T00:00:00.000Z',bw_cover:`示例/附件/${item.cover}`,bw_data:{...data,cover:`示例/附件/${item.cover}`}};
 await writeFile(new URL(`示例/${folder}/${item.id}.md`,root),`---\n${stringify(fields)}---\n\n# ${item.title}\n`);
}
const layouts=['coverflow-carousel','album-rail','scroll-bend','skewed-carousel'];
let text='# Barry Cards 布局示例\n\n安装插件后，将卡片目录设为「示例」。8 张封面均使用本地资源，可断网查看。点击模块标题前的手柄可拖动排序，也可用 Alt + ↑ / ↓。\n';
for(const layout of layouts)text+=`\n## ${layout}\n\n\`\`\`barry-cards\nid: demo-${layout}\nmodules:\n  - id: demo-books-${layout}\n    collection: book\n    layout: ${layout}\n  - id: demo-films-${layout}\n    collection: film\n    layout: ${layout}\n\`\`\`\n`;
text+='\n## 竖向弯曲画廊\n\n```barry-cards\nid: demo-scroll-bend-vertical\nmodules:\n  - id: demo-books-vertical\n    collection: book\n    layout: scroll-bend\n    orientation: vertical\n```\n';
await writeFile(new URL('卡片布局示例.md',root),text);
await mkdir(new URL('.obsidian/plugins/barry-cards/',root),{recursive:true});
await writeFile(new URL('.obsidian/plugins/barry-cards/data.json',root),JSON.stringify({rootFolder:'示例'},null,2)+'\n');
await writeFile(new URL('.obsidian/community-plugins.json',root),'["barry-cards"]\n');
await writeFile(new URL('.obsidian/app.json',root),JSON.stringify({livePreview:true},null,2)+'\n');
console.log('8 isolated example notes generated');
