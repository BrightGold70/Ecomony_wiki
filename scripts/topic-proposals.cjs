'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const DOMAIN=Object.freeze({wiki:'economy_wiki',targetFolder:'Topics',sourceFolders:Object.freeze(['Sources','Literature']),reviewStatus:'economist-review-needed'});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const digest=x=>hash(JSON.stringify(x));
function shape(x,required,optional=[]){if(!x||typeof x!=='object'||Array.isArray(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k)))throw Error('Invalid schema');}
function text(x){if(typeof x!=='string'||!x.trim()||x.includes('\0'))throw Error('Nonempty text required');}
function safeId(x){if(typeof x!=='string'||! /^[a-z0-9][a-z0-9-]{0,79}$/.test(x))throw Error('Unsafe id');}
function canonical(p,folders){if(typeof p!=='string'||p.includes('\\')||p.split('/').some(s=>!s||s.startsWith('.')||/^(private|personal|secrets|raw)$/i.test(s))||!p.endsWith('.md')||p.split('/')[0]!==DOMAIN.wiki||!folders.includes(p.split('/')[1])||p.split('/').length<3)throw Error('Noncanonical or unauthorized path');return p;}
function utf8(bytes){const s=bytes.toString('utf8');if(!Buffer.from(s).equals(bytes))throw Error('Invalid UTF-8');return s;}
function frontmatter(s){
 if(!s.startsWith('---\n')&&!s.startsWith('---\r\n'))return {length:0,lines:[]};
 const m=s.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!m)throw Error('Unclosed frontmatter');const seen=new Set();
 // Constrained flat scalar mapping only; never guess at YAML indentation or collections.
 for(const line of m[1].split(/\r?\n/)){
  if(!line.trim()||/^\s*#/.test(line))continue;
  const field=line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):(?:[ \t]+(.*))?$/);if(!field)throw Error('Unsupported frontmatter syntax');
  const key=field[1],value=(field[2]||'').trim();if(seen.has(key))throw Error('Duplicate frontmatter key');seen.add(key);
  const quoted=/^"(?:[^"\\\r\n]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"$/.test(value)||/^'(?:[^']|'')*'$/.test(value);
  if(!quoted&&(/^[\s\[\]{}|>'"`@%?\-:&*!#]/.test(value)||/:\s|[\[\]{}]|(^|\s)[&*!]|<<:/.test(value)))throw Error('Unsupported frontmatter scalar');
 }
 return {length:m[0].length,lines:m[1].split(/\r?\n/)};
}
function inspectProposal({vaultRoot,proposal}){
 if(typeof vaultRoot!=='string'||!path.isAbsolute(vaultRoot)||path.resolve(vaultRoot)!==vaultRoot)throw Error('Canonical absolute vaultRoot required');noSymlinks(vaultRoot);
 shape(proposal,['version','id','targetPath','beforeSha256','changes']);if(proposal.version!==1)throw Error('Unsupported version');safeId(proposal.id);canonical(proposal.targetPath,[DOMAIN.targetFolder]);
 if(typeof proposal.beforeSha256!=='string'||!/^[a-f0-9]{64}$/.test(proposal.beforeSha256))throw Error('Invalid beforeSha256');
 const bytes=readSafe(path.join(vaultRoot,proposal.targetPath)),original=utf8(bytes);if(hash(bytes)!==proposal.beforeSha256)throw Error('Stale target hash');const metadata=frontmatter(original);
 if(!Array.isArray(proposal.changes)||!proposal.changes.length||proposal.changes.length>100)throw Error('Invalid changes');const ids=new Set(),ranges=[];
 const changes=proposal.changes.map(c=>{shape(c,['id','before','after','reason','evidence']);safeId(c.id);if(ids.has(c.id))throw Error('Duplicate change id');ids.add(c.id);text(c.before);text(c.after);text(c.reason);if(c.before===c.after)throw Error('Unchanged wording');const start=original.indexOf(c.before);if(start<0||original.indexOf(c.before,start+1)>=0)throw Error('Before wording must match exactly once');if(start<metadata.length)throw Error('Changes must be in topic body, not frontmatter');const end=start+c.before.length;if(ranges.some(r=>start<r.end&&end>r.start))throw Error('Overlapping changes');ranges.push({start,end});
 if(!Array.isArray(c.evidence)||!c.evidence.length)throw Error('Missing evidence');return {...c,evidence:c.evidence.map(e=>{shape(e,['path','quote'],['locator']);canonical(e.path,DOMAIN.sourceFolders);text(e.quote);if(e.locator!==undefined)text(e.locator);const source=readSafe(path.join(vaultRoot,e.path));if(!utf8(source).includes(e.quote))throw Error('Evidence quote not found');return {...e,sourceSha256:hash(source)};})};});
 const proposalSha256=digest(proposal),inspectionSha256=digest({proposalSha256,beforeSha256:hash(bytes),changes});
 return {version:1,id:proposal.id,targetPath:proposal.targetPath,beforeSha256:hash(bytes),proposalSha256,inspectionSha256,changes,metadataEffects:{when:'any accepted change',type:'topic',review_status:DOMAIN.reviewStatus,remove:'Prior review/economist/approval metadata; preserved in before.md'},disclaimer:DISCLAIMER,decisionTemplate:{version:1,proposalSha256,inspectionSha256,decisions:changes.map(c=>({id:c.id,decision:'choose-accept-or-reject'}))}};
}
const DISCLAIMER='Decisions are caller declarations only, not authenticated identity, economist approval or economic correctness. Hashes are not signatures. Multi-file history and target updates are not a transaction.';
function pendingTopic(body,metadata){
 let lines=[];
 {let omit=false;for(const line of metadata.lines){if(/^[^\s#][^:]*:/.test(line)){const key=line.split(':')[0];omit=/^(type|review.*|economist.*|approved.*|approval.*)$/.test(key);}if(!omit)lines.push(line);}}
 return '---\n'+lines.concat(['type: "topic"','review_status: "'+DOMAIN.reviewStatus+'"']).join('\n')+'\n---\n'+body;
}
function exclusive(file,data){noSymlinks(file,true);const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function jsonFile(file,data){exclusive(file,JSON.stringify(data,null,2)+'\n');}
function applyProposal({vaultRoot,proposal,decisions}){
 proposal=JSON.parse(JSON.stringify(proposal));decisions=decisions===undefined?undefined:JSON.parse(JSON.stringify(decisions));
 const preview=inspectProposal({vaultRoot,proposal});shape(decisions,['version','proposalSha256','inspectionSha256','decisions']);
 if(decisions.version!==1||decisions.proposalSha256!==preview.proposalSha256||decisions.inspectionSha256!==preview.inspectionSha256)throw Error('Stale or tampered proposal/inspection binding');
 if(!Array.isArray(decisions.decisions)||decisions.decisions.length!==proposal.changes.length)throw Error('Every change requires an explicit decision');const byId=new Map();
 for(const d of decisions.decisions){shape(d,['id','decision']);if(byId.has(d.id)||!proposal.changes.some(c=>c.id===d.id)||!['accept','reject'].includes(d.decision))throw Error('Invalid or duplicate decision');byId.set(d.id,d.decision);}
 const accepted=proposal.changes.filter(c=>byId.get(c.id)==='accept'),rejected=proposal.changes.filter(c=>byId.get(c.id)==='reject').map(c=>c.id);
 const target=path.join(vaultRoot,proposal.targetPath),before=readSafe(target);let after=before;
 if(accepted.length){const original=utf8(before),metadata=frontmatter(original);let body=original.slice(metadata.length);for(const c of accepted.map(c=>({...c,start:original.indexOf(c.before)-metadata.length})).sort((a,b)=>b.start-a.start))body=body.slice(0,c.start)+c.after+body.slice(c.start+c.before.length);after=Buffer.from(pendingTopic(body,metadata));}
 const historyPath=DOMAIN.wiki+'/Review/proposals/'+proposal.id,history=path.join(vaultRoot,historyPath),parent=path.dirname(history);
 noSymlinks(history,true);fs.mkdirSync(parent,{recursive:true});noSymlinks(parent);
 const lock=path.join(parent,'.target-'+hash(proposal.targetPath)+'.lock');fs.mkdirSync(lock);const lockIdentity=fs.lstatSync(lock);let reserved=false,temp,targetWritten=false,receipt,primaryError;
 const record={version:1,id:proposal.id,targetPath:proposal.targetPath,historyPath,proposalSha256:preview.proposalSha256,inspectionSha256:preview.inspectionSha256,decisionsSha256:digest(decisions),beforeSha256:hash(before),afterSha256:hash(after),accepted:accepted.map(c=>c.id),rejected,targetWritten:accepted.length>0,disclaimer:DISCLAIMER};
 try{
  noSymlinks(history,true);fs.mkdirSync(history);reserved=true;
  jsonFile(path.join(history,'journal.json'),{...record,state:'prepared'});
  exclusive(path.join(history,'before.md'),before);jsonFile(path.join(history,'proposal.json'),proposal);jsonFile(path.join(history,'decisions.json'),decisions);jsonFile(path.join(history,'inspection.json'),preview);
  if(inspectProposal({vaultRoot,proposal}).inspectionSha256!==preview.inspectionSha256)throw Error('Source or target changed during preparation');
  if(accepted.length){temp=path.join(path.dirname(target),'.proposal-'+crypto.randomBytes(16).toString('hex')+'.tmp');exclusive(temp,after);noSymlinks(history);noSymlinks(target);if(hash(readSafe(target))!==record.beforeSha256)throw Error('Target changed before replacement');fs.renameSync(temp,target);targetWritten=true;temp=undefined;}
  if(hash(readSafe(target))!==record.afterSha256)throw Error('Target read-back mismatch');
  receipt={...record,status:'complete'};jsonFile(path.join(history,'receipt.json'),receipt);return receipt;
 }catch(e){primaryError=e;if(reserved){let observedSha256=null;try{observedSha256=hash(readSafe(target));}catch{}const incomplete={...record,status:'incomplete',targetWritten,observedSha256,targetState:observedSha256===record.afterSha256?(record.targetWritten?'matches-planned-after':'unchanged'):observedSha256===record.beforeSha256?'unchanged':'unknown',error:e.message};try{jsonFile(path.join(history,'incomplete.json'),incomplete);}catch{}const error=Error('Incomplete proposal application; inspect history '+historyPath+': '+e.message);error.code='PROPOSAL_INCOMPLETE';error.receipt=incomplete;primaryError=error;throw error;}throw e;
 }finally{
  if(temp){try{noSymlinks(temp);fs.unlinkSync(temp);}catch{}}
  try{const currentLock=fs.lstatSync(lock);if(!currentLock.isDirectory()||currentLock.dev!==lockIdentity.dev||currentLock.ino!==lockIdentity.ino)throw Error('Lock ownership changed; refusing cleanup');fs.rmdirSync(lock);}catch(e){
   let lockState='unknown';try{fs.lstatSync(lock);lockState='present';}catch(observed){if(observed.code==='ENOENT')lockState='absent';}
   const cleanupWarning={code:'PROPOSAL_LOCK_CLEANUP_FAILED',lockPath:lock,lockState,error:e.message};
   if(primaryError)primaryError.cleanupWarning=cleanupWarning;
   else{const error=Error('Proposal application complete; lock cleanup failed; inspect history '+historyPath);error.code='PROPOSAL_CLEANUP_FAILED';error.receipt=receipt;error.cleanupWarning=cleanupWarning;throw error;}
  }
 }
}
if(require.main===module){try{
 const [command,...args]=process.argv.slice(2),opts={};if(!['preview','apply'].includes(command))throw Error('Use preview or apply');
 for(let i=0;i<args.length;i+=2){const k=args[i];if(!['--vault','--proposal','--decisions'].includes(k)||Object.hasOwn(opts,k)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid CLI arguments');opts[k]=args[i+1];}
 if(!opts['--vault']||!opts['--proposal']||(command==='apply'&&!opts['--decisions'])||(command==='preview'&&opts['--decisions']))throw Error('Usage: preview --vault ABSOLUTE_VAULT --proposal JSON; apply --vault ABSOLUTE_VAULT --proposal JSON --decisions JSON');
 for(const value of Object.values(opts)){if(value.includes('\\')||value.split('/').some(p=>p==='.'||p==='..')||(path.isAbsolute(value)&&path.resolve(value)!==value))throw Error('Noncanonical CLI path');}
 const input={vaultRoot:opts['--vault'],proposal:JSON.parse(utf8(readSafe(path.resolve(opts['--proposal']))))};if(command==='apply')input.decisions=JSON.parse(utf8(readSafe(path.resolve(opts['--decisions']))));console.log(JSON.stringify(command==='preview'?inspectProposal(input):applyProposal(input),null,2));
 }catch(e){console.error(JSON.stringify({error:e.message,...(e.code?{code:e.code}:{}),...(e.receipt?{receipt:e.receipt}:{}),...(e.cleanupWarning?{cleanupWarning:e.cleanupWarning}:{})},null,2));process.exitCode=1;}}
module.exports={DOMAIN,inspectProposal,applyProposal};
