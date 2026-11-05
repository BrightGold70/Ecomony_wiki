'use strict';
// Fixed element names and text sinks only. Never invoke Obsidian's renderer.
function codeSpan(text,start){
 const run=/^`+/.exec(text.slice(start));if(!run)return null;
 const marker=run[0];let end=start+marker.length;
 while((end=text.indexOf(marker,end))!==-1){if(text[end-1]!=='`'&&text[end+marker.length]!=='`')return {end:end+marker.length,text:text.slice(start+marker.length,end)};end+=marker.length}
 return null;
}
function inlineParts(text,depth=0){
 if(depth>24)return [['span',text]];
 const parts=[];let plain='';const flush=()=>{if(plain){parts.push(['span',plain]);plain=''}};
 for(let i=0;i<text.length;){
  if(text[i]==='\\'&&/[\\`*_[\]{}()#+.!|>~-]/.test(text[i+1]||'')){plain+=text[i+1];i+=2;continue}
  const code=text[i]==='`'&&codeSpan(text,i);if(code){flush();parts.push(['code',code.text]);i=code.end;continue}
  // Links, images and wiki embeds are displayed literally, not resolved.
  const literal=/^(?:!?\[\[[^\n]*?\]\]|!?\[[^\n]*?\]\([^\n]*?\)|<[^>\n]*>)/.exec(text.slice(i));
  if(literal){plain+=literal[0];i+=literal[0].length;continue}
  const char=text[i];if((char==='*'||char==='_')&&!/\s/.test(text[i+1]||' ')&&!(char==='_'&&/[\p{L}\p{N}]/u.test(text[i-1]||''))){
   const marker=text.slice(i,i+2)===char+char?char+char:char;let end=i+marker.length;
   while((end=text.indexOf(marker,end))!==-1){
    if(text[end-1]==='\\'||/\s/.test(text[end-1])||(char==='_'&&/[\p{L}\p{N}]/u.test(text[end+marker.length]||''))){end+=marker.length;continue}
    // A closing triple run closes inner emphasis before outer strong.
    if(marker.length===2&&text[end+2]===char&&text.slice(i+2,end).includes(char))end++;
    const inside=text.slice(i+marker.length,end);if(inside){flush();parts.push([marker.length===2?'strong':'em',inlineParts(inside,depth+1)]);i=end+marker.length;break}end+=marker.length;
   }
   if(end!==-1&&i===end+marker.length)continue;
  }
  plain+=text[i++];
 }
 flush();return parts;
}
function markdownText(parent,tag,text){
 const parts=inlineParts(text);if(parts.length===1&&parts[0][0]==='span')return parent.createEl(tag,{text:parts[0][1]});
 const el=parent.createEl(tag);const append=(target,items)=>{for(const [kind,value]of items){if(Array.isArray(value))append(target.createEl(kind),value);else target.createEl(kind,{text:value})}};append(el,parts);return el;
}
function tableCells(line){
 const text=line.trim(),cells=[];let value='',separators=0;
 for(let i=0;i<text.length;){
  if(text[i]==='\\'&&i+1<text.length){value+=text.slice(i,i+2);i+=2;continue}
  const code=text[i]==='`'&&codeSpan(text,i);if(code){value+=text.slice(i,code.end);i=code.end;continue}
  if(text[i]==='|'){cells.push(value.trim());value='';separators++;i++;continue}value+=text[i++];
 }
 cells.push(value.trim());if(text.startsWith('|'))cells.shift();if(text.endsWith('|')&&cells.at(-1)==='')cells.pop();return {cells,separators};
}
function hideMarkdownComments(value){
 const lines=String(value??'').split(/\r?\n/);let comment=false,fence=null;
 return lines.map(line=>{
  const f=!comment&&/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length&&!f[2].trim())fence=null;return line}
  if(fence)return line;
  let out='';for(let i=0;i<line.length;){
   if(comment){const end=line.indexOf('-->',i);if(end<0)break;comment=false;i=end+3;continue}
   if(line[i]==='\\'&&i+1<line.length){out+=line.slice(i,i+2);i+=2;continue}
   const code=line[i]==='`'&&codeSpan(line,i);if(code){out+=line.slice(i,code.end);i=code.end;continue}
   if(line.startsWith('<!--',i)){comment=true;i+=4;continue}
   out+=line[i++];
  }return out;
 }).join('\n');
}
function renderMarkdown(parent,value,depth=0){
 if(depth===0)value=hideMarkdownComments(value);
 if(depth>=24){parent.createEl('p',{text:String(value??'')}).style.whiteSpace='pre-wrap';return parent}
 const lines=String(value??'').split(/\r?\n/);let i=0;
 const tableAt=n=>{if(n+1>=lines.length)return null;const h=tableCells(lines[n]),s=tableCells(lines[n+1]);return h.separators&&h.cells.length===s.cells.length&&s.cells.every(c=>/^:?-{3,}:?$/.test(c))?{headers:h.cells,alignment:s.cells.map(c=>c.startsWith(':')?(c.endsWith(':')?'center':'left'):c.endsWith(':')?'right':'')}:null};
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue}
  const spec=tableAt(i);if(spec){
   const wrap=parent.createDiv();wrap.style.overflowX='auto';const table=wrap.createEl('table'),head=table.createEl('thead').createEl('tr');
   const row=(target,cells,tag)=>{for(let n=0;n<spec.headers.length;n++){const cell=markdownText(target,tag,cells[n]||'');if(spec.alignment[n])cell.style.textAlign=spec.alignment[n]}};
   row(head,spec.headers,'th');i+=2;const body=table.createEl('tbody');
   while(i<lines.length&&lines[i].trim()&&tableCells(lines[i]).separators)row(body.createEl('tr'),tableCells(lines[i++]).cells,'td');continue;
  }
  const fence=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);if(fence){
   const marker=fence[1],body=[];i++;while(i<lines.length&&!new RegExp('^ {0,3}'+marker[0]+'{'+marker.length+',}\\s*$').test(lines[i]))body.push(lines[i++]);if(i<lines.length)i++;
   const pre=parent.createEl('pre');pre.style.cssText='white-space:pre;overflow:auto;max-width:100%';pre.createEl('code',{text:body.join('\n')});continue;
  }
  const heading=/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);if(heading){markdownText(parent,'h'+heading[1].length,heading[2]);i++;continue}
  if(/^ {0,3}>/.test(lines[i])){const quote=[];while(i<lines.length&&/^ {0,3}>/.test(lines[i]))quote.push(lines[i++].replace(/^ {0,3}> ?/,''));renderMarkdown(parent.createEl('blockquote'),quote.join('\n'),depth+1);continue}
  const item=/^( *)([-+*]|\d+[.)])\s+(.+)$/.exec(lines[i]);if(item){
   const stack=[];while(i<lines.length){const m=/^( *)([-+*]|\d+[.)])\s+(.+)$/.exec(lines[i]);if(!m)break;
    const indent=m[1].length,ordered=/^\d/.test(m[2]),tag=ordered?'ol':'ul';while(stack.length&&stack.at(-1).indent>indent)stack.pop();
    if(!stack.length||stack.at(-1).indent<indent||stack.at(-1).tag!==tag){const host=stack.length?stack.at(-1).last||parent:parent,list=host.createEl(tag);if(ordered)list.setAttribute('start',String(parseInt(m[2],10)));stack.push({indent,tag,list})}
    stack.at(-1).last=markdownText(stack.at(-1).list,'li',m[3]);i++;
   }continue;
  }
  const paragraph=[];do{paragraph.push(lines[i++])}while(i<lines.length&&lines[i].trim()&&!tableAt(i)&&!/^ {0,3}(?:#{1,6}\s|>|`{3,}|~{3,}|[-+*]\s|\d+[.)]\s)/.test(lines[i]));markdownText(parent,'p',paragraph.join('\n')).style.whiteSpace='pre-wrap';
 }
 return parent;
}
module.exports={renderMarkdown};
