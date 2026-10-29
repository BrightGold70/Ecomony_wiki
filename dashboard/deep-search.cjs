const {safeNotePath}=require('./keyword-search.cjs');
'use strict';

// Optional, dependency-free retrieval over dashboard-core's in-memory index.
// No filesystem/network access, generated answers, embeddings, or index mutation.
const DEEP_STOP=new Set(('what which who when where why how does do did is are was were can could should would '
 +'the a an and or of to in for with from by on at about as it its this that these those '
 +'please tell me show compare versus vs study studies paper papers evidence findings results '
 +'firm firms economic reported report have has had be been being').split(' '));
const LIMITATIONS=Object.freeze([
 'Local lexical BM25 and one-hop recorded-link retrieval only; no semantic embeddings or model reranking.',
 'Scores explain retrieval relevance, not economic evidence, certainty, or verified publication relationships.',
 'Only permitted research notes already present in the supplied index are searched; title/summary or supplied term counts may omit full-text material.',
 'At most 8 results; no matches is not evidence of absence. Graph-only neighbours may not match the query.'
]);
const compare=(a,b)=>a<b?-1:a>b?1:0;
function allowed(path){
 return safeNotePath(path)&&typeof path==='string'&&/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\/.+\.md$/.test(path)
  &&!path.split('/').some(part=>!part||part==='.'||part==='..'||/[\\%\x00-\x1f\x7f]/.test(part));
}
function tokens(text){
 return (String(text??'').toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)||[]).filter(term=>!DEEP_STOP.has(term));
}
function frequencies(paper){
 const counts=new Map();
 // Reuse core's substantive title/summary counts, not raw metadata or boilerplate.
 if(paper.counts instanceof Map){
  for(const [term,count] of paper.counts){
   if(typeof term==='string'&&!DEEP_STOP.has(term)&&Number.isFinite(count)&&count>0)counts.set(term,count);
  }
 }else for(const term of tokens(`${paper.title??''} ${paper.summary??''}`))counts.set(term,(counts.get(term)||0)+1);
 return counts;
}
function deepSearch(index,query){
 const result={rows:[],mode:'bm25-graph',limitations:[...LIMITATIONS]};
 const terms=[...new Set(tokens(query))];
 if(!terms.length||!Array.isArray(index))return result;
 const seen=new Set();
 const docs=index.filter(p=>p&&allowed(p.path)).slice().sort((a,b)=>compare(a.path,b.path))
  .filter(p=>{if(seen.has(p.path))return false;seen.add(p.path);return true;})
  .map(paper=>{const counts=frequencies(paper);return {paper,counts,length:[...counts.values()].reduce((a,b)=>a+b,0)};});
 if(!docs.length)return result;
 const average=docs.reduce((sum,d)=>sum+d.length,0)/docs.length||1;
 const df=new Map(terms.map(term=>[term,docs.filter(d=>d.counts.has(term)).length]));
 for(const doc of docs){
  let score=0;const matched=[];
  for(const term of terms){
   const tf=doc.counts.get(term)||0;if(!tf)continue;
   // Okapi BM25, k1=1.2, b=0.75; OR retrieval (sum matching terms).
   const idf=Math.log(1+(docs.length-df.get(term)+0.5)/(df.get(term)+0.5));
   const contribution=idf*tf*2.2/(tf+1.2*(0.25+0.75*doc.length/average));
   score+=contribution;matched.push(`${term}=${contribution.toFixed(4)}`);
  }
  if(score>0)result.rows.push({paper:doc.paper,score,reason:`BM25 ${score.toFixed(4)} [${matched.join(', ')}]`});
 }
 // Fuse only original lexical seeds; never recursively propagate graph scores.
 const seeds=result.rows.slice().sort((a,b)=>b.score-a.score||compare(a.paper.path,b.paper.path)).slice(0,8);
 const byPath=new Map(docs.map(d=>[d.paper.path,d.paper]));
 const neighbours=new Map(docs.map(d=>[d.paper.path,new Set()]));
 for(const {paper} of docs)for(const link of Array.isArray(paper.explicit)?paper.explicit:[]){
  const target=link&&link.target;
  if(target!==paper.path&&byPath.has(target)){
   neighbours.get(paper.path).add(target);neighbours.get(target).add(paper.path);
  }
 }
 const boosts=new Map();
 for(const seed of seeds)for(const path of [...neighbours.get(seed.paper.path)].sort(compare)){
  // Strongest neighbour only: link count cannot swamp the lexical ranking.
  const boost=0.25*seed.score;
  if(!boosts.has(path)||boost>boosts.get(path).score)boosts.set(path,{score:boost,source:seed.paper.path});
 }
 const rows=new Map(result.rows.map(row=>[row.paper.path,row]));
 for(const [path,boost] of boosts){
  const row=rows.get(path)||{paper:byPath.get(path),score:0,reason:'BM25 0.0000 (no query term match)'};
  row.score+=boost.score;
  row.reason+=`; graph +${boost.score.toFixed(4)}: one-hop recorded-link neighbour of ${boost.source} (retrieval hint, not evidence)`;
  rows.set(path,row);
 }
 result.rows=[...rows.values()].sort((a,b)=>b.score-a.score||compare(a.paper.path,b.paper.path)).slice(0,8);
 return result;
}
module.exports={deepSearch};
