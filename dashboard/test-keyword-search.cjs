const {test}=require('node:test');const assert=require('node:assert/strict');
const {searchNotes}=require('./keyword-search.cjs');
test('findings preserve outcome tables and do not invent missing design',()=>{
 const text='# DiD study\n## Study question and population\n120 adults with DiD.\n## Reported findings — abstract only\n| Outcome | HR |\n|---|---|\n| OS | 0.72 |\n## Limitations and unresolved checks\nCI not recorded.';
 const r=searchNotes([{path:'economy_wiki/Literature/a.md',text}],'DiD')[0];
 assert.match(r.findings,/\| OS \| 0.72 \|/);assert.match(r.population,/120 adults/);assert.match(r.limitations,/CI not recorded/);
 const b=searchNotes([{path:'economy_wiki/Literature/b.md',text:'# DiD\n## Evidence and screening\nCommentary, not an independent sample.'}],'DiD')[0];assert.equal(b.findings,'');assert.match(b.publicationCaution,/commentary/i);
});
test('results include stored summary, not review boilerplate',()=>{
 const text='# Drug trial\n## Evidence and screening\nA randomized trial in 120 adults. Survival was longer.\n\nEvidence level: abstract-only.\n## Economist review required\nConfirm all denominators.';
 const r=searchNotes([{path:'economy_wiki/Literature/a.md',text}],'drug')[0];
 assert.match(r.summary,/120 adults/);assert.doesNotMatch(r.summary,/Confirm all denominators/);assert.equal(r.summaryLabel,'Stored paper summary');assert.match(r.evidence,/abstract-only/);
});
test('abstract is explicitly labelled and missing summary not invented',()=>{
 const a=searchNotes([{path:'economy_wiki/Literature/a.md',text:'# DiD\n## Abstract\nPublished abstract text.'}],'DiD')[0];assert.equal(a.summaryLabel,'Stored abstract');assert.match(a.summary,/Published abstract/);
 const b=searchNotes([{path:'economy_wiki/Literature/b.md',text:'# DiD\n## Economist review required\nCheck source.'}],'DiD')[0];assert.equal(b.summary,'');
});
test('literal keyword scoped to wiki, case insensitive',()=>{
 const result=searchNotes([{path:'economy_wiki/Literature/a.md',text:'# NPM1 study\nSurvival in NPM1 DiD.'},{path:'Patient list/private.md',text:'# NPM1 private'}],'npm1');
 assert.equal(result.length,1);assert.equal(result[0].title,'NPM1 study');assert.match(result[0].snippet,/NPM1/);
});
test('no query grammar; empty input has no hits',()=>{
 const notes=[{path:'economy_wiki/Topics/a.md',text:'# A\nDrug [A+B] result'}];assert.equal(searchNotes(notes,'[A+B]').length,1);assert.equal(searchNotes(notes,'').length,0);
});
test('all words must match and excludes navigation/source duplicates',()=>{
 const notes=[{path:'economy_wiki/Literature/a.md',text:'# DiD\ntariff survival'},{path:'economy_wiki/Sources/a.md',text:'# DiD\ntariff survival'},{path:'economy_wiki/Home.md',text:'tariff survival'}];assert.equal(searchNotes(notes,'tariff survival').length,1);assert.equal(searchNotes(notes,'tariff unrelated').length,0);
});
