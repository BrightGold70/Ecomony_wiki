const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Deliberately restricted frontmatter: scalar values and inline lists, no executable YAML.
function metadata(text){const front=(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)||[])[1]||'';return Object.fromEntries([...front.matchAll(/^([a-z_][a-z0-9_]*):[ \t]*([^\n]*)$/gm)].map(m=>[m[1],m[2].trim().replace(/^(["'])(.*)\1$/,'$2')]))}
function safeRaw(p){try{noSymlinks(p);return true}catch{return false}}
function dateOK(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
function lintWiki(vault){
 const root=path.join(path.resolve(vault),'economy_wiki'),issues=[];const add=(file,rule)=>issues.push({file,rule});let rawHashesChecked=0,externalSources=0;
 for(const n of ['SCHEMA.md','index.md','log.md'])if(!fs.existsSync(path.join(root,n)))add(n,'missing-lifecycle-file');
 noSymlinks(root);
 const index=fs.existsSync(path.join(root,'index.md'))?readSafe(path.join(root,'index.md')).toString('utf8'):'';
 function* walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.')||/^(private|personal|secrets)$/i.test(e.name)||e.isSymbolicLink())continue;const f=path.join(dir,e.name);if(e.isDirectory())yield* walk(f);else if(e.isFile())yield f;}}
 let checked=0;for(const folder of ['Sources','Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries']){
 const dir=path.join(root,folder);if(!fs.existsSync(dir)||fs.lstatSync(dir).isSymbolicLink())continue;
 for(const file of walk(dir)){if(!file.endsWith('.md'))continue;const rel=path.relative(root,file);checked++;const text=readSafe(file).toString('utf8'),m=metadata(text);
 const compiled=folder!=='Sources';const fields=compiled?['title','created','updated','type','tags','sources','review_status','evidence_kind','research_question',...(['causal','counterfactual'].includes(m.evidence_kind)?['identification_strategy','estimand']:[])]:['title','type','source_mode'];
 for(const key of fields)if(!(key in m))add(rel,'missing-field:'+key);else if(!m[key]||m[key]==='[]'&&key==='sources')add(rel,'empty-field:'+key);
 if(compiled){for(const key of ['created','updated'])if(key in m&&!dateOK(m[key]))add(rel,'invalid-date:'+key);
 if(m.evidence_kind&&!['descriptive','causal','theoretical','counterfactual','reproduced'].includes(m.evidence_kind))add(rel,'invalid-evidence-kind');
 if(m.type&&!['summary','concept','comparison','query','literature','topic','dataset','policy','method','theory','analysis'].includes(m.type))add(rel,'invalid-type');
 if(m.review_status&&!['economist-review-needed','economist-reviewed'].includes(m.review_status))add(rel,'invalid-review-status');
 if(m.review_status==='economist-reviewed'&&(!m.reviewer||!dateOK(m.reviewed_date)||!m.review_scope||!m.review_decision))add(rel,'missing-human-review-record');
 for(const key of ['tags','sources'])if(m[key]&&!/^\[.*\]$/.test(m[key]))add(rel,'invalid-inline-list:'+key);
 if(m.confidence&&!['low','medium','high'].includes(m.confidence))add(rel,'invalid-confidence');
 const target='economy_wiki/'+rel.replace(/\.md$/,'').split(path.sep).join('/');if(!index.includes('[['+target+']]')&&!index.includes('[['+target+'|'))add(rel,'not-in-index');
 }
 const links=[...text.matchAll(/\[\[(economy_wiki\/[^\]|#]+)(?:[^\]]*)\]\]/g)].map(x=>x[1]);
 if(compiled&&m.sources){const sourcePaths=[...m.sources.matchAll(/economy_wiki\/[^,\]"']+/g)].map(x=>x[0].trim());if(!sourcePaths.length)add(rel,'missing-source-path');links.push(...sourcePaths)}
 for(const target of new Set(links)){const resolved=path.resolve(vault,target+(target.endsWith('.md')?'':'.md'));if(!resolved.startsWith(root+path.sep))add(rel,'unsafe-link:'+target);else if(!fs.existsSync(resolved))add(rel,'broken-link:'+target)}
 if(folder==='Sources'){
 if(m.source_mode==='external'){externalSources++;if(!/^https?:\/\//.test(m.source_url||''))add(rel,'missing-external-url');if(!m.version||!dateOK(m.accessed)||!m.permission_note)add(rel,'missing-external-provenance')}
 else if(m.source_mode==='local'){
 if(m.raw_path&&m.raw_path.split('/').some(p=>p.startsWith('.')||/^(private|personal|secrets)$/i.test(p))){add(rel,'unsafe-raw-path');continue}
 if(!m.raw_path||!/^[a-f0-9]{64}$/.test(m.raw_sha256||''))add(rel,'missing-raw-integrity');
 else{const base=path.resolve(root,'raw'),resolved=path.resolve(root,m.raw_path);if(!resolved.startsWith(base+path.sep))add(rel,'unsafe-raw-path');else if(!fs.existsSync(resolved))add(rel,'missing-raw-file');else if(!safeRaw(resolved))add(rel,'unsafe-raw-symlink');else{rawHashesChecked++;if(crypto.createHash('sha256').update(readSafe(resolved)).digest('hex')!==m.raw_sha256)add(rel,'raw-hash-mismatch')}}
 }else add(rel,'invalid-source-mode');
 }
 }
 }
 return {checked,rawHashesChecked,externalSources,issues,limitations:'Restricted scalar/inline-list frontmatter only. Mechanical checks do not authenticate human review, validate claims, detect semantic contradictions or guarantee source immutability. External content is not fetched or hashed.'};
}
if(require.main===module){if(!process.argv[2]){console.error('Usage: node scripts/lint-wiki.cjs /path/to/vault');process.exit(1)}const result=lintWiki(process.argv[2]);console.log(JSON.stringify(result,null,2));process.exitCode=result.issues.length?1:0}
module.exports={lintWiki};
