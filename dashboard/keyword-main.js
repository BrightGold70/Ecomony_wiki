const {Plugin,ItemView}=require('obsidian');
const {searchNotes,safeNotePath}=require('./keyword-search.cjs');
const {buildIndex,relatedStudies,relationships}=require('./dashboard-core.cjs');
const {enhancedSearch,typedRelationships,reviewInbox,evidenceAnswer}=require('./enhancements.cjs');
const {validateClaim,assessDependencies,hashContent,createReview,verifyReview}=require('./evidence-lifecycle.cjs');
const {deepSearch}=require('./deep-search.cjs');
const {resolvePaperActions,openPaperAction}=require('./paper-navigation.cjs');
const VIEW='economy-keyword-search';
class SearchView extends ItemView{
 constructor(leaf,plugin){super(leaf);this.plugin=plugin}
 getViewType(){return VIEW}getDisplayText(){return 'Economics Dashboard'}getIcon(){return 'search'}
 async readScoped(file,binary=false){
  const rel=file.path;
  if(typeof rel!=='string'||!/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries|Review|Claims|Sources|raw)\//.test(rel)||rel.split('/').some(p=>!p||p.startsWith('.')||/^(private|personal|secrets)$/i.test(p)||/[\\%\x00-\x1f]/.test(p)))throw Error('Outside research scope');
  const base=this.app.vault.adapter.getBasePath?.();if(!base)throw Error('Safe local filesystem adapter required');
  const fs=require('node:fs'),path=require('node:path');let target=path.resolve(base);let current=path.parse(target).root;
  for(const part of target.slice(current.length).split(path.sep).filter(Boolean).concat(rel.split('/'))){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('Symlink denied');}
  const fd=fs.openSync(current,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{if(!fs.fstatSync(fd).isFile())throw Error('Not regular file');const data=fs.readFileSync(fd);return binary?data:data.toString('utf8')}finally{fs.closeSync(fd)}
 }
 async onOpen(){
  const root=this.contentEl;root.empty();this.selected=new Set();const header=root.createDiv();header.style.cssText='position:sticky;top:0;z-index:5;background:var(--background-primary);padding:8px 0;border-bottom:1px solid var(--background-modifier-border)';header.createEl('h2',{text:'Economics Research Dashboard'});
  root.createEl('p',{text:'Keyword search · Study findings · Similar papers · Recorded relationships. Local wiki only; drafts require economist review.'});
  const overview=root.createEl('p',{text:'Loading research index…'});
  const load=async()=>{const files=this.app.vault.getMarkdownFiles().filter(f=>/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\//.test(f.path));const notes=[];for(const f of files){if(!safeNotePath(f.path))continue;try{notes.push({path:f.path,text:await this.readScoped(f)})}catch{}}this.index=buildIndex(notes);overview.setText(`${this.index.length} research notes · ${relationships(this.index).length} recorded directed links. Similarity is vocabulary overlap, not economic agreement.`)};
  const toolbar=header.createDiv();toolbar.createEl('button',{text:'Refresh wiki'}).onclick=async()=>{await load();await run()};
  const relationshipArea=root.createDiv();
  toolbar.createEl('button',{text:'Paper relationships'}).onclick=()=>{relationshipArea.empty();relationshipArea.createEl('h3',{text:'Recorded paper-to-paper links'});relationshipArea.createEl('p',{text:'Explicit links already recorded in notes, not verified citation, confirmation, contradiction or causal relationships. Source and target open wiki notes in a split; source records and stored PDFs have separate named controls.'});const scoped=this.catalog(),edges=typedRelationships(scoped);relationshipArea.createEl('p',{text:`${edges.length} directed links within ${scoped.length} notes matching active metadata filters. Type labels derived from context are suggestions, not verified semantics.`});for(const e of edges){const line=relationshipArea.createDiv();const source=scoped.find(p=>p.path===e.source),target=scoped.find(p=>p.path===e.target);for(const [label,paper] of [['Source: ',source],['Target: ',target]]){line.createEl('button',{text:label+paper.title}).onclick=()=>openPaperAction(this.app,{kind:'wiki',target:paper.path});this.renderPaperActions(line,paper)}line.createEl('button',{text:'Explore source neighbourhood'}).onclick=()=>this.showRelated(e.source,relationshipArea);line.createEl('p',{text:e.kind+' ['+e.status+'] · '+e.context})}if(!edges.length)relationshipArea.createEl('p',{text:'No explicit study-to-study links currently recorded within active filters. Use Find similar for lexical candidates.'})};
  toolbar.createEl('button',{text:'Wiki management'}).onclick=async()=>{
   relationshipArea.empty();relationshipArea.createEl('h3',{text:'Economics wiki management'});
   relationshipArea.createEl('p',{text:'Compiled knowledge lifecycle: curate → preserve sources → extract → integrate topics → review → maintain. This panel reads status only; it does not run an LLM or approve evidence.'});
   for(const name of ['SCHEMA.md','index.md','log.md']){const p='economy_wiki/'+name;const exists=!!this.app.vault.getAbstractFileByPath(p);const b=relationshipArea.createEl('button',{text:(exists?'Open ':'Missing: ')+name});b.disabled=!exists;b.onclick=()=>this.app.workspace.openLinkText(p,'',true)}
   const flagged=(this.index||[]).filter(p=>/^(review_status:\s*economist-review-needed|contested:\s*true|confidence:\s*low)/m.test((p.raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)||[])[1]||''));
   relationshipArea.createEl('p',{text:`${flagged.length} indexed notes flagged for review, contested claims or low confidence. These are metadata signals, not a economic quality assessment.`});
   for(const p of flagged){const b=relationshipArea.createEl('button',{text:p.title});b.onclick=()=>this.app.workspace.openLinkText(p.path,'',true)}
   relationshipArea.createEl('p',{text:'Comparisons and saved Queries are managed through the index; study search currently includes Literature, Topics, Datasets, Policies, Methods, Theories, Analyses, Comparisons and Queries. Run the repository lint command for mechanical checks.'});
  };
  toolbar.createEl('button',{text:'Graphical paper links'}).onclick=()=>this.showGraph(relationshipArea);
  await load();
  const input=header.createEl('input',{type:'search',placeholder:'Search your wiki…'});input.style.width='100%';input.setAttribute('aria-label','Economics keyword');
  const filters=this.filters={};for(const key of ['country','product','method','evidence_kind']){const el=header.createEl('input',{placeholder:key+' (exact metadata)'});el.setAttribute('aria-label',key+' filter');filters[key]=el;el.addEventListener('input',()=>run())}
  const status=root.createEl('p',{text:'Searches compiled economics notes only. Drafts still require economist review.'});
  const results=root.createDiv();let sequence=0;
  const run=async()=>{
   const current=++sequence;const q=input.value.trim();results.empty();relationshipArea.empty();
   if(!q){status.setText('Enter a keyword to search compiled economics notes.');return}
   status.setText('Searching…');
   const notes=(this.index||[]).map(p=>({path:p.path,text:p.raw}));
   if(current!==sequence)return;
   const {rows,expansions}=enhancedSearch(notes,q,Object.fromEntries(Object.entries(filters).map(([k,v])=>[k,v.value.trim()])));status.setText(`${rows.length} matching notes. Stored draft evidence, not verified causal or policy conclusions. Expanded terms: ${expansions.join('; ')||'none'}`);
   for(const r of rows){
    const card=results.createDiv();card.style.borderBottom='1px solid var(--background-modifier-border)';card.style.padding='12px 0';
    const a=card.createEl('a',{text:r.title,href:'#'});a.addEventListener('click',e=>{e.preventDefault();this.app.workspace.openLinkText(r.path,'',true)});
    card.createEl('p',{text:r.evidence+' · Economist review required'});
    if(r.publicationCaution)card.createEl('p',{text:r.publicationCaution,cls:'mod-warning'});
    const findingsPanel=card.createEl('details');findingsPanel.open=true;findingsPanel.createEl('summary',{text:'Research findings and estimates'});
    const renderSection=(label,text)=>{
     findingsPanel.createEl('h4',{text:label});
     if(!text){findingsPanel.createEl('p',{text:'Not separately extracted in this wiki note — consult the summary/original source.'});return}
     const lines=text.split('\n');let table=null;
     for(const line of lines){
      if(/^\s*\|/.test(line)){
       if(/^\s*\|[\s:|-]+\|\s*$/.test(line))continue;
       if(!table)table=findingsPanel.createEl('table');
       const tr=table.createEl('tr');for(const value of line.trim().replace(/^\||\|$/g,'').split('|'))tr.createEl('td',{text:value.trim()});
      }else{table=null;if(line.trim()){const p=findingsPanel.createEl('p',{text:line});p.style.whiteSpace='pre-wrap'}}
     }
    };
    renderSection('Units / design',r.population);
    renderSection('Findings / numerical outcomes',r.findings);
    renderSection('Limitations / interpretation',r.limitations);
    const summaryPanel=card.createEl('details');summaryPanel.open=!r.findings;summaryPanel.createEl('summary',{text:r.summaryLabel+' — expand to read'});
    const summary=summaryPanel.createEl('p',{text:r.summary||'No abstract or substantive summary is stored in this note. Open the article/source to assess it.'});summary.style.whiteSpace='pre-wrap';
    if(r.summary.length>1400){
     summary.setText(r.summary.slice(0,1400)+'…');
     const expand=card.createEl('button',{text:'Show full summary'});expand.addEventListener('click',()=>{summary.setText(r.summary);expand.remove()});
    }
    const details=card.createEl('details');details.createEl('summary',{text:'Keyword matches'});details.createEl('p',{text:r.snippet});
    const select=card.createEl('label');const checkbox=select.createEl('input',{type:'checkbox'});checkbox.checked=this.selected.has(r.path);select.appendText(' Add to comparison');checkbox.onchange=()=>{if(checkbox.checked)this.selected.add(r.path);else this.selected.delete(r.path);compareButton.setText(`Compare selected (${this.selected.size})`)};
    card.createEl('button',{text:'Find similar / related studies'}).onclick=()=>this.showRelated(r.path,relationshipArea);
    card.createEl('small',{text:r.path});
   }
  };
  const compareButton=toolbar.createEl('button',{text:'Compare selected (0)'});compareButton.onclick=()=>this.showComparison(relationshipArea);
  toolbar.createEl('button',{text:'Review inbox'}).onclick=()=>this.showInbox(relationshipArea);
  toolbar.createEl('button',{text:'Topic evidence'}).onclick=()=>this.showTopics(relationshipArea,input.value);
  toolbar.createEl('button',{text:'Database health'}).onclick=()=>this.showDatabaseHealth(relationshipArea);
  toolbar.createEl('button',{text:'Publication status reports'}).onclick=()=>this.showPublicationReports(relationshipArea);
  toolbar.createEl('button',{text:'Semantic / LLM services'}).onclick=()=>this.showServices(relationshipArea,input.value);
  toolbar.createEl('button',{text:'Evidence lifecycle'}).onclick=()=>this.showLifecycle(relationshipArea);
  toolbar.createEl('button',{text:'Deeper search'}).onclick=()=>this.showDeep(relationshipArea,input.value);
  toolbar.createEl('button',{text:'Ask this collection'}).onclick=()=>this.showAsk(relationshipArea,input.value);
  const reset=()=>{clearTimeout(this.timer);this.selected.clear();compareButton.setText('Compare selected (0)');input.value='';for(const el of Object.values(filters))el.value='';run();input.focus();root.scrollTop=0};
  toolbar.createEl('button',{text:'Reset search'}).onclick=reset;
  input.addEventListener('search',()=>{clearTimeout(this.timer);run()});
  input.addEventListener('input',()=>{clearTimeout(this.timer);if(!input.value.trim()){run();return}this.timer=setTimeout(run,220)});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();reset()}else if(e.key==='Enter'){clearTimeout(this.timer);run()}});
  input.focus();
 }
 async showDatabaseHealth(area){area.empty();area.createEl('h3',{text:'Database health and daily maintenance'});area.createEl('p',{text:'Structural reconciliation, not evidence validation. Reports identify problems without silently rewriting collector notes or economic decisions.'});const files=this.app.vault.getFiles().filter(f=>/^economy_wiki\/Review\/maintenance\/[^/]+\.json$/.test(f.path)).sort((a,b)=>b.name.localeCompare(a.name));if(!files.length){area.createEl('p',{text:'No maintenance report available yet.'});return}try{const saved=JSON.parse(await this.readScoped(files[0]));const report=saved.audit?saved:{audit:saved};area.createEl('p',{text:'Latest saved report: '+files[0].basename});area.createEl('pre',{text:JSON.stringify({run:report.audit?.run,counts:report.audit?.counts,changes:report.audit?.changes?Object.fromEntries(Object.entries(report.audit.changes).map(([k,v])=>[k,Array.isArray(v)?v.length:v])):null,metadata:report.audit?.metadata,navigationIndex:report.audit?.navigationIndex,searchIndex:{state:report.searchIndex?.state,documents:report.searchIndex?.receipt?.stagedDocuments}},null,2)});const details=area.createEl('details');details.createEl('summary',{text:'Full audit findings'});details.createEl('pre',{text:JSON.stringify(report.audit?.issues||[],null,2)});area.createEl('p',{text:'New or changed findings require review. Hash matches do not imply economic correctness. No automatic merge, source deletion or economic approval.'})}catch(e){area.createEl('p',{text:'Report invalid: '+e.message})}}
 async showPublicationReports(area){area.empty();area.createEl('h3',{text:'Publication status reports'});area.createEl('p',{text:'Named-source checks only, not scientific validity or complete notice coverage. Use the monitoring CLI to refresh; stored reports never imply a paper is safe.'});const files=this.app.vault.getFiles().filter(f=>/^economy_wiki\/Review\/publication-status\/[^/]+\.json$/.test(f.path));if(!files.length)area.createEl('p',{text:'No durable reports yet.'});for(const f of files){try{const data=JSON.parse(await this.readScoped(f));area.createEl('h4',{text:f.basename});area.createEl('pre',{text:JSON.stringify(data.coverage||{coverage:data.initial?.coverage,retry:data.retry?.coverage,warning:data.warning},null,2)})}catch(e){area.createEl('p',{text:f.path+': '+e.message})}}}
 async showServices(area){
  area.empty();area.createEl('h3',{text:'Optional services — not configured by default'});
  area.createEl('p',{text:'Core keyword, BM25, graph, comparisons and extractive answers run offline without a model. No service starts automatically.'});
  area.createEl('p',{text:'Optional QMD CLI requires your explicit --vault (economy_wiki directory) and --tool-root, a separately installed QMD 2.8.3 and already cached models. Build may access the network if those models are absent. It stages only allowlisted compiled notes into a separate mirror; never index the whole vault.'});
  area.createEl('p',{text:'Optional synthesize-evidence.py requires an explicit --vault-root, --provider and --model. Only selected exact passages are transmitted, with provider charges/retention possible; output is an economist-review-needed draft. This panel never invokes providers or installs models.'});
  area.createEl('p',{text:'Optional monitor-publications.cjs queries Crossref metadata only when run explicitly. No host scheduler is installed.'});
 }
 async showLifecycle(area){
  area.empty();area.createEl('h3',{text:'Claim provenance and dependency freshness'});area.createEl('p',{text:'Hash freshness is not economic validation. Existing notes are not automatically converted into claim records. No claims means no coverage.'});
  const files=this.app.vault.getFiles().filter(f=>/^economy_wiki\/Claims\/[^/]+\.json$/.test(f.path));const claims=[],hashes={};let invalid=0;
  for(const file of files){try{const c=JSON.parse(await this.readScoped(file));const errors=validateClaim(c);if(errors.length){invalid++;area.createEl('p',{text:file.path+': '+errors.join('; ')});continue}if(!/^economy_wiki\/(raw|Sources)\//.test(c.sourcePath)||c.sourcePath.includes('..')){invalid++;area.createEl('p',{text:file.path+': source outside allowed provenance folders'});continue}claims.push(c);if(/^economy_wiki\/(raw|Sources)\//.test(c.sourcePath)&&!c.sourcePath.includes('..')){const source=this.app.vault.getAbstractFileByPath(c.sourcePath);if(source){const bytes=await this.readScoped(source,true);hashes[c.sourcePath]=require('node:crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex')}}}catch(e){invalid++;area.createEl('p',{text:file.path+': '+e.message})}}
  area.createEl('p',{text:`${claims.length} valid claim records · ${invalid} invalid · ${Object.keys(hashes).length} sources byte-checked`});for(const d of assessDependencies(claims,hashes))area.createEl('p',{text:d.id+' — '+d.state+' — '+d.reason});
  area.createEl('h4',{text:'Content-pinned review receipts'});area.createEl('p',{text:'Receipts must be created by an explicit authorized human action using the review CLI. This view verifies hashes only; identity and economic decisions are not authenticated.'});const receipts=this.app.vault.getFiles().filter(f=>/^economy_wiki\/Review\/receipts\/[^/]+\.json$/.test(f.path));
  for(const f of receipts){try{const data=JSON.parse(await this.readScoped(f));if(!/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\//.test(data.targetPath)||data.targetPath.includes('..'))throw Error('invalid target');const target=this.app.vault.getAbstractFileByPath(data.targetPath);area.createEl('p',{text:data.targetPath+' — '+(target?verifyReview(await this.readScoped(target),data.receipt).state:'missing')})}catch(e){area.createEl('p',{text:f.path+' — invalid: '+e.message})}}
 }
 async showDeep(area,query){area.empty();area.createEl('h3',{text:'Deeper search — local BM25 + graph'});area.createEl('p',{text:'Lexical/graph fusion, not semantic embeddings. Reads only compiled research folders; no cloud or model calls.'});const input=area.createEl('input',{value:query,placeholder:'Research question or keywords'}),out=area.createDiv();area.createEl('button',{text:'Run deeper search'}).onclick=async()=>{out.empty();const ix=[...this.index];const result=deepSearch(ix,input.value);for(const r of result.rows){const a=out.createEl('a',{text:r.paper.title,href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(r.paper.path,'',true)};out.createEl('p',{text:r.reason+' · score '+r.score.toFixed(3)});out.createEl('p',{text:r.paper.findings||r.paper.summary||'No findings stored'})}out.createEl('p',{text:String(result.limitations)})};
 }
 showComparison(area){
  area.empty();area.createEl('h3',{text:'Side-by-side study comparison'});const selected=this.index.filter(p=>this.selected.has(p.path));
  area.createEl('p',{text:`${selected.length} selected notes. No indirect policy comparison or economic equivalence is implied. Missing values remain unknown.`});if(!selected.length)return;
  const wrap=area.createDiv();wrap.style.overflow='auto';const table=wrap.createEl('table');const head=table.createEl('tr');head.createEl('th',{text:'Evidence dimension'});for(const p of selected){const cell=head.createEl('th');const a=cell.createEl('a',{text:p.title,href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(p.path,'',true)}}
  for(const [key,label]of [['evidence_kind','Evidence kind (declared, not validated)'],['research_question','Research question'],['identification_strategy','Identification strategy'],['estimand','Estimand'],['country','Country'],['product','Product'],['method','Method'],['population','Units / design'],['findings','Estimates and uncertainty — as stored'],['limitations','Limitations'],['evidence','Evidence scope'],['summary','Stored abstract / summary']]){const row=table.createEl('tr');row.createEl('th',{text:label});for(const p of selected){const cell=row.createEl('td',{text:p[key]||'Unknown / not separately extracted'});cell.style.cssText='min-width:280px;max-width:500px;white-space:pre-wrap;vertical-align:top'}}
 }
 showInbox(area){area.empty();area.createEl('h3',{text:'Review and maintenance inbox'});area.createEl('p',{text:'Metadata and extraction gaps only. Missing correction-check dates do not mean a correction exists; no online correction/retraction search has run.'});const rows=reviewInbox(this.index);area.createEl('p',{text:`${rows.length} notes needing attention`});for(const r of rows){const a=area.createEl('a',{text:r.paper.title,href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(r.paper.path,'',true)};area.createEl('p',{text:r.reasons.join(' · ')})}}
 showTopics(area,query){area.empty();area.createEl('h3',{text:'Topic evidence workspace'});area.createEl('p',{text:'Compiled topic notes are synthesis; a matching-paper list is not synthesis. Existing review states remain unchanged.'});for(const p of this.index.filter(p=>p.path.includes('/Topics/'))){const a=area.createEl('a',{text:p.title,href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(p.path,'',true)};area.createEl('p',{text:p.summary||'No summary stored'})}
  const q=area.createEl('input',{placeholder:'Topic or evidence question',value:query});const list=area.createDiv();area.createEl('button',{text:'Build evidence worksheet'}).onclick=()=>{list.empty();const {rows}=enhancedSearch(this.index.map(p=>({path:p.path,text:p.raw})),q.value);list.createEl('p',{text:`${rows.length} matching notes. Source-linked worksheet, not an AI-generated synthesis; disagreements and applicability need review.`});for(const p of rows){list.createEl('h4',{text:p.title});const a=list.createEl('a',{text:'Open evidence note',href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(p.path,'',true)};const t=list.createEl('p',{text:p.findings||p.summary||'No extracted findings'});t.style.whiteSpace='pre-wrap';list.createEl('p',{text:'Limits: '+(p.limitations||'Not recorded')})}};
 }
 showAsk(area,query){area.empty();area.createEl('h3',{text:'Ask this collection — local evidence mode'});area.createEl('p',{text:'Local extractive answers only: quotations with note citations, not LLM economic synthesis. No provider or data upload. Use focused keywords; selected comparison notes constrain retrieval when selected.'});const input=area.createEl('input',{placeholder:'Question / keywords',value:query});const out=area.createDiv();area.createEl('button',{text:'Find cited evidence'}).onclick=()=>{out.empty();const answer=evidenceAnswer(this.index,input.value,[...this.selected]);for(const claim of answer.claims){out.createEl('h4',{text:claim.title});out.createEl('blockquote',{text:claim.quote});const a=out.createEl('a',{text:claim.section+' — '+claim.path,href:'#'});a.onclick=e=>{e.preventDefault();this.app.workspace.openLinkText(claim.path,'',true)}}for(const gap of answer.gaps)out.createEl('p',{text:gap});if(!answer.claims.length)out.createEl('p',{text:'No source passages retrieved. This does not establish absence of evidence.'})};
 }
 catalog(){return (this.index||[]).filter(p=>Object.entries(this.filters||{}).every(([k,v])=>!v.value.trim()||String(p[k]||'').toLowerCase()===v.value.trim().toLowerCase()))}
 async renderPaperActions(area,paper){
  const controls=area.createDiv();controls.setAttribute('role','group');controls.setAttribute('aria-label','Paper navigation: '+paper.title);controls.createEl('small',{text:'Checking source navigation…'});
  try{const actions=await resolvePaperActions(this.app,paper);controls.empty();for(const action of actions){const button=controls.createEl('button',{text:action.label});button.setAttribute('aria-label',action.label+' — '+paper.title+' — '+action.target);button.title=action.target;button.onclick=async()=>{try{if(!await openPaperAction(this.app,action))controls.createEl('small',{text:'Target unavailable or unsafe; nothing opened.'})}catch{controls.createEl('small',{text:'Unable to open target.'})}}}if(!actions.some(a=>a.kind==='source'))controls.createEl('small',{text:'No verified source record. '});if(!actions.some(a=>a.kind==='pdf'))controls.createEl('small',{text:'No verified stored original PDF. '})}catch{controls.empty();controls.createEl('small',{text:'Source navigation unavailable; no original inferred.'})}
 }
 showGraph(area,filter='',kind='all',linkedOnly=false){
  area.empty();area.createEl('h3',{text:'Paper relationship network'});const controls=area.createDiv();const topic=controls.createEl('input',{placeholder:'Filter graph by economics topic',value:filter});const type=controls.createEl('select');for(const k of ['all','commentary-on','correction-of','follow-up-of','same-sample','recorded-link'])type.createEl('option',{text:k,value:k});type.value=kind;const isolateLabel=controls.createEl('label');const isolate=isolateLabel.createEl('input',{type:'checkbox'});isolate.setAttribute('aria-label','Linked notes only');isolate.checked=linkedOnly;isolateLabel.appendText(' Linked notes only (hide isolated records)');isolate.onchange=()=>this.showGraph(area,topic.value,type.value,isolate.checked);controls.createEl('button',{text:'Apply graph filters'}).onclick=()=>this.showGraph(area,topic.value,type.value,isolate.checked);
  area.createEl('p',{text:'Arrows show recorded wiki links; relation-type labels inferred from context are SUGGESTED, not verified and not proof of semantic direction. No economic agreement or causality implied.'});
  const scoped=this.catalog();const matching=new Set(filter?enhancedSearch(scoped.map(p=>({path:p.path,text:p.raw})),filter).rows.map(p=>p.path):scoped.map(p=>p.path));
  const edges=typedRelationships(scoped).filter(e=>(kind==='all'||e.kind===kind)&&matching.has(e.source)&&matching.has(e.target)),paths=new Set(edges.flatMap(e=>[e.source,e.target]));const nodes=scoped.filter(p=>matching.has(p.path)&&(!linkedOnly||paths.has(p.path)));
  const isolated=[...matching].filter(p=>!paths.has(p)).length;
  area.createEl('p',{text:`${nodes.length} displayed / ${matching.size} matching notes / ${scoped.length} notes within active metadata filters · ${edges.length} directed links · ${isolated} isolated notes ${linkedOnly?'hidden by Linked notes only':'shown (no invented edges)'}. ${this.index.length-scoped.length} notes excluded by metadata filters. Empty keyword and All link types show all nine indexed compiled categories, not Sources/raw duplicates.`});
  area.createEl('p',{text:'Click or Space selects a node and shows details above the graph. Double-click or Enter opens its wiki note in a split, keeping this dashboard open.'});
  const detail=area.createDiv();detail.setAttribute('aria-label','Selected paper details');detail.setAttribute('aria-live','polite');detail.createEl('p',{text:'Select a graph node to see wiki, source record and stored original controls here.'});
  const wrap=area.createDiv();wrap.style.overflow='auto';wrap.style.maxWidth='100%';wrap.style.width='100%';wrap.style.border='1px solid var(--background-modifier-border)';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1400 1100');svg.setAttribute('aria-label','Paper relationship network');svg.setAttribute('role','img');svg.style.width='1400px';svg.style.height='1100px';wrap.appendChild(svg);let zoom=1;const resize=()=>{svg.style.width=(1400*zoom)+'px';svg.style.height=(1100*zoom)+'px'};for(const [label,factor]of [['Zoom +',1.25],['Zoom −',0.8]])controls.createEl('button',{text:label}).onclick=()=>{zoom=Math.max(0.4,Math.min(3,zoom*factor));resize()};controls.createEl('button',{text:'Fit graph'}).onclick=()=>{zoom=Math.max(0.4,Math.min(1,wrap.clientWidth/1400));resize()};let drag=null;wrap.style.cursor='grab';wrap.onpointerdown=e=>{if(e.target.closest('g[role=button]'))return;drag={x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};wrap.setPointerCapture(e.pointerId)};wrap.onpointermove=e=>{if(drag){wrap.scrollLeft=drag.left+drag.x-e.clientX;wrap.scrollTop=drag.top+drag.y-e.clientY}};wrap.onpointerup=()=>{drag=null};wrap.style.maxHeight='650px';
  const make=(tag,attrs,parent=svg)=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.appendChild(el);return el};
  const defs=make('defs',{});const marker=make('marker',{id:'economics-arrow',viewBox:'0 0 10 10',refX:'10',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto'},defs);make('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'var(--text-muted)'},marker);
  const positions=new Map();nodes.forEach((p,i)=>{const angle=2*Math.PI*i/Math.max(1,nodes.length);positions.set(p.path,{x:700+470*Math.cos(angle),y:550+430*Math.sin(angle)})});
  for(const e of edges){const a=positions.get(e.source),b=positions.get(e.target);const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;const line=make('line',{x1:a.x+14*dx/dist,y1:a.y+14*dy/dist,x2:b.x-16*dx/dist,y2:b.y-16*dy/dist,stroke:'var(--text-muted)','stroke-width':'1.5','marker-end':'url(#economics-arrow)'});make('title',{},line).textContent=e.kind+' ['+e.status+'] — '+e.context;line.setAttribute('data-relation',e.kind);if(e.status==='suggested')line.setAttribute('stroke-dasharray','6 3');}
  nodes.forEach((p,i)=>{const pos=positions.get(p.path),g=make('g',{tabindex:'0',role:'button','aria-label':p.title});g.style.cursor='pointer';make('circle',{cx:pos.x,cy:pos.y,r:'12',fill:p.path.includes('/Topics/')?'var(--color-orange)':'var(--interactive-accent)'},g);const label=make('text',{x:pos.x+(pos.x<700?-19:19),y:pos.y+4,'text-anchor':pos.x<700?'end':'start',fill:'var(--text-normal)','font-size':'12'},g);label.textContent=(i+1)+'. '+p.title.slice(0,28)+(p.title.length>28?'…':'');make('title',{},g).textContent=p.title;
   const select=()=>{for(const el of svg.querySelectorAll('circle'))el.setAttribute('r','12');g.querySelector('circle').setAttribute('r','18');detail.empty();detail.createEl('h3',{text:p.title});this.renderPaperActions(detail,p);const text=detail.createEl('p',{text:p.findings||p.summary||'No extracted findings stored.'});text.style.whiteSpace='pre-wrap';detail.createEl('button',{text:'Explore related papers'}).onclick=()=>this.showRelated(p.path,detail);};const open=()=>openPaperAction(this.app,{kind:'wiki',target:p.path});g.setAttribute('aria-label',p.title+'. Click or Space to select; double-click or Enter to open wiki note in a split.');g.addEventListener('click',select);g.addEventListener('dblclick',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();if(e.key==='Enter')return open()}});
  });
  area.createEl('p',{text:'Scroll horizontally/vertically to inspect the network. Blue nodes: literature; orange: topic summaries. Recorded links only; inferred similarity is available under Explore related papers.'});
  area.scrollIntoView({behavior:'smooth',block:'start'});
 }
 showRelated(path,area){
  area.empty();const selected=this.index.find(p=>p.path===path);if(!selected)return;
  area.createEl('h3',{text:'Related to: '+selected.title});
  area.createEl('p',{text:'Solid links = recorded wikilinks. Dashed links = TF-IDF vocabulary similarity of titles/stored summaries. Neither establishes agreement, contradiction or independent samples.'});
  const scoped=this.catalog();if(!scoped.some(p=>p.path===path)){area.createEl('p',{text:'Selected note excluded by active metadata filters.'});return}this.renderPaperActions(area,selected);const ranked=relatedStudies(scoped,path);const shown=ranked.slice(0,8);
  area.createEl('p',{text:`Showing ${shown.length} of ${ranked.length} linked or vocabulary-overlap candidates.`});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 '+(100+shown.length*65));svg.style.width='100%';svg.style.maxHeight='650px';svg.setAttribute('role','img');svg.setAttribute('aria-label','Selected paper relationship map');area.appendChild(svg);
  const label=(x,y,text)=>{const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('fill','currentColor');t.setAttribute('font-size','14');t.textContent=text;svg.appendChild(t);return t};
  label(10,35,selected.title.slice(0,100));
  for(const [i,r]of shown.entries()){
   const y=90+i*65;const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1','30');line.setAttribute('y1','45');line.setAttribute('x2','130');line.setAttribute('y2',y);line.setAttribute('stroke','currentColor');if(!r.explicit)line.setAttribute('stroke-dasharray','5 5');svg.appendChild(line);const t=label(140,y,r.paper.title.slice(0,100));t.style.cursor='pointer';t.addEventListener('click',()=>openPaperAction(this.app,{kind:'wiki',target:r.paper.path}));
   const card=area.createDiv();card.createEl('h4',{text:r.paper.title});
   card.createEl('p',{text:(r.explicit?'Recorded link + ':'')+'Lexical similarity score: '+r.score.toFixed(3)+' (not a probability). Shared terms: '+r.sharedTerms.join(', ')});
   for(const edge of relationships(this.index).filter(e=>(e.source===path&&e.target===r.paper.path)||(e.target===path&&e.source===r.paper.path)))card.createEl('p',{text:'Recorded direction: '+(edge.source===path?'selected → candidate':'candidate → selected')+' · '+edge.context});
   const p=card.createEl('p',{text:r.paper.findings||r.paper.summary||'No findings/summary stored.'});p.style.whiteSpace='pre-wrap';
   this.renderPaperActions(card,r.paper);
   card.createEl('button',{text:'Explore this paper'}).onclick=()=>this.showRelated(r.paper.path,area);
  }
  area.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async onClose(){clearTimeout(this.timer)}
}
module.exports=class extends Plugin{
 async onload(){
  this.registerView(VIEW,leaf=>new SearchView(leaf,this));
  const open=async()=>{let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW,active:true})}await this.app.workspace.revealLeaf(leaf)};
  this.addCommand({id:'open-search',name:'Search economics wiki',callback:open});
  this.addRibbonIcon('search','Search economics wiki',open);
  this.registerObsidianProtocolHandler('economy-search',open);
 }
};
