'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function fixture(fn){const d=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-safety-'));try{const {root}=require('./init-wiki.cjs').initWiki(d);return fn(d,root)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('initializer creates all economics categories without medical scope rules',()=>fixture((d,r)=>{for(const f of ['Datasets','Policies','Methods','Theories','Analyses'])assert.ok(fs.statSync(path.join(r,f)).isDirectory());assert.doesNotMatch(fs.readFileSync(path.join(r,'Setup/Scope-policy.md'),'utf8'),/disease|intervention|patient/i)}));
test('lint never traverses private or symlink directories and validates economics evidence kind',()=>fixture((d,r)=>{
 fs.mkdirSync(path.join(r,'Literature/Private'));fs.writeFileSync(path.join(r,'Literature/Private/secret.md'),'SECRET');fs.mkdirSync(path.join(d,'secret'));fs.writeFileSync(path.join(d,'secret/x.md'),'SECRET');fs.symlinkSync(path.join(d,'secret'),path.join(r,'Methods/link'));assert.equal(require('./lint-wiki.cjs').lintWiki(d).checked,0);
 fs.writeFileSync(path.join(r,'Analyses/a.md'),'---\ntitle: Test\nevidence_kind: causal\nresearch_question: Effect?\n---\n# Test');const issues=require('./lint-wiki.cjs').lintWiki(d).issues.map(i=>i.rule);assert.ok(issues.includes('missing-field:identification_strategy'));assert.ok(issues.includes('missing-field:estimand'));
}));
test('review CLI rejects aliases symlinks and private paths before writing receipts',()=>fixture((d,r)=>{
 const source=path.join(r,'Literature/a.md');fs.writeFileSync(source,'Synthetic economics draft');fs.symlinkSync(source,path.join(r,'Literature/link.md'));const api=require('./review-content.cjs');assert.throws(()=>api.reviewFile(d,'economy_wiki/Literature/link.md','Synthetic Person','format','needs revision',path.join(d,'r.json')),/symlink/i);assert.equal(fs.existsSync(path.join(d,'r.json')),false);
}));
