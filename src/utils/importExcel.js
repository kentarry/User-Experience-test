import * as XLSX from 'xlsx';
import { callGemini, parseAIJson } from './gemini';

/**
 * Parse an Excel file and use Gemini AI to analyze UX feedback data.
 * @param {File} file - The uploaded Excel file.
 * @param {string} dataImportPrompt - The prompt to send to Gemini.
 * @param {string} apiKey - The Gemini API key.
 * @param {Array} existingAiAnalysis - Existing AI analysis items to preserve.
 * @returns {object} - The processed report data.
 */
export async function importExcelFile(file, dataImportPrompt, apiKey, existingAiAnalysis) {
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
