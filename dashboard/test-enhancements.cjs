'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('./dashboard-core.cjs');
const api=()=>require('./enhancements.cjs');

test('typed relationships only classify recorded edges, retain direction, and never verify economic semantics',()=>{
 const target=paper('target','# Target\n## Abstract\nFTA study.');
 const contexts=['Commentary on','Correction of','Follow-up of','Same sample as','See also','Not a correction of'];
 const notes=contexts.map((context,i)=>paper(`r${i}`,`# Link ${i}\n## Publication relationships\n${context} [[economy_wiki/Literature/target]].`));
 notes.push(target,paper('unlinked','# Same sample commentary correction\nNo link.'));
 const index=core.buildIndex(notes),before=index.map(p=>p.raw);
 const edges=api().typedRelationships(index);
 assert.equal(edges.length,6);
 assert.deepEqual(edges.map(e=>e.kind),['commentary-on','correction-of','follow-up-of','same-sample','recorded-link','recorded-link']);
 for(const [i,edge] of edges.entries()){
  assert.equal(edge.source,notes[i].path);assert.equal(edge.target,target.path);
  assert.equal(edge.status,i<4?'suggested':'recorded');
  assert.match(edge.context,/\[\[economy_wiki\/Literature\/target\]\]/);
  if(i<4)assert.match(edge.context,/does not establish semantic direction/i);
  assert.equal(Object.hasOwn(edge,'verified'),false);
 }
 assert.deepEqual(index.map(p=>p.raw),before);
 assert.deepEqual(api().typedRelationships([]),[]);
});
const paper=(id,body,front='')=>({path:`economy_wiki/Literature/${id}.md`,text:(front?`---\n${front}\n---\n`:'')+body});

test('review inbox explains gaps, parses quoted/commented metadata, and does not call unreviewed new',()=>{
 const complete='## Reported findings\nDiD outcomes were recorded.\n## Limitations\nSmall study.';
 const reviewed='review_status: "economist-reviewed" # recorded only\nconfidence: HIGH\ncontested: "false"\ncorrection_check_date: "2999-01-01"';
 const notes=[paper('complete','# Complete\n'+complete,reviewed),paper('abstract','# Abstract paper\n## Abstract\nDiD abstract only.','review_status: \'economist-review-needed\'\nconfidence: "low" # uncertain\ncontested: "true"'),paper('metadata','# Metadata\nDOI: 10.1/example','correction_check_date: 2000-01-01'),paper('empty','# Empty\n## Reported findings\nPending.','review_status: unreviewed\ncorrection_check_date: nonsense'),paper('negative','# Negative\n'+complete,reviewed.replace('contested: "false"','contested: false'))];
 const index=core.buildIndex(notes),snapshot=JSON.stringify(index);
 const rows=api().reviewInbox(index);
 assert.equal(rows.some(r=>r.paper.path===notes[0].path),false);
 assert.equal(rows.some(r=>r.paper.path===notes[4].path),false);
 const reasons=id=>rows.find(r=>r.paper.path===notes[id].path).reasons.join('; ');
 assert.match(reasons(1),/abstract-only/);assert.match(reasons(1),/missing findings/);assert.match(reasons(1),/unreviewed/);assert.match(reasons(1),/contested/);assert.match(reasons(1),/low confidence/);assert.match(reasons(1),/missing correction_check_date/);
 assert.match(reasons(2),/metadata-only/);assert.match(reasons(2),/missing summary/);assert.match(reasons(2),/old correction_check_date/);
 assert.match(reasons(3),/invalid correction_check_date/);
 assert.ok(rows.every(row=>row.reasons.every(reason=>!(/\bnew\b/i.test(reason)))));
 assert.equal(JSON.stringify(index),snapshot);
 assert.deepEqual(api().reviewInbox([]),[]);
});

test('review metadata and tables retain evidence while abstract-only extraction and invalid dates stay actionable',()=>{
 const notes=[paper('table','# Table\n## Reported findings\n| Endpoint | Estimate |\n|---|---|\n| OS | 42% |','review_status: economist-reviewed\nconfidence: high\ncontested: false\ncorrection_check_date: 2026-01-01'),paper('abstract-mode','# Screening\n## Evidence and screening\nStored DiD summary.','review_status: economist-reviewed\nextraction_status: "abstract-only"\ncorrection_check_date: 2026-02-30')];
 const rows=api().reviewInbox(core.buildIndex(notes),'2026-10-01');
 assert.equal(rows.some(r=>r.paper.path===notes[0].path),false);
 assert.ok(rows[0].reasons.includes('abstract-only'));
 assert.ok(rows[0].reasons.includes('invalid correction_check_date'));
});

