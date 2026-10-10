import http from 'node:http';
export function forMode(c,mode){
 if(!['mock','testnet'].includes(mode))throw Error('Invalid payment mode');
 if(mode==='testnet'&&(c.requirements.network!=='eip155:84532'||c.requirements.asset.toLowerCase()!=='0x036cbd53842c5426634e7929541ec2318f3dcf7e'||c.decimals!==6))throw Error('Testnet requires Base Sepolia USDC');
 const receiver=c.requirements.payTo.toLowerCase();return {...c,mode,paymentReady:mode==='mock'||(!/^0x0{40}$/.test(receiver)&&receiver!=='0x000000000000000000000000000000000000dead')};
}
export function createDualServer(factory,c){
 const mock=factory(forMode(c,'mock'));let realConfig;try{realConfig=forMode(c,'testnet');}catch{/* Unsupported real configuration leaves Demo available. */}
 const testnet=realConfig?factory(realConfig):null;
 return http.createServer((req,res)=>{const mode=req.headers['x402-mode']||'mock';const server=mode==='mock'?mock:mode==='testnet'?testnet:null;if(!server){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unsupported payment mode'}));return;}server.emit('request',req,res);});
}
