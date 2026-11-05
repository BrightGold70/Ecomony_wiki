'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {renderReadingContent:renderPaperContent}=require('./study-reading.cjs');
class Element{
 constructor(tag='div',o={}){this.tag=tag;this.text=o.text||'';this.children=[];this.style={};this.attrs={}}
 createEl(tag,o={}){assert.ok(!['script','img','iframe','object','embed','a','style','input'].includes(tag),'inert element allowlist');const e=new Element(tag,o);this.children.push(e);return e}
 createDiv(){return this.createEl('div')}setAttribute(k,v){this.attrs[k]=v}empty(){this.children=[];this.text=''}
 all(){return [this,...this.children.flatMap(e=>e.all())]}content(){return this.text+this.children.map(e=>e.content()).join('')}
 set innerHTML(_){assert.fail('no HTML sink')}set outerHTML(_){assert.fail('no HTML sink')}
}
test('stored paper summary renders real table headers and emphasis without changing stored content',()=>{
 const text='**Recorded** response\n\n| Outcome | Value |\n| --- | ---: |\n| *Response* | `12/20` |';
 const result={path:'economy_wiki/Literature/fixture.md',abstract:{text:'Plain abstract.',label:'Published abstract'},summary:{text,label:'Recorded summary — authorship not recorded'},metadata:{}};
 const before=JSON.stringify(result),root=new Element();renderPaperContent(root,result);
 assert.equal(root.all().filter(e=>e.tag==='table').length,1,'stored Markdown table becomes a table');
 assert.deepEqual(root.all().filter(e=>e.tag==='th').map(e=>e.content()),['Outcome','Value']);
 assert.equal(root.all().find(e=>e.tag==='strong')?.content(),'Recorded');assert.equal(root.all().find(e=>e.tag==='em')?.content(),'Response');assert.equal(root.all().find(e=>e.tag==='code')?.content(),'12/20');
 assert.ok(root.all().some(e=>e.tag==='p'&&e.text==='Plain abstract.'));assert.equal(JSON.stringify(result),before);
});
const {renderMarkdown}=require('./inert-markdown.cjs');
test('table delimiters respect escaped and multi-backtick code pipes; malformed tables remain prose',()=>{
 const root=new Element();renderMarkdown(root,'Name | Value\n:--- | ---:\nA\\|B | ``x|`y``\nC | **pending**\n\n| lone | pipe |\n\nA | B\n--- | nope');
 assert.equal(root.all().filter(e=>e.tag==='table').length,1);
 assert.deepEqual(root.all().filter(e=>e.tag==='td').map(e=>e.content()),['A|B','x|`y','C','pending']);
 assert.deepEqual(root.all().filter(e=>e.tag==='th').map(e=>e.style.textAlign),['left','right']);
 assert.ok(root.all().some(e=>e.tag==='p'&&e.content().includes('| lone | pipe |')));
});
test('inline parsing honors escapes, nested emphasis, intraword underscores, unmatched delimiters and inert links/HTML',()=>{
 const raw='\\*literal\\* **bold and *em*** `**code**` ``a`b`` gene_name_value **open <script>alert(1)</script> ![x](https://invalid/image) ![[embed]] [x](javascript:alert(1))';
 const root=new Element();renderMarkdown(root,raw);
 assert.equal(root.all().find(e=>e.tag==='strong')?.content(),'bold and em');
 assert.equal(root.all().find(e=>e.tag==='em')?.content(),'em');
 assert.deepEqual(root.all().filter(e=>e.tag==='code').map(e=>e.content()),['**code**','a`b']);
 assert.ok(root.content().includes('*literal*'));assert.ok(root.content().includes('gene_name_value **open'));
 for(const literal of ['<script>alert(1)</script>','![x](https://invalid/image)','![[embed]]','[x](javascript:alert(1))'])assert.ok(root.content().includes(literal),literal);
 assert.ok(root.all().every(e=>Object.keys(e.attrs).every(k=>!['href','src','style'].includes(k))));
});
test('block Markdown renders headings, nested lists, quotes and literal fenced code',()=>{
 const root=new Element();renderMarkdown(root,'### Recorded scope\n- **First**\n  - Nested\n- Second\n\n3. Third\n4. Fourth\n\n> *Caution*\n> continuation\n\n```html\n<img src="https://invalid/x">\n| A | B |\n| --- | --- |\n**literal**\n```\n\n~~~\nunclosed **literal**');
 assert.equal(root.all().find(e=>e.tag==='h3')?.content(),'Recorded scope');
 assert.equal(root.all().filter(e=>e.tag==='ul').length,2);assert.equal(root.all().find(e=>e.tag==='ol')?.attrs.start,'3');
 assert.equal(root.all().find(e=>e.tag==='blockquote')?.content(),'Caution\ncontinuation');
 assert.deepEqual(root.all().filter(e=>e.tag==='pre').map(e=>e.content()),['<img src="https://invalid/x">\n| A | B |\n| --- | --- |\n**literal**','unclosed **literal**']);
 assert.equal(root.all().filter(e=>e.tag==='table').length,0);
});
test('deep quote input stays bounded and long stored tables retain complete expandable content',()=>{
 const deep=new Element();assert.doesNotThrow(()=>renderMarkdown(deep,'> '.repeat(10000)+'literal'));
 const text='| Outcome | Value |\n| --- | --- |\n'+Array.from({length:100},(_,i)=>'| **Row '+i+'** | pending |').join('\n'),root=new Element();
 renderPaperContent(root,{path:'fixture',abstract:{text:'',label:'Published abstract'},summary:{text,label:'Recorded summary'},metadata:{}});
 const full=root.all().find(e=>e.tag==='details'&&e.children[0]?.text==='Read complete stored text');assert.ok(full);assert.equal(full.all().filter(e=>e.tag==='tbody')[0].children.length,100);assert.equal(full.all().filter(e=>e.tag==='strong').at(-1).content(),'Row 99');
});
test('renderer has no ambient network, HTML parser or Obsidian capability even for hostile input',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const forbidden=()=>assert.fail('privileged renderer capability used');
 const sandbox={module:{exports:{}},require:forbidden,fetch:forbidden,XMLHttpRequest:forbidden,Image:forbidden,document:new Proxy({},{get:forbidden}),MarkdownRenderer:{render:forbidden}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'inert-markdown.cjs'),'utf8'),sandbox);
 const root=new Element();sandbox.module.exports.renderMarkdown(root,'<img src=x onerror=alert(1)>\n<script>fetch("https://invalid")</script>\n\n![**image**](https://invalid/x) ![[private/note]] [run](obsidian://x)\n\n```dataviewjs\nawait fetch("https://invalid")\n```');
 assert.ok(root.content().includes('<script>'));assert.ok(root.content().includes('![**image**]'));assert.ok(root.content().includes('![[private/note]]'));assert.ok(!root.all().some(e=>e.tag==='strong'));
});
test('HTML comments and truncated provenance markers stay hidden outside literal code',()=>{
 const marker='<!-- collector-summary-backfill:v1:'+'a'.repeat(64)+' -->',bibliography='<!-- verified-bibliography:v1:'+'b'.repeat(64)+' -->';
 const raw='Before '+marker+' **visible**\n\n<!-- multi\nline -->After\n\n'+bibliography+'\n\n`'+marker+'`\n\n```text\n'+bibliography+'\n```\n\nTail <!-- collector-summary-backfill:v1:truncated';
 const root=new Element();renderMarkdown(root,raw);
 assert.equal(root.all().filter(e=>e.tag==='code').length,2);
 const ordinary=root.all().filter(e=>e.tag==='p').map(e=>e.text+e.children.filter(c=>c.tag!=='code').map(c=>c.content()).join('')).join('\n');
 assert.ok(!ordinary.includes('collector-summary-backfill'),'hidden and preview-truncated markers must not leak');
 assert.ok(!ordinary.includes('verified-bibliography'));assert.ok(!ordinary.includes('multi'));assert.match(ordinary,/Before/);assert.match(ordinary,/After/);assert.match(ordinary,/Tail/);
 assert.equal(root.all().find(e=>e.tag==='strong')?.content(),'visible');
 assert.deepEqual(root.all().filter(e=>e.tag==='code').map(e=>e.content()),[marker,bibliography]);
 assert.ok(raw.includes(marker),'input remains untouched');
});
module.exports={Element};
