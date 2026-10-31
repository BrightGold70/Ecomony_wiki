const fs=require('node:fs'),path=require('node:path');const {createReview,verifyReview}=require('../dashboard/evidence-lifecycle.cjs');
const {noSymlinks,readSafe}=require('./safe-fs.cjs');
const {safeNotePath}=require('../dashboard/keyword-search.cjs');
function reviewFile(vault,targetPath,reviewer,scope,decision,output){
 if(!safeNotePath(targetPath))throw Error('Target outside compiled research scope');
 const root=path.resolve(vault,'economy_wiki');const target=path.resolve(vault,targetPath),compiled=path.join(root,targetPath.split('/')[1]);
 if(!target.startsWith(compiled+path.sep)||!fs.realpathSync(target).startsWith(path.join(fs.realpathSync(root),targetPath.split('/')[1])+path.sep))throw Error('Target outside compiled research scope');
 noSymlinks(target);
 const receipt=createReview(readSafe(target).toString('utf8'),reviewer,scope,decision,'human');const envelope={targetPath,reviewedAt:new Date().toISOString(),receipt};fs.writeFileSync(output,JSON.stringify(envelope,null,2)+'\n',{flag:'wx'});return verifyReview(readSafe(target).toString('utf8'),receipt);
}
if(require.main===module){const [vault,target,reviewer,scope,decision,output,confirm]=process.argv.slice(2);if(confirm!=='--human-confirmed'||!output){console.error('Human-operated only: node scripts/review-content.cjs VAULT TARGET_PATH REVIEWER SCOPE DECISION OUTPUT --human-confirmed');process.exit(1)}try{console.log(JSON.stringify(reviewFile(vault,target,reviewer,scope,decision,output),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={reviewFile};
