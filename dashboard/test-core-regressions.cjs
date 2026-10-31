'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildIndex,relationships}=require('./dashboard-core.cjs');
const {deepSearch}=require('./deep-search.cjs');
test('Unicode and short economics terms survive indexing without an H1 or filename body match',()=>{
 const notes=['Theories','Methods','Datasets','Policies','Analyses'].map(folder=>({path:`economy_wiki/${folder}/unmentioned.md`,text:'---\nevidence_kind: association\n---\n## Summary\n관세 IV 무역 FDI 贸易 π'}));
 const index=buildIndex(notes);assert.equal(index.length,5);for(const row of index){assert.equal(row.title,'unmentioned');for(const term of ['관세','iv','무역','fdi','贸易','π'])assert.ok(row.counts.has(term),term);assert.equal(row.evidence_kind,'association');}
 assert.equal(deepSearch(index,'IV 관세').rows.length,5);
});
test('fenced and commented example links never create graph relationships or neighbours',()=>{
 const a='economy_wiki/Methods/a.md',b='economy_wiki/Datasets/b.md';
 for(const sample of ['- ```md\n  [[TARGET]]\n  ```','> - ```md\n>   [[TARGET]]\n>   ```','1. > ```md\n   > [[TARGET]]\n   > ```','```md\n[[TARGET]]\n```','~~~~\n[[TARGET]]\n~~~~','<!--\n[[TARGET]]\n-->','> ```md\n> [[TARGET]]\n> ```','<!-- ``` -->\n```\n[[TARGET]]\n```']){
  const index=buildIndex([{path:a,text:'# IV\n## Summary\nInstrument estimate.\n'+sample.replace('TARGET',b.slice(0,-3))},{path:b,text:'# Unrelated\n## Summary\nOther content.'}]);
  assert.deepEqual(relationships(index),[],sample);assert.deepEqual(deepSearch(index,'IV').rows.map(r=>r.paper.path),[a],sample);
 }
 const index=buildIndex([{path:a,text:'# IV\n<!-- hidden --> active [['+b+']] <!-- trailing -->'},{path:b,text:'# Other'}]);assert.equal(relationships(index).length,1);
});
