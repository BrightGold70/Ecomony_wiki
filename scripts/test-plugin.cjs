'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
test('bundle renders offline economics search and comparison controls',async()=>{
 const repo=path.resolve(__dirname,'..');require('node:child_process').execFileSync(process.execPath,[path.join(repo,'scripts/build.cjs')]);
 const d=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-render-'));try{
 fs.mkdirSync(path.join(d,'economy_wiki/Policies'),{recursive:true});fs.writeFileSync(path.join(d,'economy_wiki/Policies/trade.md'),'---\nevidence_kind: causal\nresearch_question: Effect?\nidentification_strategy: DiD\nestimand: ATT\ncountry: Korea\n---\n# Tariff trade\n## Reported findings\nTariff estimate 2; synthetic only.');
 const elements=[];class Element{constructor(tag,opts={}){this.tag=tag;this.text=opts.text||'';this.value=opts.value||'';this.style={};this.events={};this.children=[];elements.push(this)}createEl(tag,opts){const e=new Element(tag,opts);this.children.push(e);return e}createDiv(){return this.createEl('div')}empty(){}setText(v){this.text=v}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}appendText(){}focus(){}scrollIntoView(){}}
 const registrations=[];class Plugin{registerView(id,f){registrations.push(f)}addCommand(){}addRibbonIcon(){}registerObsidianProtocolHandler(){}}class ItemView{constructor(leaf){Object.assign(this,leaf)}}
 const sandbox={module:{exports:{}},require:n=>n==='obsidian'?{Plugin,ItemView}:require(n),TextEncoder,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(path.join(repo,'dist/economy-keyword-search/main.js'),'utf8'),sandbox);const plugin=new sandbox.module.exports();await plugin.onload();
 const view=registrations[0]({app:{vault:{adapter:{getBasePath:()=>d},getMarkdownFiles:()=>[{path:'economy_wiki/Policies/trade.md'}]}},contentEl:new Element('root')});await view.onOpen();assert.equal(view.index.length,1);const search=elements.find(e=>e.tag==='input'&&e.events.search);search.value='tariff';await search.events.search();assert.ok(elements.some(e=>e.text==='Tariff trade'));assert.ok(elements.some(e=>/Tariff estimate 2/.test(e.text)));view.selected.add('economy_wiki/Policies/trade.md');view.showComparison(new Element('area'));for(const text of ['ATT','DiD','Effect?','Korea'])assert.ok(elements.some(e=>e.text===text),text);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
});
test('bundle registers economy plugin and refuses symlinks at the filesystem reader boundary',async()=>{
 const repo=path.resolve(__dirname,'..');require('node:child_process').execFileSync(process.execPath,[path.join(repo,'scripts/build.cjs')]);
 const file=path.join(repo,'dist/economy-keyword-search/main.js'),code=fs.readFileSync(file,'utf8');const registered=[];
 class Plugin{registerView(id,factory){registered.push([id,factory])}addCommand(){}addRibbonIcon(){}registerObsidianProtocolHandler(){}}
 class ItemView{constructor(leaf){this.app=leaf.app;this.contentEl=leaf.contentEl}}
 const sandbox={module:{exports:{}},require:name=>name==='obsidian'?{Plugin,ItemView}:require(name),TextEncoder,setTimeout,clearTimeout};vm.runInNewContext(code,sandbox);const plugin=new sandbox.module.exports();await plugin.onload();assert.equal(registered[0][0],'economy-keyword-search');
 const d=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||os.tmpdir()),'economy-plugin-'));
 try{fs.mkdirSync(path.join(d,'economy_wiki/Literature'),{recursive:true});fs.writeFileSync(path.join(d,'economy_wiki/Literature/a.md'),'# Trade\n## Reported findings\nTariffs');fs.symlinkSync(path.join(d,'economy_wiki/Literature/a.md'),path.join(d,'economy_wiki/Literature/link.md'));
 const view=registered[0][1]({app:{vault:{adapter:{getBasePath:()=>d}}}});assert.equal(await view.readScoped({path:'economy_wiki/Literature/a.md'}),'# Trade\n## Reported findings\nTariffs');await assert.rejects(view.readScoped({path:'economy_wiki/Literature/link.md'}),/symlink/i);await assert.rejects(view.readScoped({path:'economy_wiki/Literature/Private/a.md'}),/scope/i);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
});
