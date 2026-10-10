import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {config} from '../lib/config.mjs';
try{loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const c=config();
if(c.webPort===c.resourcePort)throw Error('Client and Resource ports must be different');
const require=createRequire(import.meta.url),production=process.argv.includes('--production');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');},3000).unref();}
for(const [file,args] of [['services/resource.mjs',[]],[require.resolve('next/dist/bin/next'),[production?'start':'dev','--hostname','127.0.0.1','--port',String(c.webPort)]]]){
 const child=spawn(process.execPath,[file,...args],{stdio:'inherit',env:process.env});children.push(child);child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',(code,signal)=>{if(!stopping){console.error(`Server exited (${file}, ${code??signal})`);stop(code||1);}});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log(`\nClient: ${c.webOrigin}\nResource: ${c.resourceUrl}\nCtrl+C stops both servers.\n`);
