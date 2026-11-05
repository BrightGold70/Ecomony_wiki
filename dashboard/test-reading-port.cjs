'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const headings=['Essential finding','Population and comparison','Key result','Main limitation','Relevance to question'];
const essential='## Essential study summary\n'+headings.map((h,i)=>'### '+h+'\n'+['Recorded economic finding.','Panel sample; identification assumptions.','Estimate with uncertainty.','Vintage and selection uncertainty.','Indirect relevance.'][i]).join('\n');
const roles=['Literature','Datasets','Policies','Methods','Theories','Analyses','Topics','Comparisons','Queries'];
const appFor=notes=>({vault:{getMarkdownFiles:()=>notes,getAbstractFileByPath:p=>notes.find(n=>n.path===p),read:async f=>f.text}});
test('all nine economics categories resolve only exact current hash sidecars without abstract substitution',async()=>{
 const api=require('./study-reading.cjs');
 for(const role of roles){const note={path:`economy_wiki/${role}/test.md`,text:'# Economic record\n## Abstract\nNot an essential finding.'},side={path:'economy_wiki/Review/readability-pilot/test.md',text:`---\ntype: study-essential-summary\nreview_status: economist-review-needed\ntarget_path: ${note.path}\ntarget_sha256: ${sha(note.text)}\nquestions: ["economy_wiki/Questions/q.md"]\n---\n${essential}`};
 const app=appFor([note,side]);let result=await api.resolveEssentialSummary(app,note,[side]);assert.equal(result.status,'prepared',role);assert.equal(result.sections[0].text,'Recorded economic finding.');assert.deepEqual(result.questions,['economy_wiki/Questions/q.md']);note.text+=' changed';result=await api.resolveEssentialSummary(app,note,[side]);assert.equal(result.status,'pending');assert.ok(result.sections.every(s=>!s.text));assert.match(result.reason,/exact current .*hash required/);assert.equal((await api.resolveEssentialSummary(app,note,[])).status,'pending');
 }
});
module.exports={essential,headings,roles,appFor,sha};
