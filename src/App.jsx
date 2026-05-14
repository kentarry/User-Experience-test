import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Download, FileText, Plus, Trash2, Image as ImageIcon,
  AlertTriangle, Loader2, Sparkles, Upload, FileSpreadsheet,
  Code, Trophy, FolderInput, Eye, EyeOff, X, MessageSquare, Share2, Link as LinkIcon,
  Lock, RefreshCcw, Zap, RotateCcw
} from 'lucide-react';

import Section from './components/Section';
import InputGroup from './components/InputGroup';
import ToastContainer from './components/Toast';
import DashboardStats from './components/DashboardStats';
import ProgressStepper from './components/ProgressStepper';
import OnboardingGuide from './components/OnboardingGuide';
import { initialData, DEFAULT_UX_EXPERT_PROMPT, DEFAULT_DATA_IMPORT_PROMPT } from './constants';
import { callGemini, parseAIJson, validateApiKey } from './utils/gemini';
import { exportHtmlReport } from './utils/exportHtml';
import { importExcelFile } from './utils/importExcel';
import LZString from 'lz-string';

const App = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ux_report_api_key') || import.meta.env.VITE_GEMINI_API_KEY || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [apiStatus, setApiStatus] = useState('idle'); // idle | checking | valid | invalid

  // Toast system
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const addToast = useCallback((message, type = 'info', title = '', duration = 4000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, title, duration }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Modal (only for errors now)
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', isError: false });
  const showModal = (message, title = '提示', isError = false) => {
    if (!isError) {
      addToast(message, 'success', title);
      return;
    }
    setModalConfig({ isOpen: true, title, message, isError });
  };
  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('editor');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(initialData, null, 2));
  const [previewMode, setPreviewMode] = useState('export');

  const [uxExpertPrompt] = useState(DEFAULT_UX_EXPERT_PROMPT);
  const [dataImportPrompt] = useState(DEFAULT_DATA_IMPORT_PROMPT);

  const [analyzingIds, setAnalyzingIds] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Persist API Key
  useEffect(() => {
    if (apiKey) localStorage.setItem('ux_report_api_key', apiKey);
  }, [apiKey]);

  // Validate API Key on change
  useEffect(() => {
    if (!apiKey || apiKey.length < 10) { setApiStatus('idle'); return; }
    setApiStatus('checking');
    const timer = setTimeout(async () => {
      const result = await validateApiKey(apiKey);
      setApiStatus(result.valid ? 'valid' : 'invalid');
      if (result.valid) addToast('API Key 驗證成功，已就緒', 'success', '連線成功');
    }, 800);
    return () => clearTimeout(timer);
  }, [apiKey, addToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleExportHtml(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); setPreviewMode(p => p === 'export' ? 'internal' : 'export'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to webp for ultra-small base64 size
        const compressedBase64 = canvas.toDataURL('image/webp', 0.6);
        updateListItem('aiAnalysis', index, 'imageUrl', compressedBase64);
        analyzeImage(index, compressedBase64);
      };
      img.src = reader.result;
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
      const payload = {
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

  const handleShareReport = async () => {
    try {
      showModal('正在產生分享連結，請稍候...', '處理中');
      let shareData = { ...data };
      let payload = JSON.stringify(shareData);
      let isImageStripped = false;

      // 網址長度有限制，如果超過 30000 字元，移除圖片以節省空間
      if (payload.length > 30000) {
        isImageStripped = true;
        shareData.aiAnalysis = shareData.aiAnalysis.map(item => ({
          ...item,
          imageUrl: "" // 移除圖片以減少 payload 大小
        }));
        payload = JSON.stringify(shareData);

        if (payload.length > 150000) {
          throw new Error('資料量過大，無法產生分享連結。請直接使用「下載 HTML 檔案」。');
        }
      }

      // 使用 LZString 壓縮，並直接作為 URL 的 hash
      const compressed = LZString.compressToEncodedURIComponent(payload);
      const basePath = window.location.href.replace(/\/[^\/]*$/, '');
      const shareUrl = basePath + '/view.html#' + compressed;

      let successMsg = '✅ 分享連結已複製到剪貼簿！\n\n您可以直接貼給專案成員。\n\n📝 注意：若資料量過大無法在部分通訊軟體開啟，請改用「下載 HTML 檔案」。';
      if (isImageStripped) {
        successMsg = '⚠️ 由於包含的圖片過多/過大，為產生分享連結，【圖片已被自動移除】(文字建議仍保留)。\n\n✅ 連結已複製到剪貼簿！\n\n若專案成員需要檢視完整圖片，請改用「下載 HTML 檔案」並傳送給對方。';
      }

      navigator.clipboard.writeText(shareUrl).then(() => {
        showModal(successMsg, isImageStripped ? '連結已複製 (不含圖片)' : '連結已複製');
      }).catch(() => {
        prompt('請手動複製以下連結：', shareUrl);
        showModal(successMsg, isImageStripped ? '連結產生成功 (不含圖片)' : '連結產生成功');
      });
    } catch (err) {
      showModal('產生分享連結失敗: ' + err.message, '錯誤', true);
    }
  };

  // --- Loading state ---
  const isLoading = isImporting || Object.values(analyzingIds).some(v => v === true);

  // --- Issue table renderer (shared between critical & secondary) ---
  const renderNormalIssueRows = (item, idx, colorClass) => {
    const suggestions = Array.isArray(item.suggestions) && item.suggestions.length > 0
      ? item.suggestions
      : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }];
    const rowSpan = suggestions.length;

    return suggestions.map((sug, sIdx) => (
      <tr key={`${idx}-${sIdx}`} className="hover:bg-slate-750">
        {sIdx === 0 && (
          <>
            <td rowSpan={rowSpan} className={`px-4 py-3 text-center ${colorClass} font-mono border-r border-slate-600 align-top`}>{item.id}</td>
            <td rowSpan={rowSpan} className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap align-top">
              <div className="mb-2">{item.issue}</div>
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
            <td rowSpan={rowSpan} className="px-4 py-3 text-center font-bold text-white border-r border-slate-600 align-top">{item.count}</td>
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

  // Render grouped "suggestion-only" rows with merged cells for id and issue
  const renderSuggestionOnlyGroup = (soItems, colorClass) => {
    if (soItems.length === 0) return null;
    // Count total suggestion rows across all suggestion-only items
    const allSugRows = [];
    soItems.forEach((item) => {
      const suggestions = Array.isArray(item.suggestions) && item.suggestions.length > 0
        ? item.suggestions
        : [{ suggestionId: item.suggestionId || '', suggestion: item.suggestion || '' }];
      suggestions.forEach((sug, sIdx) => {
        allSugRows.push({ item, sug, sIdx, isFirst: sIdx === 0 });
      });
    });
    const totalRows = allSugRows.length;

    return allSugRows.map((row, rowIdx) => (
      <tr key={`so-${rowIdx}`} className="hover:bg-slate-750">
        {rowIdx === 0 && (
          <>
            <td rowSpan={totalRows} className={`px-4 py-3 text-center ${colorClass} font-mono border-r border-slate-600 align-middle`}>{allSugRows[0].item.id}</td>
            <td rowSpan={totalRows} className="px-4 py-3 text-slate-200 border-r border-slate-600 leading-relaxed whitespace-pre-wrap align-middle text-center">
              <div className="text-slate-400 italic">無對應使用者體驗</div>
            </td>
            <td rowSpan={totalRows} className="px-4 py-3 text-center font-bold text-white border-r border-slate-600 align-middle"></td>
          </>
        )}
        <td className="px-4 py-3 text-center text-purple-400 font-mono border-r border-slate-600 align-top">{row.sug.suggestionId}</td>
        <td className="px-4 py-3 text-slate-300 leading-relaxed whitespace-pre-wrap align-top">
          <div className="mb-2">{row.sug.suggestion}</div>
          {row.isFirst && previewMode === 'internal' && row.item.bestSuggestionRawText && (
            <div className="bg-slate-900/30 p-2 rounded border border-slate-700/50 text-xs italic text-slate-400 mb-2 whitespace-pre-wrap">
              <span className="block text-[10px] text-slate-500 not-italic mb-1">原始建議:</span>
              &quot;{row.item.bestSuggestionRawText}&quot;
            </div>
          )}
          {row.isFirst && previewMode === 'internal' && row.item.bestSuggester?.name && (
            <div className="text-xs flex items-center gap-1 text-orange-400">
              <span>🏆 建議者: {row.item.bestSuggester.name}</span>
              <span className="text-orange-400/60">({row.item.bestSuggester.account || 'No ID'})</span>
            </div>
          )}
        </td>
      </tr>
    ));
  };

  const renderIssueTable = (title, issues, colorClass, borderColorClass) => {
    // Separate normal issues from suggestion-only items
    const normalIssues = issues.filter(item => !item.isSuggestionOnly && item.issue !== "無使用者體驗" && item.issue !== "無" && item.issue !== "無對應使用者體驗");
    const soIssues = issues.filter(item => item.isSuggestionOnly || item.issue === "無使用者體驗" || item.issue === "無" || item.issue === "無對應使用者體驗");

    return (
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
                {normalIssues.map((item, idx) => renderNormalIssueRows(item, idx, colorClass))}
                {renderSuggestionOnlyGroup(soIssues, colorClass)}
              </tbody>
            </table>
          ) : <div className="p-4 text-center text-slate-500 italic">尚無資料，請匯入 Excel</div>}
        </div>
      </div>
    );
  };

  // --- Issue editor (shared between critical & secondary) ---
  const renderIssueEditor = (listName, item, idx) => (
    <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
      <button onClick={() => removeItem(listName, idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
      <div className="flex gap-2 mb-2">
        <input className={`w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs ${listName === 'criticalIssues' ? 'text-green-400' : 'text-blue-400'}`} value={item.id} onChange={(e) => updateListItem(listName, idx, 'id', e.target.value)} />
        <input className="w-16 bg-slate-800 border border-slate-600 rounded px-2 text-xs text-white text-center" type="number" value={item.count} onChange={(e) => updateListItem(listName, idx, 'count', parseInt(e.target.value) || 0)} title="人數" />
      </div>
      <textarea className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-slate-300 mb-2 h-16" placeholder="問題描述..." value={item.issue} onChange={(e) => updateListItem(listName, idx, 'issue', e.target.value)} />
      <div className="mb-2">
        <label className="text-[10px] text-blue-300 block mb-1">相關人員 (陣列, 以逗號分隔)</label>
        <textarea className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-blue-200" placeholder="UserA, UserB..." value={Array.isArray(item.relatedPersonnel) ? item.relatedPersonnel.join(', ') : ""} onChange={(e) => updateListItem(listName, idx, 'relatedPersonnel', e.target.value.split(',').map(s => s.trim()))} />
      </div>
      <textarea className="w-full bg-slate-800 border border-slate-600/50 rounded p-2 text-xs text-purple-300 h-16 mb-2" placeholder="優化建議..." value={item.suggestion} onChange={(e) => updateListItem(listName, idx, 'suggestion', e.target.value)} />
      <div className="bg-slate-800 border border-slate-700 rounded p-2">
        <div className="text-[10px] text-orange-400 mb-1 flex items-center gap-1 font-bold"><Trophy size={10} /> 最佳建議提供者</div>
        <div className="flex gap-2 mb-2">
          <input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300" placeholder="姓名" value={item.bestSuggester?.name || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, name: e.target.value })} />
          <input className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400" placeholder="帳號" value={item.bestSuggester?.account || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggester', { ...item.bestSuggester, account: e.target.value })} />
        </div>
        <textarea className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-400 italic" placeholder="原始回饋內容 (Raw Content)..." value={item.bestSuggestionRawText || ""} onChange={(e) => updateListItem(listName, idx, 'bestSuggestionRawText', e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden relative">

      {/* === Left Side: Preview === */}
      <div className="w-[70%] h-full overflow-y-auto p-8 border-r border-slate-800 custom-scrollbar bg-slate-950 relative z-10">

        {/* Dashboard Stats */}
        <DashboardStats data={data} />

        <div className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 mb-3">
              <Sparkles size={12} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400 tracking-wider uppercase">UX Report</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{data.meta.title}</h1>
            <p className="text-slate-400 text-sm">報告日期: {data.meta.date} | 總測人數: {data.meta.testerCount}人</p>
          </div>
          <div className="text-right">
            <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
              <button onClick={() => setPreviewMode('export')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'export' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                <Eye size={12} /> 匯出報告預覽
              </button>
              <button onClick={() => setPreviewMode('internal')} className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${previewMode === 'internal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                <EyeOff size={12} /> 內部完整資料
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2"><FileText size={16} /> 使用者體驗 - 總結</h3>
            <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded border border-red-500/30">Impact: {data.summary.impactLevel}</span>
          </div>
          <div className="p-5 text-slate-200 leading-relaxed text-lg whitespace-pre-wrap">{data.summary.content}</div>
        </div>

        {renderIssueTable('使用者體驗回饋 (重要)', data.criticalIssues, 'text-green-500', 'border-green-500')}
        {renderIssueTable('使用者體驗回饋 (次要)', data.secondaryIssues, 'text-blue-500', 'border-blue-500')}

        {/* AI Image Analysis Preview */}
        <div className="mb-8">
          <div className="bg-slate-800 border border-slate-800 rounded-t-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-400" />
            <h3 className="text-lg font-bold text-slate-200">AI - UI/UX 圖像判讀與建議</h3>
          </div>
          <div className="border-x border-b border-slate-800 bg-slate-900 p-6 rounded-b-lg space-y-8">
            {data.aiAnalysis.length > 0 ? data.aiAnalysis.map((item, idx) => (
              <div key={idx} className="flex gap-6 border-b border-slate-700 pb-6 last:border-0 last:pb-0">
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-xs text-slate-400">AI 辨識用圖片</span>
                  <div className="rounded-lg overflow-hidden border border-slate-600 relative group bg-black/40 min-h-[150px] flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="Analysis" className="w-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setLightboxImage(item.imageUrl)} title="點擊放大圖片" />
                    ) : (
                      <div className="text-slate-500 text-xs flex flex-col items-center">
                        <ImageIcon size={24} className="mb-2 opacity-50" />尚無圖片
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
      <div className="w-[30%] bg-slate-900 border-l border-slate-800 flex flex-col h-full z-10">
        <div className="p-4 bg-slate-900 border-b border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings size={18} /> 報告編輯器
            </h2>
            <div className="flex gap-1 bg-slate-800 rounded p-1">
              <button onClick={() => setActiveTab('editor')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>GUI</button>
              <button onClick={() => setActiveTab('prompts')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'prompts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Prompts</button>
              <button onClick={() => setActiveTab('json')} className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>JSON</button>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                🔑 Gemini API Key
                <span className={`api-status-dot ${apiStatus}`} title={apiStatus === 'valid' ? '已連線' : apiStatus === 'invalid' ? '無效金鑰' : apiStatus === 'checking' ? '驗證中...' : '未設定'} />
              </label>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">取得 API Key →</a>
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
            {apiStatus === 'valid' && <p className="text-[10px] text-emerald-400/80 mt-1.5">✅ API Key 已驗證，可正常使用</p>}
            {apiStatus === 'invalid' && <p className="text-[10px] text-red-400/80 mt-1.5">❌ API Key 無效，請重新輸入</p>}
          </div>
        </div>

        {/* Progress Stepper */}
        <ProgressStepper
          apiKey={apiKey}
          hasData={data.criticalIssues.length > 0 || data.secondaryIssues.length > 0}
          hasAiAnalysis={data.aiAnalysis.length > 0}
        />

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'editor' && (
            <>
              {/* Onboarding Guide - always available, collapsed by default */}
              <OnboardingGuide />

              {/* HTML Import */}
              <div className="mb-4 bg-slate-700/30 border border-slate-600 rounded-lg p-3">
                <h4 className="text-slate-300 text-xs font-bold mb-2 flex items-center gap-2"><FolderInput size={14} /> 匯入舊版 HTML 報告</h4>
                <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 rounded py-2 px-3 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-xs text-slate-300">
                  <Code size={14} /><span>選擇 HTML 檔案還原</span>
                  <input type="file" accept=".html" className="hidden" onChange={handleHtmlImport} />
                </label>
              </div>

              {/* Excel Import */}
              <div
                className={`mb-6 rounded-lg p-4 transition-all ${dragOver ? 'bg-slate-800 border-2 border-blue-500 drop-zone-active' : 'bg-slate-800/50 border border-slate-700'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileUpload({ target: { files: e.dataTransfer.files } }); }}
              >
                <h4 className="text-slate-300 text-sm font-bold mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> 匯入 Excel 原始資料</h4>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">上傳使用者體驗回饋的 Excel (.xlsx)，AI 將自動清洗空洞回饋、整併相似問題、統計頻率並歸納重點。</p>
                <label className={`flex items-center justify-center gap-2 w-full py-3 rounded border border-dashed cursor-pointer transition-all ${isImporting ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                  {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
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
                  <button onClick={() => addItem('criticalIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增重要問題</button>
                </Section>

                <Section title="4. 次要問題 (Secondary)">
                  {data.secondaryIssues.map((item, idx) => renderIssueEditor('secondaryIssues', item, idx))}
                  <button onClick={() => addItem('secondaryIssues')} className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 hover:text-white hover:border-slate-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增次要問題</button>
                </Section>

                <Section title="5. AI 圖像分析 (Smart Analysis)">
                  {data.aiAnalysis.map((item, idx) => (
                    <div key={idx} className="mb-4 bg-slate-900/50 p-3 rounded border border-slate-700 relative group">
                      <button onClick={() => removeItem('aiAnalysis', idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={14} /></button>
                      <div className="mb-3">
                        <label className="text-xs text-slate-500 mb-1 block">1. 上傳遊戲截圖</label>
                        <div className="flex gap-2 items-center">
                          <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-600 border-dashed rounded h-16 flex flex-col items-center justify-center hover:bg-slate-700 transition-colors relative overflow-hidden">
                            {item.imageUrl && <img src={item.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Preview" />}
                            <div className="relative z-10 flex flex-col items-center"><Upload size={16} className="text-slate-400" /><span className="text-[10px] text-slate-400 mt-1">點擊上傳</span></div>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e)} />
                          </label>
                          <button onClick={() => analyzeImage(idx, item.imageUrl)} disabled={analyzingIds[idx] || !item.imageUrl}
                            className={`h-16 w-16 rounded flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition-all ${analyzingIds[idx] ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : !item.imageUrl ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-900/20'}`}>
                            {analyzingIds[idx] ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
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
                  <button onClick={() => addItem('aiAnalysis')} className="w-full py-2 border border-dashed border-orange-500/50 rounded text-orange-400 hover:text-orange-200 hover:border-orange-400 text-xs flex items-center justify-center gap-1"><Plus size={14} /> 新增圖片分析</button>
                </Section>
              </div>
            </>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6 h-full flex flex-col">
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
                <Lock size={14} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">提示詞為唯讀模式，已鎖定以確保分析品質穩定</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2"><ImageIcon size={16} /> AI 圖像分析指令 (Image Prompt) <Lock size={12} className="text-slate-500" /></h4>
                <p className="text-xs text-slate-400 mb-2">點擊「AI 分析」按鈕時發送給 AI 的指令。</p>
                <textarea className="prompt-locked flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none resize-none cursor-not-allowed" value={uxExpertPrompt} readOnly spellCheck="false" />
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2"><FileSpreadsheet size={16} /> Excel 匯入分析指令 (Data Prompt) <Lock size={12} className="text-slate-500" /></h4>
                <p className="text-xs text-slate-400 mb-2">匯入 Excel 檔案時，AI 用於清洗、整併與分類資料的指令。</p>
                <textarea className="prompt-locked flex-1 w-full bg-slate-900 border border-slate-600 rounded p-3 text-xs text-slate-300 font-mono leading-relaxed outline-none resize-none cursor-not-allowed" value={dataImportPrompt} readOnly spellCheck="false" />
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

        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-2">
          <button onClick={handleShareReport} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all">
            <Share2 size={18} /> 分享報告連結
          </button>
          <div className="flex gap-2">
            <button onClick={handleExportHtml} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg flex items-center justify-center gap-2 transition-all text-sm">
              <Download size={16} /> 下載 HTML
            </button>
            <button onClick={() => { if (confirm('確定要清空所有資料嗎？')) { syncState(initialData); addToast('已重置為預設狀態', 'info', '資料已清空'); } }} className="py-2.5 px-4 bg-slate-700 hover:bg-red-900/50 hover:border-red-500/30 text-slate-400 hover:text-red-300 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all text-sm border border-transparent">
              <RotateCcw size={14} />
            </button>
          </div>
          <p className="text-[9px] text-slate-600 text-center">Ctrl+S 匯出 | Ctrl+E 切換模式</p>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center cursor-not-allowed">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-400 rounded-full animate-spin" />
          </div>
          <p className="text-white text-lg font-bold tracking-wider mt-6">資料處理中...</p>
          <p className="text-slate-400 text-sm mt-1">AI 正在分析，請稍候</p>
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default App;
