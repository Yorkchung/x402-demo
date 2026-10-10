import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const paymentKey=payment=>createHash('sha256').update(JSON.stringify({signature:payment?.payload?.signature,accepted:payment?.accepted,resource:payment?.resource})).digest('hex');
export async function loadLedger(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw error;}}
export async function saveLedger(path,ledger){await mkdir(dirname(path),{recursive:true});const temporary=`${path}.tmp`;await writeFile(temporary,JSON.stringify(ledger,null,2),{mode:0o600});await rename(temporary,path);}
