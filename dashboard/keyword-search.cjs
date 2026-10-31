const safeNotePath=path=>typeof path==='string'&&/^economy_wiki\/(Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries)\/.+\.md$/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||/^(private|personal|secrets)$/i.test(p)||/[\\%\x00-\x1f\x7f]/.test(p));
function paperDetails(text){
 const front=(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)||[])[1]||'';
 const body=text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
 const sections=[];let heading='',lines=[];
 const flush=()=>{if(lines.length)sections.push({heading,text:lines.join('\n').trim()});lines=[]};
 for(const line of body.split(/\r?\n/)){const m=line.match(/^#{1,6}\s+(.+)$/);if(m){flush();heading=m[1]}else lines.push(line)}flush();
 const abstracts=sections.filter(s=>/^(abstract|published abstract|摘要|초록)$/i.test(s.heading));
 const useful=abstracts.length?abstracts:sections.filter(s=>/evidence|screening|study question|research question|identification|estimand|data|method|theory|analysis|summary|population|design|findings|interpretation|limits|scope/i.test(s.heading)&&!/economist|review status|access|PDF|publication relationship|unresolved/i.test(s.heading));
 const clean=s=>s.replace(/<!--[\s\S]*?-->/g,'').split('\n').filter(l=>!/^\s*(Evidence level:|Extraction status:|\[\[|- \[|Economist reviewer)/i.test(l)).join('\n').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').trim();
 const summary=useful.map(s=>clean(s.text)).filter(Boolean).join('\n\n');
 const evidence=(front.match(/^evidence_kind:\s*(.+)$/m)||front.match(/^evidence_level:\s*(.+)$/m)||body.match(/^Evidence level:\s*(.+)$/mi)||[])[1]||'Evidence scope: see original note';
 const pick=pattern=>sections.filter(s=>pattern.test(s.heading)).map(s=>clean(s.text)).filter(Boolean).join('\n\n');
 const findings=pick(/^(reported findings|supported findings|results|key findings|main findings|design, findings)/i);
 const population=pick(/^(study question and population|scope and design|population|study design)/i);
 const limitations=pick(/^(limitations|limits and|reviewer interpretation|supported findings and limitations|reported findings and limitations|design, findings and limitations)/i);
 const publicationCaution=/\b(commentary|editorial|point-counterpoint)\b/i.test(body)?'Commentary/editorial mentioned — check publication type; do not count as an independent sample.':'';
 const meta=Object.create(null);for(const m of front.matchAll(/^([a-z_]+):[ \t]*(.*)$/gm))meta[m[1]]=m[2].trim().replace(/^([\"'])(.*)\1$/,'$2');
 return {...Object.fromEntries(['evidence_kind','research_question','identification_strategy','estimand','country','product','method'].map(k=>[k,meta[k]||''])),summary,summaryLabel:abstracts.length?'Stored abstract':'Stored paper summary',evidence,findings,population,limitations,publicationCaution};
}
function searchNotes(notes,query){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return [];
 const rows=[];
 for(const n of notes){
  if(n.isSymlink||!safeNotePath(n.path))continue;
  const body=n.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');const lower=body.toLocaleLowerCase();
  if(!words.every(w=>lower.includes(w)))continue;
  const title=(body.match(/^#\s+(.+)$/m)||[])[1]||n.path.split('/').pop().replace(/\.md$/,'');
  const lines=body.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('<!--'));
  const matched=lines.filter(l=>words.some(w=>l.toLocaleLowerCase().includes(w))).slice(0,3);
  rows.push({...paperDetails(n.text),path:n.path,title,snippet:matched.join(' … ').slice(0,650),score:words.reduce((s,w)=>s+(title.toLocaleLowerCase().includes(w)?10:0),0)});
 }
 return rows.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
}
module.exports={searchNotes,safeNotePath,paperDetails};
