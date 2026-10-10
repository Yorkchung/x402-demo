'use client';
export default function FlowDiagram({stage,busy,live}){
 const client=live?95:160,resource=live?330:640,facilitator=570,chain=800;
 const color=phase=>stage>=phase?'#168066':'#bccbc4';
 function message(y,from,to,label,phase,dashed=false){const active=busy&&stage===phase-1;return <g className={active?'diagram-active':''}><line x1={from} y1={y} x2={to} y2={y} stroke={color(phase)} strokeWidth="2" strokeDasharray={dashed?'6 5':undefined}/><path d={to>from?`M ${to-9} ${y-5} L ${to} ${y} L ${to-9} ${y+5}`:`M ${to+9} ${y-5} L ${to} ${y} L ${to+9} ${y+5}`} fill="none" stroke={color(phase)} strokeWidth="2"/><text x={(from+to)/2} y={y-10} textAnchor="middle" fill={stage>=phase||active?'#203c34':'#83958c'}>{label}</text></g>;}
 return <section className="diagram"><div className="diagram-title"><h2>基本流程</h2><span>{live?'Base Sepolia · 真實結算':'Demo · 不上鏈'}</span></div><svg viewBox="0 0 900 415" role="img" aria-label="x402 流程圖：Client 查詢，收到 402，內部簽署授權，帶授權重試，Resource 驗證結算後回傳 200">{[[client,'Client'],[resource,'Resource'],...(live?[[facilitator,'Facilitator'],[chain,'Base Sepolia']]:[])].map(([x,label])=><g key={label}><rect x={x-75} y="15" width="150" height="42" rx="10" fill="#edf5f0" stroke="#ceded4"/><text x={x} y="41" textAnchor="middle" className="actor-label">{label}</text><line x1={x} y1="66" x2={x} y2="390" stroke="#dce7e0" strokeDasharray="4 5"/></g>)}
 {message(100,client,resource,'① GET 航班資料',1)}
 {message(145,resource,client,'② 402 · PAYMENT-REQUIRED',1,true)}
 <g><rect x={client-85} y="171" width="170" height="48" rx="8" fill={stage>=2?'#e5f4ec':'#f2f5f3'} stroke={color(2)}/><text x={client} y="190" textAnchor="middle">③ Client 內部授權</text><text x={client} y="207" textAnchor="middle" className="diagram-small">{live?'簽署 EIP-3009 · 未轉帳':'模擬授權 · 未結算'}</text></g>
 {message(260,client,resource,'④ GET + PAYMENT-SIGNATURE',3)}
 {live?<>{message(308,resource,facilitator,'⑤ verify / settle',3)}{message(347,facilitator,chain,'USDC 結算',3)}</>:<g><rect x={resource-100} y="291" width="200" height="45" rx="8" fill={stage>=3?'#e5f4ec':'#f2f5f3'} stroke={color(3)}/><text x={resource} y="309" textAnchor="middle">⑤ Resource 內部處理</text><text x={resource} y="326" textAnchor="middle" className="diagram-small">模擬 verify / settle</text></g>}
 {message(385,resource,client,'⑥ 200 · 航班 + PAYMENT-RESPONSE',3,true)}</svg><p>{stage===0?'查詢後先收到付款條件。':stage===1?'Client 建立授權，還沒有付款。':stage===2?(busy?'Resource 正在驗證與結算，GET 等待回應。':'授權已建立，重試 GET 後才會執行結算。'):'結算完成，Resource 回傳航班資料。'}</p></section>;
}
