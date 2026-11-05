'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class Element{
 constructor(tag='div',opts={},parent=null){Object.assign(this,{tag,parent,text:opts.text||'',value:opts.value||'',children:[],style:{},attrs:{},events:{}})}
 createEl(tag,opts={}){const e=new Element(tag,opts,this);this.children.push(e);return e}createDiv(){return this.createEl('div')}empty(){this.children=[];this.text=''}setText(t){this.text=t}appendText(t){this.text+=t}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,v){this.events[k]=v}focus(){}scrollIntoView(){}all(){return [this,...this.children.flatMap(e=>e.all())]}contents(){return this.all().map(e=>e.text).join('\n')}visible(){return [this,...this.children.filter(e=>this.tag!=='details'||this.open||e.tag==='summary').flatMap(e=>e.visible())]}
 set innerHTML(_){assert.fail('Stored strings must stay text')}
}
const note=(id,title,meta='',folder='Literature')=>({path:`economy_wiki/${folder}/${id}.md`,text:`---\ncountry: Korea\nproduct: steel\nmethod: DiD\nevidence_kind: causal\n${meta}\n---\n# ${title}\n## Abstract\nFull stored summary ${id}.\n## Scope and design\nKorean steel units.\n## Reported findings\nStored estimate ${id}.\n## Limitations\nNot causal verification.`});
async function setup(notes,preferences={},bundled=false){let factory;const opens=[];class Plugin{registerView(_,f){factory=f}addCommand(){}addRibbonIcon(){}registerObsidianProtocolHandler(){}async loadData(){return preferences}}class ItemView{constructor(){this.contentEl=new Element();this.app={vault:{getMarkdownFiles:()=>notes,read:async f=>f.text,getAbstractFileByPath:p=>notes.find(f=>f.path===p),adapter:{}},workspace:{openLinkText:async(...args)=>opens.push(args)}}}}
 const sandbox={module:{exports:{}},require:n=>n==='obsidian'?{Plugin,ItemView}:require(n.startsWith('node:')?n:path.resolve(__dirname,n)),setTimeout,clearTimeout,console};vm.runInNewContext(bundled?require('../scripts/build.cjs').buildDashboard({stdout:true}):fs.readFileSync(path.join(__dirname,'keyword-main.js'),'utf8'),sandbox);const plugin=new sandbox.module.exports();await plugin.onload();const v=factory({});v.readScoped=async f=>f.text;await v.onOpen();return {v,opens};}
