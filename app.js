/* 
 * Standalone entry point. Auto-generated from src/ 
 */
const { Settings, Download, FileText, Plus, Trash2, Image: ImageIcon, MessageSquare, AlertTriangle, Loader2, Sparkles, Upload, FileSpreadsheet, RefreshCcw, Code, Trophy, UserIcon, FolderInput, Eye, EyeOff, X, Share2, Link: LinkIcon, DEFAULT_UX_EXPERT_PROMPT, DEFAULT_DATA_IMPORT_PROMPT, initialData } = window;
const { useState, useEffect } = React;


/**
 * Call the Gemini API with automatic retry and exponential backoff.
 * @param {object} payload - The request payload for Gemini API.
 * @param {string} apiKey - The Gemini API key.
 * @returns {string} - The text response from Gemini.
 */
async function callGemini(payload, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const delays = [1000, 2000, 4000, 8000, 16000];
  let lastError = null;

  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`API 錯誤 (${response.status}): ${responseText}`);
      }

      if (!responseText) {
        throw new Error("API 回傳了空資料");
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`API 解析失敗: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      if (result.error) throw new Error(result.error.message);
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI 回傳了空白內容");
      return text;
    } catch (error) {
      lastError = error;
      if (i < delays.length) {
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  }
  throw new Error(lastError ? lastError.message : "未知的連線錯誤");
}

/**
 * Parse potentially markdown-wrapped JSON from AI response.
 * @param {string} text - Raw text from AI.
 * @returns {object} - Parsed JSON object.
 */
function parseAIJson(text) {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();
  return JSON.parse(cleanText);
}


/**
 * Generate and download the HTML report.
 * @param {object} data - The full report data.
 */
function exportHtmlReport(data) {
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



/**
 * Parse an Excel file and use Gemini AI to analyze UX feedback data.
 * @param {File} file - The uploaded Excel file.
 * @param {string} dataImportPrompt - The prompt to send to Gemini.
 * @param {string} apiKey - The Gemini API key.
 * @param {Array} existingAiAnalysis - Existing AI analysis items to preserve.
 * @returns {object} - The processed report data.
 */
async function importExcelFile(file, dataImportPrompt, apiKey, existingAiAnalysis) {
  const fileNameTitle = file.name.replace(/\.[^/.]+$/, "");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawRows || rawRows.length === 0) {
          throw new Error("讀取到的 Excel 為空，請檢查檔案。");
        }

        let headerRowIndex = -1;
        let feedbackIdx = -1;
        let suggestionIdx = -1;

        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r];
          if (!row || !Array.isArray(row)) continue;

          const fIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "使用者體驗");
          if (fIdx !== -1) {
            headerRowIndex = r;
            feedbackIdx = fIdx;
            suggestionIdx = row.findIndex(cell => typeof cell === 'string' && cell.trim() === "優化建議");
            break;
          }
        }

        if (headerRowIndex === -1 || feedbackIdx === -1) {
          throw new Error("無法自動偵測到「使用者體驗」標題欄位，請確認 Excel 格式。");
        }

        const nameIdx = feedbackIdx - 3;
        const accountIdx = feedbackIdx - 1;

        if (nameIdx < 0) {
          throw new Error("欄位結構異常：偵測到「使用者體驗」過於靠左，無法推算姓名欄位。");
        }

        const filteredData = [];

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row) continue;

          const name = row[nameIdx];
          const account = row[accountIdx];
          const feedback = row[feedbackIdx];
          const suggestion = suggestionIdx !== -1 ? row[suggestionIdx] : "";

          if (typeof name === 'string' && (name.includes("早班") || name.includes("中班") || name.includes("測試帳號") || name.includes("填寫完成"))) {
            continue;
          }
          if (!name) continue;
          // Allow rows with empty feedback but valid suggestion (suggestion-only)
          if ((!feedback || feedback === "使用者體驗") && !suggestion) {
            continue;
          }

          filteredData.push({
            _id: `R${i}`,
            user: name,
            account: account || "",
            uxContext: feedback || "",
            suggestion: suggestion || ""
          });
        }

        if (filteredData.length === 0) {
          throw new Error("未偵測到有效資料，請確認 Excel 格式。");
        }

        const uniqueTesters = new Set(filteredData.map(d => d.user)).size;

        const payload = {
          contents: [{ parts: [{ text: dataImportPrompt + "\n\n" + JSON.stringify(filteredData) }] }],
          generationConfig: { responseMimeType: "application/json" }
        };

        const textResponse = await callGemini(payload, apiKey);
        let importedData;
        try {
          importedData = parseAIJson(textResponse);
        } catch (e) {
          console.error("JSON Parse Error", textResponse);
          throw new Error("AI 回傳格式錯誤，請重試");
        }

        const rowMap = new Map(filteredData.map(d => [d._id, d]));

        // Programmatic post-processing: normalize, threshold, sort, renumber
        const processIssues = (issues) => {
          if (!Array.isArray(issues)) return [];
          return issues.map(i => {
            // Support both relatedRowIds (ID-based) and relatedPersonnel (name-based)
            const relatedIds = Array.isArray(i.relatedRowIds) ? i.relatedRowIds : [];
            const validRows = relatedIds.map(id => rowMap.get(id)).filter(Boolean);
            const fallbackPersonnel = Array.isArray(i.relatedPersonnel) ? i.relatedPersonnel : [];
            const personnelNames = validRows.length > 0 ? validRows.map(r => r.user) : fallbackPersonnel;
            const uniquePersonnel = [...new Set(personnelNames)];

            let bestSuggester = { name: "", account: "" };
            if (i.bestSuggesterRowId && rowMap.has(i.bestSuggesterRowId)) {
              const bestRow = rowMap.get(i.bestSuggesterRowId);
              bestSuggester = { name: bestRow.user, account: bestRow.account };
            } else if (i.bestSuggester && i.bestSuggester.name) {
              bestSuggester = i.bestSuggester;
            }

            const { relatedRowIds, bestSuggesterRowId, ...restProps } = i;

            return {
              ...restProps,
              relatedPersonnel: uniquePersonnel,
              count: uniquePersonnel.length,
              bestSuggestionRawText: i.bestSuggestionRawText || "",
              bestSuggester: bestSuggester
            };
          });
        };

        let allIssues = [];
        if (importedData.criticalIssues) allIssues = allIssues.concat(processIssues(importedData.criticalIssues));
        if (importedData.secondaryIssues) allIssues = allIssues.concat(processIssues(importedData.secondaryIssues));

        const criticalThreshold = Math.ceil(uniqueTesters * 0.35);
        const newCritical = [];
        const newSecondary = [];

        allIssues.forEach(issue => {
          if (issue.count === 0 && !issue.issue) return;
          if (issue.count >= criticalThreshold) {
            newCritical.push(issue);
          } else {
            newSecondary.push(issue);
          }
        });

        newCritical.sort((a, b) => b.count - a.count);
        newSecondary.sort((a, b) => b.count - a.count);

        // --- Multi-suggestion splitting ---
        // Each issue may have multiple suggestions separated by \n\n in bestSuggestionRawText
        // Split them into separate suggestion entries with independent IDs
        let globalSuggestionCounter = 1;

        const assignIdsAndSplitSuggestions = (issues, startUxIdx) => {
          const result = [];
          issues.forEach((issue, idx) => {
            issue.id = `UX${String(startUxIdx + idx + 1).padStart(2, '0')}`;

            // Check if suggestion contains multiple entries (split by \n\n)
            const suggestionText = issue.suggestion || "";
            const rawText = issue.bestSuggestionRawText || "";
            const suggestionParts = suggestionText.split(/\n\n/).filter(s => s.trim());

            if (suggestionParts.length > 1) {
              // Multiple suggestions for this issue
              issue.suggestions = suggestionParts.map(part => ({
                suggestionId: `S${String(globalSuggestionCounter++).padStart(2, '0')}`,
                suggestion: part.trim()
              }));
            } else {
              // Single suggestion
              issue.suggestions = [{
                suggestionId: `S${String(globalSuggestionCounter++).padStart(2, '0')}`,
                suggestion: suggestionText
              }];
            }
            // Keep legacy field for backward compatibility
            issue.suggestionId = issue.suggestions[0].suggestionId;

            result.push(issue);
          });
          return result;
        };

        const processedCritical = assignIdsAndSplitSuggestions(newCritical, 0);
        const processedSecondary = assignIdsAndSplitSuggestions(newSecondary, newCritical.length);

        // --- Collect suggestion-only entries ---
        // Find rows that have suggestion but no uxContext and weren't already associated
        const usedRowIds = new Set();
        [...processedCritical, ...processedSecondary].forEach(issue => {
          if (Array.isArray(issue.relatedRowIds)) {
            issue.relatedRowIds.forEach(id => usedRowIds.add(id));
          }
        });

        const suggestionOnlyRows = filteredData.filter(d =>
          (!d.uxContext || d.uxContext.trim() === "") && d.suggestion && d.suggestion.trim() !== ""
        );

        if (suggestionOnlyRows.length > 0) {
          // Group suggestion-only rows into a single "no UX" entry
          const suggestionOnlyIssue = {
            id: `UX${String(processedCritical.length + processedSecondary.length + 1).padStart(2, '0')}`,
            issue: "無使用者體驗",
            count: 0,
            relatedPersonnel: [],
            suggestion: "",
            suggestions: suggestionOnlyRows.map(row => ({
              suggestionId: `S${String(globalSuggestionCounter++).padStart(2, '0')}`,
              suggestion: row.suggestion,
              suggester: { name: row.user, account: row.account }
            })),
            bestSuggestionRawText: "",
            bestSuggester: { name: "", account: "" },
            isSuggestionOnly: true
          };
          suggestionOnlyIssue.suggestionId = suggestionOnlyIssue.suggestions[0].suggestionId;
          processedSecondary.push(suggestionOnlyIssue);
        }

        importedData.criticalIssues = processedCritical;
        importedData.secondaryIssues = processedSecondary;
        importedData.aiAnalysis = existingAiAnalysis || [];

        if (!importedData.meta) importedData.meta = {};
        importedData.meta.title = fileNameTitle;
        importedData.meta.date = new Date().toISOString().split('T')[0];
        importedData.meta.testerCount = uniqueTesters;

        resolve(importedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("檔案讀取失敗"));

    try {
      reader.readAsBinaryString(file);
    } catch (error) {
      reject(new Error("處理檔案時發生錯誤：" + error.message));
    }
  });
}



const Section = ({ title, children }) => (
  <div className="border border-slate-600/50 rounded-lg p-3 bg-slate-800/50">
    <h4 className="text-sm font-bold text-blue-400 mb-3 pb-2 border-b border-slate-600/50 flex items-center justify-between">
      {title}
    </h4>
    {children}
  </div>
);





const InputGroup = ({ label, type = "text", value, onChange }) => (
  <div className="mb-2">
    <label className="text-xs text-slate-400 block mb-1">{label}</label>
    <input
      type={type}
      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
      value={value}
      onChange={onChange}
    />
  </div>
);






const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isError: false });
  const showModal = (message, title = '提示', isError = false) => {
    setModalConfig({ isOpen: true, title, message, isError });
  };
  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('editor');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(initialData, null, 2));
  const [previewMode, setPreviewMode] = useState('export');

  const [uxExpertPrompt, setUxExpertPrompt] = useState(DEFAULT_UX_EXPERT_PROMPT);
  const [dataImportPrompt, setDataImportPrompt] = useState(DEFAULT_DATA_IMPORT_PROMPT);

  const [analyzingIds, setAnalyzingIds] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  // --- Data manipulation helpers ---
  const syncState = (newData) => {
    setData(newData);
    setJsonInput(JSON.stringify(newData, null, 2));
  };

  const handleJsonChange = (e) => {
    const newVal = e.target.value;
    setJsonInput(newVal);
    try {
      const parsed = JSON.parse(newVal);
      setData(parsed);
    } catch (err) { /* ignore invalid JSON while typing */ }
  };

  const updateField = (path, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split('.');
    let current = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    syncState(newData);
  };

  const addItem = (listName) => {
    const newData = JSON.parse(JSON.stringify(data));
    const newItem = listName === 'aiAnalysis'
      ? { id: `AS0${newData[listName].length + 1}`, imageUrl: "", observation: [], suggestion: [] }
      : {
          id: `UX0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`,
          issue: "",
          count: 1,
          relatedPersonnel: [],
          suggestionId: `S0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`,
          suggestion: "",
          bestSuggestionRawText: "",
          bestSuggester: { name: "", account: "" }
        };
    newData[listName].push(newItem);
    syncState(newData);
  };

  const removeItem = (listName, index) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData[listName].splice(index, 1);
    syncState(newData);
  };

  const updateListItem = (listName, index, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData[listName][index][field] = value;
    syncState(newData);
  };

  // --- Image upload & AI analysis ---
  const handleImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateListItem('aiAnalysis', index, 'imageUrl', reader.result);
      analyzeImage(index, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (index, base64Image) => {
    if (!base64Image) { showModal("請先上傳圖片", "提示", true); return; }
    if (!apiKey) { showModal("請先在右側上方輸入 Gemini API Key，才能使用 AI 分析功能。", "API Key 缺失", true); return; }
    setAnalyzingIds(prev => ({ ...prev, [index]: true }));

    try {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];
      const systemText = "你必須針對圖片中的具體UI元素進行分析，指出實際可見的問題（如按鈕位置、文字可讀性、色彩對比、資訊層級、操作動線等），避免空泛描述。每一條觀察和建議都必須可直接對應到圖片中的具體區域或元素。回答需精闢、有針對性，並附帶改善方向。";
      const payload = {
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ parts: [{ text: uxExpertPrompt }, { inlineData: { mimeType, data: base64Data } }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const textResponse = await callGemini(payload, apiKey);
      let analysisResult;
      try {
        analysisResult = parseAIJson(textResponse);
      } catch (e) {
        console.error("Image JSON Parse Error:", textResponse);
        throw new Error("AI 回傳格式異常，無法解析為 JSON。");
      }

      setData(prevData => {
        const newData = JSON.parse(JSON.stringify(prevData));
        newData.aiAnalysis[index].observation = Array.isArray(analysisResult.observation) ? analysisResult.observation : [analysisResult.observation || ""];
        newData.aiAnalysis[index].suggestion = Array.isArray(analysisResult.suggestion) ? analysisResult.suggestion : [analysisResult.suggestion || ""];
        setJsonInput(JSON.stringify(newData, null, 2));
        return newData;
      });
    } catch (error) {
      showModal("AI 分析失敗：" + error.message, "錯誤", true);
    } finally {
      setAnalyzingIds(prev => ({ ...prev, [index]: false }));
    }
  };

  // --- Excel import ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!apiKey) { showModal("請先在右側上方輸入 Gemini API Key，才能使用 Excel 匯入功能。", "API Key 缺失", true); return; }
    setIsImporting(true);
    try {
      const importedData = await importExcelFile(file, dataImportPrompt, apiKey, data.aiAnalysis);
      syncState(importedData);
      setActiveTab('editor');
    } catch (error) {
      console.error(error);
      showModal("匯入失敗：" + error.message, "錯誤", true);
    } finally {
      setIsImporting(false);
    }
  };

  // --- HTML import ---
  const handleHtmlImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const htmlContent = evt.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const scriptTag = doc.getElementById('data-snapshot');
        if (scriptTag && scriptTag.textContent) {
          const parsedData = JSON.parse(scriptTag.textContent);
          syncState(parsedData);
          setActiveTab('editor');
          showModal("成功匯入舊版報告資料！", "匯入成功");
        } else {
          showModal("無法在 HTML 中找到資料快照，請確認檔案是否為此工具產生的報告。", "格式錯誤", true);
        }
      } catch (err) {
        console.error(err);
        showModal("匯入失敗：檔案解析錯誤。", "解析錯誤", true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Export & Share ---
  const handleExportHtml = () => exportHtmlReport(data);

  const handleShareReport = () => {
    try {
      const shareData = {
        ...data,
        aiAnalysis: data.aiAnalysis.map(item => ({ ...item, imageUrl: '' }))
      };
      const json = JSON.stringify(shareData);
      const compressed = LZString.compressToEncodedURIComponent(json);
      const basePath = window.location.href.replace(/\/[^\/]*$/, '');
      const shareUrl = basePath + '/view.html#' + compressed;
      if (shareUrl.length > 2000000) {
        showModal('報告資料量過大，無法產生分享連結。\n建議使用「下載 HTML 檔案」方式分享。', '資料過大', true);
        return;
      }
      navigator.clipboard.writeText(shareUrl).then(() => {
        showModal('✅ 分享連結已複製到剪貼簿！\n\n直接貼給專案成員即可檢視報告。\n\n📝 注意：分享連結不包含 AI 分析圖片，\n如需完整圖片請使用「下載 HTML 檔案」。', '連結已複製');
      }).catch(() => {
        prompt('請手動複製以下連結：', shareUrl);
      });
    } catch (err) {
      showModal('產生分享連結失敗: ' + err.message, '錯誤', true);
    }
  };

  // --- Loading state ---
  const isLoading = isImporting || Object.values(analyzingIds).some(v => v === true);

  // --- Issue table renderer (shared between critical & secondary) ---
  const renderIssueRows = (item, idx, colorClass) => {
    const suggestions = Array.isArray(item.suggestions) && item.suggestions.length > 0
      ? item.suggestions
      : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }];
    const rowSpan = suggestions.length;
    const isSuggestionOnly = item.isSuggestionOnly || (item.issue === "無使用者體驗" || item.issue === "無");
    const issueDisplay = isSuggestionOnly ? "無" : item.issue;
    const countDisplay = isSuggestionOnly ? "" : item.count;

    return suggestions.map((sug, sIdx) => (
      <tr key={`${idx}-${sIdx}`} className="hover:bg-slate-750">
        {sIdx === 0 && (
          <>
            <td rowSpan={rowSpan} className={`px-4 py-3 text-center ${colorClass} font-mono border-r border-slate-600 align-top`}>{item.id}</td>
            <td rowSpan={rowSpan} className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap align-top">
              <div className="mb-2">{issueDisplay}</div>
              {previewMode === 'internal' && Array.isArray(item.relatedPersonnel) && item.relatedPersonnel.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-blue-300 mr-2 block mb-1">相關人員:</span>
                  <div className="flex flex-wrap gap-1">
                    {item.relatedPersonnel.map((person, pIdx) => (
                      <span key={pIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-200 border border-blue-800">{person}</span>
                    ))}
                  </div>
                </div>
              )}
            </td>
            <td rowSpan={rowSpan} className="px-4 py-3 text-center font-bold text-white border-r border-slate-600 align-top">{countDisplay}</td>
          </>
        )}
        <td className="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600 align-top">{sug.suggestionId}</td>
        <td className="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap align-top">
          <div className="mb-2">{sug.suggestion}</div>
          {sIdx === 0 && previewMode === 'internal' && item.bestSuggestionRawText && (
            <div className="bg-slate-900/30 p-2 rounded border border-slate-700/50 text-xs italic text-slate-400 mb-2 whitespace-pre-wrap">
              <span className="block text-[10px] text-slate-500 not-italic mb-1">原始建議:</span>
              &quot;{item.bestSuggestionRawText}&quot;
            </div>
          )}
          {sIdx === 0 && previewMode === 'internal' && item.bestSuggester?.name && (
            <div className="text-xs flex items-center gap-1 text-orange-400">
              <span>🏆 最佳建議者: {item.bestSuggester.name}</span>
              <span className="text-orange-400/60">({item.bestSuggester.account || 'No ID'})</span>
            </div>
          )}
          {sug.suggester && previewMode === 'internal' && (
            <div className="text-xs flex items-center gap-1 text-cyan-400 mt-1">
              <span>💡 建議者: {sug.suggester.name}</span>
              {sug.suggester.account && <span className="text-cyan-400/60">({sug.suggester.account})</span>}
            </div>
          )}
        </td>
      </tr>
    ));
  };

  const renderIssueTable = (title, issues, colorClass, borderColorClass) => (
    <div className="mb-8">
      <h3 className={`text-xl font-bold ${colorClass} mb-3 border-l-4 ${borderColorClass} pl-3`}>{title}</h3>
      <div className="overflow-hidden rounded-lg border border-slate-600">
        {issues.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-700 text-slate-200">
              <tr>
                <th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th>
                <th className="px-4 py-3 border-r border-slate-600">使用者體驗 (Issue)</th>
                <th className="px-4 py-3 w-16 text-center border-r border-slate-600">反應人數</th>
                <th className="px-4 py-3 w-16 text-center border-r border-slate-600">編號</th>
                <th className="px-4 py-3">組員優化建議 (Suggestion)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600 bg-slate-800">
              {issues.map((item, idx) => renderIssueRows(item, idx, colorClass))}
            </tbody>
          </table>
        ) : <div className="p-4 text-center text-slate-500 italic">尚無資料，請匯入 Excel</div>}
      </div>
    </div>
  );

  // --- Issue editor (shared between critical & secondary) ---
  const renderIssueEditor = (listName, item, idx) => (
    <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
      <button onClick={() => removeItem(listName, idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
      <div className="flex gap-2 mb-2">
        <input className={`w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs ${listName === 'criticalIssues' ? 'text-green-400' : 'text-blue-400'}`} value={item.id} onChange={(e) => updateListItem(listName, idx, 'id', e.target.value)} />
        <input className="w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs text-white text-center" type="number" value={item.count} onChange={(e) => updateListItem(listName, idx, 'count', parseInt(e.target.value) || 0)} title="人數" />
      </div>
      <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-16" placeholder="問題描述..." value={item.issue} onChange={(e) => updateListItem(listName, idx, 'issue', e.target.value)} />
      <div className="mb-2">
        <label className="text-[10px] text-blue-300 block mb-1">相關人員 (陣列, 以逗號分隔)</label>
        <textarea className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-blue-200" placeholder="UserA, UserB..." value={Array.isArray(item.relatedPersonnel) ? item.relatedPersonnel.join(', ') : ""} onChange={(e) => updateListItem(listName, idx, 'relatedPersonnel', e.target.value.split(',').map(s=>s.trim()))} />
      </div>
      <textarea className="w-full bg-slate-800 border border-slate-600/50 rounded p-2 text-xs text-purple-300 h-16 mb-2" placeholder="優化建議..." value={item.suggestion} onChange={(e) => updateListItem(listName, idx, 'suggestion', e.target.value)} />
      <div className="bg-slate-800 border border-slate-700 rounded p-2">
        <div className="text-[10px] text-orange-400 mb-1 flex items-center gap-1 font-bold"><Trophy size={10}/> 最佳建議提供者</div>
        <div className="flex gap-2 mb-2">
          <input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300" placeholder="姓名" value={item.bestSuggester?.name || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, name: e.target.value })} />
          <input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400" placeholder="帳號" value={item.bestSuggester?.account || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, account: e.target.value })} />
        </div>
        <textarea className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400 italic" placeholder="原始回饋內容 (Raw Content)..." value={item.bestSuggestionRawText || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggestionRawText', e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden relative">

      {/* === Left Side: Preview === */}
      <div className="w-[70%] h-full overflow-y-auto p-8 border-r border-slate-700 custom-scrollbar bg-[#0f1115]">
        <div className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{data.meta.title}</h1>
            <p className="text-slate-400 text-sm">報告日期: {data.meta.date} | 總測人數: {data.meta.testerCount}人</p>
          </div>
          <div className="text-right">
            <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
              <button onClick={() => setPreviewMode('export')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'export' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                <Eye size={12}/> 匯出報告預覽
              </button>
              <button onClick={() => setPreviewMode('internal')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'internal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                <EyeOff size={12}/> 內部完整資料
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2"><FileText size={16} /> 使用者體驗 - 總結</h3>
            <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: {data.summary.impactLevel}</span>
          </div>
          <div className="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">{data.summary.content}</div>
        </div>

        {renderIssueTable('使用者體驗回饋 (重要)', data.criticalIssues, 'text-green-400', 'border-green-500')}
        {renderIssueTable('使用者體驗回饋 (次要)', data.secondaryIssues, 'text-blue-400', 'border-blue-500')}

        {/* AI Image Analysis Preview */}
        <div className="mb-8">
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-t-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-400"/>
            <h3 className="text-lg font-bold text-orange-100">AI - UI/UX 圖像判讀與建議</h3>
          </div>
          <div className="border-x border-b border-orange-500/30 bg-slate-800/50 p-6 rounded-b-lg space-y-8">
            {data.aiAnalysis.length > 0 ? data.aiAnalysis.map((item, idx) => (
              <div key={idx} className="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0">
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-xs text-slate-400">AI 辨識用圖片</span>
                  <div className="rounded-lg overflow-hidden border border-slate-600 relative group bg-black/40 min-h-[150px] flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="Analysis" className="w-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxImage(item.imageUrl)} title="點擊放大圖片" />
                    ) : (
                      <div className="text-slate-500 text-xs flex flex-col items-center">
                        <ImageIcon size={24} className="mb-2 opacity-50"/>尚無圖片
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-1/2 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30 font-mono">{item.id}</span>
                    <span className="text-orange-400 font-bold text-sm">AI 觀察與建議</span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <p className="text-slate-400 text-xs mb-2 font-bold">觀察 (Observation)</p>
                      {Array.isArray(item.observation) && item.observation.length > 0 ? (
                        <ul className="list-disc list-outside ml-4 space-y-1">
                          {item.observation.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-slate-500">{point}</li>))}
                        </ul>
                      ) : <p className="text-slate-500 text-sm">等待分析...</p>}
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-purple-500/30">
                      <p className="text-purple-400 text-xs mb-2 font-bold">建議 (Suggestion)</p>
                      {Array.isArray(item.suggestion) && item.suggestion.length > 0 ? (
                        <ul className="list-disc list-outside ml-4 space-y-1">
                          {item.suggestion.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-purple-500">{point}</li>))}
                        </ul>
                      ) : <p className="text-slate-500 text-sm">等待分析...</p>}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-center text-slate-500 text-sm">尚無圖像分析，請從右側新增。</div>}
          </div>
        </div>
      </div>

      {/* === Right Side: Editor === */}
      <div className="w-[30%] bg-slate-800 border-l border-slate-700 flex flex-col h-full shadow-2xl z-10">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings size={18} className="animate-spin-slow" /> 報告編輯器
            </h2>
            <div className="flex gap-1 bg-slate-800 rounded p-1">
              <button onClick={() => setActiveTab('editor')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>GUI</button>
              <button onClick={() => setActiveTab('prompts')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'prompts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Prompts</button>
              <button onClick={() => setActiveTab('json')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>JSON</button>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">🔑 Gemini API Key</label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">前往取得 API Key →</a>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 pr-8 transition-colors"
                  placeholder="輸入您的 Gemini API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {!apiKey && <p className="text-[10px] text-amber-400/80 mt-1.5">⚠️ 需要 API Key 才能使用 AI 分析和 Excel 匯入功能</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'editor' && (
            <>
              {/* HTML Import */}
              <div className="mb-4 bg-slate-700/30 border border-slate-600 rounded-lg p-3">
                <h4 className="text-slate-300 text-xs font-bold mb-2 flex items-center gap-2"><FolderInput size={14}/> 匯入舊版 HTML 報告</h4>
                <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 rounded py-2 px-3 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-xs text-slate-300">
                  <Code size={14}/><span>選擇 HTML 檔案還原</span>
                  <input type="file" accept=".html" className="hidden" onChange={handleHtmlImport} />
                </label>
              </div>

              {/* Excel Import */}
              <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 text-sm font-bold mb-2 flex items-center gap-2"><FileSpreadsheet size={16}/> 匯入 Excel 原始資料</h4>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">上傳使用者體驗回饋的 Excel (.xlsx)，AI 將自動清洗空洞回饋、整併相似問題、統計頻率並歸納重點。</p>
                <label className={`flex items-center justify-center gap-2 w-full py-3 rounded border border-dashed cursor-pointer transition-all ${isImporting ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-blue-600/10 border-blue-500/50 text-blue-300 hover:bg-blue-600/20'}`}>
                  {isImporting ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18}/>}
                  <span className="text-xs font-bold">{isImporting ? "AI 正在分析資料..." : "點擊上傳 Excel 檔"}</span>
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
                </label>
              </div>

              <div className="space-y-6">
                <Section title="1. 報告基礎資訊">
                  <InputGroup label="報告標題" value={data.meta.title} onChange={(e) => updateField('meta.title', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <InputGroup label="日期" type="date" value={data.meta.date} onChange={(e) => updateField('meta.date', e.target.value)} />
                    <InputGroup label="測試總人數" type="number" value={data.meta.testerCount} onChange={(e) => updateField('meta.testerCount', parseInt(e.target.value) || 0)} />
                  </div>
                </Section>

                <Section title="2. 體驗總結 (Summary)">
                  <textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none h-32 leading-relaxed" value={data.summary.content} onChange={(e) => updateField('summary.content', e.target.value)} />
                </Section>

                <Section title="3. 重要問題 (Critical)">
                  {data.criticalIssues.map((item, idx) => renderIssueEditor('criticalIssues', item, idx))}
                  <button onClick={() => addItem('criticalIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14}/> 新增重要問題</button>
                </Section>

                <Section title="4. 次要問題 (Secondary)">
                  {data.secondaryIssues.map((item, idx) => renderIssueEditor('secondaryIssues', item, idx))}
                  <button onClick={() => addItem('secondaryIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14}/> 新增次要問題</button>
                </Section>

                <Section title="5. AI 圖像分析 (Smart Analysis)">
                  {data.aiAnalysis.map((item, idx) => (
                    <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
                      <button onClick={() => removeItem('aiAnalysis', idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={14}/></button>
                      <div className="mb-3">
                        <label className="text-xs text-slate-500 mb-1 block">1. 上傳遊戲截圖</label>
                        <div className="flex gap-2 items-center">
                          <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 border-dashed rounded h-16 flex flex-col items-center justify-center hover:bg-slate-700 transition-colors relative overflow-hidden">
                            {item.imageUrl && <img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Preview"/>}
                            <div className="relative z-10 flex flex-col items-center"><Upload size={16} className="text-slate-400"/><span className="text-[10px] text-slate-400 mt-1">點擊上傳</span></div>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                          </label>
                          <button onClick={() => analyzeImage(idx, item.imageUrl)} disabled={analyzingIds[idx] || !item.imageUrl}
                            className={`h-16 w-16 rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${analyzingIds[idx] ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : !item.imageUrl ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-900/20'}`}>
                            {analyzingIds[idx] ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                            {analyzingIds[idx] ? '分析中' : 'AI 分析'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs text-slate-500 mb-1 block">AI 觀察 (每行一點)</label>
                        <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-20" value={Array.isArray(item.observation) ? item.observation.join('\n') : item.observation} onChange={(e) => updateListItem('aiAnalysis', idx, 'observation', e.target.value.split('\n'))} placeholder="等待 AI 分析..." />
                      </div>
                      <div className="mt-1">
                        <label className="text-xs text-purple-400/70 mb-1 block">UIUX 建議 (每行一點)</label>
                        <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-purple-300 h-24" value={Array.isArray(item.suggestion) ? item.suggestion.join('\n') : item.suggestion} onChange={(e) => updateListItem('aiAnalysis', idx, 'suggestion', e.target.value.split('\n'))} placeholder="等待 AI 分析..." />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addItem('aiAnalysis')} className="w-full py-2 border border-dashed border-orange-500/50 rounded text-orange-400 hover:text-orange-200 hover:border-orange-400 text-xs flex items-center justify-center gap-1"><Plus size={14}/> 新增圖片分析</button>
                </Section>
              </div>
            </>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6 h-full flex flex-col">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2"><ImageIcon size={16} /> AI 圖像分析指令 (Image Prompt)</h4>
                <p className="text-xs text-slate-400 mb-2">這是點擊「AI 分析」按鈕時，發送給 AI 的指令。您可以根據專案需求微調分析邏輯。</p>
                <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-orange-500 resize-none" value={uxExpertPrompt} onChange={(e) => setUxExpertPrompt(e.target.value)} spellCheck="false" />
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel 匯入分析指令 (Data Prompt)</h4>
                <p className="text-xs text-slate-400 mb-2">這是匯入 Excel 檔案時，AI 用於清洗、整併與分類資料的指令。可調整門檻 (如 35%) 或分類規則。</p>
                <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-blue-500 resize-none" value={dataImportPrompt} onChange={(e) => setDataImportPrompt(e.target.value)} spellCheck="false" />
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="h-full flex flex-col">
              <p className="text-xs text-slate-400 mb-2">完整 Raw Data JSON：</p>
              <textarea className="flex-1 w-full bg-slate-950 font-mono text-xs text-green-400 p-4 rounded border border-slate-700 outline-none resize-none" value={jsonInput} onChange={handleJsonChange} spellCheck="false" />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900 space-y-2">
          <button onClick={handleShareReport} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20">
            <Share2 size={18} /> 分享報告連結
          </button>
          <button onClick={handleExportHtml} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded flex items-center justify-center gap-2 transition-all text-sm">
            <Download size={16} /> 下載 HTML 檔案
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center cursor-not-allowed">
          <Loader2 size={48} className="text-blue-400 animate-spin mb-4" />
          <p className="text-white text-lg font-bold tracking-wider">資料處理中...</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center cursor-pointer" onClick={() => setLightboxImage(null)}>
          <button onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }} className="absolute top-5 right-7 text-white/80 hover:text-white transition-colors text-4xl leading-none z-10">&times;</button>
          <img src={lightboxImage} alt="Enlarged" className="max-w-[92vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-sm w-full relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {modalConfig.isError ? (<AlertTriangle className="text-red-400" size={24} />) : (<MessageSquare className="text-blue-400" size={24} />)}
                <h3 className={`text-lg font-bold ${modalConfig.isError ? 'text-red-400' : 'text-blue-400'}`}>{modalConfig.title}</h3>
              </div>
              <p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">{modalConfig.message}</p>
              <div className="flex justify-end">
                <button onClick={closeModal} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm font-medium">確定</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};





// --- Render ---
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
