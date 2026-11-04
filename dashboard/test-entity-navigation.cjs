 'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ENTITY_FIELDS,validateEntities,entityMatches,entitySuggestions}=require('./entity-navigation.cjs');
test('personal entity preferences validate exact field/value identities independently of display names',()=>{
 const entry={field:'country',value:'Korea',label:'My trade research'};
 assert.deepEqual(validateEntities([entry]),[entry]);assert.deepEqual(validateEntities([]),[]);
 assert.deepEqual(validateEntities([entry,{field:'product',value:'Korea',label:'Other dimension'}]).length,2);
 assert.deepEqual(validateEntities([{field:'subject',value:'Macroeconomics',label:'Macro'},{field:'keyword',value:'tariffs',label:'Tariff studies'}]).length,2);
 assert.ok(ENTITY_FIELDS.includes('subject'));
 assert.ok(ENTITY_FIELDS.includes('keyword'));
 for(const bad of [null,{},['Korea'],[{...entry,field:'disease_scope'}],[{...entry,field:'__proto__'}],[entry,entry],[entry,{...entry,value:'Japan'}],Array.from({length:51},(_,i)=>({...entry,value:String(i),label:String(i)}))])assert.throws(()=>validateEntities(bad),/at most 50/);
 for(const key of ['value','label'])for(const value of ['', ' x','x ','x\n','x\x7f','x'.repeat(101),12,null])assert.throws(()=>validateEntities([{...entry,[key]:value}]),/at most 50/);
 assert.deepEqual(validateEntities([{...entry,label:'<img src=x onerror=alert(1)>'}])[0].value,'Korea');
});
test('exact metadata references use safe catalog paths, not titles, labels or case-folded UI filters',()=>{
 const index=[{path:'economy_wiki/Literature/a.md',country:'Korea',title:'Japan',subject:'Macroeconomics',keyword:'tariffs'}, {path:'economy_wiki/Methods/b.md',country:'korea',subject:'Microeconomics'}, {path:'economy_wiki/Topics/c.md',country:'Korea',keyword:'tariffs'}, {path:'private/a.md',country:'Korea',subject:'Macroeconomics'}, {path:'economy_wiki/Literature/../bad.md',country:'Korea',keyword:'tariffs'}];
 assert.deepEqual(entityMatches(index,{field:'country',value:'Korea',label:'Japan'}).map(p=>p.path),[index[0].path,index[2].path]);
 assert.deepEqual(entityMatches(index,{field:'country',value:'unknown',label:'Korea'}),[]);
 assert.deepEqual(entityMatches(index,{field:'subject',value:'Macroeconomics',label:'Macro'}).map(p=>p.path),[index[0].path]);
 assert.deepEqual(entityMatches(index,{field:'keyword',value:'tariffs',label:'Tariffs'}).map(p=>p.path),[index[0].path,index[2].path]);
 assert.throws(()=>entityMatches(index,{field:'title',value:'Japan',label:'Bad'}));
 assert.deepEqual(entitySuggestions(index),[
  {field:'country',value:'Korea',label:'Korea'},
  {field:'subject',value:'Macroeconomics',label:'Macroeconomics'},
  {field:'keyword',value:'tariffs',label:'tariffs'},
  {field:'country',value:'korea',label:'korea'},
  {field:'subject',value:'Microeconomics',label:'Microeconomics'}
 ]);
 assert.deepEqual(entitySuggestions([{path:'economy_wiki/Methods/x.md',method:' x',country:'x'.repeat(101)}]),[]);
});
test('entity suggestions and matching extract list metadata, topics, tags and YAML frontmatter',()=>{
 const richIndex=[
  {
   path:'economy_wiki/Literature/p1.md',
   tags:['ai','productivity'],
   keywords:['deep learning'],
   subjects:['Technological Change','Labor Economics'],
   topic:'Automation',
   country:'US',
   product:'software'
  },
  {
   path:'economy_wiki/Literature/p2.md',
   raw:`---
subject: Macroeconomics
tags:
  - monetary-policy
  - inflation
keywords:
  - interest-rates
countries:
  - Korea
  - Japan
products:
  - semiconductors
---
# Macro note`
  }
 ];
 const suggestions=entitySuggestions(richIndex);
 const keys=suggestions.map(s=>`${s.field}:${s.value}`);
 assert.ok(keys.includes('keyword:ai'));
 assert.ok(keys.includes('keyword:productivity'));
 assert.ok(keys.includes('keyword:deep learning'));
 assert.ok(keys.includes('keyword:monetary-policy'));
 assert.ok(keys.includes('keyword:inflation'));
 assert.ok(keys.includes('keyword:interest-rates'));
 assert.ok(keys.includes('subject:Technological Change'));
 assert.ok(keys.includes('subject:Labor Economics'));
 assert.ok(keys.includes('subject:Automation'));
 assert.ok(keys.includes('subject:Macroeconomics'));
 assert.ok(keys.includes('country:US'));
 assert.ok(keys.includes('country:Korea'));
 assert.ok(keys.includes('country:Japan'));
 assert.ok(keys.includes('product:software'));
 assert.ok(keys.includes('product:semiconductors'));

 assert.deepEqual(entityMatches(richIndex,{field:'keyword',value:'productivity',label:'Prod'}).map(p=>p.path),['economy_wiki/Literature/p1.md']);
 assert.deepEqual(entityMatches(richIndex,{field:'keyword',value:'monetary-policy',label:'Monetary'}).map(p=>p.path),['economy_wiki/Literature/p2.md']);
 assert.deepEqual(entityMatches(richIndex,{field:'subject',value:'Labor Economics',label:'Labor'}).map(p=>p.path),['economy_wiki/Literature/p1.md']);
 assert.deepEqual(entityMatches(richIndex,{field:'subject',value:'Macroeconomics',label:'Macro'}).map(p=>p.path),['economy_wiki/Literature/p2.md']);
 assert.deepEqual(entityMatches(richIndex,{field:'country',value:'Japan',label:'Japan'}).map(p=>p.path),['economy_wiki/Literature/p2.md']);
 assert.deepEqual(entityMatches(richIndex,{field:'product',value:'semiconductors',label:'Chips'}).map(p=>p.path),['economy_wiki/Literature/p2.md']);
});
