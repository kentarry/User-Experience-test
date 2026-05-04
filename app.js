/* Lucide icons and constants loaded from constants.js via window globals */
const { Settings, Download, FileText, Plus, Trash2, ImageIcon, MessageSquare, AlertTriangle, Loader2, Sparkles, Upload, FileSpreadsheet, RefreshCcw, Code, Trophy, UserIcon, FolderInput, Eye, EyeOff, X, Share2, LinkIcon, DEFAULT_UX_EXPERT_PROMPT, DEFAULT_DATA_IMPORT_PROMPT, initialData } = window;
const { useState, useEffect } = React;

const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isError: false });
  const showModal = (message, title = '?內', isError = false) => { setModalConfig({ isOpen: true, title, message, isError }); };
  const closeModal = () => { setModalConfig({ ...modalConfig, isOpen: false }); };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) { document.body.removeChild(script); } }
  }, []);

  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('editor');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(initialData, null, 2));
  const [previewMode, setPreviewMode] = useState('export');
  const [uxExpertPrompt, setUxExpertPrompt] = useState(DEFAULT_UX_EXPERT_PROMPT);
  const [dataImportPrompt, setDataImportPrompt] = useState(DEFAULT_DATA_IMPORT_PROMPT);
  const [analyzingIds, setAnalyzingIds] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  const handleJsonChange = (e) => {
    const newVal = e.target.value; setJsonInput(newVal);
    try { setData(JSON.parse(newVal)); } catch (err) { }
  };

  const updateField = (path, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split('.'); let current = newData;
    for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }
    current[keys[keys.length - 1]] = value;
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const addItem = (listName) => {
    const newData = { ...data };
    const newItem = listName === 'aiAnalysis'
      ? { id: `AS0${newData[listName].length + 1}`, imageUrl: "", observation: [], suggestion: [] }
      : { id: `UX0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`, issue: "", count: 1, relatedPersonnel: [], suggestionId: `S0${(newData.criticalIssues.length + newData.secondaryIssues.length) + 1}`, suggestion: "", bestSuggestionRawText: "", bestSuggester: { name: "", account: "" } };
    newData[listName].push(newItem);
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const removeItem = (listName, index) => {
    const newData = { ...data }; newData[listName].splice(index, 1);
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const updateListItem = (listName, index, field, value) => {
    const newData = { ...data }; newData[listName][index][field] = value;
    setData(newData); setJsonInput(JSON.stringify(newData, null, 2));
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { const result = reader.result; updateListItem('aiAnalysis', index, 'imageUrl', result); analyzeImage(index, result); };
    reader.readAsDataURL(file);
  };

  const callGemini = async (payload) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const delays = [1000, 2000, 4000, 8000, 16000]; let lastError = null;
    for (let i = 0; i <= delays.length; i++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const responseText = await response.text();
        if (!response.ok) throw new Error(`API ?航炊 (${response.status}): ${responseText}`);
        if (!responseText) throw new Error("API ?鈭征鞈?");
        let result; try { result = JSON.parse(responseText); } catch (e) { throw new Error(`API 閫??憭望?: ${response.status} - ${responseText.substring(0, 100)}`); }
        if (result.error) throw new Error(result.error.message);
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI ?鈭征?賢摰?);
        return text;
      } catch (error) { lastError = error; if (i < delays.length) { await new Promise(resolve => setTimeout(resolve, delays[i])); } }
    }
    throw new Error(lastError ? lastError.message : "?芰????航炊");
  };

  const analyzeImage = async (index, base64Image) => {
    if (!base64Image) { showModal("隢?銝??", "?內", true); return; }
    if (!apiKey) { showModal("隢??典?港??寡撓??Gemini API Key嚗??賭蝙??AI ?????, "API Key 蝻箏仃", true); return; }
    setAnalyzingIds(prev => ({ ...prev, [index]: true }));
    try {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];
      const systemText = "雿???撠??葉?擃I???脰???嚗??箏祕?閬???嚗???雿蔭??摮霈?扼敶拙?瘥?閮惜蝝?雿?蝺?嚗??踹?蝛箸??膩??銝璇?撖?撱箄降?賢???湔撠??啣??葉?擃???????蝑?蝎暸?????改?銝阡?撣嗆???;
      const payload = { systemInstruction: { parts: [{ text: systemText }] }, contents: [{ parts: [{ text: uxExpertPrompt }, { inlineData: { mimeType: mimeType, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json" } };
      const textResponse = await callGemini(payload);
      let analysisResult;
      try { let cleanText = textResponse.trim(); if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7); else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3); if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3); analysisResult = JSON.parse(cleanText.trim()); } catch (e) { throw new Error("AI ??澆??啣虜嚗瘜圾? JSON??); }
      setData(prevData => {
        const newData = JSON.parse(JSON.stringify(prevData));
        newData.aiAnalysis[index].observation = Array.isArray(analysisResult.observation) ? analysisResult.observation : [analysisResult.observation || ""];
        newData.aiAnalysis[index].suggestion = Array.isArray(analysisResult.suggestion) ? analysisResult.suggestion : [analysisResult.suggestion || ""];
        setJsonInput(JSON.stringify(newData, null, 2)); return newData;
      });
    } catch (error) { showModal("AI ??憭望?嚗? + error.message, "?航炊", true); }
    finally { setAnalyzingIds(prev => ({ ...prev, [index]: false })); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!apiKey) { showModal("隢??典?港??寡撓??Gemini API Key嚗??賭蝙??Excel ?臬???, "API Key 蝻箏仃", true); return; }
    const fileNameTitle = file.name.replace(/\.[^/.]+$/, "");
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        if (!window.XLSX) { showModal("Excel 閫???辣撠頛摰?嚗???敺?閰艾?, "?辣?航炊", true); setIsImporting(false); return; }
        const wb = window.XLSX.read(bstr, { type: 'binary' }); const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rawRows || rawRows.length === 0) { showModal("霈???Excel ?箇征嚗?瑼Ｘ瑼???, "?澆??航炊", true); setIsImporting(false); return; }

        // --- Text-based column matching ---
        const columnKeywords = {
          account: ["皜祈岫撣唾?", "撣唾?"],
          name: ["憪?", "?迂", "Name"],
          feedback: ["雿輻??撽?],
          suggestion: ["?芸?撱箄降"]
        };
        const findColByText = (row, keywords) => {
          if (!row || !Array.isArray(row)) return -1;
          return row.findIndex(cell => typeof cell === 'string' && keywords.some(kw => cell.trim().includes(kw)));
        };

        let headerRowIndex = -1, nameIdx = -1, accountIdx = -1, feedbackIdx = -1, suggestionIdx = -1;
        for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
          const row = rawRows[r]; if (!row || !Array.isArray(row)) continue;
          const fIdx = findColByText(row, columnKeywords.feedback);
          if (fIdx !== -1) {
            headerRowIndex = r;
            feedbackIdx = fIdx;
            accountIdx = findColByText(row, columnKeywords.account);
            suggestionIdx = findColByText(row, columnKeywords.suggestion);
            nameIdx = findColByText(row, columnKeywords.name);
            // Fallback: if name column not found by text, try column left of account
            if (nameIdx === -1 && accountIdx !== -1 && accountIdx > 0) nameIdx = accountIdx - 1;
            // Legacy fallback: offset from feedback
            if (nameIdx === -1) nameIdx = feedbackIdx - 3;
            if (accountIdx === -1) accountIdx = feedbackIdx - 1;
            break;
          }
        }
        if (headerRowIndex === -1 || feedbackIdx === -1) { showModal("?⊥??芸??菜葫?啜蝙?刻?撽?憿?雿?隢Ⅱ隤?Excel ?澆???, "甈??航炊", true); setIsImporting(false); return; }
        if (nameIdx < 0) { showModal("甈?蝯??啣虜嚗瘜蝞???雿?隢Ⅱ隤?Excel ?澆???, "蝯??航炊", true); setIsImporting(false); return; }

        // --- Handle morning/afternoon shift rows (?拍/銝剔) ---
        const isShiftHeaderRow = (row) => {
          if (!row || !Array.isArray(row)) return false;
          const rowStr = row.filter(c => typeof c === 'string').join(' ');
          return (rowStr.includes('?拍') || rowStr.includes('銝剔')) && !row[feedbackIdx];
        };
        const isRepeatHeaderRow = (row) => {
          if (!row || !Array.isArray(row)) return false;
          const cellAtFeedback = row[feedbackIdx];
          return typeof cellAtFeedback === 'string' && columnKeywords.feedback.some(kw => cellAtFeedback.trim().includes(kw));
        };

        const filteredData = [];
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i]; if (!row) continue;
          // Skip shift separator rows and repeated header rows
          if (isShiftHeaderRow(row)) continue;
          if (isRepeatHeaderRow(row)) continue;
          const name = row[nameIdx], account = row[accountIdx], feedback = row[feedbackIdx], suggestion = suggestionIdx !== -1 ? row[suggestionIdx] : "";
          // Skip rows with special keywords in name column
          if (typeof name === 'string' && (name.includes("?拍") || name.includes("銝剔") || name.includes("皜祈岫撣唾?") || name.includes("憛怠神摰?"))) continue;
          if (!name) continue;
          // Allow rows with empty feedback but valid suggestion (suggestion-only)
          if (!feedback && !suggestion) continue;
          filteredData.push({ _id: `R${i}`, user: name, account: account || "", uxContext: feedback || "", suggestion: suggestion || "" });
        }
        if (filteredData.length === 0) { showModal("?芸皜砍??鞈?嚗?蝣箄? Excel ?澆???, "?∟???, true); setIsImporting(false); return; }
        const uniqueTesters = new Set(filteredData.map(d => d.user)).size;
        const payload = { contents: [{ parts: [{ text: dataImportPrompt + "\n\n" + JSON.stringify(filteredData) }] }], generationConfig: { responseMimeType: "application/json" } };
        const textResponse = await callGemini(payload);
        let importedData;
        try { let cleanText = textResponse.trim(); if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7); else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3); if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3); importedData = JSON.parse(cleanText.trim()); } catch (e) { throw new Error("AI ??澆??航炊嚗??岫"); }

        const rowMap = new Map(filteredData.map(d => [d._id, d]));
        const processIssues = (issues) => {
          if (!Array.isArray(issues)) return [];
          return issues.map(i => {
            const relatedIds = Array.isArray(i.relatedRowIds) ? i.relatedRowIds : [];
            const validRows = relatedIds.map(id => rowMap.get(id)).filter(Boolean);
            const fallbackPersonnel = Array.isArray(i.relatedPersonnel) ? i.relatedPersonnel : [];
            const personnelNames = validRows.length > 0 ? validRows.map(r => r.user) : fallbackPersonnel;
            const uniquePersonnel = [...new Set(personnelNames)];
            let bestSuggester = { name: "", account: "" };
            if (i.bestSuggesterRowId && rowMap.has(i.bestSuggesterRowId)) { const bestRow = rowMap.get(i.bestSuggesterRowId); bestSuggester = { name: bestRow.user, account: bestRow.account }; }
            else if (i.bestSuggester && i.bestSuggester.name) { bestSuggester = i.bestSuggester; }
            const { relatedRowIds, bestSuggesterRowId, ...restProps } = i;
            return { ...restProps, relatedPersonnel: uniquePersonnel, count: uniquePersonnel.length, bestSuggestionRawText: i.bestSuggestionRawText || "", bestSuggester: bestSuggester };
          });
        };
        let allIssues = [];
        if (importedData.criticalIssues) allIssues = allIssues.concat(processIssues(importedData.criticalIssues));
        if (importedData.secondaryIssues) allIssues = allIssues.concat(processIssues(importedData.secondaryIssues));
        const criticalThreshold = Math.ceil(uniqueTesters * 0.35);
        const newCritical = [], newSecondary = [];
        allIssues.forEach(issue => { if (issue.count === 0 && !issue.issue) return; if (issue.count >= criticalThreshold) newCritical.push(issue); else newSecondary.push(issue); });
        newCritical.sort((a, b) => b.count - a.count); newSecondary.sort((a, b) => b.count - a.count);

        // Multi-suggestion splitting + ID assignment
        let globalSugCounter = 1;
        const assignIdsAndSplit = (issues, startUxIdx) => {
          issues.forEach((issue, idx) => {
            issue.id = `UX${String(startUxIdx + idx + 1).padStart(2, '0')}`;
            const sugText = issue.suggestion || "";
            const sugParts = sugText.split(/\n\n/).filter(s => s.trim());
            if (sugParts.length > 1) {
              issue.suggestions = sugParts.map(part => ({ suggestionId: `S${String(globalSugCounter++).padStart(2, '0')}`, suggestion: part.trim() }));
            } else {
              issue.suggestions = [{ suggestionId: `S${String(globalSugCounter++).padStart(2, '0')}`, suggestion: sugText }];
            }
            issue.suggestionId = issue.suggestions[0].suggestionId;
          });
        };
        assignIdsAndSplit(newCritical, 0);
        assignIdsAndSplit(newSecondary, newCritical.length);

        // Collect suggestion-only entries
        const sugOnlyRows = filteredData.filter(d => (!d.uxContext || d.uxContext.trim() === "") && d.suggestion && d.suggestion.trim() !== "");
        if (sugOnlyRows.length > 0) {
          const sugOnlyIssue = {
            id: `UX${String(newCritical.length + newSecondary.length + 1).padStart(2, '0')}`,
            issue: "?∩蝙?刻?撽?, count: 0, relatedPersonnel: [], suggestion: "",
            suggestions: sugOnlyRows.map(row => ({ suggestionId: `S${String(globalSugCounter++).padStart(2, '0')}`, suggestion: row.suggestion, suggester: { name: row.user, account: row.account } })),
            bestSuggestionRawText: "", bestSuggester: { name: "", account: "" }, isSuggestionOnly: true
          };
          sugOnlyIssue.suggestionId = sugOnlyIssue.suggestions[0].suggestionId;
          newSecondary.push(sugOnlyIssue);
        }

        importedData.criticalIssues = newCritical; importedData.secondaryIssues = newSecondary;
        importedData.aiAnalysis = data.aiAnalysis || [];
        if (!importedData.meta) importedData.meta = {};
        importedData.meta.title = fileNameTitle; importedData.meta.date = new Date().toISOString().split('T')[0]; importedData.meta.testerCount = uniqueTesters;
        setData(importedData); setJsonInput(JSON.stringify(importedData, null, 2)); setActiveTab('editor'); setIsImporting(false);
      } catch (error) { showModal("?臬憭望?嚗? + error.message, "?航炊", true); setIsImporting(false); }
    };
    reader.onerror = () => { showModal("瑼?霈?仃??, "?航炊", true); setIsImporting(false); };
    try { reader.readAsBinaryString(file); } catch (error) { showModal("??瑼???隤歹?" + error.message, "?航炊", true); setIsImporting(false); }
  };

  const handleHtmlImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const doc = new DOMParser().parseFromString(evt.target.result, 'text/html');
        const scriptTag = doc.getElementById('data-snapshot');
        if (scriptTag && scriptTag.textContent) { const parsedData = JSON.parse(scriptTag.textContent); setData(parsedData); setJsonInput(JSON.stringify(parsedData, null, 2)); setActiveTab('editor'); showModal("???臬???勗?鞈?嚗?, "?臬??"); }
        else showModal("?⊥???HTML 銝剜?啗??翰?改?隢Ⅱ隤?獢?衣甇文極?瑞???勗???, "?澆??航炊", true);
      } catch (err) { showModal("?臬憭望?嚗?獢圾?隤扎?, "閫???航炊", true); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const handleShareReport = () => {
    try {
      // Strip base64 images to keep URL compact
      const shareData = {
        ...data,
        aiAnalysis: data.aiAnalysis.map(item => ({
          ...item,
          imageUrl: '' // Remove base64 images for URL sharing
        }))
      };
      const json = JSON.stringify(shareData);
      const compressed = LZString.compressToEncodedURIComponent(json);
      // Detect base URL (works on GitHub Pages and localhost)
      const basePath = window.location.href.replace(/\/[^\/]*$/, '');
      const shareUrl = basePath + '/view.html#' + compressed;
      
      if (shareUrl.length > 2000000) {
        showModal('?勗?鞈???憭改??⊥??Ｙ??澈????n撱箄降雿輻??頛?HTML 瑼??撘?鈭怒?, '鞈??之', true);
        return;
      }
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        showModal('???澈???撌脰?鋆賢?芾票蝪選?\n\n?湔鞎潛策撠???喳瑼Ｚ??勗??n\n?? 瘜冽?嚗?鈭恍??銝???AI ????嚗n憒?摰??隢蝙?具?頛?HTML 瑼???, '???撌脰?鋆?);
      }).catch(() => {
        // Fallback: show URL for manual copy
        prompt('隢???鋆賭誑銝??嚗?, shareUrl);
      });
    } catch (err) {
      showModal('?Ｙ??澈???憭望?: ' + err.message, '?航炊', true);
    }
  };

  const handleExportHtml = () => {
    const sanitizeIssues = (issues) => issues.map(item => { const { relatedPersonnel, bestSuggestionRawText, bestSuggester, ...rest } = item; return rest; });
    const cleanData = { ...data, criticalIssues: sanitizeIssues(data.criticalIssues), secondaryIssues: sanitizeIssues(data.secondaryIssues) };
    const jsonSnapshot = JSON.stringify(data);
    const esc = (s) => { if (typeof s !== 'string') return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    const critLen = cleanData.criticalIssues ? cleanData.criticalIssues.length : 0;
    const secLen = cleanData.secondaryIssues ? cleanData.secondaryIssues.length : 0;
    const aiLen = cleanData.aiAnalysis ? cleanData.aiAnalysis.length : 0;
    const issueRows = (issues, color) => {
      if (!issues || issues.length === 0) return '<tr><td colspan="5" class="td" style="text-align:center;color:var(--text3);padding:32px;font-style:italic">撠鞈?</td></tr>';
      return issues.map(item => { const sgs = Array.isArray(item.suggestions) && item.suggestions.length > 0 ? item.suggestions : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }]; const rs = sgs.length; const isSO = item.isSuggestionOnly || item.issue === '?∩蝙?刻?撽? || item.issue === '??; const issDisp = isSO ? '?? : esc(item.issue); const cntDisp = isSO ? '' : item.count; return sgs.map((sg, si) => { const left = si === 0 ? `<td rowspan="${rs}" class="td td-id ${color}">${esc(item.id)}</td><td rowspan="${rs}" class="td td-issue">${issDisp}</td><td rowspan="${rs}" class="td td-count">${cntDisp}</td>` : ''; return `<tr>${left}<td class="td td-sid">${esc(sg.suggestionId)}</td><td class="td td-sug">${esc(sg.suggestion)}</td></tr>`; }).join(''); }).join('');
    };
    const aiCards = cleanData.aiAnalysis.map(item => { const imgHtml = item.imageUrl ? `<img src="${item.imageUrl}" onclick="openLB(this.src)" />` : '<div class="no-img">撠??</div>'; const obsList = Array.isArray(item.observation) ? item.observation.map(p => `<li>${esc(p)}</li>`).join('') : ''; const sugList = Array.isArray(item.suggestion) ? item.suggestion.map(p => `<li>${esc(p)}</li>`).join('') : ''; return `<div class="ai-card"><div class="ai-card-img"><span class="ai-label">AI 颲刻???</span><div class="ai-img-box">${imgHtml}</div></div><div class="ai-card-text"><div class="ai-tag-row"><span class="ai-tag">${esc(item.id)}</span><span class="ai-tag-title">AI 閫撖?撱箄降</span></div><div class="ai-block obs"><div class="ai-block-title obs">?? 閫撖?(Observation)</div><ul class="ai-list obs">${obsList}</ul></div><div class="ai-block sug"><div class="ai-block-title sug">? 撱箄降 (Suggestion)</div><ul class="ai-list sug">${sugList}</ul></div></div></div>`; }).join('');
    const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bg:#06080f;--bg2:#0c1018;--surface:#121826;--surface2:#1a2236;--surface3:#243046;--border:rgba(99,130,190,0.12);--border2:rgba(99,130,190,0.2);--text:#e8edf5;--text2:#8fa4c4;--text3:#5a6f8e;--green:#22c55e;--green-glow:rgba(34,197,94,0.15);--blue:#3b82f6;--blue-glow:rgba(59,130,246,0.12);--orange:#f97316;--orange-glow:rgba(249,115,22,0.12);--purple:#a855f7;--purple-glow:rgba(168,85,247,0.12);--red:#ef4444;--red-glow:rgba(239,68,68,0.12);--cyan:#06b6d4;--radius:16px;--radius-sm:10px;--font:'Noto Sans TC',system-ui,sans-serif;--mono:'JetBrains Mono',monospace}html{scroll-behavior:smooth;font-size:15px}body{background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.75;min-height:100vh;overflow-x:hidden}.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}.ambient::before{content:'';position:absolute;width:800px;height:800px;top:-200px;left:-200px;background:radial-gradient(circle,rgba(59,130,246,0.06),transparent 60%);animation:float 20s ease-in-out infinite}.ambient::after{content:'';position:absolute;width:600px;height:600px;bottom:-100px;right:-100px;background:radial-gradient(circle,rgba(168,85,247,0.05),transparent 60%);animation:float 25s ease-in-out infinite reverse}@keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,40px)}}.container{position:relative;z-index:1;max-width:1040px;margin:0 auto;padding:48px 28px 80px}@media(max-width:768px){.container{padding:24px 16px 60px}}.hero{margin-bottom:48px;position:relative;padding:40px 0 32px}.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--border2),var(--blue),var(--border2),transparent)}.hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--cyan);background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.15);padding:5px 14px;border-radius:20px;margin-bottom:16px;letter-spacing:0.03em;text-transform:uppercase}.hero h1{font-size:clamp(1.6rem,4.5vw,2.4rem);font-weight:900;color:#fff;letter-spacing:-0.03em;margin-bottom:12px;line-height:1.3}.hero-meta{display:flex;gap:12px;flex-wrap:wrap}.meta-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);background:var(--surface);padding:6px 14px;border-radius:20px;border:1px solid var(--border)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:48px}.stat-card{background:linear-gradient(135deg,var(--surface),var(--surface2));border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;position:relative;overflow:hidden}.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--radius) var(--radius) 0 0}.stat-card.green::before{background:linear-gradient(90deg,var(--green),transparent)}.stat-card.blue::before{background:linear-gradient(90deg,var(--blue),transparent)}.stat-card.orange::before{background:linear-gradient(90deg,var(--orange),transparent)}.stat-card.purple::before{background:linear-gradient(90deg,var(--purple),transparent)}.stat-label{font-size:12px;color:var(--text3);font-weight:500;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em}.stat-value{font-size:28px;font-weight:800;color:#fff}.stat-value span{font-size:14px;font-weight:500;color:var(--text3);margin-left:4px}.section{margin-bottom:48px}.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)}.section-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}.section-icon.green{background:var(--green-glow)}.section-icon.blue{background:var(--blue-glow)}.section-icon.orange{background:var(--orange-glow)}.section-title{font-size:18px;font-weight:700;color:#fff;flex:1}.section-count{font-size:12px;color:var(--text3);background:var(--surface2);padding:3px 10px;border-radius:12px;border:1px solid var(--border)}.summary-card{background:linear-gradient(135deg,var(--surface),rgba(59,130,246,0.03));border:1px solid var(--border2);border-radius:var(--radius);overflow:hidden;margin-bottom:48px;box-shadow:0 4px 32px rgba(0,0,0,0.2)}.summary-head{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(59,130,246,0.06),rgba(168,85,247,0.04));border-bottom:1px solid var(--border)}.summary-head h3{font-size:15px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}.impact{font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;background:var(--red-glow);color:var(--red);border:1px solid rgba(239,68,68,0.2)}.summary-body{padding:24px;font-size:15px;line-height:1.9;white-space:pre-wrap}.table-wrap{border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);box-shadow:0 2px 16px rgba(0,0,0,0.15)}table{width:100%;border-collapse:collapse;font-size:13px}thead{background:linear-gradient(135deg,var(--surface2),var(--surface3))}thead th{padding:14px 18px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text3);border-right:1px solid var(--border)}thead th:last-child{border-right:none}tbody{background:var(--surface)}tbody tr{border-bottom:1px solid var(--border);transition:background .2s}tbody tr:hover{background:rgba(59,130,246,0.03)}tbody tr:last-child{border-bottom:none}.td{padding:14px 18px;vertical-align:top;border-right:1px solid var(--border)}.td:last-child{border-right:none}.td-id{text-align:center;font-family:var(--mono);font-weight:500;font-size:13px;width:64px}.td-id.green{color:var(--green)}.td-id.blue{color:var(--blue)}.td-issue{color:var(--text);line-height:1.75;white-space:pre-wrap;min-width:200px}.td-count{text-align:center;font-weight:800;color:#fff;width:56px;font-size:16px}.td-sid{text-align:center;font-family:var(--mono);color:var(--purple);font-size:13px;width:64px}.td-sug{color:var(--text2);line-height:1.75;white-space:pre-wrap}@media(max-width:768px){.table-wrap{overflow-x:auto}table{min-width:680px}}.ai-wrap{background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);padding:28px}.ai-card{display:flex;gap:28px;padding:24px 0;border-bottom:1px solid var(--border)}.ai-card:first-child{padding-top:0}.ai-card:last-child{border-bottom:none;padding-bottom:0}@media(max-width:768px){.ai-card{flex-direction:column}}.ai-card-img{flex:1;display:flex;flex-direction:column;gap:8px}.ai-card-text{flex:1;display:flex;flex-direction:column;gap:14px}.ai-label{font-size:11px;color:var(--text3);font-weight:500;text-transform:uppercase;letter-spacing:0.04em}.ai-img-box{border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border);background:#000;min-height:140px;display:flex;align-items:center;justify-content:center}.ai-img-box img{width:100%;display:block;cursor:pointer;transition:opacity .2s}.ai-img-box img:hover{opacity:.9}.ai-img-box .no-img{color:var(--text3);font-size:12px;padding:32px;text-align:center}.ai-tag-row{display:flex;align-items:center;gap:10px}.ai-tag{font-size:11px;font-family:var(--mono);padding:4px 12px;border-radius:8px;background:var(--orange-glow);color:var(--orange);border:1px solid rgba(249,115,22,0.2);font-weight:500}.ai-tag-title{font-size:14px;font-weight:700;color:var(--orange)}.ai-block{padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border)}.ai-block.obs{background:rgba(59,130,246,0.03);border-color:rgba(59,130,246,0.1)}.ai-block.sug{background:rgba(168,85,247,0.03);border-color:rgba(168,85,247,0.1)}.ai-block-title{font-size:12px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:6px}.ai-block-title.obs{color:var(--blue)}.ai-block-title.sug{color:var(--purple)}.ai-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.ai-list li{font-size:13px;color:var(--text);line-height:1.7;padding-left:16px;position:relative}.ai-list li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:50%}.ai-list.obs li::before{background:var(--blue)}.ai-list.sug li::before{background:var(--purple)}.footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--border);text-align:center;color:var(--text3);font-size:12px}#lb{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);backdrop-filter:blur(16px);justify-content:center;align-items:center;cursor:pointer}#lb.open{display:flex}#lb-x{position:absolute;top:20px;right:28px;background:none;border:none;color:#fff;font-size:36px;cursor:pointer;opacity:.6;transition:opacity .2s;z-index:10000;line-height:1}#lb-x:hover{opacity:1}#lb img{max-width:92vw;max-height:90vh;object-fit:contain;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,0.6)}@media print{.ambient,.footer{display:none}body{background:#fff;color:#222}.container{padding:20px}.hero::after{display:none}.stat-card,.summary-card,.table-wrap,.ai-wrap{box-shadow:none;border-color:#ddd}.stat-card::before{display:none}thead{background:#f5f5f5}tbody tr:hover{background:none}}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:4px}`;
    const htmlContent = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(cleanData.meta.title)}</title><meta name="description" content="UX Report - ${esc(cleanData.meta.title)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="ambient"></div><div class="container"><div class="hero"><div class="hero-badge">?? UX 擃?皜祈岫?勗?</div><h1>${esc(cleanData.meta.title)}</h1><div class="hero-meta"><span class="meta-chip">?? ${esc(cleanData.meta.date)}</span><span class="meta-chip">? ${cleanData.meta.testerCount} 雿葫閰西?/span></div></div><div class="stats"><div class="stat-card green"><div class="stat-label">????</div><div class="stat-value">${critLen}<span>??/span></div></div><div class="stat-card blue"><div class="stat-label">甈∟???</div><div class="stat-value">${secLen}<span>??/span></div></div><div class="stat-card orange"><div class="stat-label">AI ????</div><div class="stat-value">${aiLen}<span>撘?/span></div></div><div class="stat-card purple"><div class="stat-label">敶梢蝑?</div><div class="stat-value" style="font-size:22px">${esc(cleanData.summary.impactLevel)}</div></div></div><div class="summary-card"><div class="summary-head"><h3>?? 雿輻??撽???蝮賜?</h3><span class="impact">Impact: ${esc(cleanData.summary.impactLevel)}</span></div><div class="summary-body">${esc(cleanData.summary.content)}</div></div><div class="section"><div class="section-header"><div class="section-icon green">?</div><div class="section-title">雿輻??撽?擖???嚗?/div><span class="section-count">${critLen} ??/span></div><div class="table-wrap"><table><thead><tr><th style="width:64px;text-align:center">蝺刻?</th><th>雿輻??撽?(Issue)</th><th style="width:56px;text-align:center">鈭箸</th><th style="width:64px;text-align:center">蝺刻?</th><th>蝯?芸?撱箄降 (Suggestion)</th></tr></thead><tbody>${issueRows(cleanData.criticalIssues,'green')}</tbody></table></div></div><div class="section"><div class="section-header"><div class="section-icon blue">?</div><div class="section-title">雿輻??撽?擖?甈∟?嚗?/div><span class="section-count">${secLen} ??/span></div><div class="table-wrap"><table><thead><tr><th style="width:64px;text-align:center">蝺刻?</th><th>雿輻??撽?(Issue)</th><th style="width:56px;text-align:center">鈭箸</th><th style="width:64px;text-align:center">蝺刻?</th><th>蝯?芸?撱箄降 (Suggestion)</th></tr></thead><tbody>${issueRows(cleanData.secondaryIssues,'blue')}</tbody></table></div></div><div class="section"><div class="section-header"><div class="section-icon orange">??</div><div class="section-title">AI ??UI/UX ???方??遣霅?/div><span class="section-count">${aiLen} 撘?/span></div><div class="ai-wrap">${aiCards || '<div style="text-align:center;color:var(--text3);padding:32px;font-size:13px">撠????鞈?</div>'}</div></div><div class="footer">Generated by UX Report Tool &middot; ${esc(cleanData.meta.date)}</div></div><div id="lb" onclick="closeLB()"><button id="lb-x" onclick="closeLB()">&times;</button><img id="lb-img" src="" onclick="event.stopPropagation()" /></div><script>function openLB(s){document.getElementById('lb-img').src=s;document.getElementById('lb').classList.add('open');}function closeLB(){document.getElementById('lb').classList.remove('open');}document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLB();});<\/script><script id="data-snapshot" type="application/json">${jsonSnapshot}<\/script></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `UX_Report_${data.meta.date}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

  };


  const isLoading = isImporting || Object.values(analyzingIds).some(v => v === true);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans overflow-hidden relative">
      <div className="w-[70%] h-full overflow-y-auto p-8 border-r border-slate-700 custom-scrollbar bg-[#0f1115]">
        <div className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{data.meta.title}</h1>
            <p className="text-slate-400 text-sm">?勗??交?: {data.meta.date} | 蝮賣葫鈭箸: {data.meta.testerCount}鈭?/p>
          </div>
          <div className="text-right">
            <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
              <button onClick={() => setPreviewMode('export')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'export' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Eye size={12} /> ?臬?勗??汗</button>
              <button onClick={() => setPreviewMode('internal')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'internal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><EyeOff size={12} /> ?折摰鞈?</button>
            </div>
          </div>
        </div>
        <div className="mb-8 bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2"><FileText size={16} /> 雿輻??撽?- 蝮賜?</h3>
            <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: {data.summary.impactLevel}</span>
          </div>
          <div className="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">{data.summary.content}</div>
        </div>
        {/* Shared Issue Table Renderer */}
        {[
          { title: '雿輻??撽?擖?(??)', issues: data.criticalIssues, color: 'text-green-400', border: 'border-green-500', cellColor: 'text-green-400', mb: 'mb-8' },
          { title: '雿輻??撽?擖?(甈∟?)', issues: data.secondaryIssues, color: 'text-blue-400', border: 'border-blue-500', cellColor: 'text-blue-400', mb: 'mb-10' }
        ].map(({ title, issues, color, border, cellColor, mb }) => (
          <div key={title} className={mb}>
            <h3 className={`text-xl font-bold ${color} mb-3 border-l-4 ${border} pl-3`}>{title}</h3>
            <div className="overflow-hidden rounded-lg border border-slate-600">
              {issues.length > 0 ? (
                <table className="w-full text-sm text-left"><thead className="text-xs uppercase bg-slate-700 text-slate-200"><tr><th className="px-4 py-3 w-16 text-center border-r border-slate-600">蝺刻?</th><th className="px-4 py-3 border-r border-slate-600">雿輻??撽?(Issue)</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">??鈭箸</th><th className="px-4 py-3 w-16 text-center border-r border-slate-600">蝺刻?</th><th className="px-4 py-3">蝯?芸?撱箄降 (Suggestion)</th></tr></thead>
                  <tbody className="divide-y divide-slate-600 bg-slate-800">
                    {issues.map((item, idx) => {
                      const sgs = Array.isArray(item.suggestions) && item.suggestions.length > 0 ? item.suggestions : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }];
                      const rs = sgs.length;
                      const isSO = item.isSuggestionOnly || item.issue === '?∩蝙?刻?撽? || item.issue === '??;
                      const issDisp = isSO ? '?? : item.issue;
                      const cntDisp = isSO ? '' : item.count;
                      return sgs.map((sg, si) => (
                        <tr key={`${idx}-${si}`} className="hover:bg-slate-750">
                          {si === 0 && (<>
                            <td rowSpan={rs} className={`px-4 py-3 text-center ${cellColor} font-mono border-r border-slate-600 align-top`}>{item.id}</td>
                            <td rowSpan={rs} className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap align-top">
                              <div className="mb-2">{issDisp}</div>
                              {previewMode === 'internal' && Array.isArray(item.relatedPersonnel) && item.relatedPersonnel.length > 0 && (
                                <div className="mt-2"><span className="text-[10px] text-blue-300 mr-2 block mb-1">?賊?鈭箏:</span><div className="flex flex-wrap gap-1">{item.relatedPersonnel.map((person, pIdx) => (<span key={pIdx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-200 border border-blue-800">{person}</span>))}</div></div>
                              )}
                            </td>
                            <td rowSpan={rs} className="px-4 py-3 text-center font-bold text-white border-r border-slate-600 align-top">{cntDisp}</td>
                          </>)}
                          <td className="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600 align-top">{sg.suggestionId}</td>
                          <td className="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap align-top">
                            <div className="mb-2">{sg.suggestion}</div>
                            {si === 0 && previewMode === 'internal' && item.bestSuggestionRawText && (<div className="bg-slate-900/30 p-2 rounded border border-slate-700/50 text-xs italic text-slate-400 mb-2 whitespace-pre-wrap"><span className="block text-[10px] text-slate-500 not-italic mb-1">??撱箄降:</span>"{item.bestSuggestionRawText}"</div>)}
                            {si === 0 && previewMode === 'internal' && (item.bestSuggester && item.bestSuggester.name) && (<div className="text-xs flex items-center gap-1 text-orange-400"><span>?? ?雿喳遣霅啗? {item.bestSuggester.name}</span><span className="text-orange-400/60">({item.bestSuggester.account || 'No ID'})</span></div>)}
                            {sg.suggester && previewMode === 'internal' && (<div className="text-xs flex items-center gap-1 text-cyan-400 mt-1"><span>? 撱箄降?? {sg.suggester.name}</span>{sg.suggester.account && <span className="text-cyan-400/60">({sg.suggester.account})</span>}</div>)}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody></table>
              ) : <div className="p-4 text-center text-slate-500 italic">撠鞈?嚗??臬 Excel</div>}
            </div>
          </div>
        ))}
        {/* AI Image Analysis */}
        <div className="mb-8">
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-t-lg px-4 py-2 flex items-center gap-2"><AlertTriangle size={18} className="text-orange-400" /><h3 className="text-lg font-bold text-orange-100">AI - UI/UX ???方??遣霅?/h3></div>
          <div className="border-x border-b border-orange-500/30 bg-slate-800/50 p-6 rounded-b-lg space-y-8">
            {data.aiAnalysis.length > 0 ? data.aiAnalysis.map((item, idx) => (
              <div key={idx} className="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0">
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-xs text-slate-400">AI 颲刻??典???/span>
                  <div className="rounded-lg overflow-hidden border border-slate-600 relative group bg-black/40 min-h-[150px] flex items-center justify-center">
                    {item.imageUrl ? (<img src={item.imageUrl} alt="Analysis" className="w-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxImage(item.imageUrl)} title="暺??曉之??" />) : (<div className="text-slate-500 text-xs flex flex-col items-center"><ImageIcon size={24} className="mb-2 opacity-50" />撠??</div>)}
                  </div>
                </div>
                <div className="w-1/2 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30 font-mono">{item.id}</span>
                    <span className="text-orange-400 font-bold text-sm">AI 閫撖?撱箄降</span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <p className="text-slate-400 text-xs mb-2 font-bold">閫撖?(Observation)</p>
                      {Array.isArray(item.observation) && item.observation.length > 0 ? (<ul className="list-disc list-outside ml-4 space-y-1">{item.observation.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-slate-500">{point}</li>))}</ul>) : <p className="text-slate-500 text-sm">蝑???...</p>}
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded border border-purple-500/30">
                      <p className="text-purple-400 text-xs mb-2 font-bold">撱箄降 (Suggestion)</p>
                      {Array.isArray(item.suggestion) && item.suggestion.length > 0 ? (<ul className="list-disc list-outside ml-4 space-y-1">{item.suggestion.map((point, i) => (<li key={i} className="text-slate-200 text-sm leading-relaxed pl-1 marker:text-purple-500">{point}</li>))}</ul>) : <p className="text-slate-500 text-sm">蝑???...</p>}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-center text-slate-500 text-sm">撠????嚗?敺?湔憓?/div>}
          </div>
        </div>
      </div>

      {/* RIGHT: Editor */}
      <div className="w-[30%] bg-slate-800 border-l border-slate-700 flex flex-col h-full shadow-2xl z-10">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18} className="animate-spin-slow" /> ?勗?蝺刻摩??/h2>
            <div className="flex gap-1 bg-slate-800 rounded p-1">
              <button onClick={() => setActiveTab('editor')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>GUI</button>
              <button onClick={() => setActiveTab('prompts')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'prompts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Prompts</button>
              <button onClick={() => setActiveTab('json')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>JSON</button>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">?? Gemini API Key</label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">???? API Key ??/a>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 pr-8 transition-colors"
                  placeholder="頛詨?函? Gemini API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {!apiKey && <p className="text-[10px] text-amber-400/80 mt-1.5">?? ?閬?API Key ?雿輻 AI ????Excel ?臬?</p>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'editor' && (<EditorTab data={data} previewMode={previewMode} isImporting={isImporting} analyzingIds={analyzingIds} updateField={updateField} addItem={addItem} removeItem={removeItem} updateListItem={updateListItem} handleFileUpload={handleFileUpload} handleHtmlImport={handleHtmlImport} handleImageUpload={handleImageUpload} analyzeImage={analyzeImage} />)}
          {activeTab === 'prompts' && (<PromptsTab uxExpertPrompt={uxExpertPrompt} setUxExpertPrompt={setUxExpertPrompt} dataImportPrompt={dataImportPrompt} setDataImportPrompt={setDataImportPrompt} />)}
          {activeTab === 'json' && (<div className="h-full flex flex-col"><p className="text-xs text-slate-400 mb-2">摰 Raw Data JSON嚗?/p><textarea className="flex-1 w-full bg-slate-950 font-mono text-xs text-green-400 p-4 rounded border border-slate-700 outline-none resize-none" value={jsonInput} onChange={handleJsonChange} spellCheck="false" /></div>)}
        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-900 space-y-2">
          <button onClick={handleShareReport} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"><Share2 size={18} /> ?澈?勗????</button>
          <button onClick={handleExportHtml} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded flex items-center justify-center gap-2 transition-all text-sm"><Download size={16} /> 銝? HTML 瑼?</button>
        </div>
      </div>
      {isLoading && (<div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center cursor-not-allowed"><Loader2 size={48} className="text-blue-400 animate-spin mb-4" /><p className="text-white text-lg font-bold tracking-wider">鞈???銝?..</p></div>)}
      {lightboxImage && (<div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center cursor-pointer" onClick={() => setLightboxImage(null)}><button onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }} className="absolute top-5 right-7 text-white/80 hover:text-white transition-colors text-4xl leading-none z-10">&times;</button><img src={lightboxImage} alt="Enlarged" className="max-w-[92vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} /></div>)}
      {modalConfig.isOpen && (<div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-sm w-full relative"><button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={18} /></button><div className="p-6"><div className="flex items-center gap-3 mb-4">{modalConfig.isError ? (<AlertTriangle className="text-red-400" size={24} />) : (<MessageSquare className="text-blue-400" size={24} />)}<h3 className={`text-lg font-bold ${modalConfig.isError ? 'text-red-400' : 'text-blue-400'}`}>{modalConfig.title}</h3></div><p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">{modalConfig.message}</p><div className="flex justify-end"><button onClick={closeModal} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm font-medium">蝣箏?</button></div></div></div></div>)}
    </div>
  );
};

// Sub-components to keep the main component clean
const EditorTab = ({ data, isImporting, analyzingIds, updateField, addItem, removeItem, updateListItem, handleFileUpload, handleHtmlImport, handleImageUpload, analyzeImage }) => (
  <>
    <div className="mb-4 bg-slate-700/30 border border-slate-600 rounded-lg p-3">
      <h4 className="text-slate-300 text-xs font-bold mb-2 flex items-center gap-2"><FolderInput size={14} /> ?臬?? HTML ?勗?</h4>
      <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 rounded py-2 px-3 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-xs text-slate-300"><Code size={14} /><span>?豢? HTML 瑼???</span><input type="file" accept=".html" className="hidden" onChange={handleHtmlImport} /></label>
    </div>
    <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
      <h4 className="text-blue-400 text-sm font-bold mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> ?臬 Excel ??鞈?</h4>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">銝雿輻??撽?擖? Excel (.xlsx)嚗I 撠??瘣征瘣?擖雿萇隡澆?憿絞閮?蒂甇貊?????/p>
      <label className={`flex items-center justify-center gap-2 w-full py-3 rounded border border-dashed cursor-pointer transition-all ${isImporting ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-blue-600/10 border-blue-500/50 text-blue-300 hover:bg-blue-600/20'}`}>
        {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
        <span className="text-xs font-bold">{isImporting ? "AI 甇???鞈?..." : "暺?銝 Excel 瑼?}</span>
        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
      </label>
    </div>
    <div className="space-y-6">
      <Section title="1. ?勗??箇?鞈?">
        <InputGroup label="?勗?璅?" value={data.meta.title} onChange={(e) => updateField('meta.title', e.target.value)} />
        <div className="grid grid-cols-2 gap-2"><InputGroup label="?交?" type="date" value={data.meta.date} onChange={(e) => updateField('meta.date', e.target.value)} /><InputGroup label="皜祈岫蝮賭犖?? type="number" value={data.meta.testerCount} onChange={(e) => updateField('meta.testerCount', parseInt(e.target.value))} /></div>
      </Section>
      <Section title="2. 擃?蝮賜? (Summary)">
        <textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none h-32 leading-relaxed" value={data.summary.content} onChange={(e) => updateField('summary.content', e.target.value)} />
      </Section>
      <Section title="3. ???? (Critical)">
        {data.criticalIssues.map((item, idx) => <IssueEditor key={idx} listName="criticalIssues" item={item} idx={idx} colorClass="text-green-400" removeItem={removeItem} updateListItem={updateListItem} />)}
        <button onClick={() => addItem('criticalIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> ?啣?????</button>
      </Section>
      <Section title="4. 甈∟??? (Secondary)">
        {data.secondaryIssues.map((item, idx) => <IssueEditor key={idx} listName="secondaryIssues" item={item} idx={idx} colorClass="text-blue-400" removeItem={removeItem} updateListItem={updateListItem} />)}
        <button onClick={() => addItem('secondaryIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> ?啣?甈∟???</button>
      </Section>
      <Section title="5. AI ???? (Smart Analysis)">
        {data.aiAnalysis.map((item, idx) => (
          <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
            <button onClick={() => removeItem('aiAnalysis', idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={14} /></button>
            <div className="mb-3"><label className="text-xs text-slate-500 mb-1 block">1. 銝??芸?</label><div className="flex gap-2 items-center">
              <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 border-dashed rounded h-16 flex flex-col items-center justify-center hover:bg-slate-700 transition-colors relative overflow-hidden">{item.imageUrl ? (<img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Preview" />) : null}<div className="relative z-10 flex flex-col items-center"><Upload size={16} className="text-slate-400" /><span className="text-[10px] text-slate-400 mt-1">暺?銝</span></div><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} /></label>
              <button onClick={() => analyzeImage(idx, item.imageUrl)} disabled={analyzingIds[idx] || !item.imageUrl} className={`h-16 w-16 rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${analyzingIds[idx] ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : !item.imageUrl ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-900/20'}`}>{analyzingIds[idx] ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{analyzingIds[idx] ? '??銝? : 'AI ??'}</button>
            </div></div>
            <div className="mt-2"><label className="text-xs text-slate-500 mb-1 block">AI 閫撖?(瘥?銝暺?</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-20" value={Array.isArray(item.observation) ? item.observation.join('\n') : item.observation} onChange={(e) => updateListItem('aiAnalysis', idx, 'observation', e.target.value.split('\n'))} placeholder="蝑? AI ??..." /></div>
            <div className="mt-1"><label className="text-xs text-purple-400/70 mb-1 block">UIUX 撱箄降 (瘥?銝暺?</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-purple-300 h-24" value={Array.isArray(item.suggestion) ? item.suggestion.join('\n') : item.suggestion} onChange={(e) => updateListItem('aiAnalysis', idx, 'suggestion', e.target.value.split('\n'))} placeholder="蝑? AI ??..." /></div>
          </div>
        ))}
        <button onClick={() => addItem('aiAnalysis')} className="w-full py-2 border border-dashed border-orange-500/50 rounded text-orange-400 hover:text-orange-200 hover:border-orange-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> ?啣?????</button>
      </Section>
    </div>
  </>
);

const IssueEditor = ({ listName, item, idx, colorClass, removeItem, updateListItem }) => (
  <div className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
    <button onClick={() => removeItem(listName, idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
    <div className="flex gap-2 mb-2">
      <input className={`w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs ${colorClass}`} value={item.id} onChange={(e) => updateListItem(listName, idx, 'id', e.target.value)} />
      <input className="w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs text-white text-center" type="number" value={item.count} onChange={(e) => updateListItem(listName, idx, 'count', parseInt(e.target.value))} title="鈭箸" />
    </div>
    <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-16" placeholder="???膩..." value={item.issue} onChange={(e) => updateListItem(listName, idx, 'issue', e.target.value)} />
    <div className="mb-2"><label className="text-[10px] text-blue-300 block mb-1">?賊?鈭箏 (???, 隞仿???)</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-blue-200" placeholder="UserA, UserB..." value={Array.isArray(item.relatedPersonnel) ? item.relatedPersonnel.join(', ') : ""} onChange={(e) => updateListItem(listName, idx, 'relatedPersonnel', e.target.value.split(',').map(s => s.trim()))} /></div>
    <textarea className="w-full bg-slate-800 border border-slate-600/50 rounded p-2 text-xs text-purple-300 h-16 mb-2" placeholder="?芸?撱箄降..." value={item.suggestion} onChange={(e) => updateListItem(listName, idx, 'suggestion', e.target.value)} />
    <div className="bg-slate-800 border border-slate-700 rounded p-2">
      <div className="text-[10px] text-orange-400 mb-1 flex items-center gap-1 font-bold"><Trophy size={10} /> ?雿喳遣霅唳?靘?/div>
      <div className="flex gap-2 mb-2"><input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300" placeholder="憪?" value={item.bestSuggester?.name || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, name: e.target.value })} /><input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400" placeholder="撣唾?" value={item.bestSuggester?.account || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, account: e.target.value })} /></div>
      <textarea className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400 italic" placeholder="?????批捆 (Raw Content)..." value={item.bestSuggestionRawText || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggestionRawText', e.target.value)} />
    </div>
  </div>
);

const PromptsTab = ({ uxExpertPrompt, setUxExpertPrompt, dataImportPrompt, setDataImportPrompt }) => (
  <div className="space-y-6 h-full flex flex-col">
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
      <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2"><ImageIcon size={16} /> AI ?????誘 (Image Prompt)</h4>
      <p className="text-xs text-slate-400 mb-2">?暺??I ??????嚗?策 AI ??隞扎?臭誑?寞?撠??瘙凝隤踹???頛胯?/p>
      <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-orange-500 resize-none" value={uxExpertPrompt} onChange={(e) => setUxExpertPrompt(e.target.value)} spellCheck="false" />
    </div>
    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
      <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel ?臬???誘 (Data Prompt)</h4>
      <p className="text-xs text-slate-400 mb-2">??臬 Excel 瑼???AI ?冽皜??雿菔???鞈???隞扎隤踵?瑼?(憒?35%) ??憿???/p>
      <textarea className="flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none focus:border-blue-500 resize-none" value={dataImportPrompt} onChange={(e) => setDataImportPrompt(e.target.value)} spellCheck="false" />
    </div>
  </div>
);

const Section = ({ title, children }) => (<div className="border border-slate-600/50 rounded-lg p-3 bg-slate-800/50"><h4 className="text-sm font-bold text-blue-400 mb-3 pb-2 border-b border-slate-600/50 flex items-center justify-between">{title}</h4>{children}</div>);
const InputGroup = ({ label, type = "text", value, onChange }) => (<div className="mb-2"><label className="text-xs text-slate-400 block mb-1">{label}</label><input type={type} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none transition-colors" value={value} onChange={onChange} /></div>);

// --- Render ---
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
