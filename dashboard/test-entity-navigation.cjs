'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateEntities,entityMatches,entitySuggestions}=require('./entity-navigation.cjs');
test('personal entity preferences validate exact field/value identities independently of display names',()=>{
 const entry={field:'country',value:'Korea',label:'My trade research'};
 assert.deepEqual(validateEntities([entry]),[entry]);assert.deepEqual(validateEntities([]),[]);
 assert.deepEqual(validateEntities([entry,{field:'product',value:'Korea',label:'Other dimension'}]).length,2);
 for(const bad of [null,{},['Korea'],[{...entry,field:'disease_scope'}],[{...entry,field:'__proto__'}],[entry,entry],[entry,{...entry,value:'Japan'}],Array.from({length:51},(_,i)=>({...entry,value:String(i),label:String(i)}))])assert.throws(()=>validateEntities(bad),/at most 50/);
 for(const key of ['value','label'])for(const value of ['', ' x','x ','x\n','x\x7f','x'.repeat(101),12,null])assert.throws(()=>validateEntities([{...entry,[key]:value}]),/at most 50/);
 assert.deepEqual(validateEntities([{...entry,label:'<img src=x onerror=alert(1)>'}])[0].value,'Korea');
});
test('exact metadata references use safe catalog paths, not titles, labels or case-folded UI filters',()=>{
 const index=[{path:'economy_wiki/Literature/a.md',country:'Korea',title:'Japan'}, {path:'economy_wiki/Methods/b.md',country:'korea'}, {path:'economy_wiki/Topics/c.md',country:'Korea'}, {path:'private/a.md',country:'Korea'}, {path:'economy_wiki/Literature/../bad.md',country:'Korea'}];
 assert.deepEqual(entityMatches(index,{field:'country',value:'Korea',label:'Japan'}).map(p=>p.path),[index[0].path,index[2].path]);
 assert.deepEqual(entityMatches(index,{field:'country',value:'unknown',label:'Korea'}),[]);
 assert.throws(()=>entityMatches(index,{field:'title',value:'Japan',label:'Bad'}));
 assert.deepEqual(entitySuggestions(index),[{field:'country',value:'Korea',label:'Korea'},{field:'country',value:'korea',label:'korea'}]);
 assert.deepEqual(entitySuggestions([{path:'economy_wiki/Methods/x.md',method:' x',country:'x'.repeat(101)}]),[]);
});
