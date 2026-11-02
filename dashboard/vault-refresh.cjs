'use strict';
function watchResearchVault(vault,refresh,dirty=()=>{},delay=300){
 let timer,closed=false;const inScope=path=>typeof path==='string'&&/^(?:economy_wiki(?:\/(?:Literature|Topics|Datasets|Policies|Methods|Theories|Analyses|Comparisons|Queries|Sources)(?:\/.*)?)?)$/.test(path)&&!/[\\%\x00-\x1f\x7f]/.test(path)&&!path.split('/').some(s=>!s||s==='..'||s==='.'||s.startsWith('.')||/^(private|personal|secrets)$/i.test(s));
 const changed=(file,oldPath)=>{if(closed||!inScope(file?.path)&&!inScope(oldPath))return;dirty();clearTimeout(timer);timer=setTimeout(()=>{if(!closed)Promise.resolve(refresh()).catch(()=>{})},delay)};
 const refs=typeof vault.on==='function'?['modify','create','delete','rename'].map(type=>vault.on(type,changed)):[];
 return ()=>{closed=true;clearTimeout(timer);for(const ref of refs)vault.offref?.(ref)};
}
module.exports={watchResearchVault};
