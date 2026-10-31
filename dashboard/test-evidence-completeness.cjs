'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=fs.existsSync(__dirname+'/evidence-completeness.cjs')?require('./evidence-completeness.cjs'):{};
const note=raw=>({path:'economy_wiki/Literature/a.md',raw});
for(const [name,body] of [["closed tilde", "~~~text\nExample finding.\n~~~"], ["unclosed backtick", "```text\nExample finding."], ["unclosed tilde", "~~~text\nExample finding."], ["long fence containing shorter fence", "````\n```\nExample finding.\n```\n````"], ["nested quote and list", "> - ~~~text\n>   Example finding.\n>   ~~~"], ["nested list and quote", "- > ```text\n  > Example finding.\n  > ```"], ["nested unclosed", "> - ```text\n>   Example finding."]])test('example fences do not satisfy findings: '+name,()=>{assert.equal(api.evidenceCompleteness(note('## Reported findings\n'+body)).fields.findings,false)});
test('real findings after closed nested fences remain substantive',()=>{for(const body of ["> - ```\n>   Example only.\n>   ```\nObserved estimate: 0.8.", "> - ~~~\n>   Example only.\n>   ~~~\nObserved estimate: 0.8."]){assert.equal(api.evidenceCompleteness(note('## Reported findings\n'+body)).fields.findings,true)}});
test('placeholder-only table rows with dash cells are missing but zero and real values survive',()=>{
 for(const row of ['| Unknown | - |','| — | N/A |','| Pending | – |','| | |'])assert.equal(api.evidenceCompleteness(note('## Reported findings\n| Endpoint | Estimate |\n| --- | --- |\n'+row)).fields.findings,false,row);
 for(const row of ['| OS | - |','| Unknown | 0 |','| Estimate | -0.2 |'])assert.equal(api.evidenceCompleteness(note('## Reported findings\n| Endpoint | Estimate |\n| --- | --- |\n'+row)).fields.findings,true,row);
});


test('economics completeness inventories estimand identification sample vintage and optional numerical declarations without causal appraisal',()=>{
 assert.equal(typeof api.evidenceCompleteness,'function');
 const r=api.evidenceCompleteness(note('---\nevidence_scope: abstract-only\nreview_status: economist-review-needed\nestimand: descriptive wage difference\nidentification_strategy: not causal; descriptive comparison\nsample_period: 2010–2019\ndataset_vintage: release 2020\noutcome_endpoint: log wages\noutcome_estimate: 0.2 log points\noutcome_uncertainty: SE 0.1\noutcome_denominator: 200 firms\noutcome_timepoint: annual\nsources: [economy_wiki/Sources/a.md]\n---\n## Data/sample/period\nFirms observed annually.\n## Reported findings\nA descriptive difference was reported.\n## Limitations\nSelection may remain.'));
 for(const k of ['access','estimand','identification','sample','vintage','design','findings','limitations','endpoint','estimate','uncertainty','denominator','timepoint','source','review'])assert.equal(r.fields[k],true,k);
 assert.equal(r.fields.pdf,false);assert.equal(r.numerical.estimate,'0.2 log points');assert.equal(r.review,'economist-review-needed');assert.equal('score' in r,false);assert.match(r.disclaimer,/not.*causal/i);
});
test('placeholders empty headings checklist and table headers do not satisfy completeness',()=>{
 const r=api.evidenceCompleteness(note('---\nreview_status: unknown\nestimand: pending\n---\n## Data/sample/period\nPending\n## Reported findings\n| Outcome | Estimate |\n| --- | --- |\n| Unknown | Pending |\n## Limitations\n<!-- TODO -->\n- [ ] assess'));
 for(const k of ['review','estimand','design','findings','limitations','endpoint','estimate','sample','vintage'])assert.equal(r.fields[k],false,k);
 assert.equal(r.review,'Not recorded');
});
test('recorded versions and exact shared samples or datasets yield non-mutating unverified suggestions',()=>{
 const a=note('---\nreference_role: working-paper follow-up\nversion_family: synthetic-family\nsample_id: synthetic-sample\ndataset_id: synthetic-data\nrelated_versions: [economy_wiki/Literature/b.md]\n---\n# A'),b={path:'economy_wiki/Literature/b.md',raw:'---\nreference_role: journal\nversion_family: synthetic-family\nsample_id: synthetic-sample\ndataset_id: synthetic-data\n---\n# B'},before=JSON.stringify([a,b]);
 assert.equal(typeof api.evidenceWarnings,'function');const rows=api.evidenceWarnings(a,[a,b]);assert.ok(rows.some(r=>r.status==='metadata-recorded'&&/version/i.test(r.message)));for(const field of ['version_family','sample_id','dataset_id'])assert.ok(rows.some(r=>r.status==='unverified-suggestion'&&r.target===b.path&&r.message.includes(field)));assert.match(rows.map(r=>r.message).join(' '),/independence.*unverified/i);assert.equal(JSON.stringify([a,b]),before);assert.deepEqual(api.evidenceWarnings(note('# No recorded matches'),[b]),[]);
});
