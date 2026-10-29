'use strict';

const COMPILED_PAPER_FOLDERS=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'];
// Restricted frontmatter reader: navigation scalars and source lists only, never executable YAML.
function paperFrontmatter(raw){
 const front=(String(raw||'').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)||[])[1]||'';
 const scalar=s=>{s=s.trim();if(s.startsWith('"')){try{return JSON.parse(s.replace(/\s+#.*$/,''))}catch{return ''}}if(s.startsWith("'"))return s.replace(/^'|'(?:\s+#.*)?$/g,'').replace(/''/g,"'");return s.replace(/\s+#.*$/,'').trim()};
 const out=Object.create(null);let key='';
 for(const line of front.split(/\r?\n/)){const pair=line.match(/^([a-z_][\w-]*):\s*(.*)$/i);if(pair){key=pair[1];const value=pair[2].trim();out[key]=key==='sources'?(value.startsWith('[')?value.replace(/^\[|\](?:\s+#.*)?$/g,'').split(',').map(scalar):[]):scalar(value);continue}const item=line.match(/^\s+-\s+(.*)$/);if(item&&key==='sources')out.sources.push(scalar(item[1]))}
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
async function paperMetadata(app,file,raw){
 const cached=app.metadataCache?.getFileCache?.(file)?.frontmatter;
 return cached||paperFrontmatter(raw??await app.vault.cachedRead(file));
}
async function resolvePaperActions(app,paper){
 if(!COMPILED_PAPER_FOLDERS.some(f=>safePaperPath(paper.path,f,'.md')))return [];
 const wiki=await verifiedPaperFile(app,paper.path);if(!wiki)return [];
 const actions=[{label:'Open wiki note',kind:'wiki',target:paper.path}],seen=new Set();
 const add=(label,kind,target)=>{if(target&&!seen.has(kind+target)){seen.add(kind+target);actions.push({label,kind,target})}};
 const metadata=await paperMetadata(app,wiki,paper.raw);
 const urls=m=>{add('Open publisher/source URL','external',paperURL(m.source_url));add('Open DOI','external',paperURL(m.doi,true))};urls(metadata);
 const sources=Array.isArray(metadata.sources)?metadata.sources:[];
 const links=[...(paper.raw||'').matchAll(/\[\[(economy_wiki\/Sources\/[^\]|#]+)(?:[^\]]*)\]\]/g)].map(m=>m[1]);
 for(let target of [...sources,...links]){
  if(typeof target!=='string')continue;target=target.replace(/^\[\[([^\]|#]+)(?:[^\]]*)\]\]$/,'$1');if(!target.endsWith('.md'))target+='.md';
  if(!safePaperPath(target,'Sources','.md'))continue;const file=await verifiedPaperFile(app,target);if(!file)continue;
  add('Open source record','source',target);const m=await paperMetadata(app,file);urls(m);
  if(typeof m.raw_path!=='string'||!m.raw_path.startsWith('raw/'))continue;
  const raw='economy_wiki/'+m.raw_path;
  if(safePaperPath(raw,'raw','.pdf')&&await verifiedPaperFile(app,raw))add('Open stored original PDF','pdf',raw);
 }
 return actions;
}
async function openPaperAction(app,action,external){
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
module.exports={resolvePaperActions,openPaperAction};
