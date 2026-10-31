const {test}=require('node:test'),assert=require('node:assert/strict');
const {diagnose}=require('./doctor.cjs');
test('doctor separates economics core from optional services and respects explicit interpreter',()=>{
 const absent=diagnose({nodeVersion:'22.0.0',env:{},probe:()=>false});assert.equal(absent.core.ready,true);assert.equal(absent.optional.synthesis.ready,false);assert.equal(absent.optional.semantic.ready,false);
 const bad=diagnose({nodeVersion:'20.0.0',env:{PYTHON:'/bad'},probe:n=>n==='python3'});assert.equal(bad.core.ready,false);assert.equal(bad.optional.python.ready,false);
 const good=diagnose({nodeVersion:'22.0.0',env:{PYTHON:'/chosen/python'},probe:n=>n==='/chosen/python'||n==='pdftotext'});assert.equal(good.optional.python.executable,'/chosen/python');assert.equal(good.optional.pdfExtraction.ready,true);
});
