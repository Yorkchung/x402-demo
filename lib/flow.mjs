export const roleName=role=>({Client:'Client',Next:'Client',Resource:'Resource（航班 API）',Facilitator:'公開 Facilitator',Chain:'Base Sepolia'}[role]||role);
export function describeCall(record,mode='testnet'){
 const method=record.request.method,url=record.request.url;
 if(method==='SIGN')return {title:'Client 簽署 EIP-3009 授權',request:'把收款人、金額與有效期限交給錢包簽署。此時還沒有轉帳。',response:'取得付款簽章，下一步才能交給 Resource 驗證。'};
 if(method==='JSON-RPC')return {title:'確認鏈上交易',request:'依 transaction hash 查詢收據，確認 USDC Transfer 的付款人、收款人與金額。',response:'收據確認成功，Resource 才能交付航班。這是 RPC 查詢，不是新的付款。'};
 if(url.includes('/api/demo/authorize'))return {title:'Client 建立 Demo 授權',request:'建立本機模擬簽章，方便學習付款流程。',response:'已取得 Demo 授權，尚未結算。'};
 if(url.endsWith('/verify'))return {title:'驗證付款授權',request:'送出 paymentPayload 與 paymentRequirements，檢查授權是否符合條件。',response:'檢查 body.isValid；HTTP 200 只代表 API 正常回應，還沒有結算。'};
 if(url.endsWith('/settle'))return {title:'執行付款結算',request:'提交已驗證授權。測試網由公開 Facilitator 送出鏈上交易；Demo 只模擬。',response:mode==='mock'?'檢查 body.success 與 Demo 收據。模擬成功後即可回傳航班；不會查詢鏈上收據。':'檢查 body.success 與 transaction。得到結算結果後，還需確認鏈上收據。'};
 const paid=Boolean(record.request.headers?.['PAYMENT-SIGNATURE']);
 return {title:paid?'帶授權重新查詢':'第一次查詢航班',request:paid?'GET 加上 PAYMENT-SIGNATURE。請求保持等待，直到內部驗證與結算完成。':'GET 帶出發、抵達與日期，尚未提供付款授權。',response:record.response?.status===402?'402 + PAYMENT-REQUIRED：回傳價格、收款人、網路與付款條件，不交付航班。':record.response?.status===200?'200 + 航班資料 + PAYMENT-RESPONSE：付款完成後才交付資源。':'回傳執行結果；失敗時不交付航班。'};
}
export function flowEvents(records){
 return records.flatMap(record=>{
  const internal=record.from===record.to&&(record.from==='Client'||record.request.method==='CALL');
  if(internal)return [{id:`${record.id}-operation`,record,kind:record.response?'response':'request',time:record.startedMs,internal:true}];
  return [{id:`${record.id}-request`,record,kind:'request',time:record.startedMs},...(record.response?[{id:`${record.id}-response`,record,kind:'response',time:record.finishedMs??record.startedMs+(record.durationMs||0)}]:[])];
 }).sort((a,b)=>a.time-b.time);
}

// Group browser, Next.js and signing under Client; retain Resource HTTP payloads.
export function clientRecords(records){
 return records.filter(record=>!(record.from==='Client'&&record.to==='Next'&&record.request.url.includes('/api/resource'))).map(record=>({...record,from:['Client','Next'].includes(record.from)?'Client':record.from,to:['Client','Next'].includes(record.to)?'Client':record.to}));
}
