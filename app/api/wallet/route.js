import {createPublicClient,http,erc20Abi} from 'viem';
import {baseSepolia} from '../../../lib/chain.mjs';
import {config} from '../../../lib/config.mjs';
export const dynamic='force-dynamic';
export async function GET(request){const address=new URL(request.url).searchParams.get('address');if(!/^0x[0-9a-fA-F]{40}$/.test(address||''))return Response.json({error:'Invalid wallet address'},{status:400});const c=config();try{const client=createPublicClient({chain:baseSepolia,transport:http(c.rpcUrl,{timeout:10000,retryCount:0})});const balance=await client.readContract({address:c.requirements.asset,abi:erc20Abi,functionName:'balanceOf',args:[address]});return Response.json({address,network:'eip155:84532',asset:c.requirements.asset,balance:balance.toString(),sufficient:balance>=BigInt(c.requirements.amount)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'無法從 Base Sepolia RPC 讀取 USDC 餘額'},{status:503});}}
