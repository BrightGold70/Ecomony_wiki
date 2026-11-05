const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const modules={'keyword-search.cjs':'searchNotes,safeNotePath,paperDetails','dashboard-core.cjs':'buildIndex,relatedStudies,relationships','enhancements.cjs':'enhancedSearch,typedRelationships,reviewInbox,evidenceAnswer','evidence-lifecycle.cjs':'validateClaim,assessDependencies,hashContent,createReview,verifyReview','deep-search.cjs':'deepSearch','paper-navigation.cjs':'resolvePaperActions,openPaperAction,paperFrontmatter,recordedLocators,safePaperPath,verifiedPaperFile','inert-markdown.cjs':'renderMarkdown','service-settings.cjs':'renderServiceSettings','reading-metadata.cjs':'referenceMetadata','paper-content.cjs':'paperContent','study-reading.cjs':'essentialSummary,resolveEssentialSummary,renderEssentialSummary,renderReadingContent,scanReadingWorkspace,verifyReadingEvidence,IDEA_RELATIONS','evidence-completeness.cjs':'evidenceCompleteness,completenessLabels,evidenceWarnings','entity-navigation.cjs':'ENTITY_FIELDS,validateEntities,entityMatches,entitySuggestions','publication-order.cjs':'publicationDate,comparePublicationRecent','publication-keywords.cjs':'publicationKeywords,keywordCatalog,keywordGraph,isKeywordNavigation','publication-mesh.cjs':'publicationMesh,meshCatalog,meshGraph,isMeshNavigation,isBibliographicNavigation,renderMeshAppendix,meshValidate','vault-refresh.cjs':'watchResearchVault'};

function buildDashboard(options={}){
 let main=fs.readFileSync(path.join(root,'dashboard/keyword-main.js'),'utf8');
 for(const [file,names]of Object.entries(modules)){
  const body=fs.readFileSync(path.join(root,'dashboard',file),'utf8').replace(/^const\s+\{[^\n]+\}\s*=\s*require\(['"]\.\/[^\n]+\);?\s*$/gm,'').replace(/^module\.exports\s*=.*;?\s*$/gm,'');
  const marker=`const {${names}}=require('./${file}');`;if(!main.includes(marker))throw Error('Missing bundle import '+file);
  main=main.replace(marker,()=>`const {${names}}=(()=>{\n${body}\nreturn {${names}};\n})();`);
 }
 const notebookBody=fs.readFileSync(path.join(root,'dashboard/notebook-panel.cjs'),'utf8').replace(/^const\s+\{[^\n]+\}\s*=\s*require\(['"]\.\/[^\n]+\);?\s*$/gm,'').replace(/^module\.exports\s*=.*;?\s*$/gm,'');
 main=main.replace("const showNotebookPanel=require('./notebook-panel.cjs');",()=>`const showNotebookPanel=(()=>{\n${notebookBody}\nreturn showNotebook;\n})();`);
 new (require('node:vm').Script)(main,{filename:'economy-keyword-search/main.js'});
 if(options.stdout)return main;
 if(options.check){return {validated:true}}
 const dest=path.join(root,'dist/economy-keyword-search');
 fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,'main.js'),main);
 fs.copyFileSync(path.join(root,'dashboard/manifest.json'),path.join(dest,'manifest.json'));
 let deployed=null;
 if(options.vault){
  const targetDir=path.join(path.resolve(options.vault),'.obsidian/plugins/economy-keyword-search');
  fs.mkdirSync(targetDir,{recursive:true});
  fs.copyFileSync(path.join(dest,'main.js'),path.join(targetDir,'main.js'));
  fs.copyFileSync(path.join(dest,'manifest.json'),path.join(targetDir,'manifest.json'));
  deployed=targetDir;
 }
 return {built:true,dest,deployed};
}

module.exports={buildDashboard};

if(require.main===module){
 if(process.argv.includes('--stdout')){fs.writeSync(1,buildDashboard({stdout:true}));process.exit(0)}
 if(process.argv.includes('--check')){
  buildDashboard({check:true});
  console.log('Dashboard bundle validated (no files written)');
  process.exit(0);
 }
 const vaultIdx=process.argv.indexOf('--vault');
 const vault=vaultIdx!==-1&&process.argv[vaultIdx+1]?process.argv[vaultIdx+1]:null;
 const result=buildDashboard({vault});
 console.log('Built local Obsidian dashboard'+(result.deployed?' and deployed to '+result.deployed:''));
}
