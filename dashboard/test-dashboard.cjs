const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildIndex,relatedStudies,relationships}=require('./dashboard-core.cjs');
const notes=[
 {path:'economy_wiki/Literature/a.md',text:'# Gravity DiD trade\n## Evidence and screening\nGravity bilateral tariff trade elasticity.\n## Publication relationships\nCompanion: [[economy_wiki/Literature/b]].'},
 {path:'economy_wiki/Literature/b.md',text:'# Gravity commentary\n## Evidence and screening\nGravity tariff bilateral elasticity commentary.'},
 {path:'economy_wiki/Literature/c.md',text:'# IV nilotinib\n## Evidence and screening\nIV nilotinib remission kinase policy.'},
 {path:'Patient list/private.md',text:'# Gravity DiD\nprivate secret'},
 {path:'economy_wiki/Sources/a.md',text:'# Gravity\nsource duplicate'}
];
test('index stays within research study folders',()=>{assert.equal(buildIndex(notes).length,3)});
test('explicit relationships preserve direction and quotation context',()=>{
 const edges=relationships(buildIndex(notes));assert.equal(edges.length,1);assert.equal(edges[0].source,notes[0].path);assert.equal(edges[0].target,notes[1].path);assert.match(edges[0].context,/Companion/);assert.equal(edges[0].kind,'explicit-link');
});
test('similar studies show shared terms but do not assert economic relation',()=>{
 const index=buildIndex(notes),r=relatedStudies(index,index[0].path);assert.equal(r[0].paper.path,notes[1].path);assert.ok(r[0].sharedTerms.includes('gravity'));assert.equal(r[0].explicit,true);assert.ok(r[0].score>0);assert.equal(r.some(x=>x.paper.path.includes('private')),false);
});
test('boilerplate alone does not create similarity',()=>{
 const ix=buildIndex([{path:'economy_wiki/Literature/a.md',text:'# Alpha\n## Economist review required\nConfirm population design FTA DiD.'},{path:'economy_wiki/Literature/b.md',text:'# Beta\n## Economist review required\nConfirm population design FTA DiD.'}]);assert.equal(relatedStudies(ix,ix[0].path).length,0);
});
