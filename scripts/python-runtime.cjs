'use strict';
const {spawnSync}=require('node:child_process');
function resolvePython({env=process.env,candidates=['python3','/opt/homebrew/bin/python3','/usr/local/bin/python3','python'],run=spawnSync}={}){
 const choices=env.PYTHON?[env.PYTHON]:candidates;
 for(const executable of choices){
  const result=run(executable,['-B','-c','import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)'],{encoding:'utf8',timeout:10000,env});
  if(!result.error&&result.status===0)return executable;
 }
 throw Error(env.PYTHON?'PYTHON must name a working Python 3.10+ interpreter':'No working Python 3.10+ interpreter found; set PYTHON explicitly');
}
module.exports={resolvePython};
