/**
 * Generate and download the HTML report.
 * @param {object} data - The full report data.
 */
export function exportHtmlReport(data) {
  const sanitizeIssues = (issues) => issues.map(item => {
    const { relatedPersonnel, bestSuggestionRawText, bestSuggester, ...rest } = item;
    return rest;
  });

  const cleanData = {
    ...data,
    criticalIssues: sanitizeIssues(data.criticalIssues),
    secondaryIssues: sanitizeIssues(data.secondaryIssues)
  };

  const jsonSnapshot = JSON.stringify(data);

  const esc = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  const critLen = cleanData.criticalIssues ? cleanData.criticalIssues.length : 0;
  const secLen = cleanData.secondaryIssues ? cleanData.secondaryIssues.length : 0;
  const aiLen = cleanData.aiAnalysis ? cleanData.aiAnalysis.length : 0;

  const issueRows = (issues, color) => {
    if (!issues || issues.length === 0) return '<tr><td colspan="5" class="td" style="text-align:center;color:var(--text3);padding:32px;font-style:italic">尚無資料</td></tr>';
    return issues.map(item => {
      const sgs = Array.isArray(item.suggestions) && item.suggestions.length > 0
        ? item.suggestions
        : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }];
      const rs = sgs.length;
      const isSO = item.isSuggestionOnly || item.issue === '無使用者體驗' || item.issue === '無';
      const issDisp = isSO ? '無' : esc(item.issue);
      const cntDisp = isSO ? '' : item.count;
      return sgs.map((sg, si) => {
        const left = si === 0 ? `<td rowspan="${rs}" class="td td-id ${color}">${esc(item.id)}</td><td rowspan="${rs}" class="td td-issue">${issDisp}</td><td rowspan="${rs}" class="td td-count">${cntDisp}</td>` : '';
        return `<tr>${left}<td class="td td-sid">${esc(sg.suggestionId)}</td><td class="td td-sug">${esc(sg.suggestion)}</td></tr>`;
      }).join('');
    }).join('');
  };

  const aiCards = cleanData.aiAnalysis.map(item => {
    const imgHtml = item.imageUrl
      ? `<img src="${item.imageUrl}" onclick="openLB(this.src)" />`
      : '<div class="no-img">尚無圖片</div>';
    const obsList = Array.isArray(item.observation)
      ? item.observation.map(p => `<li>${esc(p)}</li>`).join('') : '';
    const sugList = Array.isArray(item.suggestion)
      ? item.suggestion.map(p => `<li>${esc(p)}</li>`).join('') : '';
    return `<div class="ai-card"><div class="ai-card-img"><span class="ai-label">AI 辨識分析</span><div class="ai-img-box">${imgHtml}</div></div><div class="ai-card-text"><div class="ai-tag-row"><span class="ai-tag">${esc(item.id)}</span><span class="ai-tag-title">AI 觀察與建議</span></div><div class="ai-block obs"><div class="ai-block-title obs">👁 觀察 (Observation)</div><ul class="ai-list obs">${obsList}</ul></div><div class="ai-block sug"><div class="ai-block-title sug">💡 建議 (Suggestion)</div><ul class="ai-list sug">${sugList}</ul></div></div></div>`;
  }).join('');

  const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bg:#06080f;--bg2:#0c1018;--surface:#121826;--surface2:#1a2236;--surface3:#243046;--border:rgba(99,130,190,0.12);--border2:rgba(99,130,190,0.2);--text:#e8edf5;--text2:#8fa4c4;--text3:#5a6f8e;--green:#22c55e;--green-glow:rgba(34,197,94,0.15);--blue:#3b82f6;--blue-glow:rgba(59,130,246,0.12);--orange:#f97316;--orange-glow:rgba(249,115,22,0.12);--purple:#a855f7;--purple-glow:rgba(168,85,247,0.12);--red:#ef4444;--red-glow:rgba(239,68,68,0.12);--cyan:#06b6d4;--radius:16px;--radius-sm:10px;--font:'Noto Sans TC',system-ui,-apple-system,sans-serif;--mono:'JetBrains Mono',monospace}html{scroll-behavior:smooth;font-size:15px}body{background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.75;min-height:100vh;overflow-x:hidden}.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}.ambient::before{content:'';position:absolute;width:800px;height:800px;top:-200px;left:-200px;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 60%);animation:float 20s ease-in-out infinite}.ambient::after{content:'';position:absolute;width:600px;height:600px;bottom:-100px;right:-100px;background:radial-gradient(circle,rgba(168,85,247,0.05),transparent 60%);animation:float 25s ease-in-out infinite reverse}@keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,40px)}}.container{position:relative;z-index:1;max-width:1040px;margin:0 auto;padding:48px 28px 80px}@media(max-width:768px){.container{padding:24px 16px 60px}}.hero{margin-bottom:48px;position:relative;padding:40px 0 32px}.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--border2),var(--blue),var(--border2),transparent)}.hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--cyan);background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.15);padding:5px 14px;border-radius:20px;margin-bottom:16px;letter-spacing:0.03em;text-transform:uppercase}.hero h1{font-size:clamp(1.6rem,4.5vw,2.4rem);font-weight:900;color:#fff;letter-spacing:-0.03em;margin-bottom:12px;line-height:1.3}.hero-meta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.meta-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);background:var(--surface);padding:6px 14px;border-radius:20px;border:1px solid var(--border)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:48px}.stat-card{background:linear-gradient(135deg,var(--surface),var(--surface2));border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}.stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.3)}.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--radius) var(--radius) 0 0}.stat-card.green::before{background:linear-gradient(90deg,var(--green),transparent)}.stat-card.blue::before{background:linear-gradient(90deg,var(--blue),transparent)}.stat-card.orange::before{background:linear-gradient(90deg,var(--orange),transparent)}.stat-card.purple::before{background:linear-gradient(90deg,var(--purple),transparent)}.stat-label{font-size:12px;color:var(--text3);font-weight:500;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em}.stat-value{font-size:28px;font-weight:800;color:#fff}.stat-value span{font-size:14px;font-weight:500;color:var(--text3);margin-left:4px}.section{margin-bottom:48px}.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)}.section-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}.section-icon.green{background:var(--green-glow);color:var(--green)}.section-icon.blue{background:var(--blue-glow);color:var(--blue)}.section-icon.orange{background:var(--orange-glow);color:var(--orange)}.section-title{font-size:18px;font-weight:700;color:#fff;flex:1}.section-count{font-size:12px;color:var(--text3);background:var(--surface2);padding:3px 10px;border-radius:12px;border:1px solid var(--border)}.summary-card{background:linear-gradient(135deg,var(--surface),rgba(59,130,246,0.03));border:1px solid var(--border2);border-radius:var(--radius);overflow:hidden;margin-bottom:48px;box-shadow:0 4px 32px rgba(0,0,0,0.2)}.summary-head{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(59,130,246,0.06),rgba(168,85,247,0.04));border-bottom:1px solid var(--border)}.summary-head h3{font-size:15px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}.impact{font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:var(--red-glow);color:var(--red);border:1px solid rgba(239,68,68,0.2)}.summary-body{padding:24px;font-size:15px;color:var(--text);line-height:1.9;white-space:pre-wrap}.table-wrap{border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);box-shadow:0 2px 16px rgba(0,0,0,0.15)}table{width:100%;border-collapse:collapse;font-size:13px}thead{background:linear-gradient(135deg,var(--surface2),var(--surface3))}thead th{padding:14px 18px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);border-right:1px solid var(--border)}thead th:last-child{border-right:none}tbody{background:var(--surface)}tbody tr{border-bottom:1px solid var(--border);transition:background .2s}tbody tr:hover{background:rgba(59,130,246,0.03)}tbody tr:last-child{border-bottom:none}.td{padding:14px 18px;vertical-align:top;border-right:1px solid var(--border)}.td:last-child{border-right:none}.td-id{text-align:center;font-family:var(--mono);font-weight:500;font-size:13px;width:64px}.td-id.green{color:var(--green)}.td-id.blue{color:var(--blue)}.td-issue{color:var(--text);line-height:1.75;white-space:pre-wrap;min-width:200px}.td-count{text-align:center;font-weight:800;color:#fff;width:56px;font-size:16px}.td-sid{text-align:center;font-family:var(--mono);color:var(--purple);font-size:13px;width:64px}.td-sug{color:var(--text2);line-height:1.75;white-space:pre-wrap}@media(max-width:768px){.table-wrap{overflow-x:auto}table{min-width:680px}}.ai-wrap{background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);padding:28px}.ai-card{display:flex;gap:28px;padding:24px 0;border-bottom:1px solid var(--border)}.ai-card:first-child{padding-top:0}.ai-card:last-child{border-bottom:none;padding-bottom:0}@media(max-width:768px){.ai-card{flex-direction:column}}.ai-card-img{flex:1;display:flex;flex-direction:column;gap:8px}.ai-card-text{flex:1;display:flex;flex-direction:column;gap:14px}.ai-label{font-size:11px;color:var(--text3);font-weight:500;text-transform:uppercase;letter-spacing:0.04em}.ai-img-box{border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border);background:#000;min-height:140px;display:flex;align-items:center;justify-content:center;position:relative}.ai-img-box img{width:100%;display:block;cursor:pointer;transition:opacity .2s,transform .3s}.ai-img-box img:hover{opacity:.9;transform:scale(1.01)}.ai-img-box .no-img{color:var(--text3);font-size:12px;padding:32px;text-align:center}.ai-tag-row{display:flex;align-items:center;gap:10px}.ai-tag{font-size:11px;font-family:var(--mono);padding:4px 12px;border-radius:8px;background:var(--orange-glow);color:var(--orange);border:1px solid rgba(249,115,22,0.2);font-weight:500}.ai-tag-title{font-size:14px;font-weight:700;color:var(--orange)}.ai-block{padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border)}.ai-block.obs{background:rgba(59,130,246,0.03);border-color:rgba(59,130,246,0.1)}.ai-block.sug{background:rgba(168,85,247,0.03);border-color:rgba(168,85,247,0.1)}.ai-block-title{font-size:12px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:6px}.ai-block-title.obs{color:var(--blue)}.ai-block-title.sug{color:var(--purple)}.ai-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.ai-list li{font-size:13px;color:var(--text);line-height:1.7;padding-left:16px;position:relative}.ai-list li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:50%}.ai-list.obs li::before{background:var(--blue)}.ai-list.sug li::before{background:var(--purple)}.footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--border);text-align:center;color:var(--text3);font-size:12px}#lb{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);justify-content:center;align-items:center;cursor:pointer}#lb.open{display:flex}#lb-x{position:absolute;top:20px;right:28px;background:none;border:none;color:#fff;font-size:36px;cursor:pointer;opacity:.6;transition:opacity .2s;z-index:10000;line-height:1}#lb-x:hover{opacity:1}#lb img{max-width:92vw;max-height:90vh;object-fit:contain;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,0.6)}@media print{.ambient,.footer{display:none}body{background:#fff;color:#222}.container{padding:20px}.hero::after{display:none}.stat-card,.summary-card,.table-wrap,.ai-wrap{box-shadow:none;border-color:#ddd}.stat-card::before{display:none}thead{background:#f5f5f5}tbody tr:hover{background:none}}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:4px}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cleanData.meta.title)}</title>
