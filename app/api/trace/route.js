import {config} from '../../../lib/config.mjs';
export const dynamic='force-dynamic';
export async function GET(request){
 const params=new URL(request.url).searchParams,id=params.get('id'),mode=params.get('mode')||'mock';
 if(!id||! /^[\w-]{1,80}$/.test(id))return Response.json({error:'Invalid trace ID'},{status:400});
 if(!['mock','testnet'].includes(mode))return Response.json({error:'Invalid mode'},{status:400});
 let records=[];
 try{
  const response=await fetch(`${config().resourceUrl}/traces/${id}`,{headers:{'X402-Mode':mode},cache:'no-store',signal:AbortSignal.timeout(2000)});
  if(response.ok)records=await response.json();
 }catch{/* Polling may fail temporarily while the payment request continues. */}
 return Response.json({records:records.sort((a,b)=>a.startedMs-b.startedMs)},{headers:{'Cache-Control':'no-store'}});
}
