'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {buildIndex}=require('./dashboard-core.cjs');
const {enhancedSearch,reviewInbox}=require('./enhancements.cjs');
const {validateClaim}=require('./evidence-lifecycle.cjs');
const folders=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'];
const note=(folder,extra='')=>({path:`economy_wiki/${folder}/trade.md`,text:`---\nevidence_kind: causal\nresearch_question: Effect of tariffs?\nidentification_strategy: difference-in-differences\nestimand: ATT\ncountry: Korea\nproduct: steel\nmethod: DiD\nreview_status: economist-review-needed\n---\n# Trade ${folder}\n## Research question\nEffect of tariffs?\n## Identification strategy\nDifference-in-differences with parallel trends assumption.\n## Reported findings\nTariff estimate 2, confidence interval [1,3].\n## Limitations\nIllustrative fixture only.\n${extra}`});
test('economics compiled folders expose findings and identification metadata without causal promotion',()=>{
 const ix=buildIndex(folders.map(f=>note(f)));assert.equal(ix.length,folders.length);
 for(const row of ix){assert.equal(row.evidence_kind,'causal');assert.equal(row.research_question,'Effect of tariffs?');assert.equal(row.identification_strategy,'difference-in-differences');assert.equal(row.estimand,'ATT');assert.match(row.findings,/Tariff estimate/)}
});
test('trade aliases are bilingual and medical abbreviations are not expanded',()=>{
 const n=note('Literature','자유무역협정 관세 철강');assert.equal(enhancedSearch([n],'FTA').rows.length,1);
 assert.deepEqual(require('./enhancements.cjs').expandQuery('AML').groups,[['AML']]);
});
test('international trade institutions and production aliases support bilingual retrieval without equivalence claims',()=>{
 const samples=[['WTO','세계무역기구'],['FDI','외국인직접투자'],['GVC','글로벌 가치사슬']];
 for(const [term,text] of samples){const n=note('Topics',text);assert.equal(enhancedSearch([n],term).rows.length,1);}
});
test('structured economics filters match exact declared scalar fields; missing metadata never matches',()=>{
 const a=note('Policies'),b={...note('Topics'),text:'# Trade\n## Reported findings\nKorea steel DiD tariff'};
 assert.equal(enhancedSearch([a,b],'tariff',{country:'Korea',product:'steel',method:'DiD'}).rows.length,1);
 assert.equal(enhancedSearch([a,b],'tariff',{country:'Japan'}).rows.length,0);
 assert.throws(()=>enhancedSearch([a],'tariff',{confidence:'high'}),/filter/i);
});
test('pure indexing rejects private hidden traversal and symlink-marked records',()=>{
 const bad=['economy_wiki/Literature/../private/x.md','economy_wiki/Literature/Private/x.md','economy_wiki/Topics/.secret.md','economy_wiki/Literature/x\\y.md'];
 assert.equal(buildIndex(bad.map(p=>({...note('Literature'),path:p}))).length,0);
 assert.equal(buildIndex([{...note('Literature'),isSymlink:true}]).length,0);
});
test('claim economics schema requires epistemic kind and research question and causal identification',()=>{
 const c={id:'c',statement:'Tariff result',sourcePath:'economy_wiki/Sources/a.md',sourceSha256:'a'.repeat(64),locator:'Table 1',evidence_kind:'causal',research_question:'Effect?',identification_strategy:'DiD',estimand:'ATT'};
 assert.deepEqual(validateClaim(c),[]);
 for(const key of ['research_question','identification_strategy','estimand'])assert.ok(validateClaim({...c,[key]:''}).some(e=>e.includes(key)));
 assert.ok(validateClaim({...c,evidence_kind:'economic'}).some(e=>e.includes('evidence_kind')));
 assert.deepEqual(validateClaim({...c,evidence_kind:'theoretical',identification_strategy:undefined,estimand:undefined}),[]);
});
test('economist review metadata is a declaration, never automated approval',()=>{
 const ix=buildIndex([note('Analyses')]);assert.ok(reviewInbox(ix).some(r=>r.reasons.some(x=>/unreviewed/.test(x))));
});
test('maintenance and optional QMD stage all economics folders but exclude nested private directories',()=>{
 const base=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-test-'));
 try{const vault=path.join(base,'vault'),root=path.join(vault,'economy_wiki');
 for(const f of folders){fs.mkdirSync(path.join(root,f),{recursive:true});fs.writeFileSync(path.join(root,f,'trade.md'),note(f).text)}
 fs.mkdirSync(path.join(root,'Literature/Private'));fs.writeFileSync(path.join(root,'Literature/Private/secret.md'),'PRIVATE');
 const r=require('../scripts/maintain-wiki.cjs').auditWiki({vault,stateDir:path.join(base,'state')});assert.equal(r.counts.notes,folders.length);assert.equal(r.navigationIndex.unlisted.length,folders.length);
 const m=require('../scripts/qmd-adapter.cjs').stage({vault:root,state:path.join(base,'qmd')});assert.equal(Object.keys(m.files).length,folders.length);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
