const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const modules={'keyword-search.cjs':'searchNotes,safeNotePath','dashboard-core.cjs':'buildIndex,relatedStudies,relationships','enhancements.cjs':'enhancedSearch,typedRelationships,reviewInbox,evidenceAnswer','evidence-lifecycle.cjs':'validateClaim,assessDependencies,hashContent,createReview,verifyReview','deep-search.cjs':'deepSearch','paper-navigation.cjs':'resolvePaperActions,openPaperAction'};
let main=fs.readFileSync(path.join(root,'dashboard/keyword-main.js'),'utf8');
for(const [file,names]of Object.entries(modules)){
 const body=fs.readFileSync(path.join(root,'dashboard',file),'utf8').replace(/^const\s+\{[^\n]+\}\s*=\s*require\(['"]\.\/[^\n]+\);?\s*$/gm,'').replace(/^module\.exports\s*=.*;?\s*$/gm,'');
 const marker=`const {${names}}=require('./${file}');`;if(!main.includes(marker))throw Error('Missing bundle import '+file);
 main=main.replace(marker,()=>`const {${names}}=(()=>{\n${body}\nreturn {${names}};\n})();`);
}
new (require('node:vm').Script)(main,{filename:'economy-keyword-search/main.js'});
if(process.argv.includes('--check')){console.log('Dashboard bundle validated (no files written)');process.exit(0)}
const dest=path.join(root,'dist/economy-keyword-search');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'main.js'),main);fs.copyFileSync(path.join(root,'dashboard/manifest.json'),path.join(dest,'manifest.json'));console.log('Built local Obsidian dashboard');
