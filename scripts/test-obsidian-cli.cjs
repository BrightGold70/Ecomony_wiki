'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('optional CLI bridge schedules async evaluation and flushes large piped results',t=>{
 const bridge=path.join(__dirname,'obsidian-cli.cjs');
 assert.ok(fs.existsSync(bridge),'optional bridge must exist');
 if(process.platform==='win32')return t.skip('POSIX executable fixture; Windows bridge remains unverified');
 const root=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-cli-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const fake=path.join(root,'obsidian');
 fs.writeFileSync(fake,`#!${process.execPath}
 const assert=require('node:assert/strict');
 const args=process.argv.slice(2),code=args.find(x=>x.startsWith('code='))||'';
 if(args.includes('eval'))assert.ok(args.includes('vault=New Economics'));
 if(code.includes('setTimeout')){assert.ok(code.includes('__economy_cli_'));assert.ok(code.includes('Promise.resolve'));console.log('=> scheduled')}
 else if(code.includes('JSON.stringify(globalThis'))console.log('=> '+JSON.stringify({state:'done',value:'x'.repeat(200000)}));
 else if(code.includes('delete globalThis'))console.log('=> true');
 else console.log('version-fixture');
 `,{mode:0o700});
 const env={...process.env,OBSIDIAN_CLI_BINARY:fake};
 const result=spawnSync(process.execPath,[bridge,'vault=New Economics','eval','code=Promise.resolve("synthetic")'],{env,encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout,'=> '+'x'.repeat(200000)+'\n');
 const version=spawnSync(process.execPath,[bridge,'version'],{env,encoding:'utf8',timeout:5000});
 assert.equal(version.status,0,version.stderr);
 assert.equal(version.stdout.trim(),'version-fixture');
});
