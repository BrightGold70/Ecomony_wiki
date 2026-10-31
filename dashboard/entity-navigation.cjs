'use strict';
const {safeNotePath}=require('./keyword-search.cjs');
const ENTITY_FIELDS=Object.freeze(['country','product','method','evidence_kind']);
function validateEntities(value){
 const invalid=()=>{throw Error('Entity preferences require at most 50 unique field/value pairs and display names; use country, product, method or evidence_kind and nonblank strings of 1–100 characters without surrounding whitespace or control characters.')};
 if(!Array.isArray(value)||value.length>50)invalid();const identities=new Set(),labels=new Set();
 return value.map(e=>{if(!e||typeof e!=='object'||!ENTITY_FIELDS.includes(e.field))invalid();for(const k of ['value','label'])if(typeof e[k]!=='string'||!e[k].trim()||e[k]!==e[k].trim()||e[k].length>100||/[\x00-\x1f\x7f]/.test(e[k]))invalid();const id=JSON.stringify([e.field,e.value]);if(identities.has(id)||labels.has(e.label))invalid();identities.add(id);labels.add(e.label);return {field:e.field,value:e.value,label:e.label}});
}
function entityMatches(index,entity){const [e]=validateEntities([entity]);return index.filter(p=>safeNotePath(p.path)&&p[e.field]===e.value)}
function entitySuggestions(index){const entries=[],seen=new Set();for(const p of index){if(!safeNotePath(p.path))continue;for(const field of ENTITY_FIELDS){const e={field,value:p[field],label:p[field]};try{validateEntities([e])}catch{continue}const id=JSON.stringify([field,e.value]);if(!seen.has(id)){seen.add(id);entries.push(e)}}}return entries}
module.exports={ENTITY_FIELDS,validateEntities,entityMatches,entitySuggestions};
