'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('default npm test includes offline synthesis Python regressions through the portable wrapper',()=>{
 const wrapper=path.join(__dirname,'run-python-tests.cjs');
 assert.ok(fs.existsSync(wrapper),'portable Python test wrapper must exist');
 const pkg=require('../package.json');
 assert.equal(pkg.scripts['test:python'],'node scripts/run-python-tests.cjs');
 const result=spawnSync(process.execPath,[wrapper],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stderr,/Ran \d+ tests/);
 assert.match(result.stderr,/\bOK\b/);
});
