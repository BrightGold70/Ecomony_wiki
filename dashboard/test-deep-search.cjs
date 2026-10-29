'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildIndex}=require('./dashboard-core.cjs');
const {deepSearch}=require('./deep-search.cjs');
const note=(id,title,summary='',scope='Literature')=>({path:`economy_wiki/${scope}/${id}.md`,text:`# ${title}\n## Evidence and screening\n${summary}`});

test('BM25 ranks multi-term matches first using OR and question stopwords',()=>{
 const index=buildIndex([note('both','NPM1 tariff','NPM1 tariff response'),note('one','NPM1','mutation'),note('other','IV','nilotinib')]);
 const result=deepSearch(index,'What does NPM1 tariff show about response?');
 assert.equal(result.mode,'bm25-graph');
 assert.equal(result.rows[0].paper.path,index[0].path);
 assert.ok(result.rows.some(r=>r.paper.path===index[1].path),'OR retains partial matches');
 assert.ok(result.rows.every(r=>Number.isFinite(r.score)&&r.score>0));
 assert.match(result.rows[0].reason,/BM25.*npm1.*tariff/i);
 assert.ok(result.limitations.some(s=>/not.*semantic|no.*embedding/i.test(s)));
});

test('graph fusion expands outgoing and incoming recorded links one hop only',()=>{
 const index=buildIndex([
  note('seed','NPM1','mutation\n[[economy_wiki/Literature/out]]'),
  note('out','Followup','sample\n[[economy_wiki/Literature/two]]'),
  note('in','Commentary','context\n[[economy_wiki/Literature/seed]]'),
  note('two','Second hop','unrelated'),
  note('other','Unconnected','unrelated')
 ]);
 const rows=deepSearch(index,'NPM1').rows;
 assert.deepEqual(new Set(rows.map(r=>r.paper.path)),new Set(index.slice(0,3).map(p=>p.path)));
 assert.equal(rows[0].paper.path,index[0].path);
 for(const row of rows.slice(1)){
  assert.match(row.reason,/graph.*recorded.link.*seed\.md/i);
  assert.match(row.reason,/not.*evidence/i);
  assert.ok(row.score>0&&row.score<rows[0].score);
 }
 assert.deepEqual(deepSearch([...index].reverse(),'NPM1'),deepSearch(index,'NPM1'));
});

test('deny private/out-of-scope and noncanonical paths even in supplied index and graph',()=>{
 const publicRow=buildIndex([note('seed','NPM1','mutation')])[0];
 const paths=['Patient list/private.md','economy_wiki/Private/secret.md','economy_wiki/Sources/a.md',
  'economy_wiki/Literature/../../Private/a.md','economy_wiki/Literature/%2e%2e/secret.md',
  'economy_wiki/Literature/sub\\private.md','economy_wiki/Literature//secret.md'];
 const denied=paths.map(path=>({...publicRow,path,title:'Private secret',counts:new Map([['npm1',100],['secret',10]]),explicit:[]}));
 const index=[{...publicRow,explicit:paths.map(target=>({target}))},...denied];
 assert.deepEqual(deepSearch(index,'NPM1').rows.map(r=>r.paper.path),[publicRow.path]);
 assert.deepEqual(deepSearch(index,'secret').rows,[]);
 // Denied rows must not change corpus statistics or boosts either.
 assert.deepEqual(deepSearch(index,'NPM1'),deepSearch([index[0]],'NPM1'));
});

test('empty, stopword-only and unmatched queries return no fabricated evidence or graph-only matches',()=>{
 const index=buildIndex([note('seed','NPM1','mutation\n[[economy_wiki/Literature/out]]'),note('out','Cohort','followup')]);
 for(const query of ['',null,undefined,'? !!!','What is the evidence for firms?','nonexistentzz']){
  const result=deepSearch(index,query);
  assert.deepEqual(result.rows,[]);
  assert.ok(result.limitations.some(s=>/not evidence of absence/i.test(s)));
  assert.equal(Object.hasOwn(result,'claims'),false);
 }
 assert.deepEqual(deepSearch([],'NPM1').rows,[]);
 assert.deepEqual(deepSearch(null,'NPM1').rows,[]);
});

test('Comparisons and Queries are allowed only if supplied, with presentation fallback',()=>{
 const rows=['Comparisons','Queries','Topics','Literature'].map(scope=>({path:`economy_wiki/${scope}/a.md`,title:'NPM1 comparison',summary:'tariff',explicit:[]}));
 assert.equal(deepSearch(rows,'NPM1').rows.length,4);
 assert.deepEqual(deepSearch(rows.slice(0,1),'NPM1').rows.map(r=>r.paper.path),[rows[0].path]);
});

test('stable path tie-break, unique results, max8 and no index mutation',()=>{
 const index=buildIndex(Array.from({length:12},(_,i)=>note(`n${String(i).padStart(2,'0')}`,'NPM1','mutation')));
 const before=structuredClone(index);
 const expected=index.slice(0,8).map(p=>p.path);
 assert.deepEqual(deepSearch(index,'NPM1').rows.map(r=>r.paper.path),expected);
 assert.deepEqual(deepSearch([...index].reverse(),'NPM1'),deepSearch(index,'NPM1'));
 assert.equal(deepSearch([...index,index[0]],'NPM1').rows.length,8);
 deepSearch(index,'mutation');
 assert.deepEqual(index,before);
});

test('BM25 saturates term frequency and normalizes document length',()=>{
 const paper=(id,counts)=>({path:`economy_wiki/Literature/${id}.md`,title:id,counts:new Map(counts),explicit:[]});
 const short=paper('short',[['npm1',2]]),long=paper('long',[['npm1',2],['unrelated',100]]),once=paper('once',[['npm1',1]]);
 const rows=deepSearch([long,short,once],'NPM1').rows;
 const score=id=>rows.find(r=>r.paper.title===id).score;
 assert.ok(score('short')>score('long'));
 assert.ok(score('short')>score('once'));
 assert.ok(score('short')<2*score('once'));
});
