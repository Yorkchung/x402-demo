import Link from 'next/link';

export const metadata={title:'學習導引 | x402 流程教學'};
const resources=[
 ['付款流程','x402 官方文件','https://docs.x402.org/','先理解 Client、Resource、Facilitator，再看 402 與三個付款 header。'],
 ['簽署與轉帳','EIP-3009','https://eips.ethereum.org/EIPS/eip-3009','本 Demo 的測試網路徑：簽署授權，結算時才轉帳。'],
 ['其他代幣授權','Permit2','https://developers.uniswap.org/docs/protocols/permit2/overview','一次性簽章與限時 allowance；本 Demo 未使用。'],
 ['Agent 身分與信任','ERC-8004','https://eips.ethereum.org/EIPS/eip-8004','身分、聲譽與驗證登錄；註冊不等於付款權限。'],
 ['Agent 錢包權限','ERC-8196','https://eips.ethereum.org/EIPS/eip-8196','政策約束執行、委派與稽核；本 Demo 未實作。'],
 ['安全架構','OWASP Agentic AI','https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/','學習工具濫用、付款政策與不可信內容的風險。'],
];
export default function Learn(){return <main className="learning-page">
 <header><Link href="/">x402 <span>流程教學</span></Link><Link className="back-link" href="/">回到互動 Demo →</Link></header>
 <section className="intro"><h1>從一次 API 呼叫，讀懂付款</h1><p>先操作 Demo，再依想了解的問題選讀。完整教材與資源整理見 <a href="https://github.com/Yorkchung/x402-demo#agent-payment" target="_blank" rel="noreferrer">專案 README ↗</a>。</p></section>
 <section className="learning-section"><h2>先分清三件事</h2><ol><li><b>402 是 Resource 的回應。</b> Client 的 GET request 沒有狀態碼。</li><li><b>簽署不等於付款。</b> Client 建立授權，Resource 驗證並結算後才交付資料。</li><li><b>Facilitator 協助付款。</b> 它不是 API gateway；Demo 模式不會呼叫它。</li></ol><Link href="/">實際查看 request、授權與 response →</Link></section>
 <section className="learning-section"><h2>AI agent 付款怎麼做？</h2><p>Agent 也是 Client。模型提出工具需求，工具取得 402，獨立政策層檢查收款人與預算，再由受限簽署器授權付款。</p><div className="learning-flow">工具請求 → 402 報價 → 政策／預算檢查 → 簽署 → 帶授權重試 → 收據／對帳</div><p className="muted">這是延伸架構，本 Demo 沒有 AI agent。不要讓 API 回傳的文字改動付款政策；未知結算先查驗，不直接重付。</p></section>
 <section className="learning-section"><h2>依問題選讀</h2><div className="learning-resources">{resources.map(([topic,title,url,description])=><article key={title}><small>{topic}</small><h3><a href={url} target="_blank" rel="noreferrer">{title} ↗</a></h3><p>{description}</p></article>)}</div><p className="muted">ERC-8004、ERC-8196、Permit2 各處理不同層，並非 x402 必備組件。以原始規格與具體 SDK 的支援為準。</p></section>
 </main>;}