const field=(v,label)=>v.contentEl.all().find(e=>e.attrs['aria-label']===label),button=(v,text)=>v.contentEl.all().find(e=>e.tag==='button'&&e.text===text),titles=v=>v.contentEl.all().filter(e=>e.attrs['data-result-title']).map(e=>e.text);
const prefs={researchEntities:[{field:'country',value:'Korea',label:'My Korea'},{field:'method',value:'missing',label:'Empty'}]};
test('compact chooser retains exact navigation and closed recent previews independent of active filters and refresh',async()=>{
 const notes=[note('old','Alpha title','year: 2020'),note('new','Zebra full title','version: 2024'),note('third','Third title','year: 2022')],{v}=await setup(notes,prefs);
 const chooser=field(v,'My entity reference pages');assert.ok(chooser);assert.match(chooser.style.cssText,/display:flex/);assert.match(chooser.style.cssText,/flex-wrap:wrap/);assert.deepEqual(chooser.visible().filter(e=>e.tag==='button').map(e=>e.text),['My Korea entity','Empty entity']);
 const preview=field(v,'My Korea entity preview');assert.equal(preview.open,false);assert.deepEqual(preview.children.slice(1).map(e=>e.text),['Zebra full title','Third title']);assert.ok(chooser.visible().some(e=>e.text==='3 references'));assert.ok(!chooser.visible().some(e=>e.text==='Zebra full title'));
 v.filters.country.value='Japan';notes.push(note('latest','Latest title','publication_date: 2026-01'));await button(v,'Refresh wiki').onclick();assert.equal(field(v,'My Korea entity preview').open,false);assert.equal(field(v,'My Korea entity preview').children[1].text,'Latest title');assert.equal(v.filters.country.value,'Japan');
});
test('entity cards show full clickable titles, complete summaries, scope, findings, citations, metadata and actions within category roles',async()=>{
 const full='Full title '.repeat(40),notes=[note('old',full,'year: 2020\ndoi: 10.1234/example\nestimand: ATT'),note('new','New literature','version: 2024'),note('topic','Topic synthesis','year: 2026','Topics')],{v,opens}=await setup(notes,prefs);v.filters.country.value='Japan';await button(v,'My Korea entity').onclick();
 const cards=v.contentEl.all().filter(e=>e.attrs['data-entity-path']);assert.deepEqual(cards.map(e=>e.attrs['data-entity-path']),[notes[1].path,notes[0].path,notes[2].path]);assert.ok(v.contentEl.all().some(e=>e.text==='Literature (2)'));assert.ok(v.contentEl.all().some(e=>e.text==='Topics (1)'));
 const card=cards[1],title=card.all().find(e=>e.tag==='a'&&e.text===full);assert.ok(title);await title.onclick({preventDefault(){}});assert.deepEqual(opens.at(-1),[notes[0].path,'','split']);for(const text of ['Full stored summary old.','Korean steel units.','Stored estimate old.','10.1234/example','ATT'])assert.ok(card.contents().includes(text),text);for(const label of ['Published abstract — expand full text','Scope / units / design','Findings / numerical outcomes','Citation / recorded metadata','Open actions'])assert.ok(card.all().some(e=>e.tag==='summary'&&e.text===label),label);assert.match(card.contents(),/Publication date: 2020/);assert.equal(v.filters.country.value,'Japan');
});
test('entity references render markdown tables as html tables with header and cells',async()=>{
 const tableNote=note('tbl','Table Study');
 tableNote.text=tableNote.text.replace('Stored estimate tbl.', '| Outcome | Estimate |\n|---|---|\n| TFP | +4.2% |');
 const {v}=await setup([tableNote],prefs,true);
 await button(v,'My Korea entity').onclick();
 const card=v.contentEl.all().find(e=>e.attrs['data-entity-path']===tableNote.path);
 assert.ok(card);
 const table=card.all().find(e=>e.tag==='table');
 assert.ok(table,'table element must be rendered in reference card');
 assert.deepEqual(table.all().filter(e=>e.tag==='th').map(e=>e.text),['Outcome','Estimate']);
 assert.deepEqual(table.all().filter(e=>e.tag==='td').map(e=>e.text),['TFP','+4.2%']);
});
test('entity references render inline bold, italic and code formatting',async()=>{
 const boldNote=note('bld','Bold Study');
 boldNote.text=boldNote.text.replace('Korean steel units.', '- **Setting**: Korean steel units.\n- **Estimates**: **+4.2%** (*p* < 0.01) with `2SLS`.');
 const {v}=await setup([boldNote],prefs,true);
 await button(v,'My Korea entity').onclick();
 const card=v.contentEl.all().find(e=>e.attrs['data-entity-path']===boldNote.path);
 assert.ok(card);
 const strongs=card.all().filter(e=>e.tag==='strong').map(e=>e.all().map(n=>n.text).join(''));
 assert.ok(strongs.includes('Setting'),'must render bold Setting in strong tag');
 assert.ok(strongs.includes('Estimates'),'must render bold Estimates in strong tag');
 assert.ok(strongs.includes('+4.2%'),'must render bold +4.2% in strong tag');
 const ems=card.all().filter(e=>e.tag==='em').map(e=>e.all().map(n=>n.text).join(''));
 assert.ok(ems.includes('p'),'must render italic p in em tag');
 const codes=card.all().filter(e=>e.tag==='code').map(e=>e.all().map(n=>n.text).join(''));
 assert.ok(codes.includes('2SLS'),'must render code 2SLS in code tag');
});
test('blank browsing defaults recent; keyword transitions use relevance; explicit sorting and pagination reset preserve all nine economics categories',async()=>{
 const notes=[note('a','Trade match match','year: 2020'),note('b','Zebra','year: 2026')];notes[1].text+='\nTrade';for(const folder of ['Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries'])notes.push(note(folder,folder,'year: 2022',folder));const {v}=await setup(notes);
 const sort=field(v,'Sort order'),input=field(v,'Economics keyword');assert.ok(sort);assert.equal(sort.value,'recent');assert.equal(titles(v)[0],'Zebra');assert.equal(titles(v).length,10);assert.match(v.contentEl.contents(),/lower bound/i);
 input.value='Trade';await input.events.search();assert.equal(sort.value,'relevance');assert.deepEqual(titles(v),['Trade match match','Zebra']);sort.value='recent';await sort.onchange();assert.deepEqual(titles(v),['Zebra','Trade match match']);sort.value='title';await sort.onchange();assert.deepEqual(titles(v),['Trade match match','Zebra']);input.value='';await input.events.search();assert.equal(sort.value,'recent');
 for(let i=0;i<30;i++)notes.push(note('extra'+i,'Extra '+i,'year: 2024'));await button(v,'Refresh wiki').onclick();await button(v,'Next results page').onclick();assert.match(v.contentEl.contents(),/Page 2 of 2/);sort.value='title';await sort.onchange();assert.match(v.contentEl.contents(),/Page 1 of 2/);
});
test('generic entity headings use recorded full titles and stored metadata summaries without inferring chronology',async()=>{
 const n=note('generic','Literature note','title: "Complete recorded economics title"\nsummary: "Stored metadata summary"\nversion: 2024');n.text=n.text.split('## Abstract')[0];const {v}=await setup([n],prefs);await button(v,'My Korea entity').onclick();assert.ok(v.contentEl.all().some(e=>e.tag==='a'&&e.text==='Complete recorded economics title'));assert.match(v.contentEl.contents(),/Stored metadata summary/);assert.equal(field(v,'My Korea entity preview').children[1].text,'Complete recorded economics title');
});
test('production bundle includes publication chronology and executes blank browse',async()=>{const {execFileSync}=require('node:child_process');assert.match(execFileSync(process.execPath,[path.join(__dirname,'../scripts/build.cjs'),'--check'],{encoding:'utf8'}),/validated/);execFileSync(process.execPath,[path.join(__dirname,'../scripts/build.cjs')]);const {v}=await setup([note('a','Old','year: 2020'),note('b','Edition','version: 2024')],{},true);assert.deepEqual(titles(v),['Edition','Old']);assert.match(v.contentEl.contents(),/publication date unverified/)});
