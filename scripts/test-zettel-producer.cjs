'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const cli=path.join(__dirname,'zettel-producer.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t){
 const base=fs.realpathSync(process.env.TMPDIR||path.join(os.homedir(),'.hermes/cache/scratch'));
 const dir=fs.mkdtempSync(path.join(base,'zettel-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const vault=path.join(dir,'vault');fs.mkdirSync(path.join(vault,'economy_wiki/Sources'),{recursive:true});
 const source='---\ntitle: Synthetic study\nversion_key: synthetic-v1\n---\n# Synthetic only\nThe synthetic sample had ten observations.\n';
 const sourcePath='economy_wiki/Sources/synthetic.md';fs.writeFileSync(path.join(vault,sourcePath),source);
 const proposal={schema_version:1,notes:[{path:'economy_wiki/Ideas/synthetic.md',type:'idea',title:'A synthetic proposition',question_links:['economy_wiki/Questions/synthetic.md'],proposition:'A synthetic observation may apply only to the recorded sample.',explanation:'A test-only paraphrase, not economic evidence.',evidence:[{source:sourcePath,source_sha256:sha(source),source_version:'synthetic-v1',locator:{start_line:6,end_line:6,label:'Synthetic sentence'},quote:'The synthetic sample had ten observations.',evidence_scope:'synthetic',cohort_id:'synthetic-sample',relationship:'supports',independence:'unknown',independence_basis:'Only one synthetic sample inspected.'}],applicability_uncertainty:'Synthetic only; not generalizable.',relations:[],open_question:'Would an independent sample support this?'},{path:'economy_wiki/Questions/synthetic.md',type:'question',title:'What does the synthetic study support?',current_interpretation:'One draft idea; no economic conclusion.',supporting_evidence:['economy_wiki/Ideas/synthetic.md'],conflicting_evidence:[],conflict_status:'Not assessed beyond the selected fixture.',applicability:'Synthetic only.',unresolved_questions:'Independent replication is absent.',review_status_text:'Pending economist review; fixture only.'}],references:[]};
 function run(extra=[]){const p=path.join(dir,'proposal.json');fs.writeFileSync(p,JSON.stringify(proposal));return spawnSync(process.execPath,[cli,'--vault',vault,'--proposal',p,...extra],{encoding:'utf8'});}
 return {dir,vault,proposal,run,source,sourcePath};
}
test('explicit proposal previews real evidence-linked drafts without mutating vault',t=>{
 const f=fixture(t),out=path.join(f.dir,'preview.json');const before=fs.readdirSync(f.vault,{recursive:true});const r=f.run(['--out',out]);
 assert.equal(r.status,0,r.stderr);const result=JSON.parse(fs.readFileSync(out,'utf8'));
 assert.equal(result.mode,'preview');assert.equal(result.notes.length,2);assert.equal(result.evidence_checked,1);
 assert.match(result.notes[0].content,/type: idea/);assert.match(result.notes[0].content,/## Proposition/);assert.match(result.notes[0].content,/## Applicability and uncertainty/);assert.match(result.notes[0].content,/synthetic-v1/);
 assert.match(result.notes[1].content,/## Conflicting evidence/);assert.deepEqual(fs.readdirSync(f.vault,{recursive:true}),before);
 assert.equal(fs.readFileSync(path.join(f.vault,f.sourcePath),'utf8'),f.source);
});
test('rejects stale evidence, wrong exact quotes, version drift and broken references',t=>{
 for(const [label,change] of [
  ['hash',f=>f.proposal.notes[0].evidence[0].source_sha256='0'.repeat(64)],
  ['quote',f=>f.proposal.notes[0].evidence[0].quote='Invented result'],
  ['version',f=>f.proposal.notes[0].evidence[0].source_version='wrong'],
  ['reference',f=>f.proposal.notes[0].question_links=['economy_wiki/Questions/missing.md']],
  ['path',f=>f.proposal.notes[0].path='economy_wiki/Sources/overwrite.md'],
  ['review',f=>f.proposal.notes[0].review_status='economist-reviewed'],
  ['outside out',f=>{}]
 ]){const f=fixture(t);change(f);const r=f.run(label==='outside out'?['--out',path.join(f.vault,'preview.json')]:[]);assert.notEqual(r.status,0,label);}
});
test('economics dataset and replication aliases preserve explained meanings in canonical vocabulary',t=>{
 const f=fixture(t);f.proposal.notes[0].relations=['same-dataset','replication'].map(type=>({target:f.proposal.notes[1].path,type,status:'suggested',explanation:'Synthetic '+type+' claim; no independent replication established.'}));const r=f.run();assert.equal(r.status,0,r.stderr);const relations=JSON.parse(/^relations: (.*)$/m.exec(JSON.parse(r.stdout).notes[0].content)[1]);assert.deepEqual(relations.map(r=>r.type),['same-cohort','supports']);assert.match(relations[0].explanation,/same-dataset/);
});
test('typed relationships retain suggested status and explanation; no quota',t=>{
 const f=fixture(t);f.proposal.notes[0].relations=[{target:'economy_wiki/Questions/synthetic.md',type:'qualifies',explanation:'The selected sample limits this question.',status:'suggested'}];
 let r=f.run();assert.equal(r.status,0,r.stderr);assert.match(JSON.parse(r.stdout).notes[0].content,/The selected sample limits/);
 f.proposal.notes[0].relations[0].explanation='';assert.notEqual(f.run().status,0);
});
test('producer output preserves dashboard relations and explicitly normalizes legacy aliases',async t=>{
 const {scanReadingWorkspace,IDEA_RELATIONS}=require('../dashboard/study-reading.cjs'),f=fixture(t);
 const aliases={'same-dataset':'same-cohort',replication:'supports','conflicts-with':'challenges',extends:'continues','applies-to':'contextualized-by',supersedes:'continues','same-cohort-as':'same-cohort','independent-support-for':'supports',addresses:'unresolved'};
 const types=[...IDEA_RELATIONS,...Object.keys(aliases)];
 f.proposal.notes[0].relations=types.map((type,i)=>({target:f.proposal.notes[1].path,type,explanation:'Explicit '+type+' meaning; not economic agreement.',status:i%2?'recorded':'suggested'}));
 const r=f.run(['--apply']);assert.equal(r.status,0,r.stderr);
 const result=await scanReadingWorkspace({vault:{getMarkdownFiles:()=>f.proposal.notes.map(n=>({path:n.path})),getAbstractFileByPath:p=>f.proposal.notes.some(n=>n.path===p)?{path:p}:null,adapter:{getBasePath:()=>f.vault},read:async file=>fs.readFileSync(path.join(f.vault,file.path),'utf8')}});
 assert.equal(result.ideas.length,1);assert.equal(result.questions.length,1);assert.equal(result.skipped,0);
 assert.deepEqual(result.ideas[0].relations,f.proposal.notes[0].relations.map(r=>({...r,type:aliases[r.type]||r.type})));
 assert.equal(fs.readFileSync(path.join(f.vault,f.sourcePath),'utf8'),f.source);
});
test('producer evidence records survive actual output scanning with stable content-bound IDs',async t=>{
 const {scanReadingWorkspace}=require('../dashboard/study-reading.cjs'),f=fixture(t),e=f.proposal.notes[0].evidence[0];
 f.proposal.notes[0].relations=[{target:f.proposal.notes[1].path,type:'challenges',explanation:'Synthetic question remains open.',status:'suggested'}];
 // Same quote at a different exact range must have a different evidence identity.
 const source=f.source+e.quote+'\n';fs.writeFileSync(path.join(f.vault,f.sourcePath),source);e.source_sha256=sha(source);
 f.proposal.notes[0].evidence.push({...e,locator:{start_line:7,end_line:7,label:'Repeated synthetic sentence'}});
 const preview=f.run();assert.equal(preview.status,0,preview.stderr);const draft=JSON.parse(preview.stdout);
 const recordsOf=content=>JSON.parse(/^evidence_records: (.*)$/m.exec(content)[1]);
 const expectedIds=f.proposal.notes[0].evidence.map(e=>'evidence-'+sha(JSON.stringify([e.source,e.source_sha256,e.source_version,e.locator.start_line,e.locator.end_line,e.locator.label,e.quote])));
 assert.deepEqual(recordsOf(draft.notes[0].content).map(e=>e.id),expectedIds);
 f.proposal.notes[0].evidence.reverse();const reordered=f.run();assert.equal(reordered.status,0,reordered.stderr);
 assert.deepEqual(recordsOf(JSON.parse(reordered.stdout).notes[0].content).map(e=>e.id),expectedIds.toReversed());f.proposal.notes[0].evidence.reverse();
 const r=f.run(['--apply']);assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout).notes,draft.notes);
 const result=await scanReadingWorkspace({vault:{getMarkdownFiles:()=>f.proposal.notes.map(n=>({path:n.path})),getAbstractFileByPath:p=>f.proposal.notes.some(n=>n.path===p)?{path:p}:null,adapter:{getBasePath:()=>f.vault},read:async file=>fs.readFileSync(path.join(f.vault,file.path),'utf8')}});
 assert.equal(result.ideas.length,1,JSON.stringify(result));assert.deepEqual(result.ideas[0].relations,f.proposal.notes[0].relations);const records=result.ideas[0].evidence;assert.equal(records.length,2);
 assert.notEqual(records[0].id,records[1].id);
 for(const [i,record] of records.entries()){
  const original=f.proposal.notes[0].evidence[i];assert.match(record.id,/^evidence-[a-f0-9]{64}$/);
  assert.deepEqual(record,{id:record.id,path:original.source,sha256:original.source_sha256,version:original.source_version,locator:original.locator.label+' (lines '+original.locator.start_line+'–'+original.locator.end_line+')',quote:original.quote});
 }
 assert.equal(fs.readFileSync(path.join(f.vault,f.sourcePath),'utf8'),source);
});
test('essential summary is explicit, pinned to existing Literature bytes, and draft only',async t=>{
 const f=fixture(t),target='economy_wiki/Literature/study.md';fs.mkdirSync(path.join(f.vault,'economy_wiki/Literature'));fs.writeFileSync(path.join(f.vault,target),'# Synthetic literature\n');
 f.proposal.notes.push({path:'economy_wiki/Review/readability-pilot/study.md',type:'study-essential-summary',title:'Synthetic study essentials',target_path:target,target_sha256:sha('# Synthetic literature\n'),essential_finding:'Explicit paraphrase.',population_comparison:'Synthetic sample, no comparison.',key_result:'Ten synthetic observations.',main_limitation:'Fixture only.',relevance_to_question:'No economic relevance.',question_links:['economy_wiki/Questions/synthetic.md'],evidence:f.proposal.notes[0].evidence});
 let r=f.run();assert.equal(r.status,0,r.stderr);assert.match(JSON.parse(r.stdout).notes[2].content,/## Essential study summary/);
 assert.equal(fs.readFileSync(path.join(f.vault,target),'utf8'),'# Synthetic literature\n');
 const keyResult=f.proposal.notes[2].key_result;delete f.proposal.notes[2].key_result;const invalid=f.run();assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Required text: key_result/);f.proposal.notes[2].key_result=keyResult;
 r=f.run(['--apply']);assert.equal(r.status,0,r.stderr);
 assert.equal(fs.readFileSync(path.join(f.vault,target),'utf8'),'# Synthetic literature\n');assert.equal(fs.readFileSync(path.join(f.vault,f.sourcePath),'utf8'),f.source);
 const m=require('../dashboard/reading-metadata.cjs').referenceMetadata(fs.readFileSync(path.join(f.vault,f.proposal.notes[2].path),'utf8'));assert.equal(m.evidence_records.length,1);assert.equal(m.evidence_records[0].version,'synthetic-v1');
 const app={vault:{getMarkdownFiles:()=>f.proposal.notes.map(n=>({path:n.path})),getAbstractFileByPath:p=>fs.existsSync(path.join(f.vault,p))?{path:p}:null,adapter:{getBasePath:()=>f.vault},read:async file=>fs.readFileSync(path.join(f.vault,file.path),'utf8')}};
 const {scanReadingWorkspace,resolveEssentialSummary}=require('../dashboard/study-reading.cjs'),scanned=await scanReadingWorkspace(app);assert.equal(scanned.sidecars.length,1);const summary=await resolveEssentialSummary(app,{path:target},scanned.sidecars);assert.equal(summary.status,'prepared');assert.equal(summary.path,f.proposal.notes[2].path);assert.deepEqual(summary.questions,[f.proposal.notes[1].path]);assert.equal(m.target_sha256,sha(fs.readFileSync(path.join(f.vault,target))));
});
test('apply is additive, preflights collisions and preserves source bytes',t=>{
 const f=fixture(t);let r=f.run(['--apply']);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).mode,'apply');
 assert.match(fs.readFileSync(path.join(f.vault,f.proposal.notes[0].path),'utf8'),/## Proposition/);
 assert.equal(fs.readFileSync(path.join(f.vault,f.sourcePath),'utf8'),f.source);r=f.run(['--apply']);assert.notEqual(r.status,0);
});
test('rejects unbound body links and false independent support from the same recorded sample',t=>{
 const f=fixture(t);f.proposal.notes[0].explanation+=' [[economy_wiki/Topics/missing.md]]';assert.notEqual(f.run().status,0);
 f.proposal.notes[0].explanation='Explicit explanation.';const e=f.proposal.notes[0].evidence[0];f.proposal.notes[0].evidence.push({...e,independence:'independent'});assert.notEqual(f.run().status,0);
});
test('initializer additively creates Ideas Questions and essential templates',t=>{
 const f=fixture(t),{initWiki}=require('./init-wiki.cjs');initWiki(f.vault);
 for(const p of ['Ideas','Questions','Review/readability-pilot','Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries','Templates/Idea.md','Templates/Question.md','Templates/Study-essential-summary.md'])assert.ok(fs.existsSync(path.join(f.vault,'economy_wiki',p)),p);
 fs.writeFileSync(path.join(f.vault,'economy_wiki/Templates/Idea.md'),'User customized');initWiki(f.vault);assert.equal(fs.readFileSync(path.join(f.vault,'economy_wiki/Templates/Idea.md'),'utf8'),'User customized');
});
test('existing links require exact current reference hashes and quotes cannot escape their line locator',t=>{
 const f=fixture(t),q='economy_wiki/Questions/existing.md';fs.mkdirSync(path.join(f.vault,'economy_wiki/Questions'));fs.writeFileSync(path.join(f.vault,q),'# Existing question\n');
 f.proposal.notes[0].question_links=[q];assert.notEqual(f.run().status,0);
 f.proposal.references=[{path:q,sha256:sha('# Existing question\n')}];assert.equal(f.run().status,0);
 f.proposal.references[0].sha256='0'.repeat(64);assert.notEqual(f.run().status,0);
 f.proposal.references[0].sha256=sha('# Existing question\n');f.proposal.notes[0].evidence[0].locator.start_line=5;f.proposal.notes[0].evidence[0].locator.end_line=5;assert.notEqual(f.run().status,0);
});
test('producer retains explicit version locator for future maintenance without changing legacy record shape',t=>{
 const f=fixture(t),e=f.proposal.notes[0].evidence[0];e.source_version='Synthetic only';e.version_locator={start_line:5,end_line:5,label:'Recorded fixture version label'};
 const r=f.run();assert.equal(r.status,0,r.stderr);const records=JSON.parse(/^evidence_records: (.*)$/m.exec(JSON.parse(r.stdout).notes[0].content)[1]);assert.deepEqual(records[0].version_locator,e.version_locator);
});
test('producer apply output audits with exact version-locator coverage through the real maintenance CLI',t=>{
 const f=fixture(t),e=f.proposal.notes[0].evidence[0];e.source_version='Synthetic only';e.version_locator={start_line:5,end_line:5,label:'Recorded version'};
 const applied=f.run(['--apply']);assert.equal(applied.status,0,applied.stderr);
 const audited=spawnSync(process.execPath,[path.join(__dirname,'zettel-audit.cjs'),'--vault',f.vault],{encoding:'utf8'});assert.equal(audited.status,0,audited.stderr);const a=JSON.parse(audited.stdout);assert.deepEqual(a.findings,[]);assert.equal(a.coverage.evidence_verified,1);assert.equal(a.coverage.notes_scanned,2);
});
test('duplicate recorded source version keys fail closed rather than accepting an older value',t=>{
 const f=fixture(t),bytes=f.source.replace('version_key: synthetic-v1','version_key: synthetic-v1\nversion_key: synthetic-v2');fs.writeFileSync(path.join(f.vault,f.sourcePath),bytes);f.proposal.notes[0].evidence[0].source_sha256=sha(bytes);f.proposal.notes[0].evidence[0].locator={start_line:7,end_line:7,label:'Synthetic sentence'};const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Duplicate.*version/);
});
test('optional version locator is validated even when frontmatter already matches',t=>{
 const f=fixture(t);f.proposal.notes[0].evidence[0].version_locator={start_line:5,end_line:5,label:'Wrong version range'};const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Exact quote not in locator/);
});
test('explicit body version locator supports collector records without rewriting them',t=>{
 const f=fixture(t),e=f.proposal.notes[0].evidence[0];e.source_version='Synthetic only';e.version_locator={start_line:5,end_line:5,label:'Recorded fixture version label'};
 assert.equal(f.run().status,0);e.version_locator.start_line=6;e.version_locator.end_line=6;assert.notEqual(f.run().status,0);
});
test('unknown payload keys, unsafe paths and source symlinks fail closed',t=>{
 for(const change of [f=>f.proposal.provider='not-allowed',f=>f.proposal.notes[0].path='economy_wiki/Ideas/../Sources/bad.md',f=>{fs.renameSync(path.join(f.vault,f.sourcePath),path.join(f.dir,'source.md'));fs.symlinkSync(path.join(f.dir,'source.md'),path.join(f.vault,f.sourcePath));}]){const f=fixture(t);change(f);assert.notEqual(f.run().status,0);}
});
test('research evidence and references reject hidden, raw, private and non-Markdown paths',t=>{
 for(const source of ['economy_wiki/.private/secret.md','economy_wiki/raw/secret.md','economy_wiki/private/secret.md','economy_wiki/Sources/.hidden.md','economy_wiki/Sources/secret.json']){
  const f=fixture(t);fs.mkdirSync(path.dirname(path.join(f.vault,source)),{recursive:true});fs.writeFileSync(path.join(f.vault,source),f.source);f.proposal.notes[0].evidence[0].source=source;
  const r=f.run();assert.notEqual(r.status,0,source);assert.match(r.stderr,/Unsafe path|research Markdown/);
 }
 const f=fixture(t);f.proposal.notes[0].path='economy_wiki/Ideas/.hidden.md';assert.notEqual(f.run().status,0);
 const g=fixture(t),secret='economy_wiki/raw/secret.md';fs.mkdirSync(path.dirname(path.join(g.vault,secret)),{recursive:true});fs.writeFileSync(path.join(g.vault,secret),g.source);g.proposal.references=[{path:secret,sha256:sha(g.source)}];assert.notEqual(g.run().status,0);
});
test('all nine compiled categories and Sources are authorized pinned evidence and summary targets',t=>{
 const folders=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries','Sources'];
 for(const folder of folders){const f=fixture(t),target='economy_wiki/'+folder+'/target.md';fs.mkdirSync(path.dirname(path.join(f.vault,target)),{recursive:true});fs.writeFileSync(path.join(f.vault,target),f.source);const e={...f.proposal.notes[0].evidence[0],source:target};f.proposal.notes.push({path:'economy_wiki/Review/readability-pilot/target.md',type:'study-essential-summary',title:'Synthetic economics essentials',target_path:target,target_sha256:sha(f.source),essential_finding:'Synthetic only.',population_comparison:'Synthetic sample; no causal identification.',key_result:'Ten synthetic observations.',main_limitation:'Fixture only.',relevance_to_question:'Test question only.',questions:[f.proposal.notes[1].path],evidence:[e]});const r=f.run();assert.equal(r.status,0,folder+': '+r.stderr);}
});
test('all targets are preflighted before apply; symlinks and output aliases fail closed',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.vault,'economy_wiki/Questions'));fs.writeFileSync(path.join(f.vault,f.proposal.notes[1].path),'Existing');
 assert.notEqual(f.run(['--apply']).status,0);assert.ok(!fs.existsSync(path.join(f.vault,f.proposal.notes[0].path)));
 fs.symlinkSync(f.vault,path.join(f.dir,'alias'));assert.notEqual(f.run(['--out',path.join(f.dir,'alias/report.json')]).status,0);
});
