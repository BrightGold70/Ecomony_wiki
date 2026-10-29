'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function fixture(fn){const d=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-private-'));try{return fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('maintenance refuses explicitly referenced private raw content and pure deep retrieval rejects private candidates',()=>fixture(d=>{
 const vault=path.join(d,'vault'),root=path.join(vault,'economy_wiki');fs.mkdirSync(path.join(root,'Sources'),{recursive:true});fs.mkdirSync(path.join(root,'raw/Private'),{recursive:true});fs.writeFileSync(path.join(root,'raw/Private/a.txt'),'secret');fs.writeFileSync(path.join(root,'Sources/a.md'),'---\nraw_path: raw/Private/a.txt\n---\n# Trade');const r=require('./maintain-wiki.cjs').auditWiki({vault,stateDir:path.join(d,'state')});assert.equal(r.counts.rawHashesChecked,0);assert.ok(r.issues.some(i=>i.rule==='unsafe-raw-path'));
 assert.equal(require('../dashboard/deep-search.cjs').deepSearch([{path:'economy_wiki/Literature/Private/a.md',title:'trade'}],'trade').rows.length,0);
}));
test('QMD external state symlink cannot write into a foreign directory',()=>fixture(d=>{
 const vault=path.join(d,'economy_wiki');fs.mkdirSync(path.join(vault,'Literature'),{recursive:true});fs.writeFileSync(path.join(vault,'Literature/a.md'),'# Trade');const foreign=path.join(d,'foreign');fs.mkdirSync(foreign);const state=path.join(d,'state');fs.symlinkSync(foreign,state);
 assert.throws(()=>require('./qmd-adapter.cjs').stage({vault,state}),/symlink/i);assert.deepEqual(fs.readdirSync(foreign),[]);
}));
