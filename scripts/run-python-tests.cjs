#!/usr/bin/env node
'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const {resolvePython}=require('./python-runtime.cjs');
try {
 const result=spawnSync(resolvePython(),['-B',path.join(__dirname,'test-synthesize.py')],{
  cwd:path.resolve(__dirname,'..'),stdio:'inherit',timeout:30000,
  env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}
 });
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
} catch(error) {
 process.stderr.write(error.message+'\n');
 process.exitCode=1;
}
