'use strict';
// Synthetic identities/content using the observed collector grammar, never live private text.
const crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const pathFor=id=>'economy_wiki/Topics/keyword-'+hash(id).slice(0,24)+'.md';
function fixture({identity='doi:10.1234/example',version='example|pdf-sha256:'+'b'.repeat(64),marker=true,qualifiers=true}={}){
 const term=(text,ui,major,id)=>({text,ui,major_topic_yn:major,attributes:{UI:ui,MajorTopicYN:major},node_path:pathFor(id)});
 const descriptor=term('Imported descriptor','D000208','N','keyword:imported descriptor'),qs=qualifiers?[term('diagnosis','Q000175','N','mesh-qualifier:Q000175'),term('genetics','Q000235','Y','mesh-qualifier:Q000235')]:[];
 const o={identity,version_key:version,verified:true,source_pmid:'123',source_dois:['10.1234/example'],source_url:'https://pubmed.ncbi.nlm.nih.gov/123/',locator:'MedlineCitation/MeshHeadingList/MeshHeading',extraction_source:'Identity-matched cached PubMed XML',evidence_sha256:'a'.repeat(64),response_sha256:'c'.repeat(64),citation_status:'MEDLINE',pmid_version:'1',cached_file:'sample.xml',descriptor:{text:descriptor.text,ui:descriptor.ui,major_topic_yn:descriptor.major_topic_yn,attributes:descriptor.attributes},qualifiers:qs,kind:'pubmed_mesh_heading',provenance_id:'d'.repeat(64),node_path:descriptor.node_path,mapping_status:'MeSH_descriptor_concept_not_disease_eligibility'};
 const indexing={schema:'typed-publication-indexing-v2',identity,version_key:version,status:'verified_MeSH_indexing_metadata',observations:[o],nodes:[],missing_field_is_not_never_indexed:true,scientific_review_unchanged:true,collection_scope_unchanged:true};indexing.indexing_sha256=hash(JSON.stringify(sorted(indexing)));
 const payload={indexing,pubmed_keyword_list:[],inspection:{identity,version_key:version,status:'actual_identity_matched_cached_pubmed_record',mesh_field_status:'returned',keyword_field_status:'not_returned_in_record',record_sha256:o.evidence_sha256,response_sha256:o.response_sha256,source_pmid:'123',cached_file:'sample.xml',fresh_network_record:false}};
 const display=t=>`${t.text} (\`${t.ui}\`; MajorTopicYN=${t.major_topic_yn}) [[${t.node_path.slice(0,-3)}|${t.text}]]`;
 const body='## MeSH indexing terms — NLM/PubMed\n\nStatus: verified_MeSH_indexing_metadata. Separate from author/publisher keywords; metadata navigation only. Indexing availability is not clinical review or disease eligibility.\n\n- '+display(descriptor)+qs.map(q=>' / '+display(q)).join('')+' — [PubMed 123](https://pubmed.ncbi.nlm.nih.gov/123/); record SHA-256 `'+o.evidence_sha256+'`; MedlineCitation/MeshHeadingList/MeshHeading.\n\n### Typed bibliographic evidence record\n\n```json\n'+JSON.stringify(payload,null,2)+'\n```\n';
 return {raw:body+(marker?'\n<!-- typed-indexing:'+hash(body)+' -->\n':''),payload,descriptor,qs,nodes:[descriptor,...qs].map(t=>({path:t.node_path,raw:'---\nkeyword_navigation_only: true\nreference_role: bibliographic-keyword-navigation\nkeyword_node_id: '+(t.ui.startsWith('D')?'keyword:imported descriptor':'mesh-qualifier:'+t.ui)+'\n---\n# Navigation'}))};
}
module.exports={fixture,hash,sorted};
