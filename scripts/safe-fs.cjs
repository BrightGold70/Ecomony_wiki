'use strict';
const fs=require('node:fs'),path=require('node:path');
function noSymlinks(file,missing=false){file=path.resolve(file);let current=path.parse(file).root;for(const part of file.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);try{if(fs.lstatSync(current).isSymbolicLink())throw Error('Symlink denied: '+current)}catch(e){if(missing&&e.code==='ENOENT')return false;throw e}}return true}
function readSafe(file){noSymlinks(file);const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{if(!fs.fstatSync(fd).isFile())throw Error('Not regular file');return fs.readFileSync(fd)}finally{fs.closeSync(fd)}}
module.exports={noSymlinks,readSafe};
