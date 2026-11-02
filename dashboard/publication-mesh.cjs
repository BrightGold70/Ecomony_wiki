'use strict';
const {paperFrontmatter}=require('./paper-navigation.cjs');
const {isKeywordNavigation,keywordGraph}=require('./publication-keywords.cjs');
const meshHash=s=>require('node:crypto').createHash('sha256').update(s,'utf8').digest('hex');
const meshRaw=n=>String(typeof n==='string'?n:n?.raw??n?.text??'');
function meshText(v,max=500){return typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&!/[\x00-\x1f\x7f<>`\\]/.test(v)}
function meshURL(v){try{const u=new URL(v);return typeof v==='string'&&/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/[1-9]\d*\/$/.test(v)&&!u.search&&!u.hash}catch{return false}}
function meshValidate(e){
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
 if(!exact(e,['schema','identity','version','mesh_observations'])||e.schema!=='explicit-mesh-v1'||!meshText(e.identity)||!/^pmid:[1-9]\d*$/.test(e.identity)||!meshText(e.version)||!Array.isArray(e.mesh_observations)||e.mesh_observations.length>2000)throw Error('Unsupported or invalid explicit-mesh-v1 envelope');
 const names=new Map(),qualifiers=new Map(),labelIDs=new Map();
 for(const o of e.mesh_observations){
  if(!exact(o,['descriptor','descriptorUI','qualifier','qualifierUI','majorTopic','origin','sourceURL','locator','evidenceSHA','identity','version'])||!meshText(o.descriptor)||!/^D\d{6,9}$/.test(o.descriptorUI)||typeof o.majorTopic!=='boolean'||o.origin!=='pubmed_mesh'||!meshURL(o.sourceURL)||!meshText(o.locator,1000)||!/^[a-f0-9]{64}$/.test(o.evidenceSHA)||o.identity!==e.identity||o.version!==e.version||o.sourceURL!==`https://pubmed.ncbi.nlm.nih.gov/${e.identity.slice(5)}/`)throw Error('Invalid MeSH observation provenance');
  if(Object.hasOwn(o,'qualifier')!==Object.hasOwn(o,'qualifierUI')||(Object.hasOwn(o,'qualifier')&&(!meshText(o.qualifier)||!/^Q\d{6,9}$/.test(o.qualifierUI))))throw Error('Qualifier name/UI must be supplied together');
  if(names.has(o.descriptorUI)&&names.get(o.descriptorUI)!==o.descriptor||labelIDs.has(o.descriptor)&&labelIDs.get(o.descriptor)!==o.descriptorUI)throw Error('Descriptor name/UI mismatch');
  names.set(o.descriptorUI,o.descriptor);labelIDs.set(o.descriptor,o.descriptorUI);
  if(o.qualifierUI){if(qualifiers.has(o.qualifierUI)&&qualifiers.get(o.qualifierUI)!==o.qualifier)throw Error('Qualifier name/UI mismatch');qualifiers.set(o.qualifierUI,o.qualifier)}
 }
 return e;
}
function meshBody(e){meshValidate(e);return '## MeSH\n\nRecorded controlled-indexing metadata; not author words, disease eligibility or clinical approval.\n\n'+e.mesh_observations.map(o=>'- '+o.descriptor+' ['+o.descriptorUI+']'+(o.qualifier?' / '+o.qualifier+' ['+o.qualifierUI+']':'')+' · majorTopic: '+o.majorTopic).join('\n')+'\n\n```json\n'+JSON.stringify(e,null,2)+'\n```'}
function renderMeshAppendix(e){const body=meshBody(e);return body+'\n\n<!-- mesh-enrichment:'+meshHash(body)+' -->\n'}
// Top-level only: examples inside blockquotes, code fences or HTML comments are inert.
function meshLines(raw){let offset=0,fence=null,comment=false;const out=[];for(const line of raw.split('\n')){const plain=line.replace(/\r$/,''),f=/^ {0,3}(`{3,}|~{3,})/.exec(plain);let active=!comment&&!/^\s*>/.test(plain);if(active&&f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;active=false}else if(fence)active=false;if(comment){if(plain.includes('-->'))comment=false;active=false}else if(active&&plain.includes('<!--')&&!/^<!-- (?:mesh-enrichment|typed-indexing):/.test(plain)){if(!plain.slice(plain.indexOf('<!--')+4).includes('-->'))comment=true;active=false}out.push({line:plain,start:offset,active});offset+=line.length+1}return out}
const meshSorted=x=>Array.isArray(x)?x.map(meshSorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,meshSorted(x[k])])):x;
const meshSHA=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const meshIdentity=v=>typeof v==='string'&&(/^(?:pmid:[1-9]\d*)$/.test(v)||/^doi:10\.\d{4,9}\/[^\s<>"\\]+$/.test(v));
function collectorMesh(raw,head,lines){
 const after=lines.filter(l=>l.start>head.start),boundary=after.find(l=>l.active&&/^#{1,2} /.test(l.line)),end=boundary?.start??raw.length;
 const section=raw.slice(head.start,end),markers=after.filter(l=>l.start<end&&l.active&&/^<!-- typed-indexing:/.test(l.line));
 const marker=markers.at(-1);if(markers.length>1)throw Error('Unpaired collector marker');
 const body=raw.slice(head.start,marker?.start??end).trimEnd();
 if(marker){const m=/^<!-- typed-indexing:([a-f0-9]{64}) -->$/.exec(marker.line);if(!m||meshHash(body+'\n')!==m[1]||section.slice(marker.start-head.start+marker.line.length).trim())throw Error('Collector appendix hash mismatch')}
 const blocks=[...body.matchAll(/^```json\n([\s\S]*?)\n```$/gm)];if(blocks.length!==1)throw Error('Missing typed record');
 const payload=JSON.parse(blocks[0][1]),e=payload.indexing;
 if(!e||e.schema!=='typed-publication-indexing-v2'||!meshIdentity(e.identity)||!meshText(e.version_key,2000)||!Array.isArray(e.observations)||e.observations.length>2000||!meshSHA(e.indexing_sha256))throw Error('Unsupported typed record');
 const unhashed={...e};delete unhashed.indexing_sha256;if(meshHash(JSON.stringify(meshSorted(unhashed)))!==e.indexing_sha256)throw Error('Typed record hash mismatch');
 const metadata=paperFrontmatter(raw);if(metadata.identity&&metadata.identity!==e.identity||metadata.version_key&&metadata.version_key!==e.version_key)throw Error('Identity/version conflict');
 const inspection=payload.inspection;if(inspection&&(inspection.identity!==e.identity||inspection.version_key!==e.version_key))throw Error('Inspection binding mismatch');
 const term=(t,prefix,path)=>{if(!t||!meshText(t.text)||!new RegExp('^'+prefix+'\\d{6,9}$').test(t.ui)||!['Y','N'].includes(t.major_topic_yn)||!meshSafePath(path)||!path.startsWith('economy_wiki/Topics/')||t.attributes&&(t.attributes.UI!==t.ui||t.attributes.MajorTopicYN!==t.major_topic_yn))throw Error('Invalid controlled term');return {label:t.text,ui:t.ui,majorTopic:t.major_topic_yn==='Y',node_path:path}};
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const observations=[],visible=[];
 for(const o of e.observations){if(o.kind!=='pubmed_mesh_heading')continue;
  if(o.verified!==true||o.identity!==e.identity||o.version_key!==e.version_key||! /^[1-9]\d*$/.test(o.source_pmid)||!meshURL(o.source_url)||o.source_url!==`https://pubmed.ncbi.nlm.nih.gov/${o.source_pmid}/`||o.locator!=='MedlineCitation/MeshHeadingList/MeshHeading'||!meshSHA(o.evidence_sha256)||!meshSHA(o.provenance_id)||o.response_sha256&&!meshSHA(o.response_sha256)||!Array.isArray(o.qualifiers))throw Error('Invalid typed provenance');
  if(e.identity.startsWith('pmid:')&&e.identity!=='pmid:'+o.source_pmid||e.identity.startsWith('doi:')&&(!Array.isArray(o.source_dois)||!o.source_dois.includes(e.identity.slice(4))))throw Error('Source identity conflict');
  const d=term(o.descriptor,'D',o.node_path),qs=o.qualifiers.map(q=>term(q,'Q',q.node_path));
  const display=t=>`${escape(t.label)} (\`${t.ui}\`; MajorTopicYN=${t.majorTopic?'Y':'N'}) [[${t.node_path.slice(0,-3)}|${escape(t.label)}]]`;
  visible.push('- '+display(d)+qs.map(q=>' / '+display(q)).join('')+` — [PubMed ${o.source_pmid}](${o.source_url}); record SHA-256 \`${o.evidence_sha256}\`; ${o.locator}.`);
  observations.push({descriptor:d.label,descriptorUI:d.ui,majorTopic:d.majorTopic,node_path:d.node_path,qualifiers:qs.map(q=>({qualifier:q.label,qualifierUI:q.ui,majorTopic:q.majorTopic,node_path:q.node_path})),origin:'pubmed_mesh',sourceURL:o.source_url,locator:o.locator,evidenceSHA:o.evidence_sha256,identity:e.identity,version:e.version_key,provenance_id:o.provenance_id});
 }
 const bullets=meshLines(body.split('\n### ')[0]).filter(l=>l.active&&l.line.startsWith('- ')).map(l=>l.line);if(JSON.stringify(bullets)!==JSON.stringify(visible))throw Error('Visible/typed mismatch');
 if(observations.length&&e.status!=='verified_MeSH_indexing_metadata')throw Error('Invalid recorded status');
 return {status:observations.length?'recorded':'unknown',observations,integrity:marker?'appendix-hash-matched':'typed-record-hash-matched; appendix hash not recorded',identity:e.identity,version:e.version_key};
}
function publicationMesh(note){
 const raw=meshRaw(note),empty={status:'unknown',observations:[],integrity:'not checked',identity:null,version:null},invalid={...empty,status:'invalid_provenance'};
 if(raw.length>5*1024*1024)return invalid;
 const lines=meshLines(raw),heads=lines.filter(l=>l.active&&/^## MeSH(?:\s|$)/.test(l.line));if(!heads.length)return empty;
 const head=heads.at(-1);if(head.line==='## MeSH indexing terms — NLM/PubMed'){try{return collectorMesh(raw,head,lines)}catch{return invalid}}
 const following=lines.filter(l=>l.start>head.start),boundary=following.find(l=>l.active&&/^#{1,2} /.test(l.line)),marker=following.filter(l=>l.active&&/^<!-- mesh-enrichment:/.test(l.line)).at(-1);
 if(head.line!=='## MeSH'||!marker||boundary&&boundary.start<marker.start)return invalid;
 const match=/^<!-- mesh-enrichment:([a-f0-9]{64}) -->$/.exec(marker.line),body=raw.slice(head.start,marker.start).trimEnd();if(!match||meshHash(body)!==match[1])return invalid;
 try{const blocks=[...body.matchAll(/^```json\n([\s\S]*?)\n```$/gm)];if(blocks.length!==1)return invalid;const e=meshValidate(JSON.parse(blocks[0][1]));if(meshBody(e)!==body)return invalid;const m=paperFrontmatter(raw);if((m.pmid&&String(m.pmid)!==e.identity.slice(5))||(m.identity&&m.identity!==e.identity)||(m.version_key&&m.version_key!==e.version))return invalid;return {status:e.mesh_observations.length?'recorded':'unknown',observations:e.mesh_observations,integrity:'appendix-hash-matched',identity:e.identity,version:e.version}}catch{return invalid}
}
function isMeshNavigation(note){const m=paperFrontmatter(meshRaw(note));return m.mesh_navigation_only===true||m.mesh_navigation_only==='true'||m.reference_role==='bibliographic-mesh-navigation'}
function isBibliographicNavigation(note){return isKeywordNavigation(note)||isMeshNavigation(note)}
function meshSafePath(p){return typeof p==='string'&&/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\/[^\x00-\x1f\\%\[\]#|?:]+\.md$/.test(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.'))}
function meshCatalog(index,{majorOnly=false}={}){
 const papers=index.filter(p=>meshSafePath(p.path)&&!isBibliographicNavigation(p)),records=new Map(),entries=new Map(),usedPaths=new Set();let recorded=0,unknown=0,invalid=0;
 const sourceRecords=index.filter(p=>/^economy_wiki\/Sources\/[^/]+\.md$/.test(p.path)).map(publicationMesh);
 for(const paper of papers){const r=publicationMesh(paper);records.set(paper.path,r);if(r.status==='recorded')recorded++;else if(r.status==='invalid_provenance')invalid++;else unknown++;
  for(const o of r.observations){for(const p of [o.node_path,...(o.qualifiers||[]).map(q=>q.node_path)])if(p)usedPaths.add(p);if(majorOnly&&!o.majorTopic&&!(o.qualifiers||[]).some(q=>q.majorTopic))continue;if(!entries.has(o.descriptorUI))entries.set(o.descriptorUI,{id:o.descriptorUI,descriptorUI:o.descriptorUI,labels:[],observations:[],papers:[],conflict:false});const e=entries.get(o.descriptorUI);if(!e.labels.includes(o.descriptor))e.labels.push(o.descriptor);e.observations.push({...o,paper_path:paper.path});let group=e.papers.find(g=>g.id===o.identity);if(!group){group={id:o.identity,paper,notes:[],versions:[],identityBasis:'Explicit recorded identity/version; locally hash-checked, not independently authenticated'};e.papers.push(group)}if(!group.notes.some(n=>n.path===paper.path))group.notes.push(paper);if(!group.versions.includes(o.version))group.versions.push(o.version);
  }
 }
 const labelUIs=new Map();for(const e of entries.values())for(const label of e.labels){if(!labelUIs.has(label))labelUIs.set(label,new Set());labelUIs.get(label).add(e.id)}
 for(const e of entries.values()){e.conflict=e.labels.length>1||e.labels.some(l=>labelUIs.get(l).size>1);e.descriptor=e.labels.join(' / ');e.paperCount=e.papers.length}
 return {mesh:[...entries.values()].sort((a,b)=>a.id.localeCompare(b.id)),records,coverage:{paperNotes:papers.length,navigationNodes:index.filter(n=>isMeshNavigation(n)||usedPaths.has(n.path)).length,recordedNotes:recorded,unknownNotes:unknown,invalidNotes:invalid,sourceNotes:sourceRecords.length,sourceVersions:new Set(sourceRecords.filter(r=>r.identity&&r.version).map(r=>JSON.stringify([r.identity,r.version]))).size,sourceRecordedMeshVersions:new Set(sourceRecords.filter(r=>r.status==='recorded').map(r=>JSON.stringify([r.identity,r.version]))).size,sourceInvalidNotes:sourceRecords.filter(r=>r.status==='invalid_provenance').length},limits:'MeSH is recorded controlled-indexing metadata, not author words or disease eligibility. Note coverage and explicitly recorded Source versions are separate, not counts of unique publications. Local hashes check integrity, not source authenticity, fresh indexing or clinical approval.'};
}
function meshGraph(index,mode='papers'){
 const eligible=index.filter(p=>!/^economy_wiki\/Sources\//.test(p.path)),papers=eligible.filter(p=>!isBibliographicNavigation(p));
 if(mode==='both'){const keywords=meshGraph(eligible,'paper-keyword'),mesh=meshGraph(eligible,'paper-mesh'),edges=[...keywords.edges,...mesh.edges],used=new Set(edges.flatMap(e=>[e.source,e.target]));return {nodes:eligible.filter(p=>!isBibliographicNavigation(p)||used.has(p.path)),edges,excludedKeywordNodes:eligible.filter(p=>isKeywordNavigation(p)&&!used.has(p.path)).length,excludedMeshNodes:eligible.filter(p=>isMeshNavigation(p)&&!used.has(p.path)).length}}
 if(mode==='all')return {nodes:eligible,edges:null,paperNodes:papers,navigationEdges:[...keywordGraph(eligible.filter(p=>!isMeshNavigation(p)),'paper-keyword').edges,...meshGraph(eligible,'paper-mesh').edges],excludedKeywordNodes:0,excludedMeshNodes:0};
 if(mode==='paper-keyword')return {...keywordGraph(eligible.filter(p=>!isMeshNavigation(p)),mode),excludedMeshNodes:eligible.filter(isMeshNavigation).length};
 if(mode!=='paper-mesh')return {nodes:papers,edges:null,excludedKeywordNodes:eligible.filter(isKeywordNavigation).length,excludedMeshNodes:eligible.filter(isMeshNavigation).length};
 const data=meshCatalog(eligible),nav=eligible.filter(isBibliographicNavigation),used=new Set(),edges=[],edgeMap=new Map();
 for(const entry of data.mesh){if(entry.conflict)continue;
  for(const group of entry.papers)for(const o of entry.observations.filter(o=>o.identity===group.id)){
   const terms=[{ui:o.descriptorUI,path:o.node_path,kind:'descriptor'},...(o.qualifiers||[]).map(q=>({ui:q.qualifierUI,path:q.node_path,kind:'qualifier'}))];
   for(const term of terms){const target=term.path?nav.find(n=>meshSafePath(n.path)&&n.path===term.path):nav.find(n=>{const m=paperFrontmatter(meshRaw(n));return meshSafePath(n.path)&&n.path==='economy_wiki/Topics/mesh-'+entry.id+'.md'&&(m.mesh_navigation_only===true||m.mesh_navigation_only==='true')&&m.reference_role==='bibliographic-mesh-navigation'&&m.mesh_descriptor_ui===entry.id&&m.mesh_descriptor===entry.descriptor});if(!target)continue;
    used.add(target.path);const key=JSON.stringify([group.id,target.path,term.ui]);let edge=edgeMap.get(key);if(!edge){edge={source:group.paper.path,target:target.path,kind:'pubmed-mesh',meshUI:term.ui,meshTermKind:term.kind,status:'bibliographic-navigation',context:'Recorded controlled-indexing; not author words, study relationship or disease eligibility.',observations:[]};edgeMap.set(key,edge);edges.push(edge)}if(!edge.observations.includes(o))edge.observations.push(o);
   }
  }
 }
 return {nodes:[...papers,...nav.filter(n=>used.has(n.path))],edges,excludedKeywordNodes:eligible.filter(isKeywordNavigation).filter(n=>!used.has(n.path)).length,excludedMeshNodes:nav.filter(n=>isMeshNavigation(n)&&!used.has(n.path)).length};
}
module.exports={publicationMesh,meshCatalog,meshGraph,isMeshNavigation,isBibliographicNavigation,renderMeshAppendix,meshValidate};
