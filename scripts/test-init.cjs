const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {initWiki}=require('./init-wiki.cjs');
test('initializer creates empty research structure and never overwrites notes',()=>{
 const base=fs.realpathSync(process.env.TMPDIR||os.tmpdir());fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'wiki-init-test-'));
 try{const first=initWiki(dir);assert.ok(first.created>0);assert.deepEqual(fs.readdirSync(path.join(first.root,'Literature')),[]);const home=path.join(first.root,'Home.md');fs.writeFileSync(home,'User content');const second=initWiki(dir);assert.equal(second.created,0);assert.equal(fs.readFileSync(home,'utf8'),'User content');assert.ok(fs.existsSync(path.join(first.root,'Templates/Literature.md')))}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
