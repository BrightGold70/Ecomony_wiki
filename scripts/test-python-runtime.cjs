'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('portable Python discovery skips broken runtimes and never ignores an explicit override',()=>{
 const file=path.join(__dirname,'python-runtime.cjs');
 assert.ok(fs.existsSync(file),'portable Python resolver must exist');
 const {resolvePython}=require(file),calls=[];
 const run=(executable,args,options)=>{calls.push(executable);assert.ok(args.at(-1).includes('(3,10)'));assert.equal(options.timeout,10000);return executable==='/working/python'?{status:0}:{status:null,error:Error('Bad CPU type')};};
 assert.equal(resolvePython({env:{PYTHON:'/working/python'},run}),'/working/python');
 assert.throws(()=>resolvePython({env:{PYTHON:'/broken/python'},run}),/PYTHON/);
 assert.equal(resolvePython({env:{},candidates:['broken','/working/python'],run}),'/working/python');
 assert.deepEqual(calls,['/working/python','/broken/python','broken','/working/python']);
 assert.throws(()=>resolvePython({env:{},candidates:['broken'],run}),/Python 3.10/);
});
