const {referenceMetadata}=require('./reading-metadata.cjs');
const CONTENT_LIMIT=1024*1024;
function currentContentRevision(raw){
 if(!/^<!-- collector-owned:v1 -->$/m.test(raw))return raw;
 const markers=[...raw.matchAll(/^<!-- collector-revision:[^\n]*$/gm)];if(!markers.length)return '';
 const last=markers.at(-1);if(!/^<!-- collector-revision:[a-f0-9]{64} -->$/.test(last[0]))return '';
 const digest=last[0].slice('<!-- collector-revision:'.length,-4),minimum=markers.length>1?markers.at(-2).index+markers.at(-2)[0].length:0;
 const starts=[...raw.slice(minimum,last.index).matchAll(/^---$/gm)].map(m=>minimum+m.index);if(starts.length>32)return '';
 const hash=s=>require('node:crypto').createHash('sha256').update(JSON.stringify(s)).digest('hex');
 for(const start of starts){const candidate=raw.slice(start,last.index).trimEnd();if(['','\n'].some(end=>hash(candidate+end)===digest))return candidate+'\n'+raw.slice(last.index+last[0].length)}
 return '';
}
// Read headings only outside fences/comments; retain nested summary subsections.
function contentSections(raw){
 const body=String(raw||'').replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
 const sections=[];let current=null,fence=null,comment=false;
 for(const line of body.split(/\r?\n/)){
  const f=/^ {0,3}(`{3,}|~{3,})/.exec(line);if(f&&!comment){if(!fence)fence=f[1];else if(fence[0]===f[1][0]&&f[1].length>=fence.length)fence=null;continue}if(fence)continue;
  if(comment){if(line.includes('-->'))comment=false;continue}if(line.includes('<!--')){comment=!line.slice(line.indexOf('<!--')+4).includes('-->');continue}
  const h=/^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if(h&&h[1].length<=2){current={heading:h[2],lines:[]};sections.push(current)}else if(current)current.lines.push(line);
 }
 return sections.map(s=>({heading:s.heading,text:s.lines.join('\n').trim()}));
}
function paperContent(raw){
 raw=String(raw||'');const empty=()=>({text:'',present:false,label:''});if(raw.length>CONTENT_LIMIT)return {abstract:empty(),summary:empty(),metadata:{},reason:'Note exceeds read limit'};
 raw=currentContentRevision(raw);
 const metadata=referenceMetadata(raw),sections=contentSections(raw),pick=re=>sections.filter(s=>re.test(s.heading)).at(-1);
 const abstractSection=pick(/^(?:published abstract|abstract|초록|摘要)$/i),summarySection=pick(/^(?:LLM summary|article content summary|stored paper summary|paper summary|summary)$/i);
 const a=abstractSection||(typeof metadata.abstract==='string'?{text:metadata.abstract}:null),s=summarySection||(typeof metadata.summary==='string'?{text:metadata.summary}:null);
 const usable=t=>!!t&&!/^(?:pending\b|not (?:recorded|available)\b|\*\*Required work)/i.test(t);
 const explicitLLM=metadata.summary_mode!=='manual'&&(/^(?:llm|llm-generated)$/i.test(metadata.summary_mode||'')||typeof metadata.summary_model==='string'&&!!metadata.summary_model.trim());
 return {abstract:{text:usable(a?.text)?a.text:'',present:!!a,bodyPresent:!!abstractSection,label:'Published abstract'},summary:{text:usable(s?.text)?s.text:'',present:!!s,bodyPresent:!!summarySection,label:explicitLLM?'LLM summary':metadata.summary_mode==='manual'?'Recorded summary — manual':'Recorded summary — authorship not recorded'},metadata,reason:''};
}

module.exports={paperContent};
