'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {entityMatches,entitySuggestions}=require('./entity-navigation.cjs');
test('singular JSON/YAML field lists retain exact comma-containing values',()=>{
 const p={path:'economy_wiki/Methods/p.md',raw:'---\ncountry: ["Korea", "Japan"]\nmethod: ["IV, local", "DiD"]\nsubject: ["Trade", "F13"]\n---\n# Methods'};
 for(const [field,value]of [['country','Korea'],['method','IV, local'],['subject','F13']])assert.deepEqual(entityMatches([p],{field,value,label:'Mine'}).map(p=>p.path),[p.path]);
});
test('intentional public Topic-to-Literature subject linking is preserved but unsafe/comment/code links cannot infer subjects',()=>{
 const paper={path:'economy_wiki/Literature/p.md',title:'Paper'},topic=(path,raw)=>({path,title:'Trade',raw});
 const match=ix=>entityMatches(ix,{field:'subject',value:'Trade',label:'Trade'}).some(p=>p.path===paper.path);
 assert.equal(match([paper,topic('economy_wiki/Topics/trade.md','[[economy_wiki/Literature/p]]')]),true);
 for(const t of [topic('economy_wiki/Topics/../unsafe.md','[[economy_wiki/Literature/p]]'),topic('economy_wiki/Topics/.private/a.md','[[economy_wiki/Literature/p]]'),topic('economy_wiki/Topics/secret.md','<!-- [[economy_wiki/Literature/p]] -->'),topic('economy_wiki/Topics/code.md','```text\n[[economy_wiki/Literature/p]]\n```'),topic('economy_wiki/Topics/unclosed.md','~~~text\n[[economy_wiki/Literature/p]]')])assert.equal(match([paper,t]),false,t.path);
 assert.ok(!entitySuggestions([paper,topic('economy_wiki/Topics/../bad.md','[[economy_wiki/Literature/p]]')]).some(e=>e.value==='Trade'));
});
const {scanReadingWorkspace,verifyReadingEvidence}=require('./study-reading.cjs');
const {appFor,sha}=require('./test-reading-port.cjs');
test('workspace validates bounded typed records and evidence checks fail closed on unsafe paths/oversize/ranges',async()=>{
 const paper={path:'economy_wiki/Datasets/p.md',text:'one\nExact quote\nthree'},idea={path:'economy_wiki/Ideas/i.md',text:'---\ntype: idea\nrelations: [{"target":"economy_wiki/Datasets/p.md","type":"qualifies","explanation":""}]\n---\n# Idea'},unsafe={path:'economy_wiki/Ideas/.private/a.md',text:'---\ntype: idea\n---\n# Secret'},app=appFor([paper,idea,unsafe]);
 const scanned=await scanReadingWorkspace(app);assert.equal(scanned.ideas.length,1);assert.equal(scanned.ideas[0].relations.length,0);const bounded=await scanReadingWorkspace(app,{maxFiles:0});assert.equal(bounded.truncated,true);assert.equal(bounded.ideas.length,0);
 const e={id:'e',path:paper.path,sha256:sha(paper.text),version:'v1',locator:'Body (lines 1–1)',quote:'Exact quote'};
 assert.equal((await verifyReadingEvidence(app,[e]))[0].status,'quote-missing');e.locator='Body (lines 2–2)';assert.equal((await verifyReadingEvidence(app,[e]))[0].status,'matched');assert.equal((await verifyReadingEvidence(app,[{...e,path:'economy_wiki/Datasets/../p.md'}]))[0].status,'unsafe');assert.equal((await verifyReadingEvidence(app,[e],{maxFileBytes:2}))[0].status,'limit');
});
