import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../lib/config.mjs';
import {forMode,createDualServer} from '../lib/modes.mjs';
import {createResource} from '../services/resource.mjs';
import {authorize,encode} from '../lib/payment.mjs';
import {flightQuery,queryString} from '../lib/flights.mjs';
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
test('Demo works with testnet env and stays isolated from real settlement',async()=>{
 const c=config({X402_MODE:'testnet',DEMO_LATENCY_MS:'0'});
 const resource=createDualServer(createResource,c);const resourceUrl=`http://127.0.0.1:${await listen(resource)}`;
 const query=flightQuery(),url=`${resourceUrl}/api/flights?${queryString(query)}`;
 try{
  assert.equal((await fetch(url)).status,402);
  const payment=authorize(forMode(c,'mock'),'success',query);
  const response=await fetch(url,{headers:{'X402-Mode':'mock','PAYMENT-SIGNATURE':encode(payment)}});
  assert.equal(response.status,200);assert.equal((await response.json()).receipt.confirmed,false);
  assert.notEqual((await fetch(url,{headers:{'X402-Mode':'testnet','PAYMENT-SIGNATURE':encode(payment)}})).status,200);
  assert.equal((await fetch(url,{headers:{'X402-Mode':'invalid'}})).status,400);
 }finally{await close(resource);}
});
