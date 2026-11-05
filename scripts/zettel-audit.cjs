'use strict';
// Local mechanical inspection only. Never edits the vault or calls a provider.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const {IDEA_RELATIONS,essentialSummary}=require('../dashboard/study-reading.cjs');
// Reader vocabulary plus explicit native record types; never infer relation semantics.
const AUDIT_RELATIONS=new Set([...IDEA_RELATIONS,'derived-from','contextualizes','comments-on','summarizes','limits','addresses','informs']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function researchPath(p){return typeof p==='string'&&!/[\\\x00-\x1f#|\[\]]/.test(p)&&!p.split('/').some(x=>!x||x.startsWith('.')||['raw','private','credentials','secrets'].includes(x.toLowerCase()))&&/^economy_wiki\/(Sources|Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries|Ideas|Questions|Review)\/.+\.md$/.test(p);}
function metadata(text,only){const fm=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!fm)throw Error('Missing frontmatter');const m={};for(const line of fm[1].split(/\r?\n/)){const hit=/^([a-z_][a-z_0-9]*):[ \t]*(.*)$/.exec(line);if(!hit)continue;const [,k,v]=hit;if(only&&!only.includes(k))continue;if(Object.hasOwn(m,k))throw Error('Duplicate field: '+k);m[k]=v;if(/^[\[{"]/.test(v))m[k]=JSON.parse(v);else if(/^'.*'$/.test(v))m[k]=v.slice(1,-1);}return m;}
function auditVault(vault){
 const root=path.resolve(vault);noSymlinks(root);
 const coverage={notes_scanned:0,evidence_records:0,evidence_verified:0,hash_quote_verified:0,hashes_checked:0,quotes_checked:0,ranges_checked:0,ranges_unverified:0,versions_checked:0,versions_unverified:0,sidecars:0,summaries_prepared:0,targets_checked:0,drafts_pending:0,links_checked:0,unreadable:0,status:'no-records'};
 const findings=[],notes=[];const add=(code,p,detail)=>findings.push({code,path:p,detail});
 const read=p=>{if(!researchPath(p))throw Error('Unauthorized research Markdown path');return readSafe(path.join(root,p));};
 function walk(p){const full=path.join(root,p);if(!noSymlinks(full,true))return;for(const entry of fs.readdirSync(full,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const child=p+'/'+entry.name;if(!researchPath(child+(entry.isDirectory()?'/scope.md':''))){add('unsafe-path',child,'Excluded path');continue;}if(entry.isSymbolicLink()){coverage.unreadable++;add('unsafe-path',child,'Symlink denied');continue;}if(entry.isDirectory())walk(child);else if(entry.isFile()&&child.endsWith('.md')){try{const text=read(child).toString('utf8');coverage.notes_scanned++;notes.push({path:child,text,m:metadata(text)});}catch(e){coverage.unreadable++;add('invalid-note',child,e.message);}}}}
 for(const folder of ['Ideas','Questions','Review/readability-pilot'])walk('economy_wiki/'+folder);
 const sidecars=new Map();
 for(const n of notes){
  const kind=n.path.startsWith('economy_wiki/Ideas/')?'idea':n.path.startsWith('economy_wiki/Questions/')?'question':'sidecar';
  if(n.m.review_status==='economist-review-needed')coverage.drafts_pending++;else add('invalid-draft-state',n.path,'Expected explicit economist-review-needed; no approval authenticated');
  if(kind!=='sidecar'&&n.m.type!==kind)add('invalid-type',n.path,'Folder/type mismatch');
  const checkLink=(p,code,bodyLink=false)=>{coverage.links_checked++;try{let target=p;if(bodyLink&&typeof p==='string'&&!p.endsWith('.md')){if(!researchPath(p+'.md')||path.posix.extname(p)!=='')throw Error('Unauthorized extensionless research path');target=p+'.md';}read(target);return true;}catch(e){add(code,n.path,String(p)+': '+e.message);return false;}};
  const questions=Array.isArray(n.m.questions)?n.m.questions:[];let linked=false;
  if(!Array.isArray(n.m.questions))add('invalid-questions',n.path,'Expected JSON array');
  for(const q of questions){if(typeof q!=='string'||!q.startsWith('economy_wiki/Questions/')){add('broken-question-target',n.path,String(q));continue;}if(checkLink(q,'broken-question-target'))linked=true;}
  if(kind==='idea'&&!linked)add('unlinked-idea',n.path,'No resolvable explicit question link; no links invented');
  if(!Array.isArray(n.m.relations))add('invalid-relations',n.path,'Expected JSON array');
  for(const r of Array.isArray(n.m.relations)?n.m.relations:[]){checkLink(r?.target,'broken-relation-target');if(!r||!AUDIT_RELATIONS.has(r.type)||!['suggested','recorded'].includes(r.status)||typeof r.explanation!=='string'||!r.explanation.trim())add('invalid-relation',n.path,'Invalid typed relation/status/explanation');}
  if(kind==='question')for(const hit of n.text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').matchAll(/\[\[([^\]]+)\]\]/g))checkLink(hit[1],'broken-question-evidence-target',true);
  if(kind==='sidecar'){
   coverage.sidecars++;if(essentialSummary(n.text).status==='prepared')coverage.summaries_prepared++;else add('summary-pending',n.path,'One or more explicit essentials missing/pending; no excerpt substituted');if(!['study-essential-summary','study-reading'].includes(n.m.type))add('invalid-type',n.path,'Expected summary sidecar type');
   if(typeof n.m.target_path==='string'){const group=sidecars.get(n.m.target_path)||[];group.push(n);sidecars.set(n.m.target_path,group);}
   try{if(typeof n.m.target_path!=='string'||!researchPath(n.m.target_path)||!/^economy_wiki\/(Sources|Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\//.test(n.m.target_path))throw Error('Expected compiled category or Source target');const b=read(n.m.target_path);if(!/^[a-f0-9]{64}$/.test(n.m.target_sha256||''))throw Error('Missing target SHA256');coverage.targets_checked++;if(sha(b)!==n.m.target_sha256)add('stale-summary-target',n.path,n.m.target_path);}catch(e){add('invalid-summary-target',n.path,e.message);}
  }
  const records=Array.isArray(n.m.evidence_records)?n.m.evidence_records:[];
  if(!Array.isArray(n.m.evidence_records)||(kind!=='question'&&!records.length))add('missing-evidence',n.path,'Explicit evidence_records required; prose alone is not checked');
  coverage.evidence_records+=records.length;
  for(const e of records){try{
   if(!e||typeof e.id!=='string'||!e.id.trim())throw Error('Missing evidence ID');
   const issueCount=findings.length;
   const b=read(e.path);if(!/^[a-f0-9]{64}$/.test(e.sha256||''))throw Error('Missing or invalid evidence SHA256');coverage.hashes_checked++;if(sha(b)!==e.sha256){add('stale-evidence',n.path,e.path);continue;}
   if(typeof e.locator!=='string'||!e.locator.trim()||typeof e.quote!=='string'||!e.quote.trim())throw Error('Missing or invalid exact quote locator');
   const raw=b.toString('utf8'),range=/\(lines (\d+)[–-](\d+)\)$/.exec(e.locator),lines=raw.split(/\r?\n/),s=Number(range?.[1]),end=Number(range?.[2]);
   if(range&&(s<1||end<s||end>lines.length))throw Error('Missing or invalid exact quote locator');
   if(range)coverage.ranges_checked++;else{coverage.ranges_unverified++;add('quote-range-unverified',n.path,e.path+': descriptive locator; exact quote checked in whole record only');}
   coverage.quotes_checked++;const quoteMatched=(range?lines.slice(s-1,end).join('\n'):raw).includes(e.quote);if(!quoteMatched)add('quote-mismatch',n.path,e.path);else coverage.hash_quote_verified++;
   const m=raw.startsWith('---')?metadata(raw,['version_key','version']):{},v=e.version_locator;
   const located=v&&Number.isInteger(v.start_line)&&Number.isInteger(v.end_line)&&v.start_line>=1&&v.end_line>=v.start_line&&v.end_line<=lines.length&&typeof v.label==='string'&&v.label.trim()&&typeof e.version==='string'&&lines.slice(v.start_line-1,v.end_line).join('\n').includes(e.version);
   const hasVersion=typeof e.version==='string'&&!!e.version.trim(),inMetadata=hasVersion&&[m.version_key,m.version].includes(e.version);
   if(hasVersion&&(typeof m.version_key==='string'||typeof m.version==='string'||v))coverage.versions_checked++;
   if(!hasVersion||(!inMetadata&&!located)){coverage.versions_unverified++;add('version-unverifiable',n.path,e.path);}
   if(findings.length===issueCount)coverage.evidence_verified++;
  }catch(e){add('invalid-evidence',n.path,e.message);}}
 }
 for(const [target,group] of sidecars)if(group.length>1)add(new Set(group.map(n=>sha(n.text))).size===1?'duplicate-sidecars':'conflicting-sidecars',target,group.map(n=>n.path).join(', ')+'; no draft selected');
 coverage.status=coverage.notes_scanned?'local-records-only':'no-records';
 return {schema_version:1,mode:'read-only',coverage,findings,limits:['Local selected folders only; zero checked hashes means no evidence coverage.','Matching bytes and quotes do not prove scientific freshness, entailment, independence or economic approval.']};
}
function main(argv){const args={};for(let i=0;i<argv.length;i++){const k=argv[i];if(!['--vault','--out'].includes(k)||args[k]||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Usage: --vault ROOT [--out EXTERNAL_NEW_JSON]');args[k]=argv[++i];}if(!args['--vault'])throw Error('Required --vault');const root=path.resolve(args['--vault']);if(args['--out']){const out=path.resolve(args['--out']);noSymlinks(out,true);if(out===root||out.startsWith(root+path.sep))throw Error('Output must be outside vault');if(fs.existsSync(out))throw Error('Output exists');}const result=auditVault(root),json=JSON.stringify(result,null,2)+'\n';if(args['--out'])fs.writeFileSync(args['--out'],json,{flag:'wx'});else process.stdout.write(json);return result;}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={auditVault,main};
