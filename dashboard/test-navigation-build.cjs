'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
test('build validates a self-contained navigation bundle without installing into a vault',()=>{
 const script=path.join(__dirname,'../scripts/build.cjs');const output=execFileSync(process.execPath,[script,'--check'],{encoding:'utf8'});assert.match(output,/validated/i);
 execFileSync(process.execPath,[script],{encoding:'utf8'});const bundle=fs.readFileSync(path.join(__dirname,'../dist/economy-keyword-search/main.js'),'utf8');assert.ok(bundle.includes('Open stored original PDF'));assert.ok(!/require\(['"]\.\//.test(bundle));new vm.Script(bundle);assert.ok(!bundle.includes('describeReference'));assert.ok(!bundle.includes('disease_scope'));
});
