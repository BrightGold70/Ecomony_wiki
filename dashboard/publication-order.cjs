'use strict';
const {paperFrontmatter}=require('./paper-navigation.cjs');
const {hashContent}=require('./evidence-lifecycle.cjs');
// Latest collector revision integrity only; never author or economic validation.
function latestCollectorMetadata(raw){
 raw=String(raw||'');if(raw.length>5*1024*1024)return {status:'invalid',fields:{}};const markers=[],headers=[];let owned=false,fence=null,offset=0;
 for(const line of raw.split('\n')){
  const plain=line.replace(/\r$/,'');const f=/^ {0,3}(`{3,}|~{3,})/.exec(plain);
  if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;offset+=line.length+1;continue}
  if(!fence){if(plain==='<!-- collector-owned:v1 -->')owned=true;
   const m=/^<!-- collector-revision:([a-f0-9]{64}) -->$/.exec(plain);if(m)markers.push({start:offset,end:offset+line.length,sha256:m[1]});
   if(plain==='---')headers.push(offset);
  }offset+=line.length+1;
 }
 if(!owned||!markers.length)return {status:'absent',fields:{}};
 const rootContent=raw.slice(0,markers[0].start).trimEnd();
 const rootCollector=['','\n'].some(end=>hashContent(JSON.stringify(rootContent+end))===markers[0].sha256);
 const last=markers.at(-1),minimum=markers.length>1?markers.at(-2).end:0;
 if(headers.filter(p=>p>=minimum&&p<last.start).length>32)return {status:'invalid',sha256:last.sha256,rootCollector,fields:{}};
 const allowed=new Set(['status','review_status','doi','topics','country','product','method','evidence_kind','research_question','identification_strategy','estimand','source_url','source_mode','publication_date','published','date_published','publication_year','year','version']);
 for(const start of headers.filter(p=>p>=minimum&&p<last.start)){
  const content=raw.slice(start,last.start).trimEnd();
  if(!['','\n'].some(end=>hashContent(JSON.stringify(content+end))===last.sha256))continue;
  const front=(content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)||[])[1];if(front===undefined)break;
  const fields=Object.create(null);let valid=true;
  for(const line of front.split('\n')){const m=/^([a-z_]+): (.+)$/.exec(line);if(!m||!allowed.has(m[1])||Object.hasOwn(fields,m[1])){valid=false;break}try{fields[m[1]]=JSON.parse(m[2])}catch{valid=false;break}}
  // Hash integrity is not validation of the recorded economics metadata.
  return valid?{status:'verified',sha256:last.sha256,rootCollector,fields}:{status:'invalid',sha256:last.sha256,rootCollector,fields:{}};
 }
 return {status:'invalid',sha256:last.sha256,rootCollector,fields:{}};
}
function publicationDate(note){
 const raw=note.raw??note.text,m=paperFrontmatter(raw),revision=latestCollectorMetadata(raw);
 const fields=['publication_date','published','date_published','publication_year','year'];
 if(revision.rootCollector)for(const field of [...fields,'version'])delete m[field];
 for(const field of fields){
  const value=Object.hasOwn(m,field)?m[field]:revision.fields[field];
  if(typeof value!=='string'&&typeof value!=='number')continue;
  const text=String(value),match=/^([1-9]\d{3})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text);
  if(!match||(['publication_year','year'].includes(field)&&text.length!==4))continue;
  const year=Number(match[1]),month=Number(match[2]||1),day=Number(match[3]||1),days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1])continue;
  const precision=match[3]?'day':match[2]?'month':'year';
  return {value:text,precision,key:year*10000+month*100+day,field,caption:`Publication date: ${text} (${precision} precision; recorded metadata)`};
 }
 const version=Object.hasOwn(m,'version')?m.version:revision.fields.version;
 if(typeof version==='string'||typeof version==='number'){
  // Standalone tokens only; repeated mentions of the same year are harmless.
  // Keep distinct years before plausibility validation so ambiguity never wins.
  const years=[...new Set(Array.from(String(version).matchAll(/(?<![\p{L}\p{N}_])([1-9]\d{3})(?![\p{L}\p{N}_])/gu),match=>match[1]))];
  if(years.length===1&&Number(years[0])>=1800&&Number(years[0])<=new Date().getFullYear()+2){
   const year=years[0];
   return {value:year,precision:'year',key:Number(year)*10000+101,field:'version',basis:'version-year',caption:`Version/edition year: ${year} (from recorded version; publication date unverified)`};
  }
 }
 return {value:null,precision:null,key:null,field:null,caption:'Publication date not recorded'};
}
function comparePublicationRecent(a,b){
 const x=publicationDate(a).key,y=publicationDate(b).key;
 const compare=(x,y)=>x<y?-1:x>y?1:0;
 return (y??-1)-(x??-1)||compare(String(a.title||''),String(b.title||''))||compare(String(a.path||''),String(b.path||''));
}
module.exports={publicationDate,comparePublicationRecent};
