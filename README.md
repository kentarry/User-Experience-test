# UX Report Tool 📊

AI 驅動的玩家體驗測試報告生成工具，整合 Google Gemini 進行資料分析與圖像判讀。

## ✨ 功能

- **Excel 匯入** — 上傳使用者體驗回饋 Excel，AI 自動清洗、整併、分類
- **AI 圖像分析** — 上傳遊戲截圖，AI 以 UI/UX 專家角度分析
- **即時預覽** — 左側即時報告預覽，支援匯出/內部兩種檢視模式
- **HTML 報告匯出** — 一鍵產出精美 HTML 報告（含資料快照，可回匯），可直接分享
- **HTML 報告匯入** — 載入先前匯出的報告繼續編輯
- **JSON 編輯器** — 直接編輯 Raw Data
- **Prompt 自訂** — 可調整 AI 分析指令與匯入規則
- **免費 API Key** — 使用 Google Gemini 免費 API Key 即可使用

## 🚀 快速開始

### 方法一：GitHub Pages 線上使用（推薦）

1. 前往 [Google AI Studio](https://aistudio.google.com/apikey) 取得免費 Gemini API Key
2. 開啟部署好的 GitHub Pages 網址
3. 在右側面板輸入你的 API Key
4. 開始使用！

### 方法二：本地開發

```bash
git clone https://github.com/your-username/ux-report-tool.git
cd ux-report-tool
npm install
npm run dev
```

開啟 `http://localhost:5173/dev.html` 即可使用。

## 🌐 GitHub Pages 部署

本專案已設定自動部署，無需任何 Secrets 或環境變數：

1. Push 程式碼至 GitHub `main` 分支
2. 到 Repository → Settings → Pages → Source 選擇 **GitHub Actions**
3. Push 後 GitHub Actions 會自動部署

> **注意**：API Key 由使用者在網頁上直接輸入，不需要設定任何 Repository Secret。

## 📁 專案結構

```
├── index.html               # GitHub Pages 入口（獨立 CDN 版本）
├── app.js                   # 主要應用程式（獨立版本，Babel 轉譯）
├── constants.js             # 圖標元件、預設 Prompt、初始資料
├── dev.html                 # Vite 開發伺服器入口
├── src/                     # Vite + React 模組化版本
│   ├── App.jsx              # 主要 React 元件
│   ├── main.jsx             # React 進入點
│   ├── index.css            # Tailwind 與自訂樣式
│   ├── constants.js         # 預設 Prompt 與初始資料
│   ├── components/
│   │   ├── Section.jsx
│   │   ├── InputGroup.jsx
│   │   └── Modal.jsx
│   └── utils/
│       ├── gemini.js        # Gemini API 呼叫與重試
│       ├── exportHtml.js    # HTML 報告匯出（精美版）
│       └── importExcel.js   # Excel 匯入與 AI 分析
├── .github/workflows/
│   └── deploy.yml           # GitHub Pages 自動部署
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 🛠 技術棧

- **React 18** + **Vite 6**
- **Tailwind CSS 3**
- **Lucide React** (圖標)
- **SheetJS (xlsx)** (Excel 解析)
- **Google Gemini API** (AI 分析) — 使用 `gemini-2.5-flash` 免費模型

## 📝 License

MIT
