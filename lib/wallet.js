export async function connectWallet(){
 if(!window.ethereum)throw Error('請在有 MetaMask 或其他 EVM 錢包的瀏覽器開啟網站。');
 const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
 try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x14a34'}]});}catch(error){if(error.code!==4902)throw error;await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:'0x14a34',chainName:'Base Sepolia',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://sepolia.base.org'],blockExplorerUrls:['https://sepolia.basescan.org']}]});await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x14a34'}]});}
 if(!accounts[0])throw Error('No wallet account');return accounts[0];
}
export async function signPayment(required,expected,onTypedData){
 const accepted=required.accepts?.[0];
 if(required.x402Version!==2||accepted?.network!=='eip155:84532'||accepted.scheme!=='exact'||JSON.stringify(accepted)!==JSON.stringify(expected))throw Error('付款條件不符合頁面上的 Base Sepolia USDC 定價，請重新查詢。');
 const [{x402Client},{ExactEvmScheme},{createWalletClient,custom},{baseSepolia}]=await Promise.all([import('@x402/core/client'),import('@x402/evm/exact/client'),import('viem'),import('./chain.mjs')]);
 const address=await connectWallet();
 const wallet=createWalletClient({account:address,chain:baseSepolia,transport:custom(window.ethereum)});
 let typedData;
 const signer={address,signTypedData:async parameters=>{typedData=parameters;onTypedData?.(parameters,address);return wallet.signTypedData({...parameters,account:address});}};
 const client=new x402Client().register('eip155:84532',new ExactEvmScheme(signer));
 const payment=await client.createPaymentPayload(required);
 return {payment,typedData,address};
}
