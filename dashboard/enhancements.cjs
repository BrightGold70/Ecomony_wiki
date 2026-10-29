'use strict';
const {searchNotes,safeNotePath}=require('./keyword-search.cjs');
const {relationships}=require('./dashboard-core.cjs');

// Deliberately small vocabulary, not an economic equivalence engine.
const ALIASES=[
 ['WTO','World Trade Organization','세계무역기구'],
 ['FDI','foreign direct investment','외국인직접투자','해외직접투자'],
 ['GVC','global value chain','global value chains','글로벌 가치사슬'],
 ['trade agreement','free trade agreement','FTA','RTA','free trade agreement','preferential trade agreement','free-trade agreement','regional trade agreement','자유무역협정','자유 무역 협정'],
 ['DiD','difference-in-differences','difference in differences','이중차분','이중 차분'],
 ['IV','instrumental variables','instrumental variable','도구변수','도구 변수'],
 ['tariff','관세'],
 ['CGE','computable-general-equilibrium','computable general equilibrium','일반균형모형','일반균형','연산가능 일반균형']
];
const stripFront=text=>String(text||'').replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
const allowed=safeNotePath;
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function matcher(alias){
 // Abbreviations must not match FTA116, preFTA or FTA_post.
 return new RegExp((/^[a-z0-9]+$/i.test(alias)?'(?<![a-z0-9_])':'')+escape(alias)+(/^[a-z0-9]+$/i.test(alias)?'(?![a-z0-9_])':''),'i');
}
function expandQuery(query){
 const text=String(query||'').trim(),groups=[],expansions=[];
 const phrases=ALIASES.flatMap(group=>group.map(alias=>({alias,group}))).sort((a,b)=>b.alias.length-a.alias.length);
 let rest=text;
 while(rest){
  const found=phrases.find(({alias})=>rest.slice(0,alias.length).toLowerCase()===alias.toLowerCase()&&(rest.length===alias.length||/\s/.test(rest[alias.length])));
  const token=found?found.alias:rest.match(/^\S+/)[0];
  const group=found?[...found.group]:[token];
  if(!groups.some(g=>JSON.stringify(g)===JSON.stringify(group))){groups.push(group);if(found)expansions.push(`${token} → ${group.join(' / ')}`)}
  rest=rest.slice(token.length).trimStart();
 }
 return {groups,expansions};
}
function enhancedSearch(notes,query,filters={}){
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.entries(filters).some(([k,v])=>!['country','product','method','evidence_kind'].includes(k)||typeof v!=='string'))throw new TypeError('Unsupported filter; use country, product, method, evidence_kind scalar strings');
 const {groups,expansions}=expandQuery(query);if(!groups.length)return {rows:[],expansions};
 const rows=[];
 for(const note of notes){
  if(note.isSymlink||!allowed(note.path))continue;
  const fields=metadata(note.text??note.raw??'');if(!Object.entries(filters).every(([k,v])=>!v||String(fields[k]||'').toLowerCase()===v.toLowerCase()))continue;
  const text=String(note.text??note.raw??''),body=stripFront(text);
  if(!groups.every(group=>group.some(alias=>matcher(alias).test(body))))continue;
  const aliases=groups.flat().filter(alias=>matcher(alias).test(body));
  // Extract exactly the established presentation fields, not a second summary implementation.
  const info=searchNotes([{path:note.path,text}],aliases[0])[0];if(!info)continue;
  const title=info.title;
  const matched=body.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('<!--')&&aliases.some(alias=>matcher(alias).test(line))).slice(0,3);
  rows.push({...info,snippet:matched.join(' … ').slice(0,650),score:groups.reduce((n,g)=>n+(g.some(a=>matcher(a).test(title))?10:0),0)});
 }
 return {rows:rows.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)),expansions};
}
function typedRelationships(index){
 return relationships(index.filter(p=>allowed(p.path))).map(edge=>{
  const context=String(edge.context||'');
  const candidates=[['commentary-on',/\b(commentary|editorial|comment on)\b|논평|사설/i],['correction-of',/\b(correction|erratum|corrigendum)\b|정정/i],['follow-up-of',/\bfollow[ -]?up\b|후속|추적/i],['same-sample',/\b(same[ -]sample|sample overlap|overlapping sample)\b|동일 코호트|코호트 중복/i]].filter(([,pattern])=>pattern.test(context));
  // Negation, uncertainty or several candidate types make the bare link safer.
  const uncertain=/\b(not|no|without|unknown|unclear|whether|unconfirmed)\b|아님|불명|미확인/i.test(context);
  const kind=candidates.length===1&&!uncertain?candidates[0][0]:'recorded-link';
  return {source:edge.source,target:edge.target,kind,status:kind==='recorded-link'?'recorded':'suggested',context:kind==='recorded-link'?context:context+'\nWarning: context-keyword suggestion only; original link direction does not establish semantic direction or economic verification.'};
 });
}
// Schema uses scalar YAML fields. Ignore comments outside quotes; never execute YAML tags.
function metadata(raw){
 const front=(String(raw||'').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)||[])[1]||'';
 const result=Object.create(null);
 for(const line of front.split(/\r?\n/)){
  const pair=line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);if(!pair)continue;
  let value=pair[2].trim();
  if(value.startsWith('"')){const m=value.match(/^"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/);if(!m)continue;try{value=JSON.parse('"'+m[1]+'"')}catch{continue}}
  else if(value.startsWith("'")){const m=value.match(/^'((?:''|[^'])*)'\s*(?:#.*)?$/);if(!m)continue;value=m[1].replace(/''/g,"'")}
  else value=value.replace(/\s+#.*$/,'').trim();
  result[pair[1].toLowerCase()]=value;
 }
 return result;
}
function sections(raw){
 const out=[];let heading='',lines=[];
 const flush=()=>{const quote=lines.join('\n').trim();if(quote)out.push({section:heading,quote});lines=[]};
 for(const line of stripFront(raw).split(/\r?\n/)){const m=line.match(/^#{1,6}\s+(.+)$/);if(m){flush();heading=m[1]}else lines.push(line)}flush();return out;
}
function substantive(text){
 const lines=String(text||'').replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/);
 return lines.some((line,i)=>{
  const value=line.trim();
  if(!value||/^(pending\.?|unknown\.?|not (yet )?(available|assessed|extracted)\.?|todo\b.*|tbd\.?|- \[[ x]\].*)$/i.test(value))return false;
  if(/^\|/.test(value))return !/^\|[\s:|\-]+\|$/.test(value)&&!/^\|[\s:|\-]+\|$/.test((lines[i+1]||'').trim());
  return true;
 });
}
// Optional asOf makes staleness deterministic for callers/tests. Old means >365 days.
function reviewInbox(index,asOf=new Date()){
 const now=new Date(asOf).getTime();
 return index.filter(p=>allowed(p.path)).map(paper=>{
  const raw=paper.raw??paper.text??'',meta=metadata(raw),parts=sections(raw),reasons=[];
  const findings=parts.filter(s=>/^(reported findings|supported findings|results|key findings|main findings|design, findings)/i.test(s.section));
  const summaries=parts.filter(s=>/abstract|초록|summary|요약|evidence|screening|findings|results|population|study question|design|interpretation|limitations/i.test(s.section)&&!/review status|economist|publication relationship|access|PDF/i.test(s.section));
  if(!findings.some(s=>substantive(s.quote)))reasons.push('missing findings');
  if(!summaries.some(s=>substantive(s.quote)))reasons.push('missing summary');
  const hasAbstract=parts.some(s=>/^(abstract|published abstract|초록|摘要)$/i.test(s.section)&&substantive(s.quote));
  const declaredAbstract=/abstract[ -]only/i.test([meta.extraction_status,meta.source_scope,meta.evidence_scope,meta.source_mode].filter(Boolean).join(' '));
  if(declaredAbstract||(hasAbstract&&!summaries.some(s=>!/abstract|초록|摘要/i.test(s.section)&&substantive(s.quote))))reasons.push('abstract-only');
  if(!summaries.some(s=>substantive(s.quote)))reasons.push('metadata-only');
  if(String(meta.review_status||'').toLowerCase()!=='economist-reviewed')reasons.push('unreviewed (no recorded economist-reviewed status)');
  if(/^(true|yes|1|contested)$/i.test(meta.contested||''))reasons.push('contested');
  if(/^low$/i.test(meta.confidence||''))reasons.push('low confidence');
  const date=meta.correction_check_date;
  if(!date||/^(null|~|unknown|pending)$/i.test(date))reasons.push('missing correction_check_date');
  else {
   const stamp=Date.parse(date);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date)reasons.push('invalid correction_check_date');
   else if(now-stamp>365*24*60*60*1000)reasons.push('old correction_check_date (>365 days)');
  }
  return {paper,reasons};
 }).filter(row=>row.reasons.length);
}
const QUESTION_STOP=new Set('what which who how does do did is are was were can could should would the a an and or of to in for with from by on at about reported report evidence findings results study studies paper papers please tell me show compare versus vs'.split(' '));
function evidenceAnswer(index,question,paths=[]){
 const answer={question,mode:'extractive',claims:[],gaps:['Local copied quotations only; publication claims and economic applicability are not independently verified.']};
 const selected=new Set(paths),available=index.filter(p=>allowed(p.path)&&(!selected.size||selected.has(p.path)));
 if(selected.size){const known=new Set(available.map(p=>p.path));if(paths.some(path=>!known.has(path)))answer.gaps.push('Some selected paths are unavailable or outside the research-note scope; selection was not broadened.');}
 // Keep controlled multiword aliases intact before dropping natural-language scaffolding.
 const cleaned=String(question||'').replace(/[?？!。,;:]/g,' ').trim();
 const {groups}=expandQuery(cleaned);
 const keywords=groups.filter(group=>group.length>1||!QUESTION_STOP.has(group[0].toLowerCase())).map(group=>group[0]).join(' ');
 if(!keywords){answer.gaps.push('Supply a question with searchable keywords.');return answer;}
 const notes=available.map(p=>({path:p.path,text:p.raw??p.text??''}));
 const {rows}=enhancedSearch(notes,keywords);
 if(!rows.length){answer.gaps.push('No local keyword matches within the requested scope; this is not evidence of absence.');return answer;}
 const queryGroups=expandQuery(keywords).groups;
 for(const row of rows){
  const note=notes.find(n=>n.path===row.path);
  const useful=sections(note.text).filter(s=>/abstract|초록|摘要|summary|요약|evidence|screening|study question|population|design|findings|results|interpretation|limitations|limits|scope/i.test(s.section)&&!/economist|review status|access|PDF|publication relationship|unresolved/i.test(s.section)&&substantive(s.quote));
  const matching=useful.filter(s=>queryGroups.some(g=>g.some(a=>matcher(a).test(s.quote))));
  // A title-only match may still point at a relevant stored section. Never quote metadata as findings.
  for(const section of matching.length?matching:useful){
   if(answer.claims.length===8)break;
   answer.claims.push({path:row.path,title:row.title,quote:section.quote,section:section.section});
  }
  if(!useful.length)answer.gaps.push(`No quotable evidence section stored for ${row.path}.`);
  if(answer.claims.length===8){answer.gaps.push('Output limited to at most 8 quotation rows; additional local material may not be shown.');break;}
 }
 if(answer.claims.some(c=>/abstract|초록|摘要/i.test(c.section)))answer.gaps.push('Stored abstracts are excerpts, not confirmation that full text was reviewed.');
 return answer;
}
module.exports={expandQuery,enhancedSearch,typedRelationships,reviewInbox,evidenceAnswer};
