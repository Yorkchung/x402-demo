export function config(env=process.env){
 const number=(key,fallback,min=1,max=65535)=>{const value=Number(env[key]??fallback);if(!Number.isInteger(value)||value<min||value>max)throw Error(`Invalid ${key}`);return value;};
 const webPort=number('WEB_PORT',3000),resourcePort=number('RESOURCE_PORT',3001);
 const origin=(key,fallback)=>{const url=new URL(env[key]||fallback);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error(`Invalid ${key}: use an HTTP origin`);return url.origin;};
 const mode=env.X402_MODE||'mock';if(!['mock','testnet'].includes(mode))throw Error('X402_MODE must be mock or testnet');
 const upstreamUrl=env.X402_UPSTREAM_FACILITATOR_URL||'https://x402.org/facilitator';const upstream=new URL(upstreamUrl);if(upstream.protocol!=='https:'||upstream.username||upstream.password||upstream.search||upstream.hash)throw Error('Upstream facilitator must use HTTPS');
 const amount=env.X402_AMOUNT||'10000';if(!/^[1-9]\d*$/.test(amount))throw Error('X402_AMOUNT must be positive atomic units');
 const address=(key,fallback)=>{const value=env[key]||fallback;if(!/^0x[0-9a-fA-F]{40}$/.test(value))throw Error(`Invalid ${key}`);return value;};
 const network=env.X402_NETWORK||'eip155:84532';if(!/^eip155:\d+$/.test(network))throw Error('This demo uses EVM network identifiers');
 if(mode==='testnet'&&(network!=='eip155:84532'||(env.X402_ASSET&&env.X402_ASSET.toLowerCase()!=='0x036cbd53842c5426634e7929541ec2318f3dcf7e')||number('X402_TOKEN_DECIMALS',6,0,18)!==6))throw Error('Real mode only supports Base Sepolia USDC');
 const payTo=address('X402_PAY_TO','0x000000000000000000000000000000000000dEaD');
 const paymentReady=mode==='mock'||(!/^0x0{40}$/i.test(payTo)&&payTo.toLowerCase()!=='0x000000000000000000000000000000000000dead');
 return {mode,paymentReady,upstreamUrl:upstreamUrl.replace(/\/$/,''),rpcUrl:env.BASE_SEPOLIA_RPC_URL||'https://sepolia.base.org',statePath:env.SETTLEMENT_STATE_PATH||'.data/settlements.json',webPort,resourcePort,webOrigin:origin('WEB_ORIGIN',`http://127.0.0.1:${webPort}`),resourceUrl:origin('RESOURCE_SERVER_URL',`http://127.0.0.1:${resourcePort}`),signingSecret:env.DEMO_SIGNING_SECRET||'local-demo-signing-secret-change-me',timeoutMs:number('SERVER_TIMEOUT_MS',60000,100,180000),latencyMs:number('DEMO_LATENCY_MS',350,0,5000),decimals:number('X402_TOKEN_DECIMALS',6,0,18),requirements:{scheme:'exact',network,amount,asset:address('X402_ASSET','0x036CbD53842c5426634e7929541eC2318f3dCF7e'),payTo,maxTimeoutSeconds:number('X402_TIMEOUT_SECONDS',60,1,3600),extra:{name:'USDC',version:'2'}}};
}
export function publicConfig(c){return {mode:c.mode,paymentReady:c.paymentReady,upstreamUrl:c.upstreamUrl,webOrigin:c.webOrigin,resourceUrl:c.resourceUrl,requirements:c.requirements,decimals:c.decimals};}
