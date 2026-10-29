'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolvePaperActions,openPaperAction}=require('./paper-navigation.cjs');
const note='economy_wiki/Literature/a.md',source='economy_wiki/Sources/a.md',pdf='economy_wiki/raw/a.pdf';
function fixture(meta={sources:[source]},sourceMeta={raw_path:'raw/a.pdf'}){
 const files=new Map([note,source,pdf].map(path=>[path,{path,extension:path.split('.').pop()}]));const calls=[];
 const app={vault:{getAbstractFileByPath:p=>files.get(p),cachedRead:async()=>'',adapter:{stat:async p=>files.has(p)?{type:'file'}:null}},metadataCache:{getFileCache:f=>({frontmatter:f.path===note?meta:sourceMeta})},workspace:{openLinkText:async(...args)=>calls.push(args)}};
 return {app,files,calls};
}
test('all nine compiled economics folders resolve and open; personal and secrets stay excluded',async()=>{
 for(const folder of ['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries']){const {app,files,calls}=fixture();const target=`economy_wiki/${folder}/trade.md`;files.set(target,{path:target});const actions=await resolvePaperActions(app,{path:target});assert.ok(actions.some(a=>a.kind==='wiki'&&a.target===target),folder);assert.equal(await openPaperAction(app,{kind:'wiki',target}),true);assert.deepEqual(calls,[[target,'','split']])}
 for(const folder of ['Personal','SECRETS']){const {app,files,calls}=fixture();const target=`economy_wiki/Literature/${folder}/a.md`;files.set(target,{path:target});assert.deepEqual(await resolvePaperActions(app,{path:target}),[]);assert.equal(await openPaperAction(app,{kind:'wiki',target}),false);assert.equal(calls.length,0)}
});
test('explicit legacy sources open the exact source and verified stored PDF in a split',async()=>{
 const {app,calls}=fixture();const actions=await resolvePaperActions(app,{path:note});assert.deepEqual(actions.map(a=>[a.label,a.target]),[['Open wiki note',note],['Open source record',source],['Open stored original PDF',pdf]]);
 for(const a of actions)await openPaperAction(app,a);assert.deepEqual(calls,[[note,'','split'],[source,'','split'],[pdf,'','split']]);
});
test('no stored original is inferred from title, DOI, source mode or neighbouring filename',async()=>{
 for(const m of [{},{source_mode:'local'},{raw_path:'raw/missing.pdf'},{raw_path:'raw/a.txt'},{raw_path:'economy_wiki/raw/a.pdf'}]){const {app}=fixture({sources:[source],raw_path:'raw/a.pdf',doi:'10.1234/example'},m);const actions=await resolvePaperActions(app,{path:note});assert.ok(actions.some(a=>a.kind==='source'));assert.ok(!actions.some(a=>a.kind==='pdf'))}
});
test('legacy source links in body and bracket lists resolve without source_mode',async()=>{
 for(const paper of [{path:note,raw:`---\nsources: [economy_wiki/Sources/a]\n---\n# A`},{path:note,raw:`# A\nSources: [[economy_wiki/Sources/a|Original record]]`}]){const {app}=fixture();delete app.metadataCache;app.vault.cachedRead=async()=>`---\nraw_path: raw/a.pdf\n---\n# Source`;const actions=await resolvePaperActions(app,paper);assert.ok(actions.some(a=>a.target===source));assert.ok(actions.some(a=>a.target===pdf))}
});
test('unsafe local paths and arbitrary action types never reach openLinkText',async()=>{
 const attacks=['raw/../a.pdf','raw/private/a.pdf','raw/.private/a.pdf','raw/%2e%2e/a.pdf','raw/a.pdf#x','raw/a.pdf?x','raw/a\\b.pdf','/etc/a.pdf','file:///etc/a.pdf','raw//a.pdf','raw/./a.pdf','raw/a.pdf\u0000','raw/../../private/a.pdf'];
 for(const raw_path of attacks){const {app,files,calls}=fixture({sources:[source]},{raw_path});files.set('economy_wiki/'+raw_path,{path:'economy_wiki/'+raw_path});assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='pdf'),raw_path);assert.equal(await openPaperAction(app,{kind:'pdf',target:'economy_wiki/'+raw_path}),false);assert.equal(calls.length,0)}
 for(const target of ['private/a.md','economy_wiki/Sources/../../private/a.md','economy_wiki/Sources/.secret/a.md','economy_wiki/Sources/private/a.md','economy_wiki/Sources/%2e%2e/a.md']){const {app,files}=fixture({sources:[target]});files.set(target,{path:target});assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='source'))}
 const {app,calls}=fixture();assert.deepEqual(await resolvePaperActions(app,{path:'economy_wiki/Literature/../private/a.md'}),[]);assert.equal(await openPaperAction(app,{kind:'execute',target:note}),false);assert.equal(calls.length,0);
});
test('missing, folder, and adapter-detected symlink originals are unavailable, with click-time revalidation',async()=>{
 for(const stat of [null,{type:'folder'},{type:'file',symlink:true},{type:'file',isSymbolicLink:true}]){const {app}=fixture();app.vault.adapter.stat=async p=>p===pdf?stat:{type:'file'};assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='pdf'))}
 const {app,files,calls}=fixture();const action=(await resolvePaperActions(app,{path:note})).find(a=>a.kind==='pdf');files.delete(pdf);assert.equal(await openPaperAction(app,action),false);assert.equal(calls.length,0);
});
test('only explicit HTTP(S) source URLs and valid DOI values become external controls',async()=>{
 const {app,calls}=fixture({sources:[source],source_url:'https://publisher.example/article'},{doi:'10.1234/example'});const actions=await resolvePaperActions(app,{path:note,raw:'# A\nhttps://untrusted.example/not-metadata'});const urls=actions.filter(a=>a.kind==='external');assert.deepEqual(urls.map(a=>a.target),['https://publisher.example/article','https://doi.org/10.1234/example']);const external=[];for(const a of urls)await openPaperAction(app,a,async u=>external.push(u));assert.deepEqual(external,urls.map(a=>a.target));assert.equal(calls.length,0);
 for(const url of ['javascript:alert(1)','file:///etc/passwd','obsidian://open','data:text/html,evil','https://user:password@example.org','//example.org','https://example.org\\evil','https://example.org\nattacker']){const {app}=fixture({sources:[source],source_url:url},{doi:url});assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='external'),url);let called=false;assert.equal(await openPaperAction(app,{kind:'external',target:url},()=>{called=true}),false);assert.equal(called,false)}
});
test('desktop verification rejects a symlinked vault ancestor, not only note-relative components',async()=>{
 const fs=require('node:fs'),path=require('node:path'),root=fs.mkdtempSync(path.join(process.env.TMPDIR,'paper-vault-link-'));
 try{const real=path.join(root,'real'),alias=path.join(root,'alias');for(const p of [note,source,pdf]){fs.mkdirSync(path.dirname(path.join(real,'vault',p)),{recursive:true});fs.writeFileSync(path.join(real,'vault',p),'fixture')}fs.symlinkSync(real,alias);const {app,calls}=fixture();app.vault.adapter.getBasePath=()=>path.join(alias,'vault');assert.deepEqual(await resolvePaperActions(app,{path:note}),[]);assert.equal(await openPaperAction(app,{kind:'wiki',target:note}),false);assert.equal(calls.length,0)}finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('desktop filesystem verification rejects symlinked PDF and parent directory',async()=>{
 const fs=require('node:fs'),path=require('node:path');const root=fs.mkdtempSync(path.join(process.env.TMPDIR,'paper-navigation-'));
 try{fs.mkdirSync(path.join(root,'economy_wiki/Literature'),{recursive:true});fs.mkdirSync(path.join(root,'economy_wiki/Sources'));fs.mkdirSync(path.join(root,'economy_wiki/raw'));fs.writeFileSync(path.join(root,note),'# A');fs.writeFileSync(path.join(root,source),'# Source');fs.writeFileSync(path.join(root,'target.pdf'),'fixture');fs.symlinkSync(path.join(root,'target.pdf'),path.join(root,pdf));const {app}=fixture();app.vault.adapter.getBasePath=()=>root;assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='pdf'));fs.unlinkSync(path.join(root,pdf));fs.rmdirSync(path.join(root,'economy_wiki/raw'));fs.mkdirSync(path.join(root,'outside'));fs.writeFileSync(path.join(root,'outside/a.pdf'),'fixture');fs.symlinkSync(path.join(root,'outside'),path.join(root,'economy_wiki/raw'));assert.ok(!(await resolvePaperActions(app,{path:note})).some(a=>a.kind==='pdf'));}finally{fs.rmSync(root,{recursive:true,force:true})}
});
