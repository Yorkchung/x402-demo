import test from 'node:test';
import assert from 'node:assert/strict';
import {flowEvents,describeCall} from '../lib/flow.mjs';
test('request and response events preserve nested verify/settle order',()=>{
 const record=(id,start,end,url)=>({id,startedMs:start,finishedMs:end,request:{method:'POST',url,headers:{}},response:{status:200,body:{}}});
 const retry=record('retry',1,10,'/api/resource');retry.request.headers['PAYMENT-SIGNATURE']='signed';
 const verify=record('verify',2,4,'/verify'),settle=record('settle',5,9,'/settle');
 assert.deepEqual(flowEvents([retry,verify,settle]).map(e=>e.id),['retry-request','verify-request','verify-response','settle-request','settle-response','retry-response']);
 assert.match(describeCall(verify).response,/isValid/);
 assert.match(describeCall(retry).response,/航班資料/);
 assert.equal(flowEvents([{...retry,response:undefined}]).length,1);
});
test('Client signing is one internal operation without a Client-to-Client HTTP exchange',()=>{
 const signing={id:'sign',from:'Client',to:'Client',startedMs:1,finishedMs:2,request:{method:'SIGN',url:'injected-wallet://signTypedData'},response:{status:200,body:{paymentPayload:{}}}};
 const events=flowEvents([signing]);assert.equal(events.length,1);assert.equal(events[0].internal,true);assert.equal(events[0].kind,'response');
});