test('evidence answers are exact local section quotations, provenance-bound, selected-path constrained, capped and never economic synthesis',()=>{
 const notes=Array.from({length:10},(_,i)=>paper(`e${i}`,`# Study ${i}\n## Abstract\nDiD and tariff were studied in sample ${i}.\n## Reported findings\nStored estimate ${i}; no inference here.\n## Economist review required\nDiD tariff check economicly.\n## Publication relationships\nDiD tariff [[economy_wiki/Literature/e0]].`));
 const index=core.buildIndex(notes),before=JSON.stringify(index);
 const answer=api().evidenceAnswer(index,'What is reported about DiD and tariff?');
 assert.equal(answer.mode,'extractive');assert.equal(answer.question,'What is reported about DiD and tariff?');
 assert.ok(answer.claims.length>0);assert.ok(answer.claims.length<=8);
 for(const claim of answer.claims){
  assert.deepEqual(Object.keys(claim).sort(),['path','quote','section','title']);
  const original=notes.find(n=>n.path===claim.path);
  assert.ok(original.text.includes(claim.quote));assert.ok(original.text.includes('## '+claim.section+'\n'+claim.quote));
  assert.ok(!/economist|publication relationships/i.test(claim.section));
 }
 assert.ok(answer.gaps.some(g=>/not.*verif|unverified/i.test(g)));
 const selected=api().evidenceAnswer(index,'DiD tariff',[notes[2].path]);
 assert.ok(selected.claims.length);assert.ok(selected.claims.every(c=>c.path===notes[2].path));
 const invalid=api().evidenceAnswer(index,'DiD',['private/a.md']);
 assert.deepEqual(invalid.claims,[]);assert.ok(invalid.gaps.some(g=>/selected|selection/i.test(g)));
 assert.equal(JSON.stringify(index),before);
});
test('evidence no-match and empty states disclose retrieval limits, not absence of evidence',()=>{
 const index=core.buildIndex([paper('e','# FTA outcomes\n## Abstract\n자유무역협정 결과를 보고했다.'),paper('meta','# DiD metadata\nDOI: 10.1/a')]);
 const alias=api().evidenceAnswer(index,'FTA');assert.equal(alias.claims.length,1);assert.equal(alias.claims[0].section,'Abstract');
 const none=api().evidenceAnswer(index,'zebrafish');
 assert.deepEqual(none.claims,[]);assert.ok(none.gaps.some(g=>/not.*absence|does not.*no evidence/i.test(g)));
 assert.deepEqual(api().evidenceAnswer(index,'').claims,[]);
 assert.ok(api().evidenceAnswer(index,'').gaps.some(g=>/keyword|question/i.test(g)));
 assert.deepEqual(api().evidenceAnswer(index,'DiD').claims,[]);
 assert.ok(api().evidenceAnswer(index,'DiD').gaps.some(g=>/section|quot/i.test(g)));
 assert.deepEqual(api().evidenceAnswer([],'DiD').claims,[]);
});

test('query expansion is controlled, phrase-aware, AND-of-OR, and empty-safe',()=>{
 const {expandQuery}=api();
 assert.deepEqual(expandQuery('  '),{groups:[],expansions:[]});
 const result=expandQuery('RTA tariff');
 assert.equal(result.groups.length,2);
 assert.ok(result.groups[0].includes('자유무역협정'));
 assert.ok(result.groups[1].includes('관세'));
 assert.ok(result.expansions.every(x=>typeof x==='string'));
 assert.equal(expandQuery('difference-in-differences CGE').groups.length,2);
 assert.ok(expandQuery('이중차분').groups[0].includes('DiD'));
 assert.ok(expandQuery('도구변수').groups[0].includes('IV'));
 assert.ok(expandQuery('computable-general-equilibrium').groups[0].includes('CGE'));
 assert.deepEqual(expandQuery('[x]+').groups,[['[x]+']]);
});
test('enhanced search reuses presentation, expands bilingual aliases and requires every group',()=>{
 const {enhancedSearch}=api();
 const notes=[paper('a','# Korean\n## Reported findings\n자유무역협정 후 관세.'),paper('b','# English\n## Abstract\nFTA with tariff.'),paper('c','# RTA alone\nRTA.'),paper('d','# IV\n도구변수 연산가능 일반균형.'),paper('e','# DiD\n이중차분.')];
 const result=enhancedSearch(notes,'trade agreement tariff');
 assert.deepEqual(result.rows.map(r=>r.path).sort(),[notes[0].path,notes[1].path].sort());
 assert.equal(result.rows.find(r=>r.path===notes[1].path).summaryLabel,'Stored abstract');
 assert.equal(enhancedSearch(notes,'IV CGE').rows.length,1);
 assert.equal(enhancedSearch(notes,'DiD').rows.length,1);
 assert.equal(enhancedSearch(notes,'자유무역협정').rows.length,3);
 assert.ok(result.expansions.length);
});
test('search is literal-safe and abbreviations do not match substrings; scope and empty behavior preserved',()=>{
 const {enhancedSearch}=api();
 const notes=[paper('a','# FTA116\nFTA116 and preFTA and FTA_post.'),paper('b','# Exact\nfTa; IVike; DiD2.'),paper('c','# Literal\nUse [x]+ and a.b literally.'),paper('d','# Metadata only\nNo term here.','tags: [FTA]'),{path:'economy_wiki/Sources/a.md',text:'# FTA'},{path:'private/a.md',text:'# FTA'}];
 assert.deepEqual(enhancedSearch(notes,'FTA').rows.map(r=>r.path),[notes[1].path]);
 assert.equal(enhancedSearch(notes,'DiD').rows.length,0);
 assert.equal(enhancedSearch(notes,'IV').rows.length,0);
 assert.equal(enhancedSearch(notes,'[x]+').rows.length,1);
 assert.equal(enhancedSearch(notes,'a.b').rows.length,1);
 assert.doesNotThrow(()=>enhancedSearch(notes,'('));
 assert.deepEqual(enhancedSearch(notes,''),{rows:[],expansions:[]});
});
