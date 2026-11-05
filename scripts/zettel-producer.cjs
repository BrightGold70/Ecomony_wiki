'use strict';
// Explicit local payload validation only: no model, collector or economic approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readSafe,noSymlinks}=require('./safe-fs.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error(m)};
function text(v,label){if(typeof v!=='string'||!v.trim()||v.includes('\0'))fail('Required text: '+label);return v;}
function relative(v){text(v,'path');if(v.includes('\\')||v.startsWith('/')||v.split('/').some(x=>!x||x.startsWith('.')||['raw','private','credentials','secrets'].includes(x.toLowerCase()))||/[\x00-\x1f#|\[\]]/.test(v))fail('Unsafe path: '+v);return v;}
function inside(root,file){return file===root||file.startsWith(root+path.sep);}
function list(v,label){if(!Array.isArray(v))fail('Expected list: '+label);return v;}
function keys(o,allowed,label){if(!o||typeof o!=='object'||Array.isArray(o))fail('Expected object: '+label);for(const k of Object.keys(o))if(!allowed.includes(k))fail('Unknown '+label+' field: '+k);}
function researchPath(p){relative(p);if(!/^economy_wiki\/(Sources|Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries|Ideas|Questions|Review)\/.+\.md$/.test(p))fail('Expected authorized research Markdown path: '+p);return p;}
function pinned(root,p,h){researchPath(p);if(!/^[a-f0-9]{64}$/.test(h))fail('Invalid SHA256: '+p);const b=readSafe(path.join(root,p));if(sha(b)!==h)fail('Hash mismatch: '+p);return b;}
function locatedQuote(bytes,loc,quote){keys(loc,['start_line','end_line','label'],'locator');text(loc.label,'locator label');const {start_line:s,end_line:e}=loc;const lines=bytes.toString('utf8').split(/\r?\n/);if(!Number.isInteger(s)||!Number.isInteger(e)||s<1||e<s||e>lines.length)fail('Invalid locator');if(!lines.slice(s-1,e).join('\n').includes(text(quote,'quote')))fail('Exact quote not in locator');}
function versionValue(body){const fm=body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]||'';for(const key of ['version_key','version'])if([...fm.matchAll(new RegExp('^'+key+':','gm'))].length>1)fail('Duplicate source version field: '+key);return ['version_key','version'].flatMap(key=>[...fm.matchAll(new RegExp('^'+key+':[ \\t]*([^\\r\\n]+)$','gm'))].map(m=>{let v=m[1].trim();if(v.startsWith('"')){try{return JSON.parse(v)}catch{return ''}}return v.replace(/^'(.*)'$/,'$1');})).filter(Boolean);}
// Keep canonical output aligned with dashboard/study-reading.cjs IDEA_RELATIONS.
const RELATIONS=['supports','challenges','qualifies','mechanism','measurement','same-cohort','unresolved','developed-by','contextualized-by','qualified-by','continues','supported-by'];
// Legacy input vocabulary only; explanations retain the specific intended meaning.
const RELATION_ALIASES=Object.freeze({'same-dataset':'same-cohort',replication:'supports','conflicts-with':'challenges',extends:'continues','applies-to':'contextualized-by',supersedes:'continues','same-cohort-as':'same-cohort','independent-support-for':'supports',addresses:'unresolved'});
function validateProposal(vault,p){
 const root=path.resolve(vault);noSymlinks(root);keys(p,['schema_version','notes','references'],'proposal');if(p.schema_version!==1||!list(p.notes,'notes').length)fail('Expected schema_version 1 and nonempty notes');
 const planned=new Set(p.notes.map(n=>relative(n.path)));if(planned.size!==p.notes.length)fail('Duplicate target');
 const references=new Map();for(const r of list(p.references||[],'references')){keys(r,['path','sha256'],'reference');if(references.has(r.path))fail('Duplicate reference');pinned(root,r.path,r.sha256);references.set(r.path,r.sha256);}
 const ref=s=>{relative(s);if(!s.endsWith('.md')||!s.startsWith('economy_wiki/'))fail('Expected full research Markdown link');if(!planned.has(s)){if(!references.has(s))fail('Existing reference needs current hash: '+s);pinned(root,s,references.get(s));}return '[['+s+']]';};
 let evidenceChecked=0;
 const notes=p.notes.map(n=>{
  keys(n,['path','type','title','review_status','question_links','questions','evidence','relations','proposition','explanation','applicability_uncertainty','open_question','current_interpretation','supporting_evidence','conflicting_evidence','conflict_status','applicability','unresolved_questions','review_status_text','target_path','target_sha256','essential_finding','population_comparison','key_result','main_limitation','relevance_to_question'],'note');
  const target=relative(n.path),title=text(n.title,'title');if(/[\r\n]/.test(title))fail('Title must be single line');
  const folder={idea:'Ideas',question:'Questions','study-essential-summary':'Review/readability-pilot'}[n.type];if(!folder||!target.startsWith('economy_wiki/'+folder+'/')||!target.endsWith('.md'))fail('Unsupported type or target path');
  if(n.review_status!==undefined&&n.review_status!=='economist-review-needed')fail('Economic approval forbidden');
  noSymlinks(path.join(root,target),true);if(fs.existsSync(path.join(root,target)))fail('Target exists: '+target);
  const links=(a,label)=>list(a,label).map(ref);
  const evidenceRecords=[];
  const evidence=list(n.evidence||[],'evidence').map(e=>{
   keys(e,['source','source_sha256','source_version','version_locator','locator','quote','evidence_scope','cohort_id','relationship','independence','independence_basis'],'evidence');
   if(!relative(e.source).startsWith('economy_wiki/'))fail('Evidence outside research root');
   const b=pinned(root,e.source,e.source_sha256);text(e.source_version,'source_version');
   if(e.version_locator)locatedQuote(b,e.version_locator,e.source_version);
   if(!versionValue(b.toString('utf8')).includes(e.source_version)&&!e.version_locator)fail('Source version mismatch: '+e.source);
   text(e.evidence_scope,'evidence_scope');text(e.cohort_id,'cohort_id');text(e.independence_basis,'independence_basis');locatedQuote(b,e.locator,e.quote);
   if(!['supports','conflicts-with','qualifies','context'].includes(e.relationship))fail('Invalid evidence relationship');
   if(!['same-cohort','independent','unknown'].includes(e.independence))fail('Invalid independence');
   const locator=e.locator.label+' (lines '+e.locator.start_line+'–'+e.locator.end_line+')';
   // Stable identity of the exact source revision, range and quote; not array position.
   const id='evidence-'+sha(JSON.stringify([e.source,e.source_sha256,e.source_version,e.locator.start_line,e.locator.end_line,e.locator.label,e.quote]));
   evidenceRecords.push({id,path:e.source,sha256:e.source_sha256,version:e.source_version,locator,quote:e.quote,...(e.version_locator?{version_locator:e.version_locator}:{})});
   evidenceChecked++;return '- [['+e.source+']] — '+e.relationship+'; version: '+e.source_version+'; SHA256: '+e.source_sha256+'; '+e.locator.label+' (lines '+e.locator.start_line+'–'+e.locator.end_line+'); scope: '+e.evidence_scope+'; sample: '+e.cohort_id+'; '+e.independence+' ('+e.independence_basis+')\n  > '+e.quote.replace(/\n/g,'\n  > ');
  });
  if(n.questions&&n.question_links)fail('Use questions or question_links, not both');
  const questionPaths=n.questions||n.question_links||[];const questions=links(questionPaths,'questions');
  for(const q of questionPaths)if(!q.startsWith('economy_wiki/Questions/'))fail('Question link outside Questions');
  const relations=list(n.relations||[],'relations').map(r=>{keys(r,['target','type','explanation','status'],'relation');ref(r.target);text(r.explanation,'relation explanation');const type=Object.hasOwn(RELATION_ALIASES,r.type)?RELATION_ALIASES[r.type]:r.type;if(!RELATIONS.includes(type)||!['suggested','recorded'].includes(r.status))fail('Invalid typed relation');return {...r,type};});
  const connections=relations.map(r=>'- '+ref(r.target)+' — '+r.type+' ('+r.status+'): '+r.explanation).join('\n')||'No justified typed relationship recorded; no link quota.';
  let body,extra='';
  if(n.type==='idea'){
   if(!questions.length||!evidence.length)fail('Idea needs a question and evidence');
   body=[['Proposition',text(n.proposition,'proposition')],['Explanation',text(n.explanation,'explanation')],['Evidence',evidence.join('\n')],['Applicability and uncertainty',text(n.applicability_uncertainty,'applicability_uncertainty')],['Connections',connections],['Open question',text(n.open_question,'open_question')]];
  }else if(n.type==='question'){
   const supporting=links(n.supporting_evidence,'supporting_evidence'),conflicting=links(n.conflicting_evidence,'conflicting_evidence');if(!supporting.length&&!conflicting.length)fail('Question needs explicit supporting or conflicting links');
   body=[['Current interpretation',text(n.current_interpretation,'current_interpretation')],['Supporting evidence',supporting.join('\n')||'None recorded.'],['Conflicting evidence',[...conflicting,text(n.conflict_status,'conflict_status')].join('\n')],['Applicability',text(n.applicability,'applicability')],['Unresolved questions',text(n.unresolved_questions,'unresolved_questions')],['Review status','Economist review needed. '+text(n.review_status_text,'review_status_text')]];
  }else{
   if(!/^economy_wiki\/(Sources|Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\/.+\.md$/.test(researchPath(n.target_path)))fail('Essential target must be a compiled category or Source');pinned(root,n.target_path,n.target_sha256);if(!evidence.length||!questions.length)fail('Essential summary needs evidence and question');
   extra='target_path: '+JSON.stringify(n.target_path)+'\ntarget_sha256: '+n.target_sha256+'\n';
   body=[['Essential study summary',['### Essential finding\n\n'+text(n.essential_finding,'essential_finding'),'### Population and comparison\n\n'+text(n.population_comparison,'population_comparison'),'### Key result\n\n'+text(n.key_result,'key_result'),'### Main limitation\n\n'+text(n.main_limitation,'main_limitation'),'### Relevance to question\n\n'+text(n.relevance_to_question,'relevance_to_question')].join('\n\n')],['Evidence',evidence.join('\n')]];
  }
  const front='---\ntitle: '+JSON.stringify(title)+'\ntype: '+n.type+'\nreview_status: economist-review-needed\nquestions: '+JSON.stringify(questionPaths)+'\nrelations: '+JSON.stringify(relations)+'\nevidence_records: '+JSON.stringify(evidenceRecords)+'\n'+extra+'---\n';
  return {path:target,content:front+'\n# '+title+'\n\n'+body.map(([h,b])=>'## '+h+'\n\n'+b).join('\n\n')+'\n'};
 });
 for(const n of notes)for(const m of n.content.matchAll(/\[\[([^\]]+)\]\]/g)){const target=m[1];if(!planned.has(target)&&!references.has(target)&&!p.notes.some(note=>(note.evidence||[]).some(e=>e.source===target)))fail('Unbound body link: '+target);}
 for(const n of p.notes){const evidence=n.evidence||[];for(const e of evidence)if(e.independence==='independent'&&evidence.some(other=>other!==e&&other.cohort_id===e.cohort_id))fail('Independent support cannot share cohort_id');}
 return {schema_version:1,mode:'preview',evidence_checked:evidenceChecked,references_checked:references.size,notes,warnings:['Mechanical validation only; exact quotes do not prove entailment, independence, source authenticity or economic validity.','No source changes, index/log updates, provider calls or economist approval.']};
}
function main(argv){
 const args={};for(let i=0;i<argv.length;i++){const k=argv[i];if(!['--vault','--proposal','--out','--apply'].includes(k)||args[k])fail('Usage: --vault ROOT --proposal JSON [--out EXTERNAL_JSON] [--apply]');if(k==='--apply')args[k]=true;else{if(!argv[i+1]||argv[i+1].startsWith('--'))fail('Missing value: '+k);args[k]=argv[++i];}}
 if(!args['--vault']||!args['--proposal'])fail('Required --vault and --proposal');const root=path.resolve(args['--vault']);
 if(args['--out']){const out=path.resolve(args['--out']);noSymlinks(out,true);if(inside(root,out))fail('Output must be outside vault');if(fs.existsSync(out))fail('Output exists');}
 const proposal=JSON.parse(readSafe(args['--proposal']).toString('utf8'));let result=validateProposal(root,proposal);
 if(args['--apply']){
  // Revalidate current evidence immediately before creating files. No overwrite/retry merge.
  result=validateProposal(root,proposal);for(const n of result.notes){const file=path.join(root,n.path);noSymlinks(file,true);fs.mkdirSync(path.dirname(file),{recursive:true});noSymlinks(file,true);fs.writeFileSync(file,n.content,{flag:'wx'});if(readSafe(file).toString('utf8')!==n.content)fail('Apply readback mismatch: '+n.path);}result.mode='apply';
 }
 if(args['--out'])fs.writeFileSync(args['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx'});else console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={validateProposal,main};
