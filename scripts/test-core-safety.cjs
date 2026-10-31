'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const scratch=path.join(os.homedir(),'.hermes/cache/scratch');fs.mkdirSync(scratch,{recursive:true});
function fixture(t){const base=fs.mkdtempSync(path.join(scratch,'economy-core-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));return base;}
test('initializer preflights all destinations before creating any files or directories',t=>{
 const base=fixture(t),vault=path.join(base,'vault'),root=path.join(vault,'economy_wiki'),outside=path.join(base,'outside');fs.mkdirSync(root,{recursive:true});fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(root,'Setup'));
 assert.throws(()=>require('./init-wiki.cjs').initWiki(vault),/Symlink/);assert.deepEqual(fs.readdirSync(root),['Setup']);assert.deepEqual(fs.readdirSync(outside),[]);
});
test('review rejects noncanonical compiled paths before writing a receipt and accepts all economics categories',t=>{
 const base=fixture(t),root=path.join(base,'economy_wiki');fs.mkdirSync(path.join(root,'Sources'),{recursive:true});fs.mkdirSync(path.join(root,'Literature'));fs.writeFileSync(path.join(root,'Sources/source.md'),'# Source');fs.writeFileSync(path.join(root,'Literature/a.md'),'# Compiled');
 const {reviewFile}=require('./review-content.cjs');const output=path.join(base,'receipt.json');
 const realpath=fs.realpathSync;try{fs.realpathSync=()=>{throw Error('noncanonical path reached filesystem')};for(const target of ['economy_wiki/Literature/../Sources/source.md','economy_wiki/Literature/./a.md','economy_wiki/Literature//a.md'])assert.throws(()=>reviewFile(base,target,'Economist','selected text','reviewed',output),/scope/);}finally{fs.realpathSync=realpath;}
 assert.ok(!fs.existsSync(output));
 for(const folder of ['Literature','Topics','Theories','Methods','Datasets','Policies','Analyses','Comparisons','Queries']){fs.mkdirSync(path.join(root,folder),{recursive:true});fs.writeFileSync(path.join(root,folder,'valid.md'),'# Evidence\nAssociation is not a causal estimate.');const out=path.join(base,folder+'.json');reviewFile(base,`economy_wiki/${folder}/valid.md`,'Economist','selected text','reviewed',out);assert.ok(fs.existsSync(out));}
});
