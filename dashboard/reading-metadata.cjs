'use strict';
function referenceMetadata(raw){
 const front=(String(raw||'').match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)||[])[1]||'';
 const scalar=s=>{s=String(s).trim();if(s[0]==='"'){try{return JSON.parse(s.replace(/\s+#.*$/,''))}catch{return ''}}if(s[0]==="'")return s.replace(/^'|'(?:\s+#.*)?$/g,'').replace(/''/g,"'");return s.replace(/\s+#.*$/,'').trim()};
 const locatorScalar=(key,value)=>{const v=value.replace(/\s+#.*$/,'').trim();if(key==='pdf_page'&&/^[1-9]\d*$/.test(v)&&Number.isSafeInteger(Number(v)))return Number(v);if(key==='pdf_page_verified'&&/^(true|false)$/.test(v))return v==='true';return scalar(value)};
 const out={};let key='',record=null;
 for(const line of front.split(/\r?\n/)){
  const m=line.match(/^([a-z_][\w-]*):\s*(.*)$/i);
  if(m){key=m[1];record=null;const v=m[2].trim();if(v.startsWith('[')){try{out[key]=JSON.parse(v)}catch{out[key]=v.replace(/^\[|\](?:\s+#.*)?$/g,'').split(',').map(scalar)}}else out[key]=v?scalar(v):[];continue}
  const item=line.match(/^\s+-\s+(.*)$/);if(item&&Array.isArray(out[key])){const pair=item[1].match(/^(path|role|relationship|source_path|locator|pdf_page|pdf_page_verified):\s*(.*)$/);if(pair){record={[pair[1]]:locatorScalar(pair[1],pair[2])};out[key].push(record)}else{record=null;out[key].push(scalar(item[1]))}continue}
  const field=line.match(/^\s+(path|role|relationship|source_path|locator|pdf_page|pdf_page_verified):\s*(.*)$/);if(field&&record)record[field[1]]=locatorScalar(field[1],field[2]);
 }
 return out;
}
module.exports={referenceMetadata};
