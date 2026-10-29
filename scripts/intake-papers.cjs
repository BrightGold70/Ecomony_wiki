'use strict';
// All source text is untrusted DATA. This program never runs source instructions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const LIMIT=20*1024*1024;
const inert=s=>JSON.stringify(s).replace(/[<>\[\]]/g,c=>'&#'+c.charCodeAt(0)+';');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function stableRead(file,max=LIMIT){noSymlinks(file);const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const a=fs.fstatSync(fd);if(!a.isFile()||a.size>max)throw Error('Not regular or exceeds size limit');const bytes=fs.readFileSync(fd),b=fs.fstatSync(fd),c=fs.lstatSync(file);if(a.ino!==b.ino||a.dev!==b.dev||a.size!==b.size||a.mtimeMs!==b.mtimeMs||a.ctimeMs!==b.ctimeMs||b.ino!==c.ino||b.dev!==c.dev||b.size!==bytes.length||b.mtimeMs!==c.mtimeMs)throw Error('Unstable file stat');return bytes;}finally{fs.closeSync(fd);}}
function mkdir(dir){noSymlinks(dir,true);fs.mkdirSync(dir,{recursive:true});noSymlinks(dir);}
function exclusive(file,bytes){mkdir(path.dirname(file));noSymlinks(file,true);try{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}catch(e){if(e.code!=='EEXIST')throw e;if(!readSafe(file).equals(Buffer.from(bytes)))throw Error('Existing file collision: '+file);}if(!readSafe(file).equals(Buffer.from(bytes)))throw Error('Write verification failed');}
function atomic(file,bytes){mkdir(path.dirname(file));noSymlinks(file,true);const tmp=file+'.tmp-'+crypto.randomBytes(8).toString('hex');try{exclusive(tmp,bytes);noSymlinks(file,true);fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function front(fields){return '---\n'+Object.entries(fields).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n';}
function noteFront(fields){return front(fields).replace(/: "([a-z][a-z0-9-]*)"$/gm,': $1');}
function indexName(root){const names=fs.existsSync(root)?fs.readdirSync(root).filter(n=>n.toLowerCase()==='index.md'):[];if(names.length>1)throw Error('Index casing collision');return names[0]||'index.md';}
const forbidden=s=>s.split(/[\\/]/).some(p=>p.startsWith('.')||/^(private|personal|secrets)$/i.test(p));
const within=(a,b)=>b===a||b.startsWith(a+path.sep);
function appendOnce(file,marker,text,heading){const old=fs.existsSync(file)?readSafe(file).toString():heading;if(!old.includes(marker))atomic(file,old+'\n'+text+'\n');}
function extract(bytes,ext){
 if(ext.toLowerCase()!=='.pdf')return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const r=require('node:child_process').spawnSync('pdftotext',['-layout','-','-'],{input:bytes,encoding:'utf8',shell:false,timeout:30000,maxBuffer:LIMIT,env:{...process.env}});
 if(r.error||r.status!==0)throw Error('PDF extraction failed: '+(r.error?.message||String(r.stderr).slice(0,300)));
 if(!r.stdout.trim())throw Error('PDF image-only/empty extraction; OCR not attempted');return r.stdout;
}
function locators(text,ext){if(ext.toLowerCase()!=='.pdf')return text.split(/\r?\n/).map((text,i)=>({locator:'line '+(i+1),text}));return text.split('\f').flatMap((page,p)=>page.split(/\r?\n/).map((text,i)=>({locator:'page '+(p+1)+' line '+(i+1),text})));}
async function intake(options){
 const {vault,inbox,stateDir,apply=false,domain='economy',move=false}=options;
 const maxBytes=options.maxBytes===undefined?LIMIT:options.maxBytes,maxFiles=options.maxFiles===undefined?100:options.maxFiles;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>LIMIT)throw Error('Invalid maxBytes');
 if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>100)throw Error('Invalid maxFiles');
 if(!vault||!inbox||!stateDir)throw Error('Explicit --vault, --inbox and --state-dir required');
 if(!['economy','hematology'].includes(domain))throw Error('Invalid domain');
 const parent=path.resolve(vault),input=path.resolve(inbox),state=path.resolve(stateDir),wiki=domain==='economy'?'economy_wiki':'hematology_wiki',root=path.join(parent,wiki);
 for(const p of [parent,input,state]){if(forbidden(path.basename(p))||p.split(path.sep).some(s=>/^(private|personal|secrets)$/i.test(s)))throw Error('Private or hidden path denied');noSymlinks(p,true);}
 noSymlinks(root,true);if(!fs.statSync(input).isDirectory())throw Error('Inbox must be directory');
 if(within(parent,state)||within(input,state)||within(state,parent)||within(state,input)||within(root,input)||within(input,root))throw Error('State must be external; inbox must not overlap wiki');
 if(options.proposal){const p=path.resolve(options.proposal);if(forbidden(path.basename(p))||p.split(path.sep).some(s=>/^(private|personal|secrets)$/i.test(s)))throw Error('Private proposal path denied');noSymlinks(p);}
 const index=indexName(root),manifestPath=path.join(state,'manifest.json'),lock=path.join(state,'intake.lock');let locked=false;
 try{
 if(apply){mkdir(state);try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,root}),{flag:'wx',mode:0o600});locked=true;}catch(e){throw Error('Intake lock busy; inspect owner before manually removing stale lock');}}
 const manifest=fs.existsSync(manifestPath)?JSON.parse(stableRead(manifestPath).toString()):{version:1,root,domain,records:{}};
 if(manifest.version!==1||manifest.root!==root||manifest.domain!==domain||!manifest.records)throw Error('Manifest scope mismatch');
 for(const [h,r] of Object.entries(manifest.records)){if(!/^[a-f0-9]{64}$/.test(h)||!r||!/^\.(pdf|txt|md)$/i.test(r.ext||'')||typeof r.name!=='string'||forbidden(r.name)||r.name.includes('/')||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!['journaled','saved'].includes(r.status))throw Error('Invalid manifest record');}
 const save=()=>atomic(manifestPath,JSON.stringify(manifest,null,2)+'\n');const items=[];let totalBytes=0;
 const selected=fs.readdirSync(input,{withFileTypes:true}).filter(e=>e.isFile()&&!forbidden(e.name)&&/\.(pdf|txt|md)$/i.test(e.name));if(selected.length>maxFiles)throw Error('Inbox file count limit exceeded');
 for(const ent of selected.sort((a,b)=>a.name.localeCompare(b.name))){
 if(!ent.isFile()||forbidden(ent.name)||!/\.(pdf|txt|md)$/i.test(ent.name))continue;
 const file=path.join(input,ent.name);
 try{const bytes=stableRead(file,maxBytes),hash=sha256(bytes),ext=path.extname(ent.name),record=manifest.records[hash];
 totalBytes+=bytes.length;if(totalBytes>50*1024*1024)throw Error('Batch byte limit exceeded');
 const text=extract(bytes,ext);
 if(!text.trim())throw Error('Empty extraction');
 items.push({name:ent.name,hash,ext,text,bytes,file,record,status:record?.status==='saved'?'duplicate':'planned'});
 }catch(e){items.push({name:ent.name,status:'error',extraction:'failed',error:e.message});}}
 const compiler=require('./intake-compiler.cjs');
 const canonical=new Map();for(const x of items.filter(x=>x.text))if(!canonical.has(x.hash))canonical.set(x.hash,x);
 const sources=[...canonical.values()].map(x=>({path:'raw/papers/'+x.hash+(x.record?.ext||x.ext),hash:x.hash,text:x.text,locators:locators(x.text,x.ext)}));
 const docs=compiler.context(root,stableRead);for(const s of sources)if(!docs.some(d=>d.path==='Literature/'+s.hash+'.md'))docs.push({path:'Literature/'+s.hash+'.md',text:s.text});
 const related=compiler.related(sources,docs),batch=sha256([...new Set(sources.map(s=>s.hash))].sort().join('\n')).slice(0,24),packetName='agent-packet-'+batch+'.json',review='Review/Intake-'+batch+'.md';
 const governance={};for(const name of ['SCHEMA.md',index])if(fs.existsSync(path.join(root,name)))governance[name]=stableRead(path.join(root,name),1024*1024).toString();
 const proposal=options.proposal?JSON.parse(stableRead(options.proposal,1024*1024).toString()):null;
 const date=new Date().toISOString().slice(0,10),proposalHash=proposal?sha256(JSON.stringify(proposal)):null;
 const proposalDate=proposalHash?(manifest.proposals?.[proposalHash]?.date||date):date;
 const pages=proposal?compiler.validateProposal(proposal,domain,sources,root,readSafe,noteFront,wiki,proposalDate):[];
 if(apply&&proposalHash){manifest.proposals=manifest.proposals||{};manifest.proposals[proposalHash]={date:proposalDate};save();}
 if(apply){for(const item of items.filter(x=>x.status==='planned'||x.status==='duplicate')){
 if(manifest.records[item.hash]?.status==='saved')item.status='duplicate';
 const record=manifest.records[item.hash]||{name:item.name,ext:item.ext,date:new Date().toISOString().slice(0,10),status:'journaled'};manifest.records[item.hash]=record;save();
 const raw='raw/papers/'+item.hash+record.ext,source='Sources/'+item.hash+'.md',literature='Literature/'+item.hash+'.md';
 exclusive(path.join(root,raw),item.bytes);
 const fields={title:'Intake: '+record.name,created:record.date,updated:record.date,type:'summary',tags:['intake'],sources:[wiki+'/'+source],review_status:domain==='economy'?'economist-review-needed':'clinician-review-needed',evidence_kind:'descriptive',research_question:'unknown'};
 exclusive(path.join(root,source),noteFront({title:record.name,type:'source',source_mode:'local',raw_path:raw,raw_sha256:item.hash,original_filename:record.name,extraction_method:record.ext.toLowerCase()==='.pdf'?'pdftotext-layout':'utf8',extracted_text_sha256:sha256(item.text),evidence_scope:'selected-local-file',review_status:domain==='economy'?'economist-review-needed':'clinician-review-needed'})+'\n## Open original document\n\n[['+wiki+'/'+raw+'|Open original document]]\n\nOriginal filename: '+inert(record.name)+'\nSHA256: '+item.hash+'\n');
 exclusive(path.join(root,literature),noteFront(fields)+'\n# Intake extraction\n\nDeterministic extractive summary, not LLM synthesis. Human review pending.\nEvidence scope: selected local file only; interpretation, title, DOI and results unknown.\n\n'+locators(item.text,item.ext).filter(x=>x.text.trim()).slice(0,12).map(x=>'- '+x.locator+': '+inert(x.text)).join('\n')+'\n');
 if(options.failAfter==='notes')throw Error('Injected failure after notes');
 const link='[['+wiki+'/'+literature.slice(0,-3)+']]';appendOnce(path.join(root,index),link,'- '+link+' — pending review','# Wiki index\n');
 appendOnce(path.join(root,'log.md'),'intake '+item.hash,'- '+record.date+' intake '+item.hash+'; '+source+', '+literature+', '+raw+'; human review pending.','# Wiki activity log\n');
 record.status='saved';save();
 item.status=item.status==='duplicate'?'duplicate':'saved';
 }
 if(sources.length){atomic(path.join(state,packetName),JSON.stringify({...compiler.packet(domain,sources,docs,governance),applyArgv:[process.execPath,path.resolve(__filename),'--vault',parent,'--inbox',input,'--state-dir',state,'--domain',domain,'--proposal','/absolute/proposal.json','--apply']},null,2)+'\n');
 const reviewFile=path.join(root,review);appendOnce(reviewFile,'<!-- intake-batch '+batch+' -->','<!-- intake-batch '+batch+' -->\n# Intake review\n\nHuman review pending. Article extraction processed; topic integration pending.\n\n## Proposed topic/entity integration\nUse the external agent packet '+packetName+' with an authorized LLM; inspect exact quotes and proposals, then rerun --proposal. Existing pages remain unchanged.\n\n## Related documents: lexical overlap suggestions, NOT established evidence relationships\n'+related.map(r=>'- [['+wiki+'/'+r.target.replace(/\.md$/,'')+']] — shared terms: '+r.shared.join(', ')).join('\n'),'');
 const reviewLink='[['+wiki+'/'+review.slice(0,-3)+']]';appendOnce(path.join(root,index),reviewLink,'- '+reviewLink+' — intake review pending','# Wiki index\n');
 appendOnce(path.join(root,'log.md'),'batch '+batch,'- '+date+' batch '+batch+'; '+review+'; external agent packet '+packetName+'; integration pending.','# Wiki activity log\n');}
 for(const page of pages){exclusive(path.join(root,page.path),page.text);const link='[['+wiki+'/'+page.path.slice(0,-3)+']]';appendOnce(path.join(root,index),link,'- '+link+' — LLM proposed; human review pending','# Wiki index\n');appendOnce(path.join(root,'log.md'),'proposal '+sha256(page.text),'- '+date+' proposal '+sha256(page.text)+'; '+page.path+'; pending human review.','# Wiki activity log\n');}
 save();
 if(move)for(const item of items.filter(x=>['saved','duplicate'].includes(x.status))){if(sha256(stableRead(item.file))!==item.hash)throw Error('Inbox changed before removal');const raw='raw/papers/'+item.hash+manifest.records[item.hash].ext;if(sha256(stableRead(path.join(root,raw)))!==item.hash)throw Error('Stored evidence changed');fs.unlinkSync(item.file);item.status='moved';}
 }
 return {root,dryRun:!apply,packet:packetName,review,related,proposalPages:pages.map(p=>p.path),items:items.map(({bytes,text,file,record,...rest})=>rest)};
 }finally{if(locked)fs.unlinkSync(lock);}
}
const HELP=`Safe local paper intake (Node, no dependencies; pdftotext optional).
node scripts/intake-papers.cjs --vault /absolute/parent --inbox /absolute/inbox --state-dir /absolute/external-state --domain economy
node scripts/intake-papers.cjs --vault /absolute/parent --inbox /absolute/inbox --state-dir /absolute/external-state --domain economy --apply
node scripts/intake-papers.cjs --vault /absolute/parent --inbox /absolute/inbox --state-dir /absolute/external-state --domain economy --proposal /absolute/proposal.json --apply
Append --move only to remove verified originals AFTER all notes/index/log/review save.
--domain hematology uses hematology_wiki and clinician-review-needed (economy default).
--max-bytes N caps each input (default 20971520, maximum 20971520).
Default dry-run writes NOTHING. Explicit top-level PDF/TXT/MD only; no recursive inbox reads.
Output: <parent>/<domain>_wiki/raw/papers/<sha256><original extension>, Sources, Literature, Review; existing Index.md casing preserved.
External state contains locked atomic manifest journal and agent-packet-<batch>.json.
LLM step: give that packet to your authorized filesystem-capable agent, request proposal JSON per embedded schema; then rerun --proposal while sources remain in inbox. No model/provider calls made here. Do not use --move until proposal compilation finished.
Quotes/locators checked mechanically, NOT semantic correctness. Human review always pending.
Existing reviewed pages are never overwritten. Duplicate identity is SHA256 only; no prose DOI guessing or inferred registry identity. PDF errors/image-only inputs remain in inbox; no OCR. Stale lock: inspect PID/owner, remove manually only after confirming no intake process runs.
node scripts/test-intake-papers.cjs
`;
function parseArgs(args){const o={};for(let i=0;i<args.length;i++){const a=args[i];if(a==='--help'){o.help=true;continue;}if(['--apply','--move'].includes(a)){o[a.slice(2)]=true;continue;}const key={'--vault':'vault','--inbox':'inbox','--state-dir':'stateDir','--domain':'domain','--proposal':'proposal','--max-bytes':'maxBytes'}[a];if(!key||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown option or missing value: '+a);if(key in o)throw Error('Duplicate option: '+a);o[key]=args[++i];}if(o.maxBytes!==undefined){o.maxBytes=Number(o.maxBytes);if(!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.maxBytes>LIMIT)throw Error('Invalid --max-bytes');}return o;}
if(require.main===module){(async()=>{try{const o=parseArgs(process.argv.slice(2));if(o.help){console.log(HELP);return;}const result=await intake(o);console.log(JSON.stringify(result,null,2));if(result.items.some(x=>x.status==='error'))process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}})();}
module.exports={intake,stableRead,sha256,extract,locators,parseArgs,HELP};
