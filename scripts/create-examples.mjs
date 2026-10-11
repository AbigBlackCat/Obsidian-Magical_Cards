import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {stringify} from 'yaml';
const root=new URL('../examples/vault/',import.meta.url);
const demoConfigDir='.obsidian';
const covers=JSON.parse(await readFile(new URL('../examples/covers.json',import.meta.url),'utf8'));
for(const item of covers){
 const folder=item.type==='book'?'书籍':'观影';await mkdir(new URL(`示例/${folder}/`,root),{recursive:true});
 const data=item.type==='book'?{sourceId:'',author:'',progress:0,lastRead:'',status:'want',notes:[],deepLink:'',summary:'',rating:null,pinned:false}:{director:'',year:'',date:'',status:'want',summary:'',rating:null,pinned:false,link:''};
 const fields={bw_id:item.id,bw_type:item.type,bw_title:item.title,bw_created:'2026-10-11T00:00:00.000Z',bw_updated:'2026-10-11T00:00:00.000Z',bw_cover:`示例/附件/${item.cover}`,bw_data:{...data,cover:`示例/附件/${item.cover}`}};
 await writeFile(new URL(`示例/${folder}/${item.id}.md`,root),`---\n${stringify(fields)}---\n\n# ${item.title}\n`);
 if(item.type==='film')await rm(new URL(`示例/影视/${item.id}.md`,root),{force:true});
}
const template=await readFile(new URL('../examples/Magical_Cards示例及用法说明.md',import.meta.url),'utf8');
const text=template.replace(/\{\{([^}]+)\}\}/g,(_match,key)=>key==='rootFolder'?'示例':`demo-${key}`);
await writeFile(new URL('Magical_Cards示例及用法说明.md',root),text);
await rm(new URL('卡片布局示例.md',root),{force:true});
const appearance={material:'paper',style:'cover',layout:'cylinder',ratio:'2:3',imageFit:'cover'};
await mkdir(new URL('示例/_数据/',root),{recursive:true});
await writeFile(new URL('示例/_数据/卡片配置.md',root),`---\n${stringify({bw_view:'cards-config',bw_card_settings:{bookCardAppearance:appearance,filmCardAppearance:appearance,customModules:[],threeCardView:true,workbenchText:{'book.title':'阅读','film.title':'影视'},standaloneOrder:[],workbenchCards:[]}})}---\n\n# 卡片配置\n`);
await mkdir(new URL(`${demoConfigDir}/plugins/magical-cards/`,root),{recursive:true});
await writeFile(new URL(`${demoConfigDir}/plugins/magical-cards/data.json`,root),JSON.stringify({rootFolder:'示例',installationOrigin:'legacy'},null,2)+'\n');
await rm(new URL(`${demoConfigDir}/plugins/barry-cards/`,root),{recursive:true,force:true});
await writeFile(new URL(`${demoConfigDir}/community-plugins.json`,root),'["magical-cards"]\n');
await writeFile(new URL(`${demoConfigDir}/app.json`,root),JSON.stringify({livePreview:true},null,2)+'\n');
process.stdout.write(`${covers.length} isolated Magical Cards example notes generated\n`);
