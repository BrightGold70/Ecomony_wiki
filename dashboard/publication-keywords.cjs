'use strict';
const {paperFrontmatter}=require('./paper-navigation.cjs');
const kwHash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
const kwKinds=new Set(['publisher_author_keywords','publisher_keywords','jats_keywords','pdf_explicit_keywords','pubmed_keyword_list']);
const kwStatuses=new Set(['pending_source_inspection','pending_evidence_version','verified_explicit_keywords','verified_keywords_with_mapping_pending','no_keywords_in_inspected_source_publisher_followup_pending']);
function keywordRaw(note){return String(typeof note==='string'?note:note?.raw??note?.text??'')}
function isKeywordNavigation(note){const m=paperFrontmatter(keywordRaw(note));return m.keyword_navigation_only===true||m.keyword_navigation_only==='true'||m.reference_role==='bibliographic-keyword-navigation'}
function keywordSafePath(path){return typeof path==='string'&&/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\/[^\x00-\x1f\\\[\]#|]+\.md$/.test(path)&&!path.split('/').some(s=>!s||s==='.'||s==='..'||s.startsWith('.'))}
function keywordEvidenceURL(value){
 if(typeof value!=='string'||value.length>2000||/[\s<>\\\x00-\x1f]/.test(value))return null;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!['pubmed.ncbi.nlm.nih.gov','doi.org','haematologica.org','ashpublications.org','www.nejm.org','jamanetwork.com','onlinelibrary.wiley.com','ascopubs.org','www.thelancet.com','link.springer.com','aeaweb.org','www.aeaweb.org','nber.org','www.nber.org','imf.org','www.imf.org','worldbank.org','www.worldbank.org','documents.worldbank.org','academic.oup.com','sciencedirect.com','www.sciencedirect.com','tandfonline.com','www.tandfonline.com','cambridge.org','www.cambridge.org','oecd.org','www.oecd.org'].includes(u.hostname))return null;for(const k of u.searchParams.keys())if(/^(token|auth|authorization|signature|sig|access_token|code|password|cookie|x-amz-.*)$/i.test(k))return null;return value}catch{return null}
}
function keywordDecode(value){return value.replace(/&#(\d+);|&(?:amp|lt|gt|quot);/g,s=>s.startsWith('&#')?(Number(s.slice(2,-1))<=0x10ffff?String.fromCodePoint(Number(s.slice(2,-1))):s):({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"'}[s]))}
// Only active top-level headings/markers count. Quoted, fenced and commented examples are inert.
function keywordLines(raw){let offset=0,fence=null,comment=false;const out=[];for(const line of raw.split('\n')){const plain=line.replace(/\r$/,'');let active=!comment&&!/^\s*>/.test(plain);const f=/^ {0,3}(`{3,}|~{3,})/.exec(plain);if(active&&f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;active=false}else if(fence)active=false;if(comment){if(plain.includes('-->'))comment=false;active=false}else if(plain.includes('<!--')&&!/^<!-- (?:keyword-enrichment|collector-revision):[a-f0-9]{64} -->$/.test(plain)){if(!plain.slice(plain.indexOf('<!--')+4).includes('-->'))comment=true;active=false}out.push({line:plain,start:offset,end:offset+line.length,active});offset+=line.length+1}return out}
function publicationKeywords(note){
 const raw=keywordRaw(note),empty={status:'not_recorded',observations:[],integrity:'not checked',identityVersion:'not recorded in appendix; not independently verified'};
 if(raw.length>5*1024*1024)return {...empty,status:'invalid_provenance'};
 const lines=keywordLines(raw),heads=lines.filter(l=>l.active&&l.line==='## Explicit publication keywords');if(!heads.length)return empty;
 const head=heads.at(-1),following=lines.filter(l=>l.start>head.start),end=following.find(l=>l.active&&(/^#{1,2} /.test(l.line)||/^<!-- (?:keyword-enrichment|collector-revision):/.test(l.line))),section=raw.slice(head.start,end?.start??raw.length).trimEnd();
 const status=/^Keyword metadata status: ([a-z_]+)\./m.exec(section)?.[1];
 const marker=following.find(l=>l.active&&/^<!-- (keyword-enrichment|collector-revision):[a-f0-9]{64} -->$/.test(l.line));
 let integrity=false;
 if(marker){const [,kind,digest]=/^<!-- (keyword-enrichment|collector-revision):([a-f0-9]{64}) -->$/.exec(marker.line);const previous=lines.filter(l=>l.start<head.start&&l.active&&/^<!-- (?:keyword-enrichment|collector-revision):/.test(l.line)).at(-1);const minimum=previous?.end??0;
  // A collector revision may hash a complete scientific note, not just its keyword section.
  const starts=[head.start,...lines.filter(l=>l.active&&l.start>=minimum&&l.start<head.start&&(l.line==='---'||/^## /.test(l.line))).map(l=>l.start)];
  for(const start of starts.slice(-128)){const content=raw.slice(start,marker.start).trimEnd();if(['','\n'].some(e=>kwHash(kind==='collector-revision'?JSON.stringify(content+e):content+e)===digest)){integrity=true;break}}
 }
 if(!kwStatuses.has(status))return {...empty,status:'invalid_provenance'};
 if(!integrity)return {...empty,status:status.startsWith('verified')?'invalid_provenance':status};
 const observations=[],seen=new Set();let invalid=false;
 for(const line of keywordLines(section).filter(l=>l.active&&l.line.startsWith('- ')).map(l=>l.line)){
  const m=/^- (.+) — ([a-z_]+); ([a-z_]+)\. (.*?) \[Evidence\]\((https:\/\/[^\s]+)\) · (.+) · SHA-256 `([a-f0-9]{64})`\.$/.exec(line);
  if(!m||!kwKinds.has(m[2])||!keywordEvidenceURL(m[5])){invalid=true;continue}
  const raw_keyword=keywordDecode(m[1]),locator=keywordDecode(m[6]);if(raw_keyword.length>500||locator.length>500||/[\x00-\x1f\x7f]/.test(raw_keyword+locator)){invalid=true;continue}
  const target=/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(m[4]);const candidate=target?target[1]+(target[1].endsWith('.md')?'':'.md'):null;
  const o={raw_keyword,kind:m[2],mapping_status:m[3],normalized_label:target?keywordDecode(target[2]||raw_keyword):raw_keyword,node_path:keywordSafePath(candidate)?candidate:null,source_url:m[5],locator,evidence_sha256:m[7],verification:'collector-declared verified explicit field; source bytes not independently inspected'};
  const id=kwHash(JSON.stringify(o));if(!seen.has(id)){seen.add(id);observations.push({...o,provenance_id:id})}
 }
 if(invalid||status.startsWith('verified')&&!observations.length)return {...empty,status:'invalid_provenance'};
 const metadata=paperFrontmatter(raw);let identity=metadata.identity||metadata.doi||metadata.pmid,version=metadata.version_key||metadata.scientific_version;
 const bindingLine=section.split('\n').find(l=>l.startsWith('Indexing binding: '));
 if(bindingLine){try{const b=JSON.parse(bindingLine.slice(18));if(!/^(pmid:[1-9]\d*|doi:10\.\d{4,9}\/[^\s<>"\\]+)$/.test(b.identity)||typeof b.version_key!=='string'||!b.version_key||!/^raw\//.test(b.evidence_path)||!/^[a-f0-9]{64}$/.test(b.evidence_sha256)||observations.some(o=>o.evidence_sha256!==b.evidence_sha256)||metadata.identity&&metadata.identity!==b.identity||metadata.version_key&&metadata.version_key!==b.version_key||metadata.doi&&b.identity.startsWith('doi:')&&'doi:'+metadata.doi!==b.identity||metadata.pmid&&b.identity.startsWith('pmid:')&&'pmid:'+metadata.pmid!==b.identity)throw Error('Binding conflict');identity=b.identity;version=b.version_key;}catch{return {...empty,status:'invalid_provenance'}}}
 return {status,observations,integrity:'appendix-hash-matched',identity:identity||null,version_key:version||null,identityVersion:bindingLine?'Appendix-bound operator-declared identity/version; not independently authenticated':identity&&version?'Note-declared identity/version; appendix does not bind them independently':empty.identityVersion};
}
function keywordPublicationKey(note){const m=paperFrontmatter(keywordRaw(note)),doi=m.doi;return typeof doi==='string'&&/^10\.\d{4,9}\/[^\s<>"\\]+$/i.test(doi)&&(m.doi_verified===true||m.doi_verified==='true')?'doi:'+doi.toLowerCase():'note:'+note.path}
function keywordCatalog(index){
 const papers=index.filter(p=>keywordSafePath(p.path)&&!isKeywordNavigation(p)),nodes=index.filter(isKeywordNavigation),byPath=new Map(nodes.map(n=>[n.path,n])),keywords=new Map(),records=new Map();let verified=0,pending=0,invalid=0;
 for(const paper of papers){const record=publicationKeywords(paper);records.set(paper.path,record);if(record.status.startsWith('verified'))verified++;else if(record.status==='invalid_provenance')invalid++;else pending++;
  for(const input of record.observations){let node_path=input.node_path;const node=byPath.get(node_path),m=node?paperFrontmatter(keywordRaw(node)):{};
   if(!node||!(m.keyword_navigation_only===true||m.keyword_navigation_only==='true')||m.reference_role!=='bibliographic-keyword-navigation'||!keywordSafePath(node_path)||typeof m.keyword_node_id!=='string'||! /^(keyword|disease):.+/.test(m.keyword_node_id)||node_path!=='economy_wiki/Topics/keyword-'+kwHash(m.keyword_node_id).slice(0,24)+'.md')node_path=null;
   const o={...input,node_path,paper_path:paper.path};const key=JSON.stringify([o.raw_keyword]);if(!keywords.has(key))keywords.set(key,{id:key,raw_keyword:o.raw_keyword,observations:[],papers:[],publicationMap:new Map()});const entry=keywords.get(key);entry.observations.push(o);
   const pub=keywordPublicationKey(paper);if(!entry.publicationMap.has(pub))entry.publicationMap.set(pub,{id:pub,paper,notes:[],versions:[],identityBasis:pub.startsWith('doi:')?'Valid DOI declared verified; not independently authenticated':'Separate note path; publication identity/version not verified'});const group=entry.publicationMap.get(pub);if(!group.notes.some(n=>n.path===paper.path))group.notes.push(paper);if(record.version_key&&!group.versions.includes(record.version_key))group.versions.push(record.version_key);
  }
 }
 for(const entry of keywords.values()){entry.papers=[...entry.publicationMap.values()];entry.paperCount=entry.papers.length;delete entry.publicationMap}
 return {keywords:[...keywords.values()].sort((a,b)=>a.raw_keyword.localeCompare(b.raw_keyword)),records,coverage:{indexedNotes:index.length,paperNotes:papers.length,navigationNodes:nodes.length,verifiedNotes:verified,pendingNotes:pending,invalidNotes:invalid,publications:new Set(papers.map(keywordPublicationKey)).size},limits:'All nine compiled categories only; Sources/raw not counted. Counts are publications only with a valid declared-verified DOI; otherwise separate note paths, not independent studies. Missing fields are pending, not evidence of absence. Appendix hashes check local integrity, not source authenticity or exact scientific-version binding.'};
}
function keywordGraph(index,mode='papers'){
 const navigation=index.filter(isKeywordNavigation),papers=index.filter(p=>!isKeywordNavigation(p));if(mode!=='paper-keyword')return {nodes:mode==='all'?index:papers,edges:null,excludedKeywordNodes:mode==='all'?0:navigation.length};
 const catalog=keywordCatalog(index),groups=new Map();for(const p of papers){const id=keywordPublicationKey(p);if(!groups.has(id))groups.set(id,p)}const paths=new Set(),edges=[],seen=new Set();
 for(const entry of catalog.keywords)for(const o of entry.observations){if(!o.node_path)continue;const paper=papers.find(p=>p.path===o.paper_path),source=groups.get(keywordPublicationKey(paper)).path,key=JSON.stringify([source,o.node_path]);if(seen.has(key))continue;seen.add(key);paths.add(o.node_path);edges.push({source,target:o.node_path,kind:'explicit-publication-keyword',status:'bibliographic-navigation',context:'Literal explicit keyword; not a study relationship or economic synthesis.'})}
 return {nodes:[...groups.values(),...navigation.filter(n=>paths.has(n.path))],edges,excludedKeywordNodes:navigation.filter(n=>!paths.has(n.path)).length};
}
module.exports={publicationKeywords,keywordCatalog,keywordGraph,isKeywordNavigation};
