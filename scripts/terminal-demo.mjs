import {once} from 'node:events';
import {createResource} from '../services/resource.mjs';
import {config} from '../lib/config.mjs';
import {authorize,decode,encode} from '../lib/payment.mjs';

// An isolated Demo server: real local HTTP, no wallet or blockchain calls.
const c=config({DEMO_LATENCY_MS:'0',X402_TIMEOUT_SECONDS:'300'});
const server=createResource(c);
server.listen(0,'127.0.0.1');
await once(server,'listening');
c.resourceUrl=`http://127.0.0.1:${server.address().port}`;
const query={origin:'TPE',destination:'NRT',date:'2026-10-10'};
const url=`${c.resourceUrl}/api/flights?${new URLSearchParams(query)}`;
const plain=process.argv.includes('--plain');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pretty=value=>JSON.stringify(value,null,2);
const compact=value=>'{\n'+Object.entries(value).map(([key,item])=>`  "${key}": ${JSON.stringify(item)}`).join(',\n')+'\n}';
async function page(number,title,content){
 if(!plain)process.stdout.write('\x1b[2J\x1b[H');
 console.log(`x402 / FLIGHT DEMO                         ${number} / 6`);
 console.log('Local HTTP | simulated payment | no blockchain\n');
 console.log(`${title}\n${'-'.repeat(72)}\n${content}`);
 if(!plain)await pause(5000);
}
try{
 await page(1,'Client -> Resource | REQUEST',`GET ${url}\n\nQuery:\n${pretty(query)}\n\nNo payment authorization yet.\nRequests do not have HTTP status codes.`);
 const first=await fetch(url),required=await first.json();
 if(first.status!==402)throw Error(`Expected 402, got ${first.status}`);
 await page(2,'Resource -> Client | RESPONSE',`HTTP ${first.status} Payment Required\n\nPAYMENT-REQUIRED (base64 decoded):\n${pretty(decode(first.headers.get('PAYMENT-REQUIRED')))}\n\nNo flight data is delivered.`);
 const payment=authorize(c,'success',query);
 await page(3,'Client | INTERNAL AUTHORIZATION',`Demo signature (not an HTTP request):\n${pretty(payment.payload)}\n\nThe resource and accepted price are bound to this authorization.\nAuthorization created; payment is not settled yet.\nTestnet mode uses wallet EIP-3009 signing instead.`);
 const signature=encode(payment),traceId=crypto.randomUUID();
 await page(4,'Client -> Resource | REQUEST',`GET ${url}\n\nPAYMENT-SIGNATURE (base64 decoded):\n${compact(payment)}\n\nThis GET waits for verification and settlement.`);
 const paid=await fetch(url,{headers:{'PAYMENT-SIGNATURE':signature,'X-Demo-Trace-Id':traceId}});
 const result=await paid.json();
 if(paid.status!==200)throw Error(`Expected 200: ${JSON.stringify(result)}`);
 const traces=await (await fetch(`${c.resourceUrl}/traces/${traceId}`)).json();
 const operations=traces.filter(record=>record.request.method==='CALL');
 await page(5,'Resource | INTERNAL VERIFY / SETTLE',operations.map(record=>`${record.request.url}\nResult:\n${pretty(record.response.body)}`).join('\n\n')+'\n\nDemo: no external Facilitator or chain RPC.\nThe Client receives 200 only after both operations succeed.');
 await page(6,'Resource -> Client | RESPONSE',`HTTP ${paid.status} OK\n\nPAYMENT-RESPONSE (base64 decoded):\n${pretty(decode(paid.headers.get('PAYMENT-RESPONSE')))}\n\nFlight data (selected fields):\n${pretty(result.flights.map(({flightNumber,origin,destination,departure})=>({flightNumber,origin,destination,departure})))}\n\nconfirmed: false = Demo receipt, no onchain transfer.`);
}finally{
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
