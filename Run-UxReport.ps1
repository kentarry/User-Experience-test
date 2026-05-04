# 啟動 UX Report Tool (Vite 開發伺服器)
# Usage: .\Run-UxReport.ps1 [-Build]

param(
    [switch]$Build,
    [string]$ApiKey
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   UX Report Tool - 使用者體驗報告工具   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝`n" -ForegroundColor Cyan

# --- Check Node.js ---
try {
    $nodeVer = node --version 2>$null
    Write-Host "  ✅ Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js 未安裝。請先安裝 Node.js (https://nodejs.org)" -ForegroundColor Red
    exit 1
}

# --- Check/Install dependencies ---
$nodeModules = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  📦 首次啟動，安裝依賴套件..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    npm install
    Pop-Location
    Write-Host "  ✅ 依賴安裝完成" -ForegroundColor Green
}

# --- Setup .env if API key provided ---
$envFile = Join-Path $ProjectRoot ".env"
if ($ApiKey) {
    Set-Content -Path $envFile -Value "VITE_GEMINI_API_KEY=$ApiKey" -Encoding UTF8
    Write-Host "  🔑 API Key 已寫入 .env" -ForegroundColor Green
} elseif (-not (Test-Path $envFile)) {
    Write-Host "  ⚠️  尚未設定 API Key。" -ForegroundColor Yellow
    Write-Host "     使用方式: .\Run-UxReport.ps1 -ApiKey 'YOUR_KEY'" -ForegroundColor DarkGray
    Write-Host "     或手動建立 .env 檔案，內容: VITE_GEMINI_API_KEY=your_key`n" -ForegroundColor DarkGray
}

# --- Build or Dev ---
Push-Location $ProjectRoot
if ($Build) {
    Write-Host "`n  🔨 建置生產版本..." -ForegroundColor Cyan
    npm run build
    Write-Host "`n  ✅ 建置完成！檔案位於 dist/ 資料夾" -ForegroundColor Green
    Write-Host "  🌐 啟動預覽伺服器..." -ForegroundColor Cyan
    npm run preview
} else {
    Write-Host "`n  🚀 啟動開發伺服器..." -ForegroundColor Cyan
    Write-Host "  📝 按 Ctrl+C 停止伺服器`n" -ForegroundColor DarkGray
    npm run dev
}
Pop-Location
