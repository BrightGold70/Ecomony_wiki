'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const scratch=path.join(os.homedir(),'.hermes/cache/scratch');
function fixture(t){fs.mkdirSync(scratch,{recursive:true});const base=fs.mkdtempSync(path.join(scratch,'economy-demo-test-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));return base;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('real offline economics lifecycle retains sources, proposed substantive revision and synthetic decisions',async t=>{
 const base=fixture(t),output=path.join(base,'new-demo'),cli=path.join(__dirname,'first-wiki-demo.cjs');
 const guard=path.join(base,'offline-guard.cjs');
 fs.writeFileSync(guard,`const deny=()=>{throw Error('Network/provider/subprocess forbidden')};global.fetch=deny;for(const n of ['node:http','node:https']){require(n).request=deny;require(n).get=deny;}require('node:net').connect=deny;require('node:net').Socket.prototype.connect=deny;for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])require('node:child_process')[k]=deny;`);
 const spawn=require('node:child_process').spawnSync;
 const run=spawn(process.execPath,['--require',guard,cli,'--output',output],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);assert(fs.existsSync(path.join(output,'receipts/demo.json')),'CLI must execute the demo');
 const read=rel=>fs.readFileSync(path.join(output,rel),'utf8'),json=rel=>JSON.parse(read(rel)),receipt=json('receipts/demo.json');
 assert.equal(receipt.synthetic,true);assert.equal(receipt.realCitations,false);assert.equal(receipt.economistReview,'pending');assert.equal(receipt.networkCalls,0);assert.equal(receipt.providerCalls,0);
 assert.equal(fs.existsSync(path.join(output,'content-evidence.json')),false,'economy does not require a medical evidence gate');
 assert.equal(receipt.papers.length,3);assert.deepEqual(receipt.lint.issues,[]);assert.equal(receipt.lint.rawHashesChecked,3);
 assert(receipt.retrieval.results.length>=3);assert(receipt.graph.edges.length>=3);assert(receipt.graph.edges.every(e=>e.kind==='explicit-link'));
 assert.equal(receipt.paths.stateDir.startsWith(receipt.paths.vault+path.sep),false);
 for(const p of receipt.papers){assert.equal(p.sha256,hash(read(p.original)));assert.equal(read(p.original),read(p.raw));assert.match(read(p.original),/SYNTHETIC.*NOT A REAL PUBLICATION/);assert.match(read(p.original),/labor|fiscal|monetary/i);for(const [rel,h] of Object.entries(p.hashes))assert.equal(hash(read(rel)),h);assert.match(read('vault/economy_wiki/Sources/'+p.sha256+'.md'),/economist-review-needed/);assert(read('vault/economy_wiki/index.md').includes(p.sha256));assert(read('vault/economy_wiki/log.md').includes(p.sha256));}
 assert.equal(json('receipts/preview.json').dryRun,true);assert.equal(json('receipts/preview.json').items.length,2);
 assert.equal(json('receipts/apply.json').items.length,2);assert.equal(json('receipts/topic.json').items.length,2);assert.equal(json('topic-proposal.json').domain,'economy');assert.equal(json('topic-proposal.json').pages[0].claims.length,2);
 for(const claim of json('topic-proposal.json').pages[0].claims)for(const e of claim.evidence){const p=receipt.papers.find(p=>e.path==='raw/papers/'+p.sha256+'.txt');assert(p);assert.equal(e.quote,p.quote);assert.equal(e.locator,'line 3');}
 const l=receipt.lifecycle;
 assert.deepEqual(l.stages.map(s=>s.stage),['first-two-ingested','topic-created','synthetic-history-retained','third-ingested','substantive-update-proposed','synthetic-update-authorized','topic-updated-pending']);
 assert.deepEqual(l.stages.map(s=>s.originals.length),[2,2,2,3,3,3,3]);
 const prior=read(l.beforePath),current=read(l.topicPath),third=receipt.papers[2];
 assert.match(prior,/review_status: ["']?economist-reviewed/);assert.match(prior,/SYNTHETIC historical state only; no human or economist review/);assert(!prior.includes(third.sha256));assert(!prior.includes(third.quote));
 assert.match(current,/review_status: ["']?economist-review-needed/);assert.doesNotMatch(current,/^reviewer:|^reviewed_date:|^review_decision:/m);assert(current.includes(third.quote));assert.match(current,/evidence_kind: descriptive/);assert.match(current,/estimand: ["']?unidentified/);assert.match(current,/not causal|no causal/i);assert.match(current,/stratify.*fiscal.*monetary/i);
 const priorDecision=json(l.previousDecisionPath),proposal=json(l.proposalPath),decision=json(l.decisionPath),update=json('receipts/manual-topic-update.json');
 for(const d of [priorDecision,decision]){assert.equal(d.synthetic,true);assert.equal(d.authenticated_human,false);assert.equal(d.economist_validation,false);}
 assert.equal(priorDecision.content_sha256,hash(prior));assert.equal(proposal.kind,'substantive-topic-update');assert.equal(proposal.before_sha256,hash(prior));assert.equal(proposal.after_sha256,hash(current));assert.equal(proposal.proposed_text,current);assert.equal(proposal.added_evidence.quote,third.quote);assert.equal(proposal.added_evidence.source_sha256,third.sha256);
 assert.equal(decision.decision,'authorize-isolated-synthetic-update');assert.equal(decision.proposal_sha256,hash(read(l.proposalPath)));assert.equal(decision.previous_decision_sha256,hash(read(l.previousDecisionPath)));assert.equal(update.after_sha256,hash(current));assert.equal(update.decision_sha256,hash(read(l.decisionPath)));assert.equal(update.economist_review,'pending');
 assert.equal(l.stages[0].topicSha256,null);assert.equal(l.stages[1].topicSha256,hash(read('history/topic-created.md')));
 for(const [i,s] of l.stages.entries()){assert.deepEqual(json('receipts/stages/'+(i+1)+'-'+s.stage+'.json'),s);for(const [rel,h] of Object.entries(s.sourceHashes))assert.equal(hash(read(rel)),h);if(i>=2){assert.equal(s.beforeSha256,hash(prior));assert.equal(s.previousDecisionSha256,hash(read(l.previousDecisionPath)));if(i<l.stages.length-1)assert.equal(s.topicSha256,hash(prior));}}
 const intake=json('receipts/third-apply.json');assert.equal(intake.items.filter(i=>i.status==='saved').length,1);assert.equal(intake.items.filter(i=>i.status==='duplicate').length,2);
 assert.match(read('README.md'),/first two[\s\S]*third[\s\S]*substantive/i);assert.match(read('README.md'),/--domain economy/);assert.match(read('README.md'),/lint-wiki.cjs/);assert.match(read('README.md'),/not real/i);
 const before=hash(read('receipts/demo.json')),again=spawn(process.execPath,[cli,'--output',output],{encoding:'utf8'});assert.notEqual(again.status,0);assert.match(again.stderr,/exists/);assert.equal(hash(read('receipts/demo.json')),before);
});
test('strict CLI and new-folder preflight preserve economy scratch scope without hidden/private escapes',t=>{
 const {preflight,parseArgs}=require('./first-wiki-demo.cjs'),base=fixture(t);
 assert.deepEqual(parseArgs(['--help']),{help:true});assert.throws(()=>parseArgs([]),/Usage/);assert.throws(()=>parseArgs(['--output','x','extra']),/Usage/);
 assert.equal(preflight(path.join(base,'new')),path.join(base,'new'));
 assert.throws(()=>preflight('relative'),/absolute/);assert.throws(()=>preflight(base),/exists/);
 for(const p of [path.join(base,'.hidden/new'),base+'/ok/.hidden/../../escape',path.join(base,'private/new'),path.join(os.homedir(),'.other/new')])assert.throws(()=>preflight(p),/hidden|private/i);
 assert.throws(()=>preflight(path.resolve(__dirname,'../demo-in-source')),/overlap|checkout/i);
 assert.throws(()=>preflight(path.join(base,'absent/new')),/ENOENT|parent/);
 fs.symlinkSync(base,path.join(base,'link'));assert.throws(()=>preflight(path.join(base,'link/new')),/Symlink/);
 assert.deepEqual(fs.readdirSync(base),['link']);
});
