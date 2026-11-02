'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const order=require('node:fs').existsSync(require('node:path').join(__dirname,'publication-order.cjs'))?require('./publication-order.cjs'):{};
const note=(title,metadata='',path=title)=>({title,path:`economy_wiki/Literature/${path}.md`,raw:`---\n${metadata}\n---\n# ${title}`});
test('explicit publication aliases validate calendar values, precedence and retained precision',()=>{
 assert.equal(typeof order.publicationDate,'function');
 for(const value of ['2025-02-29','2026-04-31','2026-00','2026-13','2026-01-00','2026-01-32','2026-1-2','2026-01-02T00:00:00Z','May 2026','0000','20260','[2026]'])assert.equal(order.publicationDate(note('Invalid',`publication_date: ${value}`)).value,null,value);
 assert.equal(order.publicationDate(note('Leap','publication_date: 2024-02-29')).value,'2024-02-29');
 assert.equal(order.publicationDate(note('Precedence','publication_date: 2020-03-01\npublished: 2025-04\ndate_published: 2026\npublication_year: 2027\nyear: 2028')).value,'2020-03-01');
 assert.equal(order.publicationDate(note('Fallback','publication_date: invalid\npublished: 2025-03')).value,'2025-03');
 assert.equal(order.publicationDate(note('Year','publication_year: 2024\nyear: 2026')).value,'2024');
 assert.deepEqual(order.publicationDate(note('Month','published: 2026-10')),{value:'2026-10',precision:'month',key:20261001,field:'published',caption:'Publication date: 2026-10 (month precision; recorded metadata)'});
});
test('only one unique standalone plausible version year supplies a clearly unverified edition fallback',()=>{
 for(const version of ['2024','Version 2.2024','2024 edition (2024)','2024-12-31'])assert.deepEqual(order.publicationDate(note('Edition',`version: ${version}`)),{value:'2024',precision:'year',key:20240101,field:'version',basis:'version-year',caption:'Version/edition year: 2024 (from recorded version; publication date unverified)'});
 for(const version of ['2025 update 2026','1799',String(new Date().getFullYear()+3),'12024','20240','v2024','2024draft','2024_edition'])assert.equal(order.publicationDate(note('Ambiguous',`version: ${version}`)).value,null,version);
 assert.equal(order.publicationDate(note('Explicit','publication_date: 2020-03\nversion: 2024')).value,'2020-03');
 assert.equal(order.publicationDate(note('2024 title','created: 2024\nmodified: 2024\nupdated: 2024\nissue_date: 2024','2024-filename')).value,null);
 const rows=[note('Unknown'),note('Old','year: 1999'),note('Edition','version: 2024'),note('Year','year: 2026'),note('Month','published: 2026-10'),note('Newest','publication_date: 2026-11-02')];
 assert.deepEqual(rows.sort(order.comparePublicationRecent).map(p=>p.title),['Newest','Month','Year','Edition','Old','Unknown']);
 assert.ok(order.comparePublicationRecent(note('Same','year: 2024','a'),note('Same','year: 2024','b'))<0);
});
test('latest integrity-checked collector revision never resurrects obsolete publication or edition metadata',()=>{
 const {hashContent}=require('./evidence-lifecycle.cjs');
 const revision=fields=>{const content='---\n'+Object.entries(fields).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n# Collector reference\n';return content.trimEnd()+'\n\n<!-- collector-revision:'+hashContent(JSON.stringify(content))+' -->\n'};
 const first=revision({publication_date:'2020-01-01',version:'2022'})+'<!-- collector-owned:v1 -->\n';
 assert.equal(order.publicationDate({raw:first+revision({version:'2024'})}).value,'2024');
 assert.equal(order.publicationDate({raw:first+revision({status:'draft'})}).value,null);
 assert.equal(order.publicationDate({raw:first+revision({version:'2024'}).replace(/collector-revision:[a-f0-9]{64}/,'collector-revision:'+'0'.repeat(64))}).value,null);
 assert.equal(order.publicationDate({raw:'---\npublication_date: 2025-03\n---\n# User note\n'+first+revision({version:'2024'})}).value,'2025-03');
});
