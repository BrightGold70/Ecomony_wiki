'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=()=>require('./evidence-lifecycle.cjs');
test('SHA256 hashes exact UTF-8 content without normalization',()=>{
 assert.equal(api().hashContent('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.notEqual(api().hashContent('abc'),api().hashContent('abc\n'));
 assert.equal(api().hashContent('가'),require('node:crypto').createHash('sha256').update('가','utf8').digest('hex'));
 assert.throws(()=>api().hashContent(null),TypeError);
});
test('dependencies report current, changed, absent and malformed provenance without reading sources',()=>{
 const claim=syntheticClaim(),sources={'synthetic/source.md':'a'.repeat(64)},before=JSON.stringify(claim);
 assert.deepEqual(api().assessDependencies([claim],sources).map(row=>row.state),['current']);
 assert.equal(api().assessDependencies([claim],{'synthetic/source.md':'b'.repeat(64)})[0].state,'stale');
 for(const hashes of [{},{'synthetic/source.md':'unknown'},Object.create(sources)])assert.equal(api().assessDependencies([claim],hashes)[0].state,'missing');
 assert.equal(api().assessDependencies([{...claim,sourceSha256:'unknown'}],sources)[0].state,'missing');
 assert.equal(api().assessDependencies([null],sources)[0].state,'missing');
 assert.equal(api().assessDependencies([claim],new Map(Object.entries(sources)))[0].state,'current');
 const rows=api().assessDependencies([claim,{...claim,id:'second',sourcePath:'synthetic/absent.md'}],sources);
 assert.deepEqual(rows.map(row=>row.id),[claim.id,'second']);
 assert.ok(rows.every(row=>typeof row.reason==='string'&&row.reason.length>0));
 assert.equal(JSON.stringify(claim),before);
 assert.deepEqual(api().assessDependencies([],{}),[]);
 assert.throws(()=>api().assessDependencies(null,{}),TypeError);
});
test('review creation requires a declared human, named reviewer, scope and decision and disclaims authentication',()=>{
 const {createReview}=api();
 for(const actor of ['agent','ai',undefined,'Human'])assert.throws(()=>createReview('synthetic text','Synthetic Reviewer','claim','approved',actor));
 for(const reviewer of ['', 'unknown','human','AI','agent'])assert.throws(()=>createReview('synthetic text',reviewer,'claim','approved','human'));
 assert.throws(()=>createReview('synthetic text','Synthetic Reviewer','','approved','human'));
 assert.throws(()=>createReview('synthetic text','Synthetic Reviewer','claim','','human'));
 assert.throws(()=>createReview(null,'Synthetic Reviewer','claim','approved','human'));
 const receipt=createReview('synthetic text','Synthetic Reviewer','claim','approved','human');
 assert.equal(receipt.contentSha256,api().hashContent('synthetic text'));
 assert.match(receipt.receiptSha256,/^[a-f0-9]{64}$/);
 assert.equal(receipt.reviewer,'Synthetic Reviewer');assert.equal(receipt.actor,'human');
 assert.match(receipt.disclaimer,/cannot authenticate.*human identity/i);
});
test('review verification is content-pinned, checks receipt fields, and keeps decisions distinct from approval',()=>{
 const {createReview,verifyReview}=api(),text='Synthetic text\n';
 const receipt=createReview(text,'Synthetic Reviewer','claim provenance','rejected','human'),before=JSON.stringify(receipt);
 assert.equal(verifyReview(text,receipt).state,'reviewed');
 assert.equal(verifyReview(text,receipt).decision,'rejected');
 assert.equal(verifyReview(text+'changed',receipt).state,'stale');
 assert.match(verifyReview(text,receipt).disclaimer,/cannot authenticate.*human identity/i);
 for(const field of Object.keys(receipt)){
  const altered={...receipt};delete altered[field];
  assert.equal(verifyReview(text,altered).state,'invalid',field);
 }
 for(const field of ['reviewer','scope','decision','contentSha256','receiptSha256','actor']){
  const altered={...receipt,[field]:field.endsWith('Sha256')?'f'.repeat(64):'changed'};
  assert.equal(verifyReview(text,altered).state,'invalid',field);
 }
 for(const value of [null,[],{},42])assert.equal(verifyReview(text,value).state,'invalid');
 assert.equal(verifyReview(null,receipt).state,'invalid');
 assert.equal(JSON.stringify(receipt),before);
 assert.equal(verifyReview(text,JSON.parse(JSON.stringify(receipt))).state,'reviewed');
});
test('SHA256 agrees with Node across padding boundaries and browser-style execution needs no require',()=>{
 const crypto=require('node:crypto');
 for(const size of [0,1,55,56,63,64,65,119,120,127,128,1024,65536]){
  const text='x'.repeat(size)+'🧬';
  assert.equal(api().hashContent(text),crypto.createHash('sha256').update(text,'utf8').digest('hex'),String(size));
 }
 const sandbox={module:{exports:{}},TextEncoder};
 require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('./evidence-lifecycle.cjs'),'utf8'),sandbox);
 assert.equal(sandbox.module.exports.hashContent('abc'),api().hashContent('abc'));
});
test('claim template is pending with explicit unknown economic values and cannot pass with unfilled provenance',()=>{
 const template=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../templates/Claim.json'),'utf8'));
 for(const key of ['id','statement','sourcePath','sourceSha256','locator'])assert.ok(key in template,key);
 assert.equal(template.reviewStatus,'pending');

 assert.ok(api().validateClaim(template).length);
 // Unfilled or pre-migration templates must fail rather than silently acquiring evidence kind.
 if(!template.evidence_kind)assert.ok(api().validateClaim(template).some(e=>e.includes('evidence_kind')));
 if(!template.research_question)assert.ok(api().validateClaim(template).some(e=>e.includes('research_question')));
 assert.deepEqual(api().validateClaim({...template,...syntheticClaim()}),[]);
});
const syntheticClaim=()=>({id:'synthetic-claim-1',evidence_kind:'descriptive',research_question:'Synthetic question',statement:'Synthetic finding only.',sourcePath:'synthetic/source.md',sourceSha256:'a'.repeat(64),locator:'Table 2, row 1',population:'unknown',endpoint:'unknown',estimate:'unknown',uncertainty:'unknown'});

test('claim requires provenance but permits explicit unknown economic strings and defaults to pending without mutation',()=>{
 const claim=syntheticClaim(),before=JSON.stringify(claim);
 assert.deepEqual(api().validateClaim(claim),[]);
 assert.equal(JSON.stringify(claim),before);
 for(const field of ['id','statement','sourcePath','sourceSha256','locator','research_question','evidence_kind']){
  const broken={...claim};delete broken[field];
  assert.ok(api().validateClaim(broken).some(error=>error.includes(field)),field);
 }
 for(const field of ['sourcePath','sourceSha256','locator'])for(const value of ['unknown','pending','',null,'TODO'])assert.ok(api().validateClaim({...claim,[field]:value}).length,field);
 assert.ok(api().validateClaim({...claim,sourceSha256:'z'.repeat(64)}).length);
 assert.ok(api().validateClaim({...claim,reviewStatus:'invented'}).length);
 for(const value of [null,[],42])assert.ok(api().validateClaim(value).length);
});
