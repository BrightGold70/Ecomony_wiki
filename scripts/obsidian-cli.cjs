#!/usr/bin/env node
'use strict';
// Optional official-CLI bridge. Never reads vault files itself or enables permissions.
const {spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const bin=process.env.OBSIDIAN_CLI_BINARY||(process.platform==='darwin'?'/Applications/Obsidian.app/Contents/MacOS/Obsidian':'obsidian');
const args=process.argv.slice(2),index=args.findIndex(a=>a.startsWith('code='));
const run=a=>spawnSync(bin,a,{encoding:'utf8',maxBuffer:64*1024*1024,timeout:125000});
const flush=(text,status=0)=>process.stdout.write(text,()=>{process.exitCode=status});
if(!args.includes('eval')||index<0){const r=run(args);if(r.stderr)process.stderr.write(r.stderr);flush(r.stdout||'',r.status??1)}else{
 const key='__economy_cli_'+crypto.randomBytes(12).toString('hex'),code=args[index].slice(5);
 const evaluate=source=>run(args.map((a,i)=>i===index?'code='+source:a));
 const start=evaluate(`(()=>{const key=${JSON.stringify(key)};globalThis[key]={state:'pending'};setTimeout(()=>Promise.resolve().then(()=>eval(${JSON.stringify(code)})).then(value=>globalThis[key]={state:'done',value}).catch(error=>globalThis[key]={state:'error',error:String(error)}),100);return 'scheduled'})()`);
 if(start.status!==0||!start.stdout.includes('scheduled')){process.stderr.write('Official Obsidian CLI unavailable; enable CLI and open the selected vault.\n');process.exitCode=1}else{
  const deadline=Date.now()+110000,sleep=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);let complete=false;
  while(Date.now()<deadline){const r=evaluate('JSON.stringify(globalThis['+JSON.stringify(key)+'])');let state;try{state=JSON.parse(r.stdout.trim().replace(/^=> /,''))}catch{}
   if(state&&state.state!=='pending'){evaluate('delete globalThis['+JSON.stringify(key)+']');complete=true;if(state.state==='error'){process.stderr.write('Obsidian evaluation failed: '+state.error+'\n');process.exitCode=1}else{const value=typeof state.value==='string'?state.value:JSON.stringify(state.value);flush('=> '+(value??'undefined')+'\n')}break}sleep();
  }
  if(!complete){evaluate('delete globalThis['+JSON.stringify(key)+']');process.stderr.write('Obsidian asynchronous evaluation timed out; no success is inferred.\n');process.exitCode=1}
 }
}
