import * as XLSX from 'xlsx';
import { callGemini, parseAIJson } from './gemini';

/**
 * Clean suggestion text by removing date prefixes (e.g. "0413早:") and "規格建議_" prefixes.
 * The original text is preserved in bestSuggestionRawText for internal view.
 */
function cleanSuggestionText(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text.trim();
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^\d{4}[早中晚]?[:：]?\s*/g, '')
      .replace(/^規格建議[_]?\s*/g, '')
      .replace(/^[:：]\s*/g, '')
      .trim();
  } while (cleaned !== prev);
  return cleaned;
}

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

        // --- Step 1: Separate suggestion-only rows (有建議無體驗) ---
        // These are rows where the tester wrote a suggestion but no UX issue description.
        // They should always appear as individual entries, not be consumed by AI grouping.
        const suggestionOnlyRows = filteredData.filter(row =>
          (!row.uxContext || row.uxContext.trim() === '') &&
          row.suggestion && row.suggestion.trim() !== ''
        );
        const suggestionOnlyRowIds = new Set(suggestionOnlyRows.map(r => r._id));

        // --- Step 2: Collect AI matching pool for regular unmatched detection ---
        const allRawTextLines = new Set();
        [...processedCritical, ...processedSecondary].forEach(issue => {
          const raw = issue.bestSuggestionRawText || '';
          if (raw) {
            raw.split(/\r?\n/).forEach(line => {
              const t = line.trim();
              if (t) allRawTextLines.add(t);
            });
          }
        });

        const allSuggestionTexts = [];
        [...processedCritical, ...processedSecondary].forEach(issue => {
          if (issue.suggestion) allSuggestionTexts.push(issue.suggestion);
          if (Array.isArray(issue.suggestions)) {
            issue.suggestions.forEach(s => {
              if (s.suggestion) allSuggestionTexts.push(s.suggestion);
            });
          }
        });
        const combinedSuggestionText = allSuggestionTexts.join('\n');

        // --- Step 3: Check unmatched suggestions from rows WITH uxContext ---
        const unmatchedSuggestionLines = [];
        filteredData.forEach(row => {
          // Skip suggestion-only rows (handled separately in Step 4)
          if (suggestionOnlyRowIds.has(row._id)) return;
          if (!row.suggestion || row.suggestion.trim() === '') return;

          const lines = row.suggestion.split(/\r?\n/).filter(l => l.trim());
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Check 1: Exact match in bestSuggestionRawText
            if (allRawTextLines.has(trimmed)) return;

            // Check 2: Substring match in bestSuggestionRawText
            let foundInRaw = false;
            for (const rawLine of allRawTextLines) {
              if (rawLine.includes(trimmed) || trimmed.includes(rawLine)) {
                foundInRaw = true;
                break;
              }
            }
            if (foundInRaw) return;

            // Check 3: Match in AI-generated suggestion text
            if (combinedSuggestionText.includes(trimmed)) return;

            // Check 4: Fuzzy core content matching
            const coreContent = trimmed
              .replace(/^\d{4}[早中晚]?[:：]?\s*/g, '')
              .replace(/^[\d.]+\s*/g, '')
              .replace(/^\(?規格建議[_)）]?\s*/g, '')
              .replace(/^\(?[^)）]*建議[_)）]?\s*/g, '')
              .trim();

            if (coreContent.length > 6) {
              let coreMatched = false;
              for (const rawLine of allRawTextLines) {
                if (rawLine.includes(coreContent)) {
                  coreMatched = true;
                  break;
                }
              }
              if (coreMatched) return;
              if (combinedSuggestionText.includes(coreContent)) return;
            }

            unmatchedSuggestionLines.push({
              suggestion: trimmed,
              user: row.user,
              account: row.account
            });
          });
        });

        // --- Step 4: Create individual entries for suggestion-only rows ---
        // Each suggestion-only row becomes its own UX entry with "無對應使用者體驗"
        let nextUxIndex = processedCritical.length + processedSecondary.length + 1;

        suggestionOnlyRows.forEach(row => {
          const lines = row.suggestion.split(/\r?\n/).filter(l => l.trim());
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            const cleanedText = cleanSuggestionText(trimmed);
            const entry = {
              id: `UX${String(nextUxIndex++).padStart(2, '0')}`,
              issue: "無對應使用者體驗",
              count: 1,
              relatedPersonnel: [row.user],
              suggestion: cleanedText,
              suggestions: [{
                suggestionId: `S${String(globalSuggestionCounter++).padStart(2, '0')}`,
                suggestion: cleanedText
              }],
              bestSuggestionRawText: trimmed,
              bestSuggester: { name: row.user, account: row.account },
              isSuggestionOnly: true
            };
            entry.suggestionId = entry.suggestions[0].suggestionId;
            processedSecondary.push(entry);
          });
        });

        // --- Step 5: Create individual entries for remaining unmatched suggestions ---
        // These come from rows that HAD uxContext but their suggestions weren't consumed by AI
        unmatchedSuggestionLines.forEach(item => {
          const cleanedText = cleanSuggestionText(item.suggestion);
          const entry = {
            id: `UX${String(nextUxIndex++).padStart(2, '0')}`,
            issue: "無對應使用者體驗",
            count: 1,
            relatedPersonnel: [item.user],
            suggestion: cleanedText,
            suggestions: [{
              suggestionId: `S${String(globalSuggestionCounter++).padStart(2, '0')}`,
              suggestion: cleanedText
            }],
            bestSuggestionRawText: item.suggestion,
            bestSuggester: { name: item.user, account: item.account },
            isSuggestionOnly: true
          };
          entry.suggestionId = entry.suggestions[0].suggestionId;
          processedSecondary.push(entry);
        });

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
