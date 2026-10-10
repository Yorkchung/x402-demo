import {createDualServer} from '../lib/modes.mjs';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {config} from '../lib/config.mjs';
import {encode,decode,paymentRequired,equal,resourceInfo} from '../lib/payment.mjs';
import {flightQuery,flightData} from '../lib/flights.mjs';
import {traceStore,traceId} from '../lib/trace.mjs';
import {createPaymentService} from '../lib/payment-service.mjs';
import {json,dashboard} from './common.mjs';
export function createResource(c=config(),dependencies={}){
 const traces=traceStore(),executePayment=createPaymentService(c,{...dependencies,traces});
 return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  if(req.method==='GET'&&path==='/')return dashboard(res,'Resource Server',c.resourcePort,['GET /api/flights?origin=TPE&destination=NRT&date=2026-10-10','內部 verify / settle'],c.mode);
  if(req.method==='GET'&&path==='/health')return json(res,200,{role:'Resource',mode:c.mode,paymentReady:c.paymentReady,port:c.resourcePort});
  if(req.method==='GET'&&path==='/events')return json(res,200,traces.all());
  if(req.method==='GET'&&path.startsWith('/traces/'))return json(res,200,traces.get(path.slice(8)));
  if(req.method!=='GET'||path!=='/api/flights')return json(res,404,{error:'Not found'});
  let query;try{query=flightQuery(url.searchParams);}catch(error){return json(res,400,{error:error.message});}
  const id=traceId(req),required=paymentRequired(c,undefined,query),resource=resourceInfo(c,query);
  const incoming=traces.start(id,'Next','Resource','GET',resource.url,undefined,{'X-Demo-Trace-Id':id,...(req.headers['payment-signature']?{'PAYMENT-SIGNATURE':req.headers['payment-signature']}:{})});
  const respond=(status,body,headers={})=>{traces.finish(incoming,status,body,headers);json(res,status,body,{'X-Demo-Trace-Id':id,...headers});};
  if(!c.paymentReady)return respond(503,{error:'請先在 .env.local 設定 X402_PAY_TO 為你的 Base Sepolia 收款地址。'});
  if(!req.headers['payment-signature'])return respond(402,required,{'PAYMENT-REQUIRED':encode(required)});
  let payment;try{payment=decode(req.headers['payment-signature']);}catch{return respond(400,{error:'Malformed PAYMENT-SIGNATURE'});}
  if(payment.x402Version!==2||!equal(payment.accepted,c.requirements)||!equal(payment.resource,resource))return respond(402,{...required,error:'付款條件或查詢資源不一致'},{'PAYMENT-REQUIRED':encode(required)});
  const body={x402Version:2,paymentPayload:payment,paymentRequirements:c.requirements};
  let phase='verify';
  async function invoke(path){const entry=traces.start(id,'Resource','Resource','CALL',`resource://payment/${path}`,body);const result=await executePayment(`/${path}`,body,id);traces.finish(entry,result.status,result.body);return result;}
  try{
   const verified=await invoke('verify');if(verified.status!==200)return respond(verified.status===409?409:503,{error:verified.body.error||'Verification unavailable',settlementState:verified.body.settlementState,transaction:verified.body.transaction});
   if(!verified.body.isValid)return respond(402,{...required,error:verified.body.invalidReason||verified.body.errorReason},{'PAYMENT-REQUIRED':encode(required)});
   const data=flightData(query);
   phase='settle';const settlement=await invoke('settle');
   if(settlement.status!==200||!settlement.body.success)return respond(settlement.status===409?409:502,{error:settlement.body.errorReason||settlement.body.error||'Settlement failed',settlementState:settlement.body.settlementState,transaction:settlement.body.transaction});
   const receipt=settlement.body;return respond(200,{...data,paymentMode:c.mode,receipt},{'PAYMENT-RESPONSE':encode(receipt)});
  }catch{return respond(503,{error:'Payment processing unavailable or timed out',phase,settlementState:phase==='settle'?'unknown':undefined});}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const c=config();createDualServer(createResource,c).listen(c.resourcePort,'127.0.0.1',()=>console.log(`Resource: http://127.0.0.1:${c.resourcePort} (Demo + Base Sepolia)`));}