<meta name="description" content="UX Report - ${esc(cleanData.meta.title)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="ambient"></div>
<div class="container">

<div class="hero">
  <div class="hero-badge">📊 UX 體驗測試報告</div>
  <h1>${esc(cleanData.meta.title)}</h1>
  <div class="hero-meta">
    <span class="meta-chip">📅 ${esc(cleanData.meta.date)}</span>
    <span class="meta-chip">👥 ${cleanData.meta.testerCount} 位測試者</span>
  </div>
</div>

<div class="stats">
  <div class="stat-card green"><div class="stat-label">重要問題</div><div class="stat-value">${critLen}<span>項</span></div></div>
  <div class="stat-card blue"><div class="stat-label">次要問題</div><div class="stat-value">${secLen}<span>項</span></div></div>
  <div class="stat-card orange"><div class="stat-label">AI 圖像分析</div><div class="stat-value">${aiLen}<span>張</span></div></div>
  <div class="stat-card purple"><div class="stat-label">影響等級</div><div class="stat-value" style="font-size:22px">${esc(cleanData.summary.impactLevel)}</div></div>
</div>

<div class="summary-card">
  <div class="summary-head"><h3>📋 使用者體驗 — 總結</h3><span class="impact">Impact: ${esc(cleanData.summary.impactLevel)}</span></div>
  <div class="summary-body">${esc(cleanData.summary.content)}</div>
