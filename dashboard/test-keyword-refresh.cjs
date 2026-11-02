'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildIndex,relatedStudies}=require('./dashboard-core.cjs');
const {watchResearchVault}=require('./vault-refresh.cjs');
test('related studies never promote keyword navigation to synthesis or similarity',()=>{const index=buildIndex([{path:'economy_wiki/Literature/a.md',text:'# Tariffs prognosis\n## Abstract\nTariffs trade liberalization.\n[[economy_wiki/Topics/keyword-x]]'},{path:'economy_wiki/Topics/keyword-x.md',text:'---\nkeyword_navigation_only: true\nreference_role: bibliographic-keyword-navigation\n---\n# Tariffs prognosis\n## Scope\nTariffs trade liberalization.'}]);assert.equal(relatedStudies(index,index[0].path).length,0);assert.equal(relatedStudies(index,index[1].path).length,0)});
test('vault watcher debounces all four events, respects read scope including rename out and folders, cleans up',async()=>{
 const handlers={},refs=[],off=[];const vault={on:(type,fn)=>{handlers[type]=fn;const ref={type};refs.push(ref);return ref},offref:r=>off.push(r)};let refresh=0,dirty=0;const stop=watchResearchVault(vault,()=>{refresh++},()=>{dirty++},5);
 handlers.modify({path:'private/a.md'});handlers.create({path:'other/Sources/a.md'});await new Promise(r=>setTimeout(r,15));assert.equal(refresh,0);
 for(const event of ['modify','create','delete'])handlers[event]({path:'economy_wiki/Sources/a.md'});handlers.rename({path:'elsewhere/a.md'},'economy_wiki/Topics/a.md');await new Promise(r=>setTimeout(r,15));assert.equal(refresh,1);assert.equal(dirty,4);
 handlers.rename({path:'economy_wiki/Topics'});await new Promise(r=>setTimeout(r,15));assert.equal(refresh,2);handlers.modify({path:'economy_wiki/Topics/a.md'});stop();await new Promise(r=>setTimeout(r,15));assert.equal(refresh,2);assert.equal(off.length,4);
});
