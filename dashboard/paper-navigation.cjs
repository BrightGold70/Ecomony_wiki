'use strict';

const COMPILED_PAPER_FOLDERS=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'];
// Restricted frontmatter reader: navigation scalars and source lists only, never executable YAML.
function paperFrontmatter(raw){
 const front=(String(raw||'').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)||[])[1]||'';
 const scalar=s=>{s=s.trim();if(s.startsWith('"')){try{return JSON.parse(s.replace(/\s+#.*$/,''))}catch{return ''}}if(s.startsWith("'"))return s.replace(/^'|'(?:\s+#.*)?$/g,'').replace(/''/g,"'");return s.replace(/\s+#.*$/,'').trim()};
 const out=Object.create(null);let key='';
 for(const line of front.split(/\r?\n/)){const pair=line.match(/^([a-z_][\w-]*):\s*(.*)$/i);if(pair){key=pair[1];const value=pair[2].trim();out[key]=['sources','related_versions'].includes(key)?(value.startsWith('[')?value.replace(/^\[|\](?:\s+#.*)?$/g,'').split(',').map(scalar):[]):scalar(value);continue}const item=line.match(/^\s+-\s+(.*)$/);if(item&&['sources','related_versions'].includes(key))out[key].push(scalar(item[1]))}
 const loc=front.match(/^evidence_locators:[ \t]*(.*)$/m);if(loc){let items=[];if(loc[1].trim()){try{const parsed=JSON.parse(loc[1]);if(Array.isArray(parsed))items=parsed}catch{}}else{const block=front.slice(loc.index+loc[0].length).split(/\r?\n(?=\S)/)[0];let item;for(const line of block.split(/\r?\n/)){const pair=line.match(/^\s+(-\s+)?(source_path|locator|pdf_page|pdf_page_verified):\s*(.*)$/);if(!pair)continue;if(pair[1]){item={};items.push(item)}if(item){const v=pair[3].trim();item[pair[2]]=pair[2]==='pdf_page'&&/^[1-9]\d*$/.test(v)?Number(v):pair[2]==='pdf_page_verified'&&v==='true'?true:scalar(v)}}}out.evidence_locators=items;}
 return out;
}
// Never normalize untrusted paths: reject traversal, link syntax and hidden/private folders.
function safePaperPath(value,folder,extension){
 return typeof value==='string'&&value.startsWith('economy_wiki/'+folder+'/')&&value.toLowerCase().endsWith(extension)&&!/[\\%\x00-\x1f\x7f:#?|\[\]]/.test(value)&&value.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!s.startsWith('.')&&!/^(private|personal|secrets)$/i.test(s));
}
async function verifiedPaperFile(app,target){
 const file=app.vault.getAbstractFileByPath?.(target);if(!file||file.path!==target||file.children)return null;
 try{
  const adapter=app.vault.adapter;
  if(adapter?.stat){const stat=await adapter.stat(target);if(!stat||stat.type!=='file'||stat.isSymbolicLink===true||stat.symlink)return null}
  // Desktop adapters expose the filesystem root. Check every component, not just the leaf.
  if(adapter?.getBasePath){
   const fs=require('node:fs'),path=require('node:path'),base=path.resolve(adapter.getBasePath());let current=path.parse(base).root;
   for(const part of base.slice(current.length).split(path.sep).filter(Boolean).concat(target.split('/'))){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())return null}
   if(!fs.statSync(current).isFile()||!fs.realpathSync(current).startsWith(fs.realpathSync(base)+path.sep))return null;
  }
  return file;
 }catch{return null}
}
function paperURL(value,isDOI=false){
 if(typeof value!=='string'||value!==value.trim()||/[\x00-\x20\\]/.test(value))return null;
 let target=value;if(isDOI&&/^10\.\d{4,9}\/[^\s]+$/i.test(value))target='https://doi.org/'+value;
 if(!/^https?:\/\//i.test(target))return null;
 try{const url=new URL(target);if(!url.hostname||url.username||url.password)return null;return target}catch{return null}
}
async function paperText(app,file){
 // Read current bytes only, after path/filesystem verification. Caches and
 // indexed paper.raw must never authorize a recorded PDF-page confirmation.
 try{return await app.vault.read(file)}catch{return ''}
}
function recordedLocators(metadata){return (Array.isArray(metadata?.evidence_locators)?metadata.evidence_locators:[]).filter(e=>e&&typeof e==='object'&&safePaperPath(e.source_path,'Sources','.md')&&typeof e.locator==='string'&&e.locator.trim()&&e.locator.length<=1000).map(e=>({sourcePath:e.source_path,locator:e.locator,page:Number.isSafeInteger(e.pdf_page)&&e.pdf_page>0&&e.pdf_page_verified===true?e.pdf_page:null}))}
async function resolvePaperActions(app,paper){
 if(!COMPILED_PAPER_FOLDERS.some(f=>safePaperPath(paper.path,f,'.md')))return [];
 const wiki=await verifiedPaperFile(app,paper.path);if(!wiki)return [];
 const actions=[{label:'Open wiki note',kind:'wiki',target:paper.path}],seen=new Set();
 const add=(label,kind,target)=>{if(target&&!seen.has(kind+target)){seen.add(kind+target);actions.push({label,kind,target})}};
 const text=await paperText(app,wiki),metadata=paperFrontmatter(text);
 const urls=m=>{add('Open publisher/source URL','external',paperURL(m.source_url));add('Open DOI','external',paperURL(m.doi,true))};urls(metadata);
 const sources=Array.isArray(metadata.sources)?metadata.sources:[];
 const links=[...text.matchAll(/\[\[(economy_wiki\/Sources\/[^\]|#]+)(?:[^\]]*)\]\]/g)].map(m=>m[1]);
 for(let target of [...sources,...links]){
  if(typeof target!=='string')continue;target=target.replace(/^\[\[([^\]|#]+)(?:[^\]]*)\]\]$/,'$1');if(!target.endsWith('.md'))target+='.md';
  if(!safePaperPath(target,'Sources','.md'))continue;const file=await verifiedPaperFile(app,target);if(!file)continue;
  add('Open source record','source',target);const m=paperFrontmatter(await paperText(app,file));urls(m);
  if(typeof m.raw_path!=='string'||!m.raw_path.startsWith('raw/'))continue;
  const raw='economy_wiki/'+m.raw_path;
  if(safePaperPath(raw,'raw','.pdf')&&await verifiedPaperFile(app,raw)){add('Open stored original PDF','pdf',raw);for(const e of recordedLocators(metadata).filter(e=>e.sourcePath===target&&e.page!==null))actions.push({label:'Open recorded PDF page '+e.page+' — '+e.locator,kind:'pdf-page',target:raw,page:e.page,locator:e.locator,notePath:paper.path,sourcePath:target})}
 }
 return actions;
}
async function openPaperAction(app,action,external){
 if(action.kind==='pdf-page'){if(!Number.isSafeInteger(action.page)||action.page<1||!safePaperPath(action.target,'raw','.pdf'))return false;const current=await resolvePaperActions(app,{path:action.notePath});if(!current.some(a=>a.kind==='pdf-page'&&['target','page','locator','sourcePath'].every(k=>a[k]===action[k])))return false;await app.workspace.openLinkText(action.target+'#page='+action.page,'','split');return true}
 if(action.kind==='external'){
  if(!paperURL(action.target))return false;
  if(external)await external(action.target);
  else{let shell;try{shell=require('electron').shell}catch{}if(shell?.openExternal)await shell.openExternal(action.target);else if(typeof window!=='undefined')window.open(action.target,'_blank','noopener,noreferrer');else return false}
  return true;
 }
 const folder={wiki:COMPILED_PAPER_FOLDERS,source:['Sources'],pdf:['raw']}[action.kind];
 if(!folder?.some(f=>safePaperPath(action.target,f,action.kind==='pdf'?'.pdf':'.md'))||!await verifiedPaperFile(app,action.target))return false;
 // Obsidian Workspace.openLinkText accepts PaneType | boolean; 'split' retains the dashboard.
 await app.workspace.openLinkText(action.target,'','split');return true;
}
module.exports={resolvePaperActions,openPaperAction,paperFrontmatter,recordedLocators};
