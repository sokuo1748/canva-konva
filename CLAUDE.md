# CLAUDE.md

本檔案提供給 Claude Code（或其他 AI 工具）在此 repo 中工作時的上下文說明。

## 專案簡介

一個以 Konva.js 為核心的線上白板/繪圖工具，用 Next.js (App Router) + React 建置。
核心功能：畫筆、橡皮擦、上傳圖片、加文字，圖片與文字皆可拖曳、縮放、旋轉。

## 技術棧

- Next.js (App Router, TypeScript)
- React 18+
- konva / react-konva（畫布渲染，僅能在 Client Component 使用）
- （視需求）Tailwind CSS 或純 CSS Modules — 以實際專案設定為準

## 目錄結構

```
src/
  app/                  # Next.js App Router 頁面
    page.tsx
    layout.tsx
  components/
    canvas/             # Konva 相關元件（Stage、Toolbar、各種 Shape）
      KonvaBoard.tsx
      Toolbar.tsx
      shapes/
        EditableText.tsx
        URLImage.tsx
    ui/                 # 一般 UI 元件（按鈕、色票選擇器等）
  hooks/                # 自訂 hooks（例如 useCanvasHistory, useKeyboardShortcuts）
  lib/                  # 工具函式（座標轉換、匯出圖片等，不含 React）
  types/                # TypeScript 型別定義
```

## 開發指令

```bash
npm run dev       # 啟動開發伺服器 (localhost:3000)
npm run build     # 打包正式版
npm run lint      # 執行 ESLint
```

## Konva / react-konva 慣例

- 任何引用 `react-konva` 的檔案，開頭必須加 `"use client"`。
- `Stage` 大小需響應容器尺寸變化（監聽 `resize` 或用 `ResizeObserver`），不要寫死 px。
- 縮放圖形時，`onTransformEnd` 一律要把 `scaleX/scaleY` 讀出來後重置回 1，並改寫 `width/height`（或 `fontSize`），避免下次拖曳時尺寸疊加跑掉。
- 橡皮擦透過 `globalCompositeOperation: "destination-out"` 實作，不要用「畫白色線」模擬（白色線在深色背景或匯出 PNG 時會出錯）。
- 可選取的物件（圖片、文字）用單一 `selectedId` 狀態管理，搭配一個共用的 `Transformer`，不要每個物件各自掛一個 Transformer 實例。
- 畫筆/橡皮擦產生的 `Line` 預設不可選取、不可拖曳，避免跟畫圖手勢衝突。

## 程式碼風格

- Function component + hooks，不使用 class component。
- 狀態盡量扁平（lines / images / texts 分開陣列存放），不要把所有物件塞進同一個巢狀結構。
- 型別定義集中放在 `src/types/`，畫布物件（Line、ImageShape、TextShape）都要有明確 interface。
- commit message 用 Conventional Commits（`feat:`, `fix:`, `chore:`, `refactor:`...）。

## 目前開發階段

- [x] Step 1：Next.js 專案初始化 + 依賴安裝
- [ ] Step 2：Web UI 設計（Toolbar、版面配置、色彩系統）
- [ ] Step 3：Konva 核心功能（畫筆、橡皮擦、上傳圖片、文字、Transformer）

> 每完成一個階段請更新這份清單，方便下次接續開發時快速掌握進度。

## 工作流程（必須遵守）

每次完成一項程式碼修改或新功能實作後，在回報「完成」給使用者之前，
**必須主動呼叫 `code-reviewer` subagent** 審查這次的改動，不需要使用者額外提醒。

流程固定為：

1. 完成實作
2. 自動呼叫 code-reviewer subagent 審查
3. 把審查結果（嚴重/建議/可忽略）整理後一併回報給使用者
4. 若 code-reviewer 標記「嚴重」等級問題，先修正後才算完成，不要略過直接回報完成

只有使用者明確說「跳過審查」或「先不用 review」時才可以省略這個步驟。
