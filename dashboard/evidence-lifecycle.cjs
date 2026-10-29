'use strict';

// Pure, in-memory provenance checks. No source reads, network, or economic verification.
// Missing reviewStatus is interpreted as pending; validation never mutates claims.
const lifecycleNonempty = value => typeof value === 'string' && value.trim().length > 0;
const lifecycleRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const lifecycleHash = value => typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
const lifecyclePlaceholder = value => /^(unknown|pending|todo|tbd|n\/?a|none|null|not (known|reported|available)|\?+)$/i.test(value.trim());
const lifecycleStatuses = ['pending','reviewed','stale','rejected'];

/** Structural validation only: a locator/hash must be supplied, not verified here. */
function validateClaim(claim) {
 if (!lifecycleRecord(claim)) return ['claim must be an object'];
 const errors=[];
 for (const field of ['id','statement','sourcePath','locator','research_question']) {
  if (!lifecycleNonempty(claim[field])) errors.push(`${field} must be a nonempty string`);
 }
 for (const field of ['sourcePath','locator']) {
  if (lifecycleNonempty(claim[field]) && lifecyclePlaceholder(claim[field])) errors.push(`${field} must identify a source location, not a placeholder`);
 }
 if (!['descriptive','causal','theoretical','counterfactual','reproduced'].includes(claim.evidence_kind)) errors.push('evidence_kind must be descriptive, causal, theoretical, counterfactual, or reproduced');
 if (['causal','counterfactual'].includes(claim.evidence_kind)) for(const field of ['identification_strategy','estimand']) if(!lifecycleNonempty(claim[field])||lifecyclePlaceholder(claim[field])) errors.push(`${field} must be explicit for causal/counterfactual claims`);
 if (!lifecycleHash(claim.sourceSha256)) errors.push('sourceSha256 must be a 64-character SHA256 hexadecimal digest');
 if (claim.reviewStatus !== undefined && !lifecycleStatuses.includes(claim.reviewStatus)) errors.push('reviewStatus must be pending, reviewed, stale, or rejected');
 return errors;
}

/** SHA256 of exact UTF-8 text. Pure JS so browser bundles need no Node shims. */
function hashContent(text) {
 if (typeof text !== 'string') throw new TypeError('text must be a string');
 const bytes=new TextEncoder().encode(text);
 const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);
 padded.set(bytes); padded[bytes.length]=0x80;
 const view=new DataView(padded.buffer);
 const bits=bytes.length*8;
 view.setUint32(padded.length-8,Math.floor(bits/0x100000000));
 view.setUint32(padded.length-4,bits>>>0);
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const rotate=(n,b)=>(n>>>b)|(n<<(32-b));
 const w=new Uint32Array(64);
 for(let offset=0;offset<padded.length;offset+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
  for(let i=16;i<64;i++){
   const x=w[i-15],y=w[i-2];
   w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+w[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;
  }
  let [a,b,c,d,e,f,g,j]=h;
  for(let i=0;i<64;i++){
   const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0;
   const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  [a,b,c,d,e,f,g,j].forEach((value,i)=>{h[i]=(h[i]+value)>>>0;});
 }
 return h.map(value=>value.toString(16).padStart(8,'0')).join('');
}

/** Compare caller-supplied source digests only; current is not economic verification. */
function assessDependencies(claims,sourceHashes) {
 if (!Array.isArray(claims)) throw new TypeError('claims must be an array');
 return claims.map(claim=>{
  const id=lifecycleRecord(claim) ? claim.id : undefined;
  const row=(state,reason)=>({id,state,reason});
  if (!lifecycleRecord(claim) || !lifecycleNonempty(claim.sourcePath) || lifecyclePlaceholder(claim.sourcePath) || !lifecycleHash(claim.sourceSha256)) return row('missing','Missing or invalid pinned source provenance');
  const path=claim.sourcePath;
  const supplied=sourceHashes instanceof Map ? sourceHashes.get(path) : lifecycleRecord(sourceHashes) && Object.prototype.hasOwnProperty.call(sourceHashes,path) ? sourceHashes[path] : undefined;
  if (!lifecycleHash(supplied)) return row('missing','Source hash is absent or invalid in supplied sourceHashes');
  if (supplied.toLowerCase() !== claim.sourceSha256.toLowerCase()) return row('stale','Source content hash changed; recheck the claim and locator');
  return row('current','Pinned source hash matches the supplied source hash; economic accuracy is not verified');
 });
}

const lifecycleDisclaimer='This receipt records a human actor declaration only; it cannot authenticate human identity, credentials, or economic correctness. Hashes are not digital signatures and a receipt can be forged.';
const lifecycleNamedReviewer=value=>lifecycleNonempty(value) && !lifecyclePlaceholder(value) && !/^(human|ai|agent|assistant|anonymous|reviewer|bot)$/i.test(value.trim());
// Fixed field order binds metadata as well as content; this is NOT authentication.
const lifecycleReceiptHash=receipt=>hashContent(JSON.stringify([receipt.version,receipt.algorithm,receipt.contentSha256,receipt.reviewer,receipt.scope,receipt.decision,receipt.actor,receipt.disclaimer]));

/** actor='human' is a caller declaration, never proof of identity. No I/O. */
function createReview(text,reviewer,scope,decision,actor) {
 if (actor !== 'human') throw new TypeError('actor must explicitly equal human');
 if (!lifecycleNamedReviewer(reviewer)) throw new TypeError('reviewer must be a named person, not a generic actor or placeholder');
 for(const [field,value] of [['scope',scope],['decision',decision]]) {
  if (!lifecycleNonempty(value) || lifecyclePlaceholder(value)) throw new TypeError(`${field} must be a nonempty, explicit string`);
 }
 const receipt={version:1,algorithm:'SHA256',contentSha256:hashContent(text),reviewer,scope,decision,actor,disclaimer:lifecycleDisclaimer};
 receipt.receiptSha256=lifecycleReceiptHash(receipt);
 return receipt;
}

/** reviewed means an intact receipt matches text, NOT approval or authenticated review. */
function verifyReview(text,receipt) {
 const result=(state,reason)=>({state,reason,disclaimer:lifecycleDisclaimer});
 if (typeof text !== 'string' || !lifecycleRecord(receipt)) return result('invalid','Text and a structured receipt are required');
 const fields=['version','algorithm','contentSha256','reviewer','scope','decision','actor','disclaimer','receiptSha256'];
 if (fields.some(field=>!Object.prototype.hasOwnProperty.call(receipt,field))) return result('invalid','Receipt fields are missing');
 if (receipt.version !== 1 || receipt.algorithm !== 'SHA256' || receipt.actor !== 'human' || receipt.disclaimer !== lifecycleDisclaimer || !lifecycleNamedReviewer(receipt.reviewer) || !lifecycleHash(receipt.contentSha256) || !lifecycleHash(receipt.receiptSha256)) return result('invalid','Receipt fields are invalid');
 for(const field of ['scope','decision'])if (!lifecycleNonempty(receipt[field]) || lifecyclePlaceholder(receipt[field])) return result('invalid',`Receipt ${field} is invalid`);
 if (lifecycleReceiptHash(receipt) !== receipt.receiptSha256) return result('invalid','Receipt hash does not match its recorded fields');
 if (hashContent(text) !== receipt.contentSha256) return result('stale','Content hash changed; another review is required');
 return {...result('reviewed','Content and receipt hashes match; this does not imply approval'),reviewer:receipt.reviewer,scope:receipt.scope,decision:receipt.decision};
}

module.exports={validateClaim,hashContent,assessDependencies,createReview,verifyReview};
