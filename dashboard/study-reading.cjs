'use strict';
const {renderMarkdown}=require('./inert-markdown.cjs');
const {referenceMetadata}=require('./reading-metadata.cjs');
const {safePaperPath,verifiedPaperFile}=require('./paper-navigation.cjs');
const COMPILED_READING_FOLDERS=Object.freeze(['Literature','Datasets','Policies','Methods','Theories','Analyses','Topics','Comparisons','Queries']);
const ESSENTIAL_SECTIONS=Object.freeze(['Essential finding','Population and comparison','Key result','Main limitation','Relevance to question']);
function readingSections(raw){
 const body=String(raw||'').replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').replace(/<!--[\s\S]*?(?:-->|$)/g,'');
 const result=[];let fence=null,current;
 for(const line of body.split(/\r?\n/)){const f=/^ {0,3}(`{3,}|~{3,})/.exec(line);if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;continue}if(fence)continue;const h=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);if(h){current={level:h[1].length,title:h[2],lines:[]};result.push(current)}else if(current)current.lines.push(line)}
 return result.map(s=>({...s,text:s.lines.join('\n').trim()}));
}
function essentialSummary(raw){
 const all=readingSections(raw),start=all.findIndex(s=>s.level===2&&s.title.toLowerCase()==='essential study summary'),found=[];
 if(start>=0)for(const s of all.slice(start+1)){if(s.level<=2)break;if(s.level===3)found.push(s)}
 const sections=ESSENTIAL_SECTIONS.map(label=>{const hits=found.filter(s=>s.title.toLowerCase()===label.toLowerCase()),text=hits.length===1?hits[0].text:'';return {label,text:/^(?:pending\b|not (?:recorded|prepared|available)\b|\*\*Required work)/i.test(text)?'':text}});
 const declared=referenceMetadata(raw).summary_status;
 const status=declared==='insufficient-evidence'?'insufficient-evidence':declared!==undefined&&declared!=='prepared'?'pending':sections.every(s=>s.text)?'prepared':'pending';
 return {status,sections};
}
function readingPath(path,kind){return safePaperPath(path,kind,'.md')}
async function resolveEssentialSummary(app,paper,sidecars=[]){
 const pending=reason=>({...essentialSummary(''),reason});
 if(!COMPILED_READING_FOLDERS.some(k=>readingPath(paper.path,k)))return pending('Current compiled record unavailable');
 let raw;try{const file=await verifiedPaperFile(app,paper.path);if(!file||file.stat?.size>1024*1024)return pending('Current compiled record unavailable');raw=await app.vault.read(file);if(typeof raw!=='string'||Buffer.byteLength(raw)>1024*1024)return pending('Current compiled record exceeds read limit')}catch{return pending('Current compiled record unavailable')}
 // The shared content parser validates the latest collector-owned revision. No stale revision fallback.
 const own=/^<!-- collector-owned:v1 -->$/m.test(raw)?pending('Collector-owned essential summary requires a separately hash-bound draft'):essentialSummary(raw);if(own.status==='prepared')return {...own,path:paper.path};
 const matches=sidecars.filter(s=>readingPath(s.path,'Review/readability-pilot')&&referenceMetadata(s.text).target_path===paper.path);
 if(!matches.length)return own;if(matches.length!==1)return pending('Multiple essential-summary sidecars; no draft selected');
 const side=matches[0],m=referenceMetadata(side.text),sha=require('node:crypto').createHash('sha256').update(raw,'utf8').digest('hex');
 if(!['study-reading','study-essential-summary'].includes(m.type)||m.review_status!=='economist-review-needed'||!/^[a-f0-9]{64}$/.test(m.target_sha256||'')||m.target_sha256!==sha)return pending('Essential-summary draft stale or invalid; exact current note hash required');
 return {...essentialSummary(side.text),path:side.path,questions:(Array.isArray(m.questions)?m.questions:[]).filter(p=>readingPath(p,'Questions')),reason:'Hash-bound draft; byte integrity is not scientific validation or economist approval'};
}
function renderEssentialSummary(area,result){
 area.createEl('h4',{text:'Essential study summary'});if(result.status!=='prepared')area.createEl('p',{text:result.status==='insufficient-evidence'?'Essential study summary: insufficient evidence — not prepared; recorded fields are draft context only.':'Essential study summary pending — no abstract or recorded-summary excerpt substituted.'});
 for(const s of result.sections.filter(s=>s.text)){area.createEl('h6',{text:s.label==='Population and comparison'?'Scope / identification (population and comparison)':s.label});renderMarkdown(area,s.text)}if(result.path)area.createEl('small',{text:'Recorded in: '+result.path});if(result.reason)area.createEl('small',{text:result.reason});
}
function renderReadingContent(area,result){
 for(const key of ['summary','abstract']){const item=result[key],label=key==='abstract'?'Published abstract':item.label||'Recorded summary';const panel=area.createEl('details');panel.open=false;panel.createEl('summary',{text:label+' — expand full text'});const text=item.text||(key==='abstract'?'Published abstract not recorded / pending.':'LLM summary not recorded / pending.');renderMarkdown(panel,text.slice(0,600)+(text.length>600?'…':''));if(text.length>600){const full=panel.createEl('details');full.open=false;full.createEl('summary',{text:'Read complete stored text'});renderMarkdown(full,text)}const m=item.metadata||result.metadata||{};panel.createEl('small',{text:'Recorded in: '+(item.path||result.path)+' · Evidence scope: '+(m.evidence_scope||m.evidence_read||'not recorded')+' · Model: '+(m.summary_model||'not recorded')+' · Date: '+(m.summary_date||'not recorded')+' · Draft; economist review required.'})}if(result.reason)area.createEl('small',{text:result.reason});
}
const IDEA_RELATIONS=Object.freeze(['supports','challenges','qualifies','mechanism','measurement','same-cohort','unresolved','developed-by','contextualized-by','qualified-by','continues','supported-by']);
function workspacePath(path){return ['Ideas','Questions','Review/readability-pilot'].some(k=>readingPath(path,k))}
function readingRecord(note){
 const m=referenceMetadata(note.text),list=k=>Array.isArray(m[k])?m[k].slice(0,100):[],safeTarget=p=>[...COMPILED_READING_FOLDERS,'Ideas','Questions','Sources','Review/readability-pilot'].some(k=>readingPath(p,k));
 const kind=readingPath(note.path,'Ideas')?'idea':'question';if(m.type!==kind)return null;
 return {...note,kind,title:typeof m.title==='string'&&m.title.trim()?m.title:(note.text.match(/^#\s+(.+)$/m)||[])[1]||'Title not recorded',sections:readingSections(note.text),questions:list('questions').filter(p=>readingPath(p,'Questions')),relations:list('relations').filter(r=>r&&safeTarget(r.target)&&IDEA_RELATIONS.includes(r.type)&&typeof r.explanation==='string'&&!!r.explanation.trim()&&r.explanation.length<=4000).map(r=>({...r,status:r.status==='recorded'?'recorded':'suggested'})),evidence:list('evidence_records').filter(e=>e&&safeTarget(e.path)&&['id','version','locator','quote'].every(k=>typeof e[k]==='string'&&e[k].trim()&&e[k].length<=16000)&&/^[a-f0-9]{64}$/.test(e.sha256||'')),review_status:typeof m.review_status==='string'?m.review_status:'unreviewed'};
}
async function scanReadingWorkspace(app,{maxFiles=5000,maxBytes=32*1024*1024,maxFileBytes=256*1024}={}){
 const files=app.vault.getMarkdownFiles().filter(f=>workspacePath(f.path)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),result={ideas:[],questions:[],sidecars:[],truncated:files.length>maxFiles,skipped:0,bytes:0};
 for(const candidate of files.slice(0,maxFiles)){try{const file=await verifiedPaperFile(app,candidate.path);if(!file||file.stat?.size>maxFileBytes){result.skipped++;continue}const text=await app.vault.read(file),size=Buffer.byteLength(text,'utf8');if(size>maxFileBytes){result.skipped++;continue}if(result.bytes+size>maxBytes){result.truncated=true;break}result.bytes+=size;const note={path:file.path,text};if(readingPath(file.path,'Review/readability-pilot'))result.sidecars.push(note);else{const record=readingRecord(note);if(record)result[record.kind==='idea'?'ideas':'questions'].push(record);else result.skipped++}}catch{result.skipped++}}
 return result;
}
async function verifyReadingEvidence(app,evidence,{maxRecords=100,maxFileBytes=1024*1024,maxBytes=4*1024*1024}={}){
 const result=[];let bytes=0;const cache=new Map();
 for(const [i,e]of evidence.entries()){
  const row={...e,status:'missing',reason:'Current record missing, unreadable or blocked by filesystem safety checks'};
  if(i>=maxRecords){result.push({...row,status:'limit',reason:'Current check not performed: evidence-count limit'});continue}
  if(![...COMPILED_READING_FOLDERS,'Sources','Ideas','Questions','Review/readability-pilot'].some(k=>readingPath(e.path,k))){result.push({...row,status:'unsafe',reason:'Unsafe evidence path; not read'});continue}
  try{
   let raw=cache.get(e.path);
   if(raw===undefined){const file=await verifiedPaperFile(app,e.path);if(!file){result.push(row);continue}if(file.stat?.size>maxFileBytes){result.push({...row,status:'limit',reason:'Current record exceeds read limit'});continue}raw=await app.vault.read(file);if(typeof raw!=='string'){result.push(row);continue}const size=Buffer.byteLength(raw,'utf8');if(size>maxFileBytes||bytes+size>maxBytes){result.push({...row,status:'limit',reason:'Current record check exceeds byte limit'});continue}bytes+=size;cache.set(e.path,raw)}
   row.current_sha256=require('node:crypto').createHash('sha256').update(raw,'utf8').digest('hex');row.hashMatched=row.current_sha256===e.sha256;
   const range=/\(lines (\d+)[–-](\d+)\)$/.exec(e.locator||''),lines=raw.split(/\r?\n/),start=range?Number(range[1]):0,end=range?Number(range[2]):0;
   const scope=range&&start>=1&&end>=start&&end<=lines.length?lines.slice(start-1,end).join('\n'):range?'':raw;
   row.quoteMatched=typeof e.quote==='string'&&!!e.quote&&scope.includes(e.quote);row.locatorChecked=!!range;
   row.status=!row.hashMatched?'stale':!row.quoteMatched?'quote-missing':'matched';row.reason=!row.hashMatched?'Stale binding — whole current record hash differs':!row.quoteMatched?'Exact quote missing from current record / recorded line range':'Current hash + exact quote match'+(range?' in recorded line range':' in record; free-text locator not verified');result.push(row);
  }catch{result.push(row)}
 }
 return result;
}
module.exports={essentialSummary,resolveEssentialSummary,renderEssentialSummary,renderReadingContent,scanReadingWorkspace,verifyReadingEvidence,IDEA_RELATIONS};
