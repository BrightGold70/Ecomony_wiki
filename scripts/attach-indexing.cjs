'use strict';
// Offline, explicit inspected metadata only. Never scans papers or calls providers.
const fs=require('node:fs'),path=require('node:path');
const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const {sha256,stableRead}=require('./intake-papers.cjs');
const {paperFrontmatter}=require('../dashboard/paper-navigation.cjs');
const {publicationKeywords}=require('../dashboard/publication-keywords.cjs');
const {publicationMesh}=require('../dashboard/publication-mesh.cjs');
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const hash=x=>sha256(JSON.stringify(sorted(x)));
const front=o=>'---\n'+Object.entries(o).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n';
const esc=s=>s.replace(/[&<>"\[\]`*_()#!|]/g,c=>'&#'+c.charCodeAt(0)+';');
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(s,max=500){if(typeof s!=='string'||!s.trim()||s!==s.trim()||s.length>max||/[\x00-\x1f\x7f<>`\\]/.test(s))throw Error('Invalid literal metadata text');return s;}
function exact(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error('Unsupported metadata fields');}
function relative(p,folder){if(typeof p!=='string'||!p.startsWith(folder+'/')||p.split('/').some(x=>!x||x.startsWith('.')||/^(private|personal|secrets)$/i.test(x))||/[\\\x00-\x1f\[\]#|%?:]/.test(p))throw Error('Unsafe scoped path');return p;}
function attachIndexing({vault,metadata:m,apply=false}){
 exact(m,['schema','source','literature','identity','version_key','inspected_date','evidence','keywords','mesh']);
 if(m.schema!=='economy-inspected-indexing-v1'||! /^(pmid:[1-9]\d*|doi:10\.\d{4,9}\/[^\s<>"\\]+)$/.test(m.identity||''))throw Error('Invalid schema or explicit identity');
 text(m.version_key,2000);if(!/^\d{4}-\d{2}-\d{2}$/.test(m.inspected_date||'')||new Date(m.inspected_date).toISOString().slice(0,10)!==m.inspected_date)throw Error('Invalid inspection date');
 if(!Array.isArray(m.keywords)||m.keywords.length>2000||!Array.isArray(m.mesh)||m.mesh.length>2000)throw Error('Explicit keyword/MeSH arrays required (empty means pending)');
 const root=path.join(path.resolve(vault),'economy_wiki');noSymlinks(root);
 const read=p=>stableRead(path.join(root,p),5*1024*1024).toString('utf8');
 relative(m.source,'Sources');relative(m.literature,'Literature');if(!m.source.endsWith('.md')||!m.literature.endsWith('.md'))throw Error('Expected markdown pair');
 const source=read(m.source),lit=read(m.literature),sm=paperFrontmatter(source),lm=paperFrontmatter(lit);
 if(sm.type!=='source'||!Array.isArray(lm.sources)||!lm.sources.includes('economy_wiki/'+m.source))throw Error('Source/Literature pair not explicitly linked');
 for(const fm of [sm,lm]){if(fm.identity&&fm.identity!==m.identity||fm.version_key&&fm.version_key!==m.version_key||fm.doi&&m.identity.startsWith('doi:')&&'doi:'+fm.doi!==m.identity||fm.pmid&&m.identity.startsWith('pmid:')&&'pmid:'+fm.pmid!==m.identity)throw Error('Pair identity/version conflict');}
 if(sm.source_mode==='local'){relative(sm.raw_path,'raw');if(sha256(stableRead(path.join(root,sm.raw_path)))!==sm.raw_sha256)throw Error('Original hash mismatch');}else if(sm.source_mode!=='external')throw Error('Unsupported source mode');
 exact(m.evidence,['path','sha256']);relative(m.evidence.path,'raw');if(!/^[a-f0-9]{64}$/.test(m.evidence.sha256||'')||sha256(stableRead(path.join(root,m.evidence.path)))!==m.evidence.sha256)throw Error('Inspected evidence hash mismatch');
 const nodes=new Map(),sourcePath='economy_wiki/'+m.source;
 function node(id,label,extra={}){const p='Topics/keyword-'+sha256(id).slice(0,24)+'.md';const body=front({title:'Bibliographic navigation: '+label,created:m.inspected_date,updated:m.inspected_date,type:'concept',tags:['bibliographic-navigation'],sources:[sourcePath],review_status:'economist-review-needed',evidence_kind:'descriptive',research_question:'Not applicable: literal bibliographic navigation only',keyword_navigation_only:true,reference_role:'bibliographic-keyword-navigation',keyword_node_id:id,...extra})+'\n# Bibliographic navigation\n\nLiteral recorded metadata only; not economic synthesis, JEL, scope eligibility or expert approval.\n';if(nodes.has(p)&&nodes.get(p)!==body)throw Error('Conflicting term labels');nodes.set(p,body);return 'economy_wiki/'+p;}
 const kinds=new Set(['publisher_author_keywords','publisher_keywords','jats_keywords','pdf_explicit_keywords','pubmed_keyword_list']);
 const bullets=m.keywords.map(k=>{exact(k,['text','kind','source_url','locator']);text(k.text);text(k.locator);if(!kinds.has(k.kind))throw Error('Unsupported keyword kind');if(k.kind==='pubmed_keyword_list'&&(!m.identity.startsWith('pmid:')||k.source_url!==`https://pubmed.ncbi.nlm.nih.gov/${m.identity.slice(5)}/`))throw Error('KeywordList identity mismatch');const p=node('keyword:'+k.text,k.text);return '- '+esc(k.text)+' — '+k.kind+'; explicit_literal_navigation. [['+p.slice(0,-3)+'|'+esc(k.text)+']] [Evidence]('+k.source_url+') · '+esc(k.locator)+' · SHA-256 `'+m.evidence.sha256+'`.';});
 const binding={identity:m.identity,version_key:m.version_key,evidence_path:m.evidence.path,evidence_sha256:m.evidence.sha256,inspected_date:m.inspected_date};
 const kb='## Explicit publication keywords\n\nKeyword metadata status: '+(bullets.length?'verified_explicit_keywords':'pending_source_inspection')+'. Literal inspected metadata; no independent authentication or economic review.\n\nIndexing binding: '+JSON.stringify(binding)+'\n\n'+bullets.join('\n');
 const keyword=kb+'\n\n<!-- keyword-enrichment:'+sha256(kb)+' -->\n';
 if(publicationKeywords(keyword).status==='invalid_provenance')throw Error('Unsupported keyword URL or provenance');
 let mesh='';if(m.mesh.length){
 if(!m.identity.startsWith('pmid:'))throw Error('MeSH attachment requires explicitly inspected PMID identity');
 const terms=new Map();const term=(label,ui,major,prefix)=>{text(label);if(!new RegExp('^'+prefix+'\\d{6,9}$').test(ui)||typeof major!=='boolean')throw Error('Invalid controlled term');if(terms.has(ui)&&terms.get(ui)!==label)throw Error('Controlled label/UI conflict');terms.set(ui,label);return {text:label,ui,major_topic_yn:major?'Y':'N',node_path:node((prefix==='D'?'mesh-descriptor:':'mesh-qualifier:')+ui,label)};};
 const observations=m.mesh.map(o=>{exact(o,['descriptor','descriptorUI','majorTopic','qualifiers','source_url','locator']);if(o.source_url!==`https://pubmed.ncbi.nlm.nih.gov/${m.identity.slice(5)}/`||o.locator!=='MedlineCitation/MeshHeadingList/MeshHeading'||!Array.isArray(o.qualifiers)||o.qualifiers.length>100)throw Error('Invalid inspected MeSH provenance');const d=term(o.descriptor,o.descriptorUI,o.majorTopic,'D'),qs=o.qualifiers.map(q=>{exact(q,['qualifier','qualifierUI','majorTopic']);return term(q.qualifier,q.qualifierUI,q.majorTopic,'Q');});const v={kind:'pubmed_mesh_heading',verified:true,identity:m.identity,version_key:m.version_key,source_pmid:m.identity.slice(5),source_url:o.source_url,locator:o.locator,evidence_sha256:m.evidence.sha256,descriptor:{text:d.text,ui:d.ui,major_topic_yn:d.major_topic_yn},node_path:d.node_path,qualifiers:qs};return {...v,provenance_id:hash(v)};});
 const indexing={schema:'typed-publication-indexing-v2',identity:m.identity,version_key:m.version_key,status:'verified_MeSH_indexing_metadata',observations};indexing.indexing_sha256=hash(indexing);
 const display=t=>`${xml(t.text)} (\`${t.ui}\`; MajorTopicYN=${t.major_topic_yn}) [[${t.node_path.slice(0,-3)}|${xml(t.text)}]]`;
 const body='## MeSH indexing terms — NLM/PubMed\n\nRecorded inspected metadata; not author keywords, JEL or economist approval.\n\n'+observations.map(o=>'- '+display({...o.descriptor,node_path:o.node_path})+o.qualifiers.map(q=>' / '+display(q)).join('')+` — [PubMed ${o.source_pmid}](${o.source_url}); record SHA-256 \`${o.evidence_sha256}\`; ${o.locator}.`).join('\n')+'\n\n### Typed bibliographic evidence record\n\n```json\n'+JSON.stringify({indexing,inspection:binding},null,2)+'\n```\n';mesh=body+'\n<!-- typed-indexing:'+sha256(body)+' -->\n';
 if(publicationMesh(mesh).status!=='recorded')throw Error('Invalid MeSH appendix');
 }
 const digest=hash(m),marker='<!-- offline-indexing:'+digest+' -->',appendix='\n'+keyword+'\n'+mesh+'\n## Offline indexing receipt\n\n'+marker+'\nInspected bytes: [[economy_wiki/'+m.evidence.path+']]; SHA-256 `'+m.evidence.sha256+'`. Identity/version are operator-declared, not independently authenticated. MeSH '+(m.mesh.length?'recorded':'pending/not supplied (optional)')+'; JEL unchanged; scientific review unchanged.\n';
 const writes=new Map();
 for(const [p,old,fm] of [[m.source,source,sm],[m.literature,lit,lm]]){
 if(old.includes(marker)){if(!old.endsWith(appendix))throw Error('Existing indexing receipt/content conflict');continue;}
 if(fm.review_status==='economist-reviewed'||/^## (Explicit publication keywords|MeSH)/m.test(old)||old.includes('<!-- offline-indexing:'))throw Error('Existing reviewed/collector indexing content: propose manual versioned migration, never overwrite');
 const next=old+appendix;if(publicationKeywords(next).status==='invalid_provenance'||m.mesh.length&&publicationMesh(next).status!=='recorded')throw Error('Appendix context is not parseable');writes.set(p,next);
 }
 for(const [p,body] of nodes){noSymlinks(path.join(root,p),true);if(fs.existsSync(path.join(root,p))){const existing=read(p),normalize=s=>s.replace(/^(created|updated|sources):.*$/gm,'$1: <preserved>');if(normalize(existing)!==normalize(body))throw Error('Navigation node collision (preserved): '+p);}else writes.set(p,body);}
 let index=read('index.md');for(const p of nodes.keys()){const link='[[economy_wiki/'+p.slice(0,-3)+']]';if(!index.includes(link))index+='\n- '+link+' — bibliographic navigation only\n';}if(index!==read('index.md'))writes.set('index.md',index);
 const log=read('log.md');if(!log.includes(marker))writes.set('log.md',log+'\n'+marker+'\n- '+m.inspected_date+' offline inspected indexing; '+m.source+' / '+m.literature+'; evidence '+m.evidence.sha256+'; metadata only, economist review pending; no network.\n');
 for(const p of writes.keys())noSymlinks(path.join(root,p),true);
 // One authorized writer only; all collisions/validation checked before the first write.
 if(apply)for(const [p,body] of writes){const file=path.join(root,p);if(!fs.existsSync(file))fs.writeFileSync(file,body,{flag:'wx',mode:0o600});else fs.writeFileSync(file,body);if(read(p)!==body)throw Error('Write verification failed: '+p);}
 return {dryRun:!apply,changed:[...writes.keys()],identity:m.identity,version_key:m.version_key,networkCalls:0,mesh:m.mesh.length?'recorded':'pending_optional',jel:'unchanged'};
}
const HELP='node scripts/attach-indexing.cjs --vault /absolute/parent-vault --metadata /absolute/inspected.json [--apply]\nPreview by default. Read docs/INDEXING_NAVIGATION.md. Offline explicit inspected metadata only; no keyword/MeSH/JEL inference. Existing reviewed/collector content is refused.';
if(require.main===module){try{const o={};for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(a==='--help'){console.log(HELP);process.exit(0);}if(a==='--apply'){if(o.apply)throw Error('Duplicate flag');o.apply=true;}else if(['--vault','--metadata'].includes(a)&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')&&!o[a.slice(2)])o[a.slice(2)]=process.argv[++i];else throw Error('Unknown/duplicate option: '+a);}if(!o.vault||!o.metadata)throw Error(HELP);o.metadata=JSON.parse(stableRead(o.metadata,5*1024*1024));console.log(JSON.stringify(attachIndexing(o),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={attachIndexing,HELP};
