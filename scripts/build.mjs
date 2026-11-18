import { cp, mkdir, writeFile, access, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'dist');
await mkdir(out,{recursive:true});
await cp(join(root,'public'),out,{recursive:true,force:true});

const {scramjetPath}=require('@mercuryworkshop/scramjet/path');
const {baremuxPath}=require('@mercuryworkshop/bare-mux/node');
const {libcurlPath}=require('@mercuryworkshop/libcurl-transport');
for (const [folder,source] of [
  ['scram',scramjetPath],
  ['baremux',baremuxPath],
  ['libcurl',libcurlPath],
]) {
  await cp(source,join(out,folder),{recursive:true,force:true});
}

const essential=[
  'index.html','assets/app.js','assets/style.css','assets/matrix.js',
  'sw.js','scram/scramjet.all.js','scram/scramjet.sync.js',
  'scram/scramjet.wasm.wasm','baremux/index.js','baremux/worker.js',
  'libcurl/index.mjs'
];
let missing=[];
for(const file of essential){
  try{
    await access(join(out,file));
    const s=await stat(join(out,file));
    if(!s.isFile()||s.size===0)throw Error('empty');
    console.log('OK', file, `${s.size} bytes`);
  }catch{missing.push(file);}
}
if(missing.length){
  console.error('Goop cannot deploy. Missing browser runtime files:',missing.join(', '));
  process.exitCode=1;
  throw Error('Goop build incomplete');
}
await writeFile(join(out,'.nojekyll'),'');
await writeFile(join(out,'runtime-health.json'),JSON.stringify({ready:true,files:essential},null,2));
console.log('Goop runtime complete — Vercel must publish dist/');
