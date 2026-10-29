'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const api=require('./monitor-publications.cjs');
test('economics monitoring queries Crossref only and reports incomplete notice coverage',async()=>{
 const base=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-monitor-'));
 try{const vault=path.join(base,'vault');fs.mkdirSync(path.join(vault,'economy_wiki/Literature'),{recursive:true});fs.writeFileSync(path.join(vault,'economy_wiki/Literature/a.md'),'---\ndoi: 10.1234/trade\n---\n# Tariffs');
 const urls=[];const fetchImpl=async url=>{urls.push(url);return {ok:true,status:200,text:async()=>JSON.stringify({status:'ok',message:urls.length===1?{DOI:'10.1234/trade',title:['Tariffs']}:{items:[],'total-results':0}})}};
 const r=await api.runBatch({vault,output:path.join(base,'report.json')},{fetchImpl});assert.equal(r.results[0].crossref.state,'no-notice-found');assert.equal(r.results[0].pubmed,undefined);assert.equal(urls.length,2);assert.ok(urls.every(u=>new URL(u).hostname==='api.crossref.org'));assert.ok(r.limitations.some(s=>/Crossref only/.test(s)));
 await assert.rejects(api.runBatch({vault,output:path.join(base,'report.json')},{fetchImpl}),/EEXIST/);assert.equal(urls.length,2);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
function fixture(fn){const base=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-monitor-'));try{const vault=path.join(base,'vault');fs.mkdirSync(path.join(vault,'economy_wiki/Literature'),{recursive:true});const note=path.join(vault,'economy_wiki/Literature/a.md');fs.writeFileSync(note,'---\ndoi: 10.1234/trade\n---\n# Tariffs');return fn({base,vault,note})}finally{fs.rmSync(base,{recursive:true,force:true})}}
test('collector excludes private and symlink notes and preserves exact invalid DOI tokens',()=>fixture(({vault,note})=>{
 const dir=path.dirname(note);fs.mkdirSync(path.join(dir,'Private'));fs.writeFileSync(path.join(dir,'Private/secret.md'),'doi: 10.9999/secret');fs.symlinkSync(note,path.join(dir,'linked.md'));fs.writeFileSync(path.join(dir,'invalid.md'),'---\ndoi: " 10.1234/bad"\n---\n# Bad');
 const r=api.collectLiterature(vault);assert.equal(r.notesScanned,2);assert.deepEqual(r.entries.map(e=>e.doi),['10.1234/trade',' 10.1234/bad']);assert.equal(r.skippedSymlinks.length,1);
}));
test('monitor CLI rejects missing duplicate malformed flags before traffic',()=>{
 const {spawnSync}=require('node:child_process');for(const args of [[],['--vault','x','--output','y','--limit','0'],['--vault','x','--vault','z','--output','y'],['--vault','x','--output','y','--bogus','z']]){const run=spawnSync(process.execPath,[path.join(__dirname,'monitor-publications.cjs'),...args],{encoding:'utf8'});assert.equal(run.status,1);assert.ok(run.stderr);assert.equal(run.stdout,'')}
});
