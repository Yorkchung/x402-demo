import {flightQuery,queryString} from './flights.mjs';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
export const encode=data=>Buffer.from(JSON.stringify(data)).toString('base64');
export const decode=value=>JSON.parse(Buffer.from(value,'base64').toString('utf8'));
export function resourceInfo(c,query=flightQuery()){return {url:`${c.resourceUrl}/api/flights?${queryString(query)}`,description:'Test flight search data (fixture)',mimeType:'application/json'};}
export function paymentRequired(c,error,query){return {x402Version:2,resource:resourceInfo(c,query),accepts:[c.requirements],...(error?{error}:{})};}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function sign(data,secret){return createHmac('sha256',secret).update(JSON.stringify(canonical(data))).digest('hex');}
export function authorize(c,scenario='success',query){
 if(!['success','invalid','settlement'].includes(scenario))throw Error('Unknown scenario');
 const authorization={nonce:randomUUID(),validUntil:Date.now()+c.requirements.maxTimeoutSeconds*1000,scenario,payer:'demo-wallet'};
 const signed={x402Version:2,resource:resourceInfo(c,query),accepted:c.requirements,authorization};
 return {x402Version:2,resource:signed.resource,accepted:signed.accepted,payload:{demo:true,authorization,signature:scenario==='invalid'?'0'.repeat(64):sign(signed,c.signingSecret)}};
}
export function validatePayment(c,payment,query){
 if(payment?.x402Version!==2||payment.payload?.demo!==true||!equal(payment.resource,resourceInfo(c,query))||!equal(payment.accepted,c.requirements))return 'Payment requirements do not match';
 const a=payment.payload.authorization;if(!a||typeof a.nonce!=='string'||!Number.isFinite(a.validUntil)||a.validUntil<=Date.now()||a.validUntil>Date.now()+c.requirements.maxTimeoutSeconds*1000+1000||!['success','invalid','settlement'].includes(a.scenario))return 'Authorization expired or malformed';
 const signature=payment.payload.signature;if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return 'Invalid demo signature';
 const expected=sign({x402Version:2,resource:payment.resource,accepted:payment.accepted,authorization:a},c.signingSecret);
 return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'))?null:'Invalid demo signature';
}
