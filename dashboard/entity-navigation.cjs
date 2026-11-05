'use strict';
const {safeNotePath}=require('./keyword-search.cjs');
const {safePaperPath}=require('./paper-navigation.cjs');
const ENTITY_FIELDS=Object.freeze(['country','product','method','evidence_kind','subject','keyword']);

function parseBracketList(val){
 if(Array.isArray(val))return val.map(s=>String(s).trim().replace(/^["']|["']$/g,'').trim()).filter(Boolean);
 if(typeof val!=='string')return [];
 val=val.trim();
 if(val.startsWith('[')){try{const a=JSON.parse(val);if(Array.isArray(a))return a.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean)}catch{}}
 const match=val.match(/^\[(.*)\]$/);
 if(!match){
  if(val.includes(','))return val.split(',').map(s=>s.trim().replace(/^["']|["']$/g,'').trim()).filter(Boolean);
  return val?[val.replace(/^["']|["']$/g,'').trim()]:[];
 }
 return match[1].split(',').map(s=>s.trim().replace(/^["']|["']$/g,'').trim()).filter(Boolean);
}

function parseFrontBlock(front){
 const meta=Object.create(null);let currentKey=null;
 for(const line of front.split(/\r?\n/)){
  const m=line.match(/^([a-zA-Z_][\w-]*):[ \t]*(.*)$/);
  if(m){
   currentKey=m[1].toLowerCase();
   meta[currentKey]=m[2].trim().replace(/^([\"'])(.*)\1$/,'$2');
   continue;
  }
  const item=line.match(/^\s*-\s+(.*)$/);
  if(item&&currentKey){
   const itemVal=item[1].trim().replace(/^([\"'])(.*)\1$/,'$2');
   if(Array.isArray(meta[currentKey]))meta[currentKey].push(itemVal);
   else if(typeof meta[currentKey]==='string'&&!meta[currentKey])meta[currentKey]=[itemVal];
   else if(typeof meta[currentKey]==='string')meta[currentKey]=[meta[currentKey],itemVal];
  }
 }
 return meta;
}

function buildTopicMap(index){
 const map=new Map();
 if(!Array.isArray(index))return map;
 for(const p of index){
  if(p&&safeNotePath(p.path)&&safePaperPath(p.path,'Topics','.md')){
   const title=typeof p.title==='string'&&p.title.trim()?p.title.trim():'';
   if(title){
    // Intentional subject backlinks use only visible recorded Topic links, never cached edges.
    let fence=null;const raw=String(p.raw??p.text??'').replace(/<!--[\s\S]*?(?:-->|$)/g,'').split(/\r?\n/).filter(line=>{const f=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length&&!f[2].trim())fence=null;return false}return !fence}).join('\n').replace(/`+[^`]*`+/g,'');
    for(const m of raw.matchAll(/\[\[(economy_wiki\/Literature\/[^\]|#]+)(?:\|[^\]]*)?\]\]/g)){
     let t=m[1];if(!t.endsWith('.md'))t+='.md';if(!safeNotePath(t)||!safePaperPath(t,'Literature','.md'))continue;
     if(!map.has(t))map.set(t,new Set());
     map.get(t).add(title);
    }
   }
  }
 }
 return map;
}

function extractFieldValues(p,field,topicMap){
 const vals=[];
 const add=v=>{
  if(Array.isArray(v)){for(const item of v)add(item);return}
  if(v instanceof Set){for(const item of v)add(item);return}
  if(typeof v==='string'){
   const s=v.replace(/^#+/, '');
   if(s&&!vals.includes(s))vals.push(s);
  }
 };
 if(p[field]!==undefined)add(typeof p[field]==='string'&&p[field].trim().startsWith('[')?parseBracketList(p[field]):p[field]);
 if(field==='subject'){
  if(p.subjects)add(p.subjects);
  if(p.topic)add(p.topic);
  if(p.topics)add(p.topics);
  if(p.path&&p.path.startsWith('economy_wiki/Topics/')&&typeof p.title==='string'&&p.title.trim())add(p.title);
  if(topicMap&&topicMap.has(p.path))add(topicMap.get(p.path));
 }else if(field==='keyword'){
  if(p.keywords)add(p.keywords);
  if(p.tags)add(p.tags);
 }else if(field==='country'){
  if(p.countries)add(p.countries);
 }else if(field==='product'){
  if(p.products)add(p.products);
 }else if(field==='method'){
  if(p.methods)add(p.methods);
 }else if(field==='evidence_kind'){
  if(p.evidence_kinds)add(p.evidence_kinds);
 }
 const raw=typeof p.raw==='string'?p.raw:(typeof p.text==='string'?p.text:'');
 if(raw){
  const front=(raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)||[])[1]||'';
  if(front){
   const meta=parseFrontBlock(front);
   if(meta[field]!==undefined)add(typeof meta[field]==='string'&&meta[field].trim().startsWith('[')?parseBracketList(meta[field]):meta[field]);
   if(field==='subject'){
    if(meta.subjects)add(parseBracketList(meta.subjects));
    if(meta.topic)add(meta.topic);
    if(meta.topics)add(parseBracketList(meta.topics));
    if(meta.jel_codes)add(parseBracketList(meta.jel_codes));
   }else if(field==='keyword'){
    if(meta.keywords)add(parseBracketList(meta.keywords));
    if(meta.tags)add(parseBracketList(meta.tags));
   }else if(field==='country'){
    if(meta.countries)add(parseBracketList(meta.countries));
   }else if(field==='product'){
    if(meta.products)add(parseBracketList(meta.products));
   }else if(field==='method'){
    if(meta.methods)add(parseBracketList(meta.methods));
   }else if(field==='evidence_kind'){
    if(meta.evidence_kinds)add(parseBracketList(meta.evidence_kinds));
   }
  }
 }
 return vals;
}

function validateEntities(value){
 const invalid=()=>{throw Error('Entity preferences require at most 50 unique field/value pairs and display names; use country, product, method, evidence_kind, subject or keyword and nonblank strings of 1–100 characters without surrounding whitespace or control characters.')};
 if(!Array.isArray(value)||value.length>50)invalid();const identities=new Set(),labels=new Set();
 return value.map(e=>{if(!e||typeof e!=='object'||!ENTITY_FIELDS.includes(e.field))invalid();for(const k of ['value','label'])if(typeof e[k]!=='string'||!e[k].trim()||e[k]!==e[k].trim()||e[k].length>100||/[\x00-\x1f\x7f]/.test(e[k]))invalid();const id=JSON.stringify([e.field,e.value]);if(identities.has(id)||labels.has(e.label))invalid();identities.add(id);labels.add(e.label);return {field:e.field,value:e.value,label:e.label}});
}

function entityMatches(index,entity){
 const [e]=validateEntities([entity]);
 const topicMap=buildTopicMap(index);
 return index.filter(p=>{
  if(!safeNotePath(p.path))return false;
  const values=extractFieldValues(p,e.field,topicMap);
  return values.includes(e.value);
 });
}

function entitySuggestions(index){
 const entries=[],seen=new Set();
 const topicMap=buildTopicMap(index);
 for(const p of index){
  if(!safeNotePath(p.path))continue;
  for(const field of ENTITY_FIELDS){
   const values=extractFieldValues(p,field,topicMap);
   for(const val of values){
    const e={field,value:val,label:val};
    try{validateEntities([e])}catch{continue}
    const id=JSON.stringify([field,e.value]);
    if(!seen.has(id)){
     seen.add(id);
     entries.push(e);
    }
   }
  }
 }
 return entries;
}

module.exports={ENTITY_FIELDS,validateEntities,entityMatches,entitySuggestions};
