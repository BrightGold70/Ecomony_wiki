'use strict';
const {paperFrontmatter}=require('./paper-navigation.cjs');
const {paperDetails}=require('./keyword-search.cjs');
const completenessLabels=Object.freeze({access:'Declared evidence access',design:'Data / sample / design',estimand:'Recorded estimand',identification:'Recorded identification strategy (not validated)',sample:'Sample period',vintage:'Dataset vintage',findings:'Findings',endpoint:'Numerical outcome / units',estimate:'Numerical estimate',uncertainty:'Numerical uncertainty',denominator:'Sample denominator',timepoint:'Numerical time point',limitations:'Limitations',source:'Recorded source link',pdf:'Verified stored PDF',review:'Recorded review status'});
function completenessText(value){return typeof value==='string'&&value.trim()&&!/^(?:[-*]\s*)?(?:pending|unknown|todo\b.*|tbd|n\/?a|none|null|not (?:yet )?(?:recorded|reported|available|assessed|extracted|reviewed))[.!]?$/i.test(value.trim())?value:''}
function completenessContent(value){
 // Strip container prefixes consistently before matching either end of a fence.
 const lines=[];let fence=null;
 for(const line of String(value||'').replace(/<!--[\s\S]*?-->/g,'').split(/\r?\n/)){
  const v=line.replace(/^(?:\s*(?:>\s?|[-+*]\s+|\d+[.)]\s+))+/,'').trim();
  const marker=v.match(/^(`{3,}|~{3,})(.*)$/);
  if(fence){if(marker&&marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;continue}
  if(marker){fence=marker[1];continue}
  lines.push(v);
 }
 return lines.some((v,i)=>{if(!v||/^#{1,6}\s|^- \[[ x]\]|^\[\[/.test(v))return false;if(/^\|/.test(v)){if(/^\|[\s:|\-]+\|$/.test(v)||/^\|[\s:|\-]+\|$/.test(lines[i+1]||''))return false;return v.split('|').some(cell=>!/^[-–—]+$/.test(cell.trim())&&completenessText(cell))}return !!completenessText(v)});
}
function evidenceCompleteness(paper,{actions=[]}={}){
 const raw=paper.raw??paper.text??'',m=paperFrontmatter(raw),d=paperDetails(raw),access=completenessText(m.evidence_scope)||completenessText(m.evidence_read)||completenessText(m.evidence_level)||'Not recorded';
 const numerical=Object.fromEntries(['endpoint','estimate','uncertainty','denominator','timepoint'].map(k=>[k,completenessText(m['outcome_'+k])||'Not recorded']));
 const sections=raw.split(/\r?\n(?=#{1,6}\s)/),data=sections.filter(s=>/^#{1,6}\s+(?:data|sample|units|scope and design|study design|population)/i.test(s)).join('\n');
 const fields={access:access!=='Not recorded',design:completenessContent(data||d.population),estimand:!!completenessText(m.estimand),identification:!!completenessText(m.identification_strategy),sample:!!completenessText(m.sample_period),vintage:!!completenessText(m.dataset_vintage),findings:completenessContent(d.findings),...Object.fromEntries(Object.entries(numerical).map(([k,v])=>[k,v!=='Not recorded'])),limitations:completenessContent(d.limitations),source:(Array.isArray(m.sources)&&m.sources.some(s=>typeof s==='string'&&/^economy_wiki\/Sources\/[^\n]+$/.test(s)))||/\[\[economy_wiki\/Sources\/[^\]\n]+\]\]/.test(raw)||actions.some(a=>a.kind==='source'),pdf:actions.some(a=>a.kind==='pdf'),review:!!completenessText(m.review_status)};
 return {path:paper.path,access,numerical,review:fields.review?m.review_status:'Not recorded',fields,missing:Object.keys(fields).filter(k=>!fields[k]),disclaimer:'Recorded presence only; completeness is not causal identification, economic validity, independent replication, economist approval or proof of full-text reading. Explicit not-applicable explanations may be appropriate for theory or descriptive work.'};
}
function evidenceWarnings(paper,index=[]){
 const m=paperFrontmatter(paper.raw??paper.text),warnings=[];const add=(status,message,target)=>warnings.push({status,message,...(target?{target}:{})});
 const versions=Array.isArray(m.related_versions)?m.related_versions:[];for(const target of versions)if(typeof target==='string'&&/^economy_wiki\/(Literature|Sources)\//.test(target))add('metadata-recorded','Recorded version relationship; working-paper and journal versions must not be counted as independent evidence.',target);
 if(/working[ -]?paper|journal|commentary|editorial|follow[ -]?up|secondary analysis/i.test(m.reference_role||''))add('metadata-recorded','Recorded publication role: '+m.reference_role+'. Verify version and sample overlap; this is not independent replication.');
 for(const key of ['sample_id','dataset_id','version_family']){const id=completenessText(m[key]);if(!id)continue;for(const other of index){if(other.path===paper.path)continue;if(paperFrontmatter(other.raw??other.text)[key]===id)add('unverified-suggestion','Shared recorded '+key+': '+id+'. Possible version/data/sample overlap only; independence is unverified. Check vintage and originals; no relationship was created.',other.path)}}
 return warnings;
}
module.exports={evidenceCompleteness,completenessLabels,evidenceWarnings};