</div>

<div class="section">
  <div class="section-header"><div class="section-icon green">🔴</div><div class="section-title">使用者體驗回饋（重要）</div><span class="section-count">${critLen} 項</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th style="width:64px;text-align:center">編號</th><th>使用者體驗 (Issue)</th><th style="width:56px;text-align:center">人數</th><th style="width:64px;text-align:center">編號</th><th>組員優化建議 (Suggestion)</th>
  </tr></thead><tbody>${issueRows(cleanData.criticalIssues, 'green')}</tbody></table></div>
</div>

<div class="section">
  <div class="section-header"><div class="section-icon blue">🔵</div><div class="section-title">使用者體驗回饋（次要）</div><span class="section-count">${secLen} 項</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th style="width:64px;text-align:center">編號</th><th>使用者體驗 (Issue)</th><th style="width:56px;text-align:center">人數</th><th style="width:64px;text-align:center">編號</th><th>組員優化建議 (Suggestion)</th>
  </tr></thead><tbody>${issueRows(cleanData.secondaryIssues, 'blue')}</tbody></table></div>
</div>

<div class="section">
  <div class="section-header"><div class="section-icon orange">🤖</div><div class="section-title">AI — UI/UX 圖像判讀與建議</div><span class="section-count">${aiLen} 張</span></div>
  <div class="ai-wrap">${aiCards || '<div style="text-align:center;color:var(--text3);padding:32px;font-size:13px">尚無圖像分析資料</div>'}</div>
</div>

<div class="footer">Generated by UX Report Tool &middot; ${esc(cleanData.meta.date)}</div>
</div>

<div id="lb" onclick="closeLB()">
  <button id="lb-x" onclick="closeLB()">&times;</button>
  <img id="lb-img" src="" onclick="event.stopPropagation()" />
</div>
<script>
function openLB(s){document.getElementById('lb-img').src=s;document.getElementById('lb').classList.add('open');}
function closeLB(){document.getElementById('lb').classList.remove('open');}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLB();});
<\/script>
<script id="data-snapshot" type="application/json">${jsonSnapshot}<\/script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UX_Report_${data.meta.date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
