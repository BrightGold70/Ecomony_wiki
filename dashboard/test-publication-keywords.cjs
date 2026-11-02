'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {publicationKeywords,keywordCatalog,keywordGraph,isKeywordNavigation}=require('./publication-keywords.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const nodePath='economy_wiki/Topics/keyword-'+hash('keyword:tariffs').slice(0,24)+'.md';
const node={path:nodePath,text:'---\nkeyword_navigation_only: true\nreference_role: bibliographic-keyword-navigation\nkeyword_node_id: "keyword:tariffs"\njel_codes: [F13]\n---\n# Tariffs navigation'};
function block(raw='Tariffs',pending=false){return '## Explicit publication keywords\n\nKeyword metadata status: verified_explicit_keywords. Bibliographic navigation only; not disease eligibility, new full-text review or clinical approval.\n\n- '+raw+' — pubmed_keyword_list; '+(pending?'pending_ambiguous. Mapping pending.':'explicit_keyword_concept_disease_mapping_unassessed. [['+nodePath.slice(0,-3)+'|tariffs]]')+' [Evidence](https://pubmed.ncbi.nlm.nih.gov/123/) · KeywordList/Keyword · SHA-256 `'+ 'a'.repeat(64)+'`.\n'}
function append(b,kind='keyword'){return b.trimEnd()+'\n\n<!-- '+(kind==='collector'?'collector-revision:'+hash(JSON.stringify(b)):'keyword-enrichment:'+hash(b))+' -->\n'}
const paper=(id,text)=>({path:'economy_wiki/Literature/'+id+'.md',text});
test('malformed entity escapes never crash keyword parsing',()=>{assert.doesNotThrow(()=>publicationKeywords(append(block('&#99999999;'))))});
test('inert observations cannot acquire provenance merely because the whole appendix hash matches',()=>{const b=block(),line=b.split('\n').find(l=>l.startsWith('- '));for(const wrapper of ['```\n'+line+'\n```','<!--\n'+line+'\n-->'])assert.equal(publicationKeywords(append(b.replace(line,wrapper))).observations.length,0)});
test('reads literal appendix with exact provenance, not title abstract MeSH or naked arrays',()=>{
 const result=publicationKeywords('---\nkeywords: [Fake]\n---\n# Fake title\n## Abstract\nFake\n'+append(block()));assert.equal(result.status,'verified_explicit_keywords');assert.equal(result.observations.length,1);assert.equal(result.observations[0].raw_keyword,'Tariffs');assert.equal(result.observations[0].kind,'pubmed_keyword_list');assert.equal(result.observations[0].source_url,'https://pubmed.ncbi.nlm.nih.gov/123/');assert.equal(result.observations[0].locator,'KeywordList/Keyword');assert.equal(result.integrity,'appendix-hash-matched');assert.equal(result.identityVersion,'not recorded in appendix; not independently verified');assert.equal(publicationKeywords('# Tariffs\n## Abstract\nKeywords: tariffs').observations.length,0);
});
test('accepts collector JSON-string hashes and latest relevant appendix only; repeated provenance deduplicates',()=>{
 const b=block();assert.equal(publicationKeywords(append(b,'collector')).observations.length,1);assert.equal(publicationKeywords(append(b)+append(b)).observations.length,1);
 assert.equal(publicationKeywords(append(b)+append(block('Changed'))).observations[0].raw_keyword,'Changed');
 assert.equal(publicationKeywords(append(b)+'\n## Other update\nUnrelated\n').observations[0].raw_keyword,'Tariffs');
 assert.equal(publicationKeywords(append(b)+block('Tampered')+'\n<!-- keyword-enrichment:'+'0'.repeat(64)+' -->').status,'invalid_provenance');
});
test('fails closed on malicious URLs paths unguarded sections and inert examples',()=>{
 const b=block();for(const bad of [b,'```md\n'+append(b)+'```','<!--\n'+append(b)+'\n-->','> '+append(b).replace(/\n/g,'\n> ')])assert.equal(publicationKeywords(bad).observations.length,0);
 for(const replacement of ['javascript:alert(1)','https://localhost/x','https://pubmed.ncbi.nlm.nih.gov/x?token=secret'])assert.equal(publicationKeywords(append(b.replace('https://pubmed.ncbi.nlm.nih.gov/123/',replacement))).observations.length,0);
 const parsed=publicationKeywords(append(b.replace(nodePath.slice(0,-3),'economy_wiki/Topics/../private')));assert.equal(parsed.observations[0].node_path,null);
});
test('pending is distinct from absence, retains ambiguous literal values and never fabricates fields',()=>{
 const p=publicationKeywords(append(block('ALL',true)));assert.equal(p.observations[0].raw_keyword,'ALL');assert.equal(p.observations[0].node_path,null);assert.equal(p.observations[0].mapping_status,'pending_ambiguous');
 const absent=publicationKeywords('## Explicit publication keywords\n\nKeyword metadata status: pending_source_inspection.\nNo explicit keywords verified.');assert.equal(absent.status,'pending_source_inspection');assert.equal(absent.observations.length,0);assert.equal(publicationKeywords('# Paper').status,'not_recorded');
});
test('publication counts use only declared verified valid DOI; no Source duplication or unsafe mapped nodes',()=>{
 const text='---\ndoi: 10.1234/example\ndoi_verified: true\nversion_key: "v1"\n---\n# Paper\n'+append(block());
 const a=paper('a',text),b=paper('b',text.replace('"v1"','"v2"')),source={path:'economy_wiki/Sources/a.md',text};
 const catalog=keywordCatalog([a,b,source,node]);assert.equal(catalog.keywords[0].paperCount,1);assert.equal(catalog.keywords[0].papers[0].notes.length,2);assert.equal(catalog.keywords[0].papers[0].versions.length,2);assert.equal(catalog.coverage.paperNotes,2);assert.equal(catalog.coverage.navigationNodes,1);
 assert.equal(keywordCatalog([a,{...b,text:b.text.replace('doi_verified: true','doi_verified: false')},node]).keywords[0].paperCount,2);
 assert.equal(keywordCatalog([a,{...node,text:'# untrusted collision'}]).keywords[0].observations[0].node_path,null);
 assert.equal(isKeywordNavigation(node),true);
});
test('paper–keyword graph is bipartite and publication-deduplicated; all mode preserves isolated indexed notes',()=>{
 const text='---\ndoi: 10.1234/example\ndoi_verified: true\n---\n# Paper\n'+append(block());const notes=[paper('a',text),paper('b',text),paper('isolated','# Alone'),node];
 const graph=keywordGraph(notes,'paper-keyword');assert.equal(graph.edges.length,1);assert.equal(graph.edges[0].kind,'explicit-publication-keyword');assert.equal(graph.nodes.length,3);assert.equal(keywordGraph(notes,'papers').nodes.length,3);assert.equal(keywordGraph(notes,'all').nodes.length,4);
});
module.exports={block,append,node,paper};
