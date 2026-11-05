'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const cli=path.join(__dirname,'zettel-audit.cjs'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||path.join(require('node:os').homedir(),'.hermes/cache/scratch')),'zettel-audit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const vault=path.join(dir,'vault');fs.mkdirSync(vault);
 const put=(p,b)=>{fs.mkdirSync(path.dirname(path.join(vault,p)),{recursive:true});fs.writeFileSync(path.join(vault,p),b);};
 const source='economy_wiki/Sources/study.md',idea='economy_wiki/Ideas/idea.md',question='economy_wiki/Questions/question.md',literature='economy_wiki/Literature/study.md',side='economy_wiki/Review/readability-pilot/study.md';
 const bytes='---\nversion_key: test-v1\n---\nSynthetic exact quote.\n';put(source,bytes);put(literature,'# Synthetic Literature\n');
 const evidence={id:'evidence-test',path:source,sha256:sha(bytes),version:'test-v1',locator:'Synthetic (lines 4–4)',quote:'Synthetic exact quote.'};
 const record=(type,extra={},body='')=>'---\ntitle: "Synthetic"\ntype: '+type+'\nreview_status: economist-review-needed\nquestions: '+JSON.stringify(type==='question'?[]:[question])+'\nrelations: []\nevidence_records: '+JSON.stringify(type==='question'?[]:[evidence])+'\n'+Object.entries(extra).map(([k,v])=>k+': '+JSON.stringify(v)+'\n').join('')+'---\n'+body;
 put(idea,record('idea'));put(question,record('question',{},'## Supporting evidence\n[['+idea+']]\n'));
 const run=(args=[])=>spawnSync(process.execPath,[cli,'--vault',vault,...args],{encoding:'utf8'});
 return {dir,vault,put,source,idea,question,literature,side,bytes,evidence,record,run};
}
test('audit reports draft status, missing provenance and broken question or relation targets without repairs',t=>{
 const f=fixture(t);f.put(f.idea,f.record('idea').replace('review_status: economist-review-needed','review_status: economist-reviewed').replace(/^questions: .*$/m,'questions: ["economy_wiki/Questions/missing.md"]').replace(/^relations: .*$/m,'relations: [{"target":"economy_wiki/Topics/missing.md","type":"supports","status":"suggested","explanation":"Synthetic"}]').replace(/^evidence_records: .*$/m,'evidence_records: []'));
 const r=f.run();assert.equal(r.status,0,r.stderr);const a=JSON.parse(r.stdout),codes=a.findings.map(x=>x.code);for(const c of ['invalid-draft-state','missing-evidence','broken-question-target','broken-relation-target','unlinked-idea'])assert.ok(codes.includes(c),JSON.stringify(a));
 assert.equal(a.coverage.drafts_pending,1);assert.equal(a.coverage.links_checked,3);
});
test('audit detects stale Literature and duplicate versus conflicting sidecars including legacy study-reading',t=>{
 const f=fixture(t),extra={target_path:f.literature,target_sha256:sha('# Synthetic Literature\n')},body='## Essential study summary\n\n'+['Essential finding','Population and comparison','Key result','Main limitation','Relevance to question'].map(h=>'### '+h+'\n\nSynthetic.\n').join('\n');
 const a=f.record('study-essential-summary',extra,body);f.put(f.side,a);f.put('economy_wiki/Review/readability-pilot/copy.md',a);
 let report=JSON.parse(f.run().stdout);assert.equal(report.coverage.sidecars,2);assert.equal(report.coverage.targets_checked,2);assert.ok(report.findings.some(x=>x.code==='duplicate-sidecars'));
 f.put('economy_wiki/Review/readability-pilot/copy.md',f.record('study-reading',extra,body+'Different draft.'));f.put(f.literature,'Changed Literature\n');report=JSON.parse(f.run().stdout);assert.equal(report.findings.filter(x=>x.code==='stale-summary-target').length,2);assert.ok(report.findings.some(x=>x.code==='conflicting-sidecars'));
});
test('negative evidence cases never count stale or missing provenance as verified',t=>{
 for(const [label,change,code] of [
  ['stale',f=>f.evidence.sha256='0'.repeat(64),'stale-evidence'],
  ['missing ID',f=>delete f.evidence.id,'invalid-evidence'],
  ['missing hash',f=>delete f.evidence.sha256,'invalid-evidence'],
  ['quote',f=>f.evidence.quote='Invented quote','quote-mismatch'],
  ['locator',f=>f.evidence.locator='Synthetic (lines 3–3)','quote-mismatch'],
  ['invalid range',f=>f.evidence.locator='Synthetic (lines 4–999)','invalid-evidence'],
  ['blank locator',f=>f.evidence.locator=' ','invalid-evidence'],
  ['object locator',f=>f.evidence.locator={start_line:4,end_line:4},'invalid-evidence'],
  ['missing quote',f=>delete f.evidence.quote,'invalid-evidence'],
  ['version',f=>f.evidence.version='wrong','version-unverifiable'],
  ['raw',f=>{f.evidence.path='economy_wiki/raw/secret.md';f.put(f.evidence.path,f.bytes);},'invalid-evidence'],
  ['symlink',f=>{fs.renameSync(path.join(f.vault,f.source),path.join(f.dir,'outside.md'));fs.symlinkSync(path.join(f.dir,'outside.md'),path.join(f.vault,f.source));},'invalid-evidence']
 ]){const f=fixture(t);change(f);f.put(f.idea,f.record('idea'));const r=f.run();assert.equal(r.status,0,r.stderr);const a=JSON.parse(r.stdout);assert.ok(a.findings.some(x=>x.code===code),label+JSON.stringify(a));assert.equal(a.coverage.evidence_verified,0,label);}
});
test('native descriptive locators verify hash and whole quote without inventing range or version',t=>{
 const f=fixture(t);f.evidence.locator='Reported findings — publisher abstract; stored note L15-L15';f.evidence.version='current Source whole-note snapshot; test-v1';f.put(f.idea,f.record('idea'));
 const a=JSON.parse(f.run().stdout);assert.equal(a.coverage.quotes_checked,1,JSON.stringify(a));assert.equal(a.coverage.hash_quote_verified,1);assert.equal(a.coverage.ranges_checked,0);assert.equal(a.coverage.ranges_unverified,1);assert.equal(a.coverage.versions_unverified,1);assert.equal(a.coverage.evidence_verified,0);assert.ok(a.findings.some(x=>x.code==='quote-range-unverified'));assert.ok(a.findings.some(x=>x.code==='version-unverifiable'));assert.ok(!a.findings.some(x=>x.code==='invalid-evidence'));
 f.evidence.quote='Invented quote';f.put(f.idea,f.record('idea'));const bad=JSON.parse(f.run().stdout);assert.equal(bad.coverage.hash_quote_verified,0);assert.ok(bad.findings.some(x=>x.code==='quote-mismatch'));
 f.evidence.sha256='0'.repeat(64);f.put(f.idea,f.record('idea'));const stale=JSON.parse(f.run().stdout);assert.equal(stale.coverage.quotes_checked,0);assert.equal(stale.coverage.hash_quote_verified,0);
});
test('native source YAML unrelated to version does not invalidate a matched quote',t=>{
 const f=fixture(t);const bytes='---\ntags: [economy_wiki, pilot, trade]\n---\nSynthetic exact quote.\n';f.put(f.source,bytes);f.evidence.sha256=sha(bytes);f.evidence.locator='Article content summary > Design and population';f.evidence.version='current Source whole-note snapshot; collector-summary-backfill:v1';f.put(f.idea,f.record('idea'));
 const a=JSON.parse(f.run().stdout);assert.equal(a.coverage.hash_quote_verified,1);assert.equal(a.coverage.versions_unverified,1,JSON.stringify(a));assert.equal(a.coverage.versions_checked,0);assert.ok(!a.findings.some(x=>x.code==='invalid-evidence'),JSON.stringify(a));
});
test('native typed relations retain recorded semantics without accepting unknown vocabulary',t=>{
 const f=fixture(t),types=['derived-from','contextualizes','comments-on','summarizes','limits','addresses','informs','developed-by','contextualized-by','qualified-by','continues','supported-by'];
 f.put(f.idea,f.record('idea').replace('relations: []','relations: '+JSON.stringify(types.map(type=>({target:f.source,type,status:'recorded',explanation:'Synthetic native relation'})))));
 let a=JSON.parse(f.run().stdout);assert.ok(!a.findings.some(x=>x.code==='invalid-relation'),JSON.stringify(a));
 f.put(f.idea,f.record('idea').replace('relations: []','relations: '+JSON.stringify([{target:f.source,type:'invented',status:'recorded',explanation:'Synthetic'}])));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='invalid-relation'));
});
test('extensionless full research body links resolve only after literal safe-path validation',t=>{
 const f=fixture(t);f.put(f.question,f.record('question',{},'[['+f.idea.slice(0,-3)+']]\n[['+f.source+']]'));
 let a=JSON.parse(f.run().stdout);assert.ok(!a.findings.some(x=>x.code==='broken-question-evidence-target'),JSON.stringify(a));
 const denied=['economy_wiki/Questions/../Ideas/idea','economy_wiki/Ideas/./idea','economy_wiki/Ideas//idea','economy_wiki/Ideas/idea.md/../idea','economy_wiki/Ideas/idea#heading','economy_wiki/Ideas/idea|alias','economy_wiki/raw/secret','Ideas/idea','economy_wiki/Ideas/idea.txt'];
 f.put('economy_wiki/Ideas/idea.txt.md',f.record('idea'));f.put(f.question,f.record('question',{},denied.map(p=>'[['+p+']]').join('\n')));a=JSON.parse(f.run().stdout);assert.equal(a.findings.filter(x=>x.code==='broken-question-evidence-target').length,denied.length);
 fs.symlinkSync(path.join(f.vault,f.idea),path.join(f.vault,'economy_wiki/Ideas/alias.md'));f.put(f.question,f.record('question',{},'[[economy_wiki/Ideas/alias]]'));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='broken-question-evidence-target'));
 f.put(f.question,f.record('question',{},'[[economy_wiki/Ideas/missing]]'));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='broken-question-evidence-target'));
});
test('body version locators are checked and legacy records without them remain unverifiable',t=>{
 const f=fixture(t);f.evidence.version='Synthetic exact quote.';f.evidence.version_locator={start_line:4,end_line:4,label:'Recorded version'};f.put(f.idea,f.record('idea'));
 let a=JSON.parse(f.run().stdout);assert.equal(a.coverage.evidence_verified,1,JSON.stringify(a));
 f.evidence.version_locator.start_line=3;f.evidence.version_locator.end_line=3;f.put(f.idea,f.record('idea'));a=JSON.parse(f.run().stdout);assert.equal(a.coverage.evidence_verified,0);assert.ok(a.findings.some(x=>x.code==='version-unverifiable'));
 delete f.evidence.version_locator;f.put(f.idea,f.record('idea'));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='version-unverifiable'));
});
test('CLI permits only create-only external reports and rejects symlinked or malformed records safely',t=>{
 const f=fixture(t);for(const args of [['--apply'],['--out',path.join(f.vault,'report.json')],['--vault',f.vault]])assert.notEqual(f.run(args).status,0);
 const out=path.join(f.dir,'report.json');assert.equal(f.run(['--out',out]).status,0);const saved=fs.readFileSync(out);assert.notEqual(f.run(['--out',out]).status,0);assert.deepEqual(fs.readFileSync(out),saved);
 fs.symlinkSync(f.vault,path.join(f.dir,'alias'));assert.notEqual(f.run(['--out',path.join(f.dir,'alias/report.json')]).status,0);
 f.put(f.idea,f.record('idea').replace('type: idea','type: idea\ntype: question'));let a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='invalid-note'));assert.equal(a.coverage.unreadable,1);
 f.put(f.idea,f.record('idea').replace(/^evidence_records: .*$/m,'evidence_records: [null]'));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='invalid-evidence'));
 fs.symlinkSync(path.join(f.dir,'report.json'),path.join(f.vault,'economy_wiki/Ideas/linked.md'));a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='unsafe-path'));
});
test('summary completeness is pending rather than implied by a current target hash',t=>{
 const f=fixture(t);f.put(f.side,f.record('study-essential-summary',{target_path:f.literature,target_sha256:sha('# Synthetic Literature\n')},'## Essential study summary\n\n### Essential finding\n\nPending.\n'));
 const a=JSON.parse(f.run().stdout);assert.ok(a.findings.some(x=>x.code==='summary-pending'));assert.equal(a.coverage.summaries_prepared,0);
});
test('collector body-only versions remain auditable without manufactured frontmatter',t=>{
 const f=fixture(t);f.put(f.source,'Collector version test-v2\nSynthetic exact quote.\n');f.evidence.sha256=sha('Collector version test-v2\nSynthetic exact quote.\n');f.evidence.version='test-v2';f.evidence.version_locator={start_line:1,end_line:1,label:'Collector version'};f.evidence.locator='Sentence (lines 2–2)';f.put(f.idea,f.record('idea'));
 const a=JSON.parse(f.run().stdout);assert.equal(a.coverage.evidence_verified,1,JSON.stringify(a));
});
test('audit uses dashboard explicit insufficient-evidence decision for five complete sections',t=>{
 const f=fixture(t),body='## Essential study summary\n\n'+['Essential finding','Population and comparison','Key result','Main limitation','Relevance to question'].map(h=>'### '+h+'\n\nSynthetic recorded context.\n').join('\n');f.put(f.side,f.record('study-essential-summary',{target_path:f.literature,target_sha256:sha('# Synthetic Literature\n'),summary_status:'insufficient-evidence'},body));const a=JSON.parse(f.run().stdout);assert.equal(a.coverage.summaries_prepared,0);assert.ok(a.findings.some(x=>x.code==='summary-pending'));
});
test('all nine compiled summary targets and Sources audit with current hashes',t=>{
 for(const folder of ['Literature','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries','Sources']){const f=fixture(t),target='economy_wiki/'+folder+'/target.md';f.put(target,f.bytes);f.put(f.side,f.record('study-essential-summary',{target_path:target,target_sha256:sha(f.bytes)},'## Essential study summary\n'));const a=JSON.parse(f.run().stdout);assert.equal(a.coverage.targets_checked,1,folder);assert.ok(!a.findings.some(x=>x.code==='invalid-summary-target'),folder);}
});
test('read-only audit checks exact evidence and exposes coverage, including empty collections',t=>{
 const f=fixture(t),before=fs.readdirSync(f.vault,{recursive:true});const r=f.run();assert.equal(r.status,0,r.stderr);const a=JSON.parse(r.stdout);
 assert.equal(a.mode,'read-only');assert.equal(a.coverage.notes_scanned,2);assert.equal(a.coverage.evidence_records,1);assert.equal(a.coverage.hashes_checked,1);assert.equal(a.coverage.quotes_checked,1);assert.equal(a.coverage.versions_checked,1);assert.deepEqual(a.findings,[]);assert.deepEqual(fs.readdirSync(f.vault,{recursive:true}),before);assert.match(a.limits.join(' '),/economic|independence/);
 fs.rmSync(path.join(f.vault,'economy_wiki'),{recursive:true});const empty=JSON.parse(f.run().stdout);assert.equal(empty.coverage.notes_scanned,0);assert.equal(empty.coverage.hashes_checked,0);assert.equal(empty.coverage.status,'no-records');
});
