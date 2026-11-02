const fs=require('node:fs');const path=require('node:path');
const {noSymlinks}=require('./safe-fs.cjs');
const template=path.resolve(__dirname,'../templates');
function initWiki(vault){
 const root=path.join(path.resolve(vault),'economy_wiki');noSymlinks(root,true);const files={
 'Home.md':'# Economics Wiki\n\n[Open research dashboard](obsidian://economy-search)\n\nCollect → extract → review → synthesize. Draft evidence is not economic guidance.\n',
 'Setup/Scope-policy.md':'# Scope policy\n\nDefine research questions, countries, products, policy changes, datasets, methods, periods and exclusion criteria before collection. Record changes with dates.\n',
 'Setup/Workflow.md':'# Workflow\n\n1. Define scope.\n2. Record available DOI, RePEc or other stable identifiers and check duplicates.\n3. Record source, version, access date and evidence actually read.\n4. Extract reported findings separately from interpretation.\n5. Obtain named, dated economist review before promoting synthesis.\n6. Link related publications without assuming independent samples.\n\nNo automated collection is configured. Read Templates/Indexing-metadata.md after the first Source/Literature pair: inspected keywords and optional MeSH are a separate offline metadata step, never inferred from prose.\n',
 'Review/Review-ledger.md':'# Review ledger\n\n| Note | Reviewer | Date | Evidence reviewed | Decision / corrections |\n|---|---|---|---|---|\n',
 };
 const directories=['Claims','Literature','Sources','Topics','Datasets','Policies','Methods','Theories','Analyses','Comparisons','Queries','raw','Templates','Setup','Review'];
 files['SCHEMA.md']=fs.readFileSync(path.join(template,'SCHEMA.md'),'utf8');
 files['index.md']='# Wiki index\n\nHuman-readable catalogue; add each compiled page with a one-line summary.\n\n## Literature\n\n## Topics\n\n## Datasets\n\n## Policies\n\n## Methods\n\n## Theories\n\n## Analyses\n\n## Comparisons\n\n## Saved queries\n';
 files['log.md']='# Wiki activity log\n\nAppend-only: date, action, source/version, changed paths, unresolved questions and reviewer. No source ingestion has run.\n';
 for(const name of fs.readdirSync(template))if(name.endsWith('.md')&&name!=='SCHEMA.md')files['Templates/'+name]=fs.readFileSync(path.join(template,name),'utf8');
 // Reject every unsafe destination before making the first change.
 for(const relative of ['',...directories,...Object.keys(files)])noSymlinks(path.join(root,relative),true);
 for(const dir of directories){const destination=path.join(root,dir);noSymlinks(destination,true);fs.mkdirSync(destination,{recursive:true});noSymlinks(destination);}
 let created=0,skipped=0;for(const [relative,text]of Object.entries(files)){noSymlinks(path.join(root,relative),true);try{fs.writeFileSync(path.join(root,relative),text,{flag:'wx'});created++}catch(e){if(e.code==='EEXIST')skipped++;else throw e}}
 return {created,skipped,root};
}
if(require.main===module){if(!process.argv[2]){console.error('Usage: node scripts/init-wiki.cjs /path/to/vault');process.exit(1)}console.log(JSON.stringify(initWiki(process.argv[2])))}
module.exports={initWiki};
