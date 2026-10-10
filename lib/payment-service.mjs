import {randomUUID} from 'node:crypto';
import {HTTPFacilitatorClient} from '@x402/core/server';
import {createPublicClient,http as rpcTransport} from 'viem';
import {baseSepolia} from './chain.mjs';
import {config} from './config.mjs';
import {validatePayment,equal} from './payment.mjs';
import {flightQuery} from './flights.mjs';
import {traceStore} from './trace.mjs';
import {paymentKey,loadLedger,saveLedger} from './settlement.mjs';
import {delay} from '../services/common.mjs';
export function createPaymentService(c=config(),dependencies={}){
 const nonces=new Map(),traces=dependencies.traces||traceStore(),locks=new Set();
 const upstream=dependencies.upstream||new HTTPFacilitatorClient({url:c.upstreamUrl,timeoutMs:c.timeoutMs});
 const chain=dependencies.chain||createPublicClient({chain:baseSepolia,transport:rpcTransport(c.rpcUrl)});
 const ledgerPromise=c.mode==='testnet'?loadLedger(c.statePath):Promise.resolve({});
 let writes=Promise.resolve();
 async function persist(ledger){writes=writes.then(()=>saveLedger(c.statePath,ledger));return writes;}
 const respond=(status,body)=>({status,body});
 return async function execute(path,body,id){
  const {paymentPayload:payment,paymentRequirements:requirements}=body;
  if(!equal(requirements,c.requirements)||payment?.x402Version!==2||!equal(payment.accepted,requirements))return respond(400,{error:'Requirements mismatch'});
  let query;try{const resource=new URL(payment.resource.url);if(resource.origin!==c.resourceUrl||resource.pathname!=='/api/flights')throw Error();query=flightQuery(resource.searchParams);}catch{return respond(400,{error:'Invalid resource'});}
  if(c.mode==='mock'){
   await delay(c.latencyMs);const error=validatePayment(c,payment,query);if(error)return respond(200,{isValid:false,success:false,errorReason:error});
   const auth=payment.payload.authorization;for(const [nonce,item] of nonces)if(item.expires<Date.now())nonces.delete(nonce);
   if(path==='/verify'){if(nonces.has(auth.nonce))return respond(200,{isValid:false,errorReason:'Authorization already used'});nonces.set(auth.nonce,{expires:auth.validUntil,state:'verified',payment,traceId:id});return respond(200,{isValid:true,payer:auth.payer,mode:'mock',confirmed:false});}
   const item=nonces.get(auth.nonce);if(!item||item.state!=='verified'||item.traceId!==id||!equal(item.payment,payment))return respond(200,{success:false,errorReason:'Authorization not verified for this request'});
   item.state='used';if(auth.scenario==='settlement')return respond(200,{success:false,errorReason:'Simulated settlement failed'});
   return respond(200,{success:true,transaction:`demo-${randomUUID()}`,network:c.requirements.network,payer:auth.payer,mode:'mock',confirmed:false});
  }
  if(!c.paymentReady||payment.payload?.demo)return respond(400,{error:'Testnet mode requires a real wallet signature and configured receiver'});
  const key=paymentKey(payment);let ledger,record,ownsLock=false;
  try{ledger=await ledgerPromise;const previous=ledger[key];
   if(previous?.state==='confirmed')return respond(200,path==='/verify'?{isValid:true,payer:previous.receipt.payer,cached:true}:previous.receipt);
   if(previous||locks.has(key))return respond(409,{error:'這份授權的結算待確認。請查詢既有交易，勿重新簽署付款。',settlementState:'unknown',transaction:previous?.transaction});
   record=traces.start(id,'Resource','Facilitator','POST',`${c.upstreamUrl}${path}`,body,{'Content-Type':'application/json'});
   if(path==='/verify'){const result=await upstream.verify(payment,requirements);traces.finish(record,200,result);return respond(200,result);}
   locks.add(key);ownsLock=true;ledger[key]={state:'submitted',time:new Date().toISOString()};await persist(ledger);
   const result=await upstream.settle(payment,requirements);traces.finish(record,200,result);
   if(!result.success){ledger[key]={state:'unconfirmed',receipt:result,transaction:result.transaction,time:new Date().toISOString()};await persist(ledger);return respond(200,{...result,settlementState:'unknown'});}
   if(!/^0x[a-fA-F0-9]{64}$/.test(result.transaction)||result.network!=='eip155:84532')throw Error('Facilitator returned invalid chain receipt');
   ledger[key].transaction=result.transaction;await persist(ledger);
   const chainRecord=traces.start(id,'Resource','Chain','JSON-RPC',c.rpcUrl==='https://sepolia.base.org'?c.rpcUrl:'rpc://base-sepolia (private provider URL hidden)',{method:'eth_getTransactionReceipt',params:[result.transaction]});
   try{const receipt=await chain.waitForTransactionReceipt({hash:result.transaction,timeout:c.timeoutMs,confirmations:1});
    const transfer=receipt.logs.some(log=>{if(log.address.toLowerCase()!==requirements.asset.toLowerCase())return false;return log.topics[0]=== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'&&log.topics[1]?.slice(-40).toLowerCase()===payment.payload.authorization.from.slice(2).toLowerCase()&&log.topics[2]?.slice(-40).toLowerCase()===requirements.payTo.slice(2).toLowerCase()&&BigInt(log.data)===BigInt(requirements.amount);});
    if(receipt.status!=='success'||!transfer)throw Error('鏈上交易沒有符合的 USDC Transfer');
    const confirmed={...result,mode:'testnet',confirmed:true,blockNumber:receipt.blockNumber.toString(),explorerUrl:`https://sepolia.basescan.org/tx/${result.transaction}`};
    traces.finish(chainRecord,200,{transactionHash:result.transaction,status:receipt.status,blockNumber:confirmed.blockNumber,matchingUsdcTransfer:true});ledger[key]={state:'confirmed',receipt:confirmed};await persist(ledger);return respond(200,confirmed);
   }catch(error){const message=error.message==='鏈上交易沒有符合的 USDC Transfer'?error.message:'Base Sepolia RPC confirmation unavailable';traces.finish(chainRecord,503,{error:message});throw Error(message);}
  }catch(error){if(record?.state==='pending')traces.finish(record,503,{error:error.message});return respond(503,{error:error.message,settlementState:path==='/settle'?'unknown':undefined,transaction:ledger?.[key]?.transaction});}
  finally{if(ownsLock)locks.delete(key);}
 };
}
