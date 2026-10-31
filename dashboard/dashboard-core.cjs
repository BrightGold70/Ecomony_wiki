const {paperDetails,safeNotePath}=require('./keyword-search.cjs');
const STOP=new Set('the a an and or of to in for with from by on at is are was were this that these those as it be been not study studies paper papers firms firm economic evidence findings results analysis review required reported source abstract full text notes note population outcome outcomes policy treated draft extracted extraction independent zero pending metadata recorded screening access publisher downloaded download license storage reuse version history source record article articles interpretation limitation limitations available unavailable'.split(' '));
function words(text){return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)||[]).filter(w=>!STOP.has(w))}
function visibleLinkLines(body){
 const lines=[];let fence=null,comment=false;
 for(const original of body.split(/\r?\n/)){
  const raw=original.replace(/^(?:[ \t]*(?:>[ \t]?|(?:[-+*]|\d+[.)])[ \t]+))+/,'');
  if(fence){const close=raw.match(/^ {0,3}(`{3,}|~{3,})\s*$/);if(close&&close[1][0]===fence[0]&&close[1].length>=fence.length)fence=null;continue}
  let line='',offset=0;
  while(offset<raw.length){
   if(comment){const end=raw.indexOf('-->',offset);if(end<0)break;comment=false;offset=end+3}
   else{const start=raw.indexOf('<!--',offset);if(start<0){line+=raw.slice(offset);break}line+=raw.slice(offset,start);comment=true;offset=start+4}
  }
  const open=line.match(/^ {0,3}(`{3,}|~{3,})/);if(open){fence=open[1];continue}
  lines.push(line);
 }
 return lines;
}
function buildIndex(notes){
 const rows=[];
 for(const n of notes){if(n.isSymlink||!safeNotePath(n.path))continue;
  // Presentation extraction must not depend on a filename matching note text.
  const body=n.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');const title=(body.match(/^#\s+(.+)$/m)||[])[1]||n.path.split('/').pop().replace(/\.md$/,'');
  const info={...paperDetails(n.text),path:n.path,title,snippet:title,score:0};
  const substantive=[title,info.summary].join(' ').replace(/https?:\/\/\S+/g,'').replace(/economy_wiki\/\S+/g,'');
  const counts=new Map();for(const w of words(substantive))counts.set(w,(counts.get(w)||0)+1);
  const explicit=[];for(const line of visibleLinkLines(body))for(const m of line.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)){let target=m[1];if(!target.endsWith('.md'))target+='.md';explicit.push({target,context:line.slice(0,900)})}
  rows.push({...info,raw:n.text,counts,explicit});
 }
 const df=new Map();for(const row of rows)for(const term of row.counts.keys())df.set(term,(df.get(term)||0)+1);
 for(const row of rows){row.vector=new Map();let norm=0;for(const [term,count]of row.counts){const weight=(1+Math.log(count))*(1+Math.log((rows.length+1)/((df.get(term)||0)+1)));row.vector.set(term,weight);norm+=weight*weight}row.norm=Math.sqrt(norm)}
 return rows;
}
function relationships(index){const paths=new Set(index.map(p=>p.path));const edges=[];const seen=new Set();for(const p of index)for(const link of p.explicit){const key=p.path+'>'+link.target;if(paths.has(link.target)&&p.path!==link.target&&!seen.has(key)){seen.add(key);edges.push({source:p.path,target:link.target,context:link.context,kind:'explicit-link'})}}return edges}
function relatedStudies(index,path){const selected=index.find(p=>p.path===path);if(!selected)return [];
 const edges=relationships(index);return index.filter(p=>p.path!==path).map(p=>{let dot=0;const shared=[];for(const [term,weight]of selected.vector)if(p.vector.has(term)){dot+=weight*p.vector.get(term);shared.push([term,weight*p.vector.get(term)])}
 const score=selected.norm&&p.norm?dot/(selected.norm*p.norm):0;
 return {paper:p,score,sharedTerms:shared.sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]),explicit:edges.some(e=>(e.source===path&&e.target===p.path)||(e.target===path&&e.source===p.path))};}).filter(r=>(r.score>=0.08&&r.sharedTerms.length>=2)||r.explicit).sort((a,b)=>Number(b.explicit)-Number(a.explicit)||b.score-a.score);
}
module.exports={buildIndex,relatedStudies,relationships};
