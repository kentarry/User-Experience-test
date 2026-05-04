# UX Report Tool — SKILL.md

## 📋 工具概覽

**UX Report Tool** 是一套 AI 驅動的使用者體驗測試報告生成工具。
- 匯入 Excel 原始回饋資料 → AI 自動歸納 Issue、拆分建議、統計人數
- 上傳遊戲截圖 → AI 以 UI/UX 專家角度分析
- 一鍵匯出精美 HTML 報告

---

## 🚀 快速啟動

### 方法一：CLI 腳本 (推薦)
```powershell
# 首次啟動（含 API Key 設定）
.\Run-UxReport.ps1 -ApiKey "YOUR_GEMINI_API_KEY"

# 後續啟動
.\Run-UxReport.ps1

# 建置生產版本
.\Run-UxReport.ps1 -Build
```

### 方法二：手動啟動
```powershell
npm install          # 首次需要
npm run dev          # 啟動開發伺服器
```

### 方法三：CDN 靜態版
直接在瀏覽器開啟 `index.html`，無需 Node.js 環境。
在右側面板輸入 Gemini API Key 即可使用。

---

## 📊 操作流程

### Step 1：匯入 Excel
1. 開啟工具後，在右側面板點擊「匯入 Excel 原始資料」
2. 上傳含有「使用者體驗」和「優化建議」欄位的 Excel
3. AI 會自動：
   - 清洗空洞回饋
   - 歸納相似問題為 Issue
   - 根據 35% 門檻分類重要/次要
   - **拆分多建議**：同一 Issue 對應多個建議時自動分行
   - **保留純建議**：無體驗但有建議的資料顯示為「無」

### Step 2：AI 圖像分析
1. 在「AI 圖像分析」區塊點擊「新增圖片分析」
2. 上傳遊戲截圖 → 點擊「AI 分析」
3. AI 會產出 3-5 點觀察與 3-5 點建議

### Step 3：匯出報告
1. 確認左側預覽無誤
2. 點擊「匯出 HTML 報告」

---

## 📐 資料結構說明

### Issue 物件
```json
{
  "id": "UX01",
  "issue": "使用者體驗描述",
  "count": 3,
  "relatedPersonnel": ["UserA", "UserB", "UserC"],
  "suggestions": [
    { "suggestionId": "S01", "suggestion": "第一個建議" },
    { "suggestionId": "S02", "suggestion": "第二個建議" }
  ],
  "suggestionId": "S01",
  "suggestion": "合併後的建議文字",
  "bestSuggestionRawText": "原始建議文字",
  "bestSuggester": { "name": "UserA", "account": "acc001" }
}
```

### 多建議分行規則
- AI 輸出的 `suggestion` 若含 `\n\n` 分隔符，後處理會自動拆分
- 每個分段獲得獨立的 `suggestionId` (S01, S02, ...)
- 表格中使用 `rowspan` 讓左側欄位（編號、Issue、人數）橫跨多行

### 無使用者體驗但有建議
- Excel 中 `使用者體驗` 欄位為空但 `優化建議` 有內容
- 會被歸類為 `isSuggestionOnly: true`
- Issue 欄顯示「無」，人數欄留空

---

## ⚠️ 注意事項

1. **API Key 安全**：
   - Vite 版本從 `.env` 讀取，請勿將 `.env` 提交至 Git
   - CDN 版本在右側面板輸入，不會被儲存

2. **Excel 格式要求**：
   - 必須含有「使用者體驗」標題欄位
   - 建議含有「優化建議」標題欄位
   - 姓名欄位會自動偵測

3. **Prompt 自訂**：
   - 切換到「Prompts」頁籤可調整 AI 分析指令
   - 修改後立即生效，不影響已匯入的資料

4. **報告回匯**：
   - 匯出的 HTML 報告內含資料快照
   - 可透過「匯入舊版 HTML 報告」功能還原編輯

---

## 🛠 技術棧
- React 18 + Vite 6 (Vite 版本)
- React 18 + Babel CDN (靜態版本)
- Tailwind CSS 3
- Google Gemini API (gemini-2.5-flash)
- SheetJS (xlsx) — Excel 解析
