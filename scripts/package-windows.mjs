import {mkdir,copyFile,cp,access,readFile,writeFile} from 'node:fs/promises';
const out='release/QuickNote-Windows';
await access('dist/index.html');
await mkdir(out,{recursive:true});
await cp('dist',`${out}/app`,{recursive:true});
for(const name of ['QuickNote.cs','Install.cmd','Install.ps1','Disable-Autostart.cmd','Disable-Autostart.ps1','README.txt'])await copyFile(`windows/${name}`,`${out}/${name}`);
console.log(`Windows package ready: ${out}. Extract the package and run Install.cmd on Windows.`);

for (const name of ['Install.cmd','Disable-Autostart.cmd']) {
  const path=`${out}/${name}`;
  const text=await readFile(path,'utf8');
  await writeFile(path,text.replace(/\r?\n/g,'\r\n'));
}
