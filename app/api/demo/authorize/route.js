import {forMode} from '../../../../lib/modes.mjs';
import {config} from '../../../../lib/config.mjs';
import {authorize} from '../../../../lib/payment.mjs';
import {flightQuery} from '../../../../lib/flights.mjs';
export async function POST(request){const mode=request.headers.get('X402-Mode')||'mock';const c=forMode(config(),'mock');if(mode!=='mock')return Response.json({error:'測試網模式由瀏覽器錢包簽署，Demo signer 已停用。'},{status:403});try{if(Number(request.headers.get('content-length'))>4096)return Response.json({error:'Body too large'},{status:413});const {scenario,query}=await request.json();return Response.json({payment:authorize(c,scenario,flightQuery(new URLSearchParams(query)))},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Invalid signing request'},{status:400});}}
