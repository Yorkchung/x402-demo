import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {config,publicConfig} from '../lib/config.mjs';
import {authorize,decode,encode,resourceInfo} from '../lib/payment.mjs';
import {createResource} from '../services/resource.mjs';
import {flightQuery,queryString} from '../lib/flights.mjs';
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const close=server=>new Promise(resolve=>server.close(resolve));
async function setup(c,dependencies){const resource=createResource(c,dependencies);c.resourceUrl=`http://127.0.0.1:${await listen(resource)}`;return {resource};}
test('mock flight flow: parameters, actual verify/settle bodies, errors and replay',async()=>{
 const c=config({X402_MODE:'mock',DEMO_LATENCY_MS:'0'}),{resource}=await setup(c),query=flightQuery();
 const get=(payment,id=crypto.randomUUID())=>fetch(`${c.resourceUrl}/api/flights?${queryString(query)}`,{headers:{'X-Demo-Trace-Id':id,...(payment?{'PAYMENT-SIGNATURE':encode(payment)}:{})}});
 try{
  const unpaid=await get();assert.equal(unpaid.status,402);const required=decode(unpaid.headers.get('PAYMENT-REQUIRED'));assert.equal(required.resource.url,resourceInfo(c,query).url);assert.equal(required.accepts[0].amount,'10000');
  const payment=authorize(c,'success',query),id=crypto.randomUUID(),paid=await get(payment,id);assert.equal(paid.status,200);const flights=await paid.json();assert.equal(flights.source,'fixture');assert.equal(flights.flights.length,2);assert.deepEqual(flights.query,query);
  const trace=await (await fetch(`${c.resourceUrl}/traces/${id}`)).json();assert.equal(trace[1].request.url,'resource://payment/verify');assert.equal(trace[2].request.url,'resource://payment/settle');assert.deepEqual(trace[1].request.body.paymentPayload,payment);assert.equal(trace[1].request.method,'CALL');assert.equal(trace[2].response.body.success,true);
  assert.equal((await get(payment)).status,402);assert.equal((await get(authorize(c,'invalid',query))).status,402);const failed=await get(authorize(c,'settlement',query));assert.equal(failed.status,502);assert.equal((await failed.json()).flights,undefined);
  const wrong=authorize(c,'success',query);wrong.accepted={...wrong.accepted,amount:'1'};assert.equal((await get(wrong)).status,402);
  const another=new URLSearchParams({...query,destination:'ICN'});assert.equal((await fetch(`${c.resourceUrl}/api/flights?${another}`,{headers:{'PAYMENT-SIGNATURE':encode(authorize(c,'success',query))}})).status,402);
  const concurrent=authorize(c,'success',query);assert.deepEqual((await Promise.all([get(concurrent),get(concurrent)])).map(x=>x.status).sort(),[200,402]);
 }finally{await close(resource);}
});
test('Resource payment service: upstream request, chain confirmation, cached settlement and restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'x402-ledger-'));const recipient='0x1111111111111111111111111111111111111111',payer='0x2222222222222222222222222222222222222222',transaction=`0x${'a'.repeat(64)}`;
 const c=config({X402_MODE:'testnet',X402_PAY_TO:recipient,SETTLEMENT_STATE_PATH:join(directory,'ledger.json')});
 let settles=0,verifyPayload;
 const dependencies={upstream:{async verify(payment,requirements){verifyPayload={payment,requirements};return {isValid:true,payer};},async settle(){settles++;return {success:true,payer,transaction,network:'eip155:84532'};}},chain:{async waitForTransactionReceipt(){return {status:'success',blockNumber:123n,logs:[{address:c.requirements.asset,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',`0x${payer.slice(2).padStart(64,'0')}`,`0x${recipient.slice(2).padStart(64,'0')}`],data:`0x${BigInt(c.requirements.amount).toString(16)}`} ]};}}};
 let {resource}=await setup(c,dependencies);const query=flightQuery(),payment={x402Version:2,resource:resourceInfo(c,query),accepted:c.requirements,payload:{signature:`0x${'b'.repeat(130)}`,authorization:{from:payer,to:recipient,value:c.requirements.amount,nonce:`0x${'c'.repeat(64)}`}}};
 const get=()=>fetch(`${c.resourceUrl}/api/flights?${queryString(query)}`,{headers:{'PAYMENT-SIGNATURE':encode(payment),'Connection':'close'}});
 try{let response=await get();assert.equal(response.status,200);const data=await response.json();assert.equal(data.receipt.confirmed,true);assert.equal(data.receipt.blockNumber,'123');assert.equal(verifyPayload.payment.payload.signature,payment.payload.signature);assert.equal(settles,1);
  response=await get();assert.equal(response.status,200);assert.equal(settles,1);
  const port=new URL(c.resourceUrl).port;await close(resource);resource=createResource(c,dependencies);await new Promise(resolve=>resource.listen(port,'127.0.0.1',resolve));assert.equal((await get()).status,200);assert.equal(settles,1);
 }finally{await close(resource);await rm(directory,{recursive:true});}
});
test('testnet incomplete receiver and invalid env prevent payments',()=>{
 assert.equal(config({X402_MODE:'testnet'}).paymentReady,false);assert.throws(()=>config({X402_MODE:'testnet',X402_NETWORK:'eip155:8453'}));assert.throws(()=>config({X402_AMOUNT:'0'}));assert.throws(()=>config({RESOURCE_SERVER_URL:'file:///tmp'}));assert.throws(()=>flightQuery(new URLSearchParams({origin:'TPE',destination:'TPE'})));
 const c=publicConfig(config());assert.equal('signingSecret' in c,false);assert.equal('serviceKey' in c,false);assert.equal('rpcUrl' in c,false);
});
test('official x402 SDK produces a recoverable EIP-3009 typed-data signature without broadcasting',async()=>{
 const [{x402Client},{ExactEvmScheme},{generatePrivateKey,privateKeyToAccount},{recoverTypedDataAddress}]=await Promise.all([import('@x402/core/client'),import('@x402/evm/exact/client'),import('viem/accounts'),import('viem')]);
 const c=config({X402_MODE:'testnet',X402_PAY_TO:'0x1111111111111111111111111111111111111111'}),account=privateKeyToAccount(generatePrivateKey());let typed;
 const signer={address:account.address,signTypedData:parameters=>{typed=parameters;return account.signTypedData(parameters);}};
 const client=new x402Client().register(c.requirements.network,new ExactEvmScheme(signer));
 const payment=await client.createPaymentPayload({x402Version:2,resource:resourceInfo(c),accepts:[c.requirements]});
 assert.equal(payment.payload.authorization.from,account.address);assert.equal(payment.payload.authorization.to,c.requirements.payTo);assert.equal(payment.payload.authorization.value,c.requirements.amount);assert.equal(typed.domain.chainId,84532);assert.equal(typed.domain.verifyingContract,c.requirements.asset);
 assert.equal((await recoverTypedDataAddress({...typed,signature:payment.payload.signature})).toLowerCase(),account.address.toLowerCase());
});
test('unconfirmed chain receipt blocks delivery and resubmission',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'x402-uncertain-'));const c=config({X402_MODE:'testnet',X402_PAY_TO:'0x1111111111111111111111111111111111111111',SETTLEMENT_STATE_PATH:join(directory,'ledger.json')});let submitted=0;
 const dependencies={upstream:{verify:async()=>({isValid:true}),settle:async()=>{submitted++;return {success:true,transaction:`0x${'d'.repeat(64)}`,network:c.requirements.network};}},chain:{waitForTransactionReceipt:async()=>({status:'success',blockNumber:1n,logs:[]})}};
 const {resource}=await setup(c,dependencies),query=flightQuery(),payment={x402Version:2,resource:resourceInfo(c,query),accepted:c.requirements,payload:{signature:'unique-invalid-transfer-test',authorization:{from:c.requirements.payTo}}};
 const get=()=>fetch(`${c.resourceUrl}/api/flights?${queryString(query)}`,{headers:{'PAYMENT-SIGNATURE':encode(payment),'Connection':'close'}});
 try{const response=await get(),body=await response.json();assert.equal(response.status,502);assert.equal(body.settlementState,'unknown');assert.equal(body.flights,undefined);assert.equal((await get()).status,409);assert.equal(submitted,1);}
 finally{await close(resource);await rm(directory,{recursive:true});}
});
