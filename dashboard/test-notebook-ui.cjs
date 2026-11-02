'use strict';
const {test,after}=require('node:test');
const {spawnSync}=require('node:child_process');
const os=require('node:os');
const notebookId='12345678-1234-4234-8234-123456789abc';
const temporary=[];
after(()=>{for(const dir of temporary)fs.rmSync(dir,{recursive:true,force:true})});
// Exercise the real handle()/strict manifest contract with synthetic local files
// and an injected async client. No SDK, credentials, login or network is used.
const backendRunner=String.raw`
import asyncio, importlib.util, json, pathlib, sys
from types import SimpleNamespace as NS
spec=importlib.util.spec_from_file_location('notebook_bridge',sys.argv[1])
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
root=pathlib.Path(sys.argv[2]);vault=root/'vault';state=root/'state'
for name,text in [('Literature/a.md','# Paper a\\n## Evidence and screening\\nSynthetic summary a.'),('Literature/b.md','# Paper b\\n## Evidence and screening\\nSynthetic summary b.'),('Sources/a.md','---\\nraw_path: raw/a.pdf\\n---\\n# PDF a'),('Sources/b.md','---\\nraw_path: raw/b.pdf\\n---\\n# PDF b')]:
 p=vault/'economy_wiki'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text.replace('\\n','\n'))
for name in ['a','b']:
 p=vault/'economy_wiki/raw'/f'{name}.pdf';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'%PDF-1.4\nSynthetic '+name.encode())
for folder in ['Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries']:
 p=vault/'economy_wiki'/folder/'compiled.md';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('# '+folder+'\\nSynthetic compiled economics note.')
request=json.loads(sys.stdin.read());failure=sys.argv[3]
nid='12345678-1234-4234-8234-123456789abc'
class Notebooks:
 async def list(self): return [NS(id=nid,title='Existing research')]
 async def create(self,title): return NS(id=nid,title=title)
 async def get(self,id): return NS(id=id)
class Sources:
 def __init__(self): self.added=0
 async def add_text(self,*args,**kwargs):
  self.added+=1
  if failure and self.added==int(failure): raise RuntimeError('SECRET_COOKIE raw provider error')
  return NS(id='source-'+str(self.added))
 async def add_file(self,*args,**kwargs): return await self.add_text()
 async def wait_until_ready(self,n,id,**kwargs): return NS(id=id,is_ready=True)
 async def list(self,n): return [NS(id='source-'+str(i)) for i in range(1,21)]
 async def get(self,n,id): return NS(id=id,is_ready=True)
result=asyncio.run(b.handle(request,vault,state,client=NS(notebooks=Notebooks(),sources=Sources())))
print(json.dumps(result));sys.exit(0 if result['ok'] else 1)
`;
function backend(root,request,failure=''){
 const result=spawnSync(process.env.NOTEBOOK_TEST_PYTHON||'python3',['-B','-c',backendRunner,path.resolve(__dirname,'../scripts/notebook-bridge.py'),root,String(failure)],{input:JSON.stringify(request),encoding:'utf8'});
 assert.ok(result.stdout, result.stderr);return {result:JSON.parse(result.stdout),code:result.status};
}
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {EventEmitter}=require('node:events');
class Element{
 constructor(tag='div',opts={}){this.tag=tag;this.children=[];this.style={};this.attrs={};this.text=opts.text||'';this.value=opts.value||'';this.type=opts.type;this.checked=false;this.disabled=false;this.listeners={}}
 createEl(tag,opts={}){const e=new Element(tag,opts);this.children.push(e);return e}createDiv(){return this.createEl('div')}empty(){this.children=[];this.text=''}setText(t){this.text=t}appendText(t){this.text+=t}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,v){this.listeners[k]=v}focus(){}scrollIntoView(){}all(){return [this,...this.children.flatMap(e=>e.all())]}contents(){return this.all().map(e=>e.text).join('\n')}
}
const papers=['a','b'].map(id=>({path:`economy_wiki/Literature/${id}.md`,text:`# Paper ${id}\n## Evidence and screening\nSynthetic summary ${id}.`}));
const config={repositoryPath:'/synthetic/repo',notebookPythonExecutable:'/synthetic/python',notebookStateDir:'/synthetic/private-state'};
async function setup(cfg=config){
 const calls=[];let factory;const root=fs.realpathSync(fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'notebook-ui-')));temporary.push(root);const respond=(i,failure='')=>{const {result,code}=backend(root,calls[i].child.payload,failure);const c=calls[i].child;c.stdout.emit('data',JSON.stringify(result));c.emit('close',code);return result};
 const spawn=(command,args,options)=>{const child=new EventEmitter();Object.assign(child,{stdout:new EventEmitter(),stderr:new EventEmitter(),kills:[],kill(s){this.kills.push(s)},stdin:{end(raw){child.payload=JSON.parse(raw)}}});calls.push({command,args,options,child});return child};
 const sandbox={URL,Buffer,module:{exports:{}},process:{env:{PATH:'/synthetic/bin'},platform:'win32'},setTimeout,clearTimeout,console,require:n=>n==='node:child_process'?{spawn}:require(n.startsWith('node:')?n:path.resolve(__dirname,n))};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'notebook-panel.cjs'),'utf8'),sandbox);
 const view={contentEl:new Element(),plugin:{loadData:async()=>cfg},selected:new Set(),index:papers.map(p=>({...p,raw:p.text})),filters:{},app:{vault:{adapter:{getBasePath:()=>'/synthetic/vault'},getAbstractFileByPath:()=>null,read:async f=>f.text},workspace:{openLinkText(){}}},catalog(){return this.index.filter(p=>Object.entries(this.filters).every(([k,v])=>!v.value.trim()||String(p[k]||'').toLowerCase()===v.value.trim().toLowerCase()))},clearPanel(area){if(this.serviceSession?.area===area)this.cancelServices?.();area.empty()},async onClose(){this.cancelServices?.()}};
 const area=view.contentEl.createDiv();view.contentEl.createEl('button',{text:'Gemini Notebook'}).onclick=()=>sandbox.module.exports.call(view,area);view.contentEl.createEl('button',{text:'Wiki management'}).onclick=()=>view.clearPanel(area);
 const comparison=view.contentEl.createEl('input',{type:'checkbox'});comparison.checked=true;comparison.onchange=()=>{view.selected.delete(papers[0].path);view.invalidateSynthesis?.()};
 return {view,calls,respond,root,button:label=>view.contentEl.all().find(e=>e.tag==='button'&&e.text===label),field:label=>view.contentEl.all().find(e=>e.attrs['aria-label']===label),finish(i,result,code=0,stderr=''){const c=calls[i].child;if(result!==null)c.stdout.emit('data',JSON.stringify(result));if(stderr)c.stderr.emit('data',stderr);c.emit('close',code)}};
}
async function previewReady(h){h.view.selected.add(papers[0].path);await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='Research';const pending=h.button('Preview notebook sources').onclick();h.respond(h.calls.length-1);await pending;h.field('Notebook upload consent').checked=true;h.field('Notebook upload consent').onchange()}
test('missing configuration keeps every execution action disabled after field edits',async()=>{
 const h=await setup({});await h.button('Gemini Notebook').onclick();assert.match(h.view.contentEl.contents(),/not configured/);h.field('Notebook title').value='Example';h.field('Notebook title').oninput();assert.equal(h.button('List existing notebooks').disabled,true);assert.equal(h.button('Preview notebook sources').disabled,true);await h.button('List existing notebooks').onclick();await h.button('Preview notebook sources').onclick();assert.equal(h.calls.length,0);
});
test('Notebook explicit list, existing ID, fallback Python and missing explicit PDF source fail closed',async()=>{
 const h=await setup({...config,notebookPythonExecutable:undefined,pythonExecutable:'/fallback/python'});await h.button('Gemini Notebook').onclick();assert.equal(h.calls.length,0);let pending=h.button('List existing notebooks').onclick();assert.deepEqual(h.calls[0].child.payload,{action:'list-notebooks'});h.respond(0);await pending;await h.button('Choose notebook: Existing research').onclick();assert.equal(h.field('Notebook destination').value,'existing');assert.equal(h.field('Notebook ID').value,notebookId);h.view.selected.add(papers[0].path);h.view.selected.add(papers[1].path);h.view.filters={country:{value:''}};h.field('Notebook source mode').value='pdf';h.field('Notebook source mode').onchange();await h.button('Preview notebook sources').onclick();assert.equal(h.calls[0].command,'/fallback/python');assert.equal(h.calls.length,1);assert.match(h.view.contentEl.contents(),/no verified explicit source record/);
});
test('Notebook prevents unselected fallback and rejects in-vault state configuration',async()=>{
 const h=await setup();await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='New';await h.button('Preview notebook sources').onclick();assert.equal(h.calls.length,0);assert.match(h.view.contentEl.contents(),/Select comparison papers first/);
 for(const notebookStateDir of ['/synthetic/vault/private','/synthetic/repo/private','relative']){const h=await setup({...config,notebookStateDir});await h.button('Gemini Notebook').onclick();assert.match(h.view.contentEl.contents(),/external directory/);await h.button('List existing notebooks').onclick();assert.equal(h.calls.length,0)}
});
test('Notebook invalidates consent on changed inputs, selected paths and note content',async()=>{
 for(const change of [h=>{h.field('Notebook source mode').value='pdf'},h=>{h.field('Notebook title').value='Changed'},h=>{h.view.selected.add(papers[1].path)},h=>{h.view.index.find(p=>p.path===papers[0].path).raw+='\nChanged note'}]){const h=await setup();await previewReady(h);change(h);await h.button('Upload previewed sources').onclick();assert.equal(h.calls.length,1);assert.equal(h.field('Notebook upload consent').checked,false)}
 const h=await setup();await previewReady(h);const checkbox=h.view.contentEl.all().find(e=>e.tag==='input'&&e.type==='checkbox'&&!e.attrs['aria-label']);checkbox.checked=false;checkbox.onchange();assert.equal(h.field('Notebook upload consent').checked,false);assert.equal(h.button('Upload previewed sources').disabled,true);
});
test('Notebook upload is single flight and closing/switching panels prevents stale results',async()=>{
 const h=await setup();await previewReady(h);const pending=h.button('Upload previewed sources').onclick();await h.button('Upload previewed sources').onclick();assert.equal(h.calls.length,2);await h.button('Wiki management').onclick();assert.deepEqual(h.calls[1].child.kills,['SIGTERM']);h.finish(1,{ok:true,action:'upload',notebookId,status:'verified',sources:[{sourceHash:'a'.repeat(64),sourceId:'late',status:'verified'}]});await pending;assert.ok(!h.view.contentEl.contents().includes('LATE'));
 const second=await setup();await second.button('Gemini Notebook').onclick();const p=second.button('List existing notebooks').onclick();await second.view.onClose();assert.deepEqual(second.calls[0].child.kills,['SIGTERM']);second.finish(0,{ok:true,action:'list-notebooks',notebooks:[{notebookId,title:'LATE'}]});await p;assert.ok(!second.view.contentEl.contents().includes('LATE'));
});
test('Notebook auth and arbitrary stderr errors never reveal backend secrets',async()=>{
 const h=await setup();await h.button('Gemini Notebook').onclick();for(const [result,stderr,pattern]of [[{ok:false,error:{code:'auth_required',message:'SECRET_COOKIE'}},'',/authentication.*expired/],[null,'SECRET_TOKEN=rawstderr',/diagnostic details suppressed/],[{ok:false,error:{code:'remote_failure',message:'SECRET_RESPONSE'}},'',/diagnostic details suppressed/]]){const p=h.button('List existing notebooks').onclick();h.finish(h.calls.length-1,result,result===null?1:0,stderr);await p;assert.match(h.view.contentEl.contents(),pattern);assert.ok(!h.view.contentEl.contents().includes('SECRET'))}
});
test('Notebook can close while private configuration is loading',async()=>{
 const h=await setup();let resolve;h.view.plugin.loadData=()=>new Promise(r=>{resolve=r});const opening=h.button('Gemini Notebook').onclick();await h.view.onClose();resolve(config);await opening;assert.equal(h.calls.length,0);
});
test('consent cannot be carried from before preview completion',async()=>{
 const h=await setup();h.view.selected.add(papers[0].path);await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='Research';const pending=h.button('Preview notebook sources').onclick();const consent=h.field('Notebook upload consent');assert.equal(consent.disabled,true);consent.checked=true;h.respond(0);await pending;assert.equal(consent.checked,false);assert.equal(h.button('Upload previewed sources').disabled,true);assert.equal(consent.disabled,false);
});
test('Notebook panel opens without subprocess/network calls; summary default and explicit actions',async()=>{
 const h=await setup();const open=h.button('Gemini Notebook');assert.ok(open,'Gemini Notebook entry action is available');await open.onclick();assert.equal(h.calls.length,0);assert.equal(h.field('Notebook source mode').value,'summary');assert.ok(h.button('List existing notebooks'));assert.ok(h.button('Preview notebook sources'));assert.ok(h.button('Upload previewed sources').disabled);assert.match(h.view.contentEl.contents(),/third-party/);assert.match(h.view.contentEl.contents(),/comparison/);
});
test('real backend preview renders exact bound summary content and scope before consent',async()=>{
 const h=await setup();h.view.selected.add(papers[0].path);await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='Selected research';
 const pending=h.button('Preview notebook sources').onclick();const result=h.respond(0);assert.equal(result.ok,true);await pending;
 assert.equal(h.calls[0].command,config.notebookPythonExecutable);assert.deepEqual(Array.from(h.calls[0].args),['/synthetic/repo/scripts/notebook-bridge.py','--vault-root','/synthetic/vault','--state-dir',config.notebookStateDir]);assert.deepEqual(h.calls[0].child.payload,{action:'preview',paths:[papers[0].path],mode:'summary',destination:{title:'Selected research'}});
 for(const file of result.files){assert.ok(h.view.contentEl.all().some(e=>e.tag==='pre'&&e.text===file.text));for(const value of [file.path,file.sourceHash,file.originalHash,String(file.bytes)])assert.ok(h.view.contentEl.contents().includes(value))}
 assert.match(h.view.contentEl.contents(),/Selected research/);assert.equal(h.field('Notebook upload consent').disabled,false);assert.equal(h.button('Upload previewed sources').disabled,true);assert.equal(h.calls.length,1);
});
test('real backend accepts strict upload payload and reports verified sources and a UUID-derived URL',async()=>{
 const h=await setup();await previewReady(h);assert.equal(h.calls.length,1);const sending=h.button('Upload previewed sources').onclick();assert.equal(h.calls.length,2);
 assert.deepEqual(Object.keys(h.calls[1].child.payload).sort(),['action','consent','previewToken']);const result=h.respond(1);assert.equal(result.ok,true);await sending;
 assert.match(h.view.contentEl.contents(),/Upload verified/);assert.ok(h.view.contentEl.contents().includes(result.sources[0].sourceHash));assert.ok(h.view.contentEl.all().some(e=>e.tag==='a'&&e.attrs.href===`https://notebooklm.google.com/notebook/${notebookId}`));assert.equal(h.field('Notebook upload consent').checked,false);
});
test('real backend exit-1 partial receipt preserves safe known statuses and notebook without errors',async()=>{
 const h=await setup();h.view.selected.add(papers[1].path);await previewReady(h);const pending=h.button('Upload previewed sources').onclick();const result=h.respond(1,2);assert.equal(result.ok,false);assert.equal(result.status,'partial');assert.equal(result.sources[0].status,'verified');assert.equal(result.sources[1].status,'uploading');await pending;
 const text=h.view.contentEl.contents();for(const status of ['verified','uploading','partial',notebookId])assert.ok(text.includes(status));assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('Upload verified —'));assert.ok(h.view.contentEl.all().some(e=>e.tag==='a'&&e.attrs.href===`https://notebooklm.google.com/notebook/${notebookId}`));assert.equal(h.field('Notebook upload consent').checked,false);assert.equal(h.button('Upload previewed sources').disabled,true);
});
test('PDF mode resolves only selected papers explicit source records and renders bound filename/hash/bytes',async()=>{
 const h=await setup();backend(h.root,{action:'list-notebooks'});const selected=h.view.index.find(p=>p.path===papers[0].path);selected.raw+='\n[[economy_wiki/Sources/a]]';h.view.selected.add(selected.path);const vault=h.view.app.vault;vault.adapter.getBasePath=()=>path.join(h.root,'vault');vault.getAbstractFileByPath=target=>{const full=path.join(h.root,'vault',target);return fs.existsSync(full)?{path:target}:null};vault.cachedRead=async f=>fs.readFileSync(path.join(h.root,'vault',f.path),'utf8');vault.read=vault.cachedRead;fs.appendFileSync(path.join(h.root,'vault',selected.path),'\n[[economy_wiki/Sources/a]]');
 await h.button('Gemini Notebook').onclick();h.field('Notebook source mode').value='pdf';h.field('Notebook source mode').onchange();h.field('Notebook destination').value='existing';h.field('Notebook ID').value=notebookId;
 const pending=h.button('Preview notebook sources').onclick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.calls[0].child.payload.paths,['economy_wiki/Sources/a.md']);const result=h.respond(0);assert.equal(result.ok,true);await pending;
 const text=h.view.contentEl.contents();for(const value of [notebookId,result.files[0].rawPath,result.files[0].sourceHash,String(result.files[0].bytes)])assert.ok(text.includes(value));assert.equal(h.field('Notebook upload consent').disabled,false);assert.equal(h.button('Upload previewed sources').disabled,true); assert.equal(h.view.contentEl.all().filter(e=>e.tag==='pre').length,0);
});
test('partial output only exposes allowlisted statuses and constructs links from exact UUID ids',async()=>{
 for(const id of ['safe-id','https://evil.test/SECRET','12345678-1234-4234-8234-123456789abc/SECRET']){
 const h=await setup();await previewReady(h);const pending=h.button('Upload previewed sources').onclick();const token=h.calls[1].child.payload.previewToken;h.finish(1,{ok:false,action:'upload',previewToken:token,status:'partial',notebookId:id,notebookUrl:'https://notebooklm.google.com/notebook/SECRET',error:{code:'remote_failure',message:'SECRET'},sources:[{sourceHash:'a'.repeat(64),status:'SECRET',title:'SECRET',sourceId:'SECRET'},{sourceHash:'SECRET',status:'verified'}]},1,'SECRET');await pending;assert.ok(!h.view.contentEl.contents().includes('SECRET'));assert.ok(h.view.contentEl.contents().includes('unknown'));assert.equal(h.view.contentEl.all().filter(e=>e.tag==='a'&&e.text==='Open Gemini Notebook').length,0);
 }
});
test('all nine compiled folders use explicitly selected, metadata-filtered catalog notes',async()=>{
 const folders=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'];
 const h=await setup();h.view.index=folders.map(folder=>({path:folder==='Literature'?papers[0].path:`economy_wiki/${folder}/compiled.md`,raw:'# Compiled economics',country:'KR'}));
 h.view.index.push({path:papers[1].path,raw:'# Hidden note',country:'US'});h.view.filters={country:{value:'KR'}};
 for(const paper of h.view.index)h.view.selected.add(paper.path);
 await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='All compiled economics';const pending=h.button('Preview notebook sources').onclick();
 assert.equal(h.calls[0].child.payload.paths.length,9);assert.ok(!h.calls[0].child.payload.paths.includes(papers[1].path));const result=h.respond(0);await pending;assert.equal(result.ok,true);assert.equal(result.files.length,9);assert.equal(h.field('Notebook upload consent').disabled,false);
});
test('PDF resolver accepts selected explicit records from every compiled folder',async()=>{
 const h=await setup();backend(h.root,{action:'list-notebooks'});const vaultRoot=path.join(h.root,'vault');h.view.app.vault.adapter.getBasePath=()=>vaultRoot;
 h.view.app.vault.getAbstractFileByPath=target=>fs.existsSync(path.join(vaultRoot,target))?{path:target}:null;h.view.app.vault.read=async f=>fs.readFileSync(path.join(vaultRoot,f.path),'utf8');
 h.view.index=['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'].map(folder=>{const target=folder==='Literature'?papers[0].path:`economy_wiki/${folder}/compiled.md`;fs.appendFileSync(path.join(vaultRoot,target),'\n[[economy_wiki/Sources/a]]');return {path:target,raw:fs.readFileSync(path.join(vaultRoot,target),'utf8')}});
 for(const paper of h.view.index)h.view.selected.add(paper.path);await h.button('Gemini Notebook').onclick();h.field('Notebook source mode').value='pdf';h.field('Notebook title').value='Explicit PDFs';
 const pending=h.button('Preview notebook sources').onclick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.calls[0].child.payload.paths,['economy_wiki/Sources/a.md']);const result=h.respond(0);await pending;assert.equal(result.ok,true);assert.equal(h.field('Notebook upload consent').disabled,false);
});
test('private configuration read errors fail closed without exposing secrets',async()=>{
 const h=await setup();h.view.plugin.loadData=async()=>{throw Error('SECRET_CONFIG')};await h.button('Gemini Notebook').onclick();assert.equal(h.calls.length,0);assert.match(h.view.contentEl.contents(),/configuration.*unavailable/i);assert.ok(!h.view.contentEl.contents().includes('SECRET'));assert.equal(h.button('Preview notebook sources').disabled,true);
});
test('unbound or incomplete preview envelopes cannot enable consent',async()=>{
 for(const alter of [r=>{r.destination={title:'SECRET wrong destination'}},r=>{delete r.files[0].text},r=>{r.files[0].path=papers[1].path},r=>{r.totalBytes++}]){
 const h=await setup();h.view.selected.add(papers[0].path);await h.button('Gemini Notebook').onclick();h.field('Notebook title').value='Research';const pending=h.button('Preview notebook sources').onclick();const {result}=backend(h.root,h.calls[0].child.payload);alter(result);h.finish(0,result);await pending;assert.equal(h.field('Notebook upload consent').disabled,true);assert.equal(h.button('Upload previewed sources').disabled,true);assert.ok(!h.view.contentEl.contents().includes('SECRET'));
 }
});
