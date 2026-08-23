# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本檔案提供給 Claude Code（或其他 AI 工具）在此 repo 中工作時的上下文說明。

## 專案簡介

一個以 Konva.js 為核心的線上白板/繪圖工具，用 Next.js (App Router) + React 建置。
核心功能（規劃中）：畫筆、橡皮擦、上傳圖片、加文字，圖片與文字皆可拖曳、縮放、旋轉。
目前已實作的部分：畫布可自動縮放置中（依容器大小 fit，滑鼠滾輪縮放已停用，待另外設計「調整畫布大小」功能）、從左側 Template 面板新增矩形。

## 技術棧

- Next.js 16 (App Router, TypeScript)、React 19
- konva / react-konva（畫布渲染，僅能在 Client Component 使用）
- 樣式分兩層：
  - `src/app/globals.css` 用 Tailwind v4（`@import "tailwindcss"`）設定全站 base theme（字型、明暗色變數）。
  - 各元件實際樣式用 **SCSS Modules**（`*.module.scss`），共用變數（顏色、尺寸）集中在 `src/styles/global.scss`，元件內用 `@use "../../styles/global" as *` 引入 —— 新增元件樣式請沿用這個模式，不要在元件內直接寫 Tailwind class。
- Path alias：`@/*` → `src/*`（見 `tsconfig.json`）。

## 開發指令

```bash
npm run dev       # 啟動開發伺服器 (localhost:3000)
npm run build     # 打包正式版
npm run start     # 啟動正式版 server
npm run lint      # 執行 ESLint（eslint-config-next，flat config）
```

目前專案沒有設定測試框架（無 test script、無 jest/vitest/playwright），若要新增測試需求請先跟使用者確認要用哪一套。

## 架構重點

- **狀態集中在 Context**：`src/context/CanvasContext.tsx` 的 `CanvasProvider`/`useCanvas()` 是畫布的單一狀態來源，管理 `shapes: CanvasShape[]`（`RectShape | ImageShape | TextShape` union，靠 `type` 判別欄位區分，單一扁平陣列，不拆成 `shapes`/`texts`/`images` 三個陣列——`useShapeSelection`/`KonvaBoard` 的渲染迴圈、Transformer 共用邏輯都靠「遍歷同一個陣列＋用 id 查」運作，拆開只會讓這些地方多維護好幾份查找邏輯）、`canvasWidth`/`canvasHeight`（+`setCanvasSize`，畫布尺寸也是 state 而非寫死常數，為之後「修改畫布大小」功能預留）、`selectedId`/`setSelectedId`（目前選中誰，設計成跨元件共享，`panelRight` 的 `SelectedShapePanel` 讀這個顯示 ID/刪除鈕，以及可編輯的 `ShapePropertiesForm` 屬性表單，見下方獨立條目）、`updateShape(id, patch: ShapePatch)`（依 id 淺層合併寫回 shape；`ShapePatch` 是手寫的攤平型別，把三種 shape 可能用到的欄位都列成 optional，不是用 `Omit<...> & Omit<...>` 交集推導——物件型別交集算出來的是欄位聯集不是共同欄位，容易誤導）、`deleteShape(id)`、`resetCanvas()`（清空 `shapes`，`shapes.length === 0` 時內部直接 no-op，不推無意義的 history）、`containerRef`（`KonvaBoard` 量測容器尺寸用的 DOM ref，放在 context 是為了之後 Toolbar 做「匯出畫布」時能拿到同一個節點，`Toolbar` 跟 `KonvaBoard` 是平行元件不能直接互傳 ref）。新增物件（`addSquare`/`addText`/`addImage`）都會呼叫 `nextId(prefix)` 產生 `shape-1`/`text-1`/`image-1` 這種每種類型各自遞增、不會歸零的 id（不受 undo/redo/reset 影響，永遠只增不減，避免復原舊 shape 後跟新 id 撞號），並且新增後自動 `setSelectedId`，讓使用者能立刻拖曳/調整剛新增的物件。
- **Undo/Redo 已實作，邏輯直接寫在 `CanvasProvider` 內，沒有另外開 `useCanvasHistory.ts`**：`past`/`future` 存 `CanvasSnapshot[]`**物件陣列**（不是 JSON 字串）——`ImageShape.src` 可能是幾百 KB～幾 MB 的 base64，存字串的話每次 push 都要整包重新 `JSON.stringify`、且字串間不共享記憶體；存物件則沿用現有的 immutable 更新寫法（`[...prev, x]`/`.map` 只換命中的元素），未變動的 shape（含大 base64）在多個 history entry 之間是同一個物件參考，不會被複製。**這個設計的前提是：往後修改 `shapes` 的程式碼都必須「不原地 mutate、只能整個換新物件/陣列」**，否則舊的 history entry 會被意外改到。每個會修改狀態的 action（`addSquare`/`addText`/`addImage`/`updateShape`/`deleteShape`/`resetCanvas`/`setCanvasSize`）都會在真正 `setShapes`/`setCanvasWidth`/`setCanvasHeight` 之前呼叫 `pushHistoryEntry()`（push 進 `past`、清空 `future`）。`undo`/`redo` 直接讀 `past`/`future` state（不是在 `setPast`/`setFuture` 的 updater 裡塞副作用），呼叫 `applySnapshot` 整包還原並用 `setSelectedId` 的 functional updater 清掉「還原後已經不存在的選取」。**`selectedId` 不算進 history**（切換選取是暫態 UI 狀態）——所以 undo 一個刪除動作後 shape 會復原，但 `SelectedShapePanel` 的 pill 不會自動重新出現，這是設計上的預期行為。跟這套 undo 機制完全獨立的是 `snapshotRef`（`useRef<string>`）+ `useEffect` 序列化出的 `getSnapshot(): string`，純粹留給未來 Export 功能讀取目前狀態，兩套機制不共用同一份資料。
- **選取/拖曳/縮放邏輯在 `src/hooks/useShapeSelection.ts`**：用 `id: string` 操作、不寫死 shape 類型，矩形/文字/圖片共用同一支 hook。`selectedId` 本身不是這支 hook 的 local state，是讀寫 `CanvasContext` 的 `selectedId`——hook 只負責「選中後 Konva 層怎麼把共用 `Transformer` 掛上去、怎麼處理拖曳/縮放事件」。`handleTransformEnd` 依 `e.target.getClassName() === "Text"` 分流：文字只改 `fontSize`（`TextShape` 沒有 `width`/`height`，靠 Konva.Text 依內容自動算），非文字改 `width`/`height`，兩者都有下限 clamp（避免縮到 0 或消失），兩個分支也都會讀 `node.rotation()`（`Math.round` 成整數）一起 `updateShape`——三種 `CanvasShape` 型別跟 `ShapePatch` 都有 `rotation: number`，`Transformer` 的 `rotateEnabled` 已開啟，不做 0–360 正規化。文字縮放要等比，靠選取變動的 `useEffect` 動態切換共用 `Transformer` 的 `enabledAnchors`/`keepRatio`（選中文字時只留四角控點 + 強制 `keepRatio(true)`，選中其他物件時還原成預設八個控點 + `keepRatio(false)`），不是在 `onTransformEnd` 事後用平均值修正 scaleX/scaleY。圖片是非同步載入完成才會有 Konva node，`registerShapeRef` 的 callback 內有補一段「node 剛掛上時如果剛好是目前 `selectedId` 就手動 attach 一次 Transformer」的邏輯（靠 `selectedIdRef` 讀最新值，避免 get-or-create 快取住的 callback 抓到 stale closure），不然「新增圖片後自動選取」會變成「選了但看不到控點」。**刪除 shape 時的 ref Map 清理是雙重機制**：① `registerShapeRef` 的 `node === null` 分支（Konva node unmount 時觸發）清掉 `shapeNodesRef`/`shapeRefCallbacksRef` 對應 entry；② 另外還有一個以 `shapes` 為依賴的保底 `useEffect`，每次 `shapes` 變動時比對「目前還存在的 id」清掉 Map 裡的殘留——這是因為 `URLImage` 在圖片非同步載入完成前 `return null`，如果圖片還沒載入完成就被刪除，它的 ref callback 從頭到尾不會被呼叫過，只靠 ①會漏掉這個情況、造成小型 memory leak。**這支 hook 雖然放在 `src/hooks/`，內部仍然直接依賴 Konva（`Konva.Node`/`Konva.Transformer`/`KonvaEventObject`），不是脫離 Konva 也能用的通用邏輯**——`hooks/` 目前的慣例是所有自訂 hook（不論是否依賴 Konva）都放這裡，`KonvaSkill/` 則專放 Konva 畫布元件本體。`handleTransformEnd` 縮放矩形時，如果新的 `width`/`height` 讓 `cornerRadius`（見下方 `ShapePropertiesForm` 條目）超過新尺寸允許的上限，會順手把 `cornerRadius` 一併夾回合法範圍再一起 `updateShape`——不這樣做的話，圓角會停留在跟新尺寸不成比例的舊值，畫面上圓角看起來會重疊/異常，且只有使用者之後自己打開屬性面板對 `cornerRadius` 欄位觸發一次 blur 才會被動修正。
- **`panelRight` 的 `SelectedShapePanel` 底下有一個可編輯的 `ShapePropertiesForm`（`src/components/canvas/SelectedShapePanel/ShapePropertiesForm.tsx`，欄位元件在 `src/components/ui/` 底下）**：選中物件後除了既有的 ID pill，還會依 `shape.type` 顯示並可編輯該物件的屬性，欄位標籤直接用 Konva 的屬性名稱（不翻譯成中文）——`x`/`y`/`rotation` 三種 type 都有，接著 Rect 顯示 `width`/`height`/`fill`/`cornerRadius`，Image 顯示 `width`/`height`（沒有 `fill`/`cornerRadius`），Text 顯示 `fontSize`/`fill`/`text`。呼叫端（`SelectedShapePanel.tsx`）用 `key={selectedId}` 掛這個表單，切換選取到不同物件（尤其換了 type，欄位種類整批不同）時所有欄位的本地 state 靠 remount 整批歸零，沿用 `ExportModal` 掛 `key={String(open)}` 的既有慣例。**`x`/`y`/`width`/`height` 全部強制只能整數**：面板的 `NumberField` 都傳 `round`，且 `useShapeSelection.ts` 的 `handleDragEnd`（拖曳）/`handleTransformEnd`（Transformer 縮放）也把讀出來的座標/尺寸 `Math.round()` 過再寫回 `updateShape`——三個寫入來源（面板打字、拖曳、縮放控點）都維持同一個「永遠是整數」的不變量，不是只有面板單獨擋。**核心設計問題是 `updateShape` 每次呼叫都會 `pushHistoryEntry()`**：如果輸入框用 `onChange` 逐字元直接 commit，打「120」會產生 3 筆 undo entry 把 undo 功能打爛、打字本身也會因為每個按鍵都觸發一次全畫布重繪而不流暢，所以 `ui/NumberField/NumberField.tsx`/`ui/TextField/TextField.tsx` 都透過共用的 `src/hooks/useFieldDraft.ts` 走「本地 draft state，`onBlur`/Enter 才真正 commit」——沒有 focus 時永遠顯示外部最新值（處理拖曳/Transformer 縮放在面板未 focus 時把 `x`/`y`/`width`/`height`/`fontSize` 改掉的情境，不能讓面板卡住舊 draft），focus 時顯示本地 draft，blur 時 parse 失敗（空字串、非數字）就放棄 commit（不會把 `NaN` 寫進 `updateShape`，欄位自動還原成目前值），值沒變也不 commit（不多推無意義的 undo）。`NumberField` 的 Enter 直接 `blur()` 委派給同一份 commit 邏輯；**`ui/TextField/TextField.tsx`（`text` 欄位）的 Enter 行為不同——`commit({ keepEditing: true })`，送出目前內容但不失焦**（多行文字通常打完一段還想繼續編輯），並 `preventDefault` 擋掉 Enter 在 textarea 裡插入換行的預設行為，改用 Shift+Enter 打換行（`text` 支援 `"\n"`）；`useFieldDraft` 的 `commit` 因此多一個 optional 的 `keepEditing` 參數，預設（`NumberField`/`ColorField`/`TextField` 的 `onBlur`）都是 `false`（跟原本行為一致，commit 後 `isEditing` 設回 `false`）。`text` 欄位仍然擋掉空字串（trim 後長度 0 視為無效輸入放棄 commit）——文字內容一旦變成空字串在 Konva 裡幾乎是零面積節點，一旦提交就很難再點擊選中。**`ui/ColorField/ColorField.tsx`（`fill` 欄位）是唯一不經過 `useFieldDraft` 的欄位**：用 `<input type="color">` 直接受控於 `shape.fill`，`onChange` 直接 commit——已知風險是主流瀏覽器在色盤上拖曳選色時原生 `input` 事件會連續觸發，理論上會連續推進多筆 undo entry，這次先接受這個風險，備案是改監聽原生 `change` 事件（只在放開滑鼠/確定選色時觸發一次）才 commit。`cornerRadius` 的上限是動態算 `Math.min(shape.width, shape.height) / 2`（不是固定常數，因為圓角超過短邊一半在視覺上就不合理），`NumberField` 內部「先 `Math.round` 再 clamp」，避免上限剛好是奇數/2 這種小數時被四捨五入拉超界。`MIN_SHAPE_SIZE`/`MIN_FONT_SIZE` 這兩個 clamp 下限收在 `src/constants/shapeConstraints.ts`（見下方目錄結構），`useShapeSelection.ts` 的 Transformer 縮放邏輯跟面板欄位共用同一份，避免兩處下限各自維護、將來不同步。
- **`URLImage`（`src/components/canvas/KonvaSkill/URLImage.tsx`）用 `forwardRef` 轉發 ref**：`react-konva` 的 `<Image>` 需要吃已載入好的 `HTMLImageElement`，不是 src 字串，所以包一層元件內部用 `useEffect` 載入（含 `cancelled` guard 防止 unmount 後或 src 變動時的 stale setState）。**這裡的 `forwardRef` 不能省**：`registerShapeRef` 要拿到的是內部真正的 Konva `<Image>` 節點，不是 `URLImage` 這個 React 元件本身（普通 function component 不會自動轉發 ref）；漏了這步圖片會完全選不到、拖不動、縮放無反應，而且不會報錯，很容易漏測。
- **`KonvaBoard.tsx` 依 `shape.type` 分支渲染**，不能再用 `{...shape}` 整包展開到單一 `<Rect>`（現在有三種 Konva 元件：`Rect`/`Text`/`URLImage`），三個分支共用同一組 `{ draggable, onClick, onDragEnd, onTransformEnd }`，避免把 `type` 這種 app 專用欄位洩漏成 Konva 節點屬性。
- **KonvaBoard 的畫布本體背景是 `listening={false}`**：那塊白色 `Rect`（`canvasWidth`×`canvasHeight`）只是視覺背景，特地關掉事件監聽讓點擊穿透到 `Stage`，`useShapeSelection` 的 `handleStageMouseDown` 才能靠 `e.target === e.target.getStage()` 正確判斷「點到畫布空白處」並清空選取；如果拿掉 `listening={false}`，點在畫布內、沒有物件的地方會被這塊背景攔截，變成「點不到空白處」。
- **元件組裝順序**：`CanvasWorkspace`（`src/components/canvas/CanvasWorkspace/CanvasWorkspace.tsx`）是唯一的畫布頁面組裝點，把 `Toolbar` + `TemplatePanel` + `KonvaBoard` 包在 `CanvasProvider` 裡。`src/app/canva/page.tsx` render `CanvasWorkspace`；`src/app/page.tsx`（首頁）改成直接 render `CanvaPage`（`canva/page.tsx` 的 default export），不是另外重複 import `CanvasWorkspace`——兩個路由現在共用同一份組裝邏輯。
- **KonvaBoard 的縮放/平移**：`Stage` 的 `scale`/`stagePos` 只有一個來源——`ResizeObserver` 每次量到容器尺寸時（含 mount），都會重新算一個能讓畫布（`canvasWidth`×`canvasHeight`）完整放進容器並置中的 fit scale（見 `FIT_PADDING_RATIO`），依賴陣列包含 `canvasWidth`/`canvasHeight`，尺寸本身變動也會重新 fit。**滑鼠滾輪縮放已經移除**（`Stage` 沒有掛 `onWheel`）——之前有一版靠滾輪事件依游標位置縮放，之後會另外設計「調整畫布大小」的功能，這次先單純拿掉滾輪這個互動，`MIN_SCALE`/`MAX_SCALE` 兩個常數目前只給 fit-scale 邏輯當上下限用。
- **Icon 型別**：`@tabler/icons-react` 沒有匯出共用的 icon 元件型別，`src/components/ui/icon-map/index.ts` 用 `typeof IconHome` 反推出 `TablerIconComponent`，並以 `iconMap` 物件當 source of truth 反推 `IconName`。之後要用固定 icon 名稱查表時走這個 `iconMap`，目前 `templateList.ts` 是暫時直接 import icon 元件（都先用 `IconFileExport` 佔位）。
- **UI 元件的 variant 寫法**：`ButtonUI` 用 `selectedStyle`（`"origin" | "template"`）對應到不同 class，每個 variant 是完整獨立的樣式，不共用基底 class（見 `ButtonUI.module.scss`）——新增 variant 時比照這個結構加。
- **純 icon 按鈕用 `IconButtonUI`，不是 `ButtonUI` 加 boolean flag**：`ButtonUI` 的兩個 variant 都是「圖示+文字」設計；工具列常駐的純 icon 按鈕（Toolbar 的 Reset/Undo/Redo）視覺定位不同（ghost 風格、無邊框），硬把 `ButtonUI` 的 `name` 改成「有時顯示、有時只當 aria-label」會讓介面語意不直覺，所以另開 `src/components/ui/IconButtonUI/`，`label: string` prop 明確只映射 `aria-label`/`title`，不顯示文字。
- **`Modal`（`src/components/ui/Modal/`）內建「置中標題 + 右上角 X」的 header 版面**，不是讓呼叫端自己組 header/main 兩個 slot——`title`/`onClose` 兩個 prop 就能拼出這個幾乎所有 modal 都會用到的版面，之後加新 modal（例如確認刪除、畫布尺寸設定）直接傳 `title` 就好。用 `createPortal` 渲染到 `document.body`（不是原地渲染在呼叫端的 DOM 位置），避免任何未來祖先元素加 `transform`/`filter` 意外影響 `position: fixed` 的定位基準。`open === false` 時整個 `return null`（不是 CSS 隱藏）。**兩個容易踩到的坑，已經在程式碼裡處理掉**：① header 只有兩個子元素（標題、關閉鈕）時 `justify-content: space-between` **不會**讓標題視覺置中（標題會被推到最左邊），要用三欄 `grid`（`32px 1fr 32px`，左邊留一個跟關閉鈕等寬的空白佔位欄）才能讓標題對齊 header 整體寬度的幾何中心；② **`Modal` 卸載不等於呼叫端的 state 自動重置**——如果呼叫端（例如 `ExportModal`）在父層是「永遠掛著、用 `open` prop 控制」而不是條件渲染整個元件，`Modal` 內部 `return null` 只會卸載它 portal 出去的子樹，呼叫端自己的 `useState` 完全不受影響、不會重置。要做到「每次重新打開都重置成初始值」，不要在 `useEffect` 裡呼叫 `setState`（ESLint 的 `react-hooks/set-state-in-effect` 會擋，也會多一次 cascading render）——改成讓呼叫端在 `open` 狀態切換時傳不同的 `key` 掛這個元件，key 變了 React 就會整個卸載重掛，state 自然拿到新的初始值（見 `Toolbar.tsx` 掛 `ExportModal` 的寫法）。不做 focus trap，只做基本 a11y（`role="dialog"`、`aria-modal`、`aria-labelledby` 用 `useId()` 產生、Esc 關閉、關閉鈕 `aria-label`），跟目前專案的 a11y 水準一致。
- **`ExportModal`（`src/components/canvas/ExportModal/`）的「Export Image」已經接上真正的匯出/下載**：開關、遮罩/Esc 關閉、檔名輸入框（預設 `picture_01`，靠上面的 `key` 機制在重新打開時重置）。匯出邏輯是**直接對 `containerRef`（`useCanvas()` 給的那個 DOM ref）底下的 `<canvas>` 呼叫 `canvas.toDataURL("image/png")`**（`containerRef.current.querySelector("canvas")`），不是透過 Konva 的 `Stage`/`Layer` API——KonvaBoard 目前只有一個 `<Layer>`，`container` 底下只會有這一個 `<canvas>`，用 `querySelector` 就夠，不需要另外幫 `Stage` 加 `stageRef`。轉出的 data URL 塞進動態建立的 `<a download>` 觸發瀏覽器下載。**已知限制（刻意選擇的簡化版本，不是 bug）**：這樣匯出的是「目前畫面看到的樣子」——包含當下的縮放/平移狀態，且如果匯出當下剛好有物件被選取，`Transformer` 的控制框也會一起被匯出進圖片。要做到「穩定 1:1 完整畫布內容、不含選取框」，需要改成對 Konva `Stage`/`Layer` 呼叫 `toDataURL()`（`Stage` 目前完全沒有 `ref`，且 `Transformer` 跟 shapes 共用同一個 `Layer`，要先拆開），這次沒有做，之後有需要再優化。`getSnapshot()`（JSON 字串）是形狀資料本身，不是點陣圖，這次的圖片匯出用不到它，兩者是獨立機制。

## 目錄結構

```
src/
  app/
    page.tsx            # 首頁，render CanvaPage（canva/page.tsx 的 default export）
    canva/page.tsx       # /canva 路由，render CanvasWorkspace
    layout.tsx / globals.css
  components/
    canvas/
      CanvasWorkspace/   # CanvasWorkspace.tsx + CanvasWorkspace.module.scss
      Toolbar/           # Toolbar.tsx + Toolbar.module.scss（Export + Reset/Undo/Redo）
      TemplatePanel/     # TemplatePanel.tsx + 它專用的資料來源 templateList.ts
      SelectedShapePanel/ # 選取物件後顯示在 panelRight 的 ID + 刪除鈕 pill，
                          # 底下接 ShapePropertiesForm.tsx（依 type 顯示可編輯屬性，
                          # 見上方架構重點；用到的欄位元件在 ui/ 底下）
      ExportModal/        # 匯出用的 modal 內容（檔名輸入框 + Export Image 按鈕），
                          # 目前只是 UI 殼，還沒接真正的圖片匯出邏輯
      KonvaSkill/         # Konva 畫布「元件」本體：KonvaBoard.tsx、URLImage.tsx，
                          # 之後畫筆/橡皮擦等新畫布元件放這裡；
                          # 選取/縮放這類邏輯（含 Transformer 的操作邏輯）放 hooks/，
                          # 這裡只放 <Transformer /> 這個 JSX 元素本身
    ui/
      ButtonUI/          # ButtonUI.tsx + ButtonUI.module.scss（圖示+文字按鈕）
      IconButtonUI/      # IconButtonUI.tsx + .module.scss（純 icon 按鈕）
      InputUI/           # InputUI.tsx + InputUI.module.scss（綠框白底，ExportModal 第一個用它）
      Modal/             # Modal.tsx + .module.scss（通用 modal 殼，見上方架構重點）
      NumberField/       # NumberField.tsx + .module.scss（x/y/width/height/fontSize/
                          # cornerRadius 這類數字屬性欄位，見上方架構重點）
      ColorField/        # ColorField.tsx + .module.scss（fill 顏色欄位）
      TextField/         # TextField.tsx + .module.scss（text 內容欄位，debounce 同步）
      icon-map/index.ts
  context/
    CanvasContext.tsx    # 畫布狀態：shapes（CanvasShape union）、canvasWidth/canvasHeight、
                          # selectedId、containerRef、updateShape/deleteShape/resetCanvas、
                          # nextId（shape-1/text-1/image-1 計數器）、undo/redo/canUndo/canRedo
                          # （past/future history，見上方架構重點）、getSnapshot（給未來
                          # Export 用，跟 undo/redo 是兩套獨立機制）
  types/
    shape.ts             # 畫布物件型別：RectShape（含 cornerRadius）、TextShape（三種都有 rotation）、
                          # ImageShape、CanvasShape（union）、ShapePatch、CanvasSnapshot
  styles/
    global.scss          # SCSS 共用變數（顏色、尺寸），給各 *.module.scss 用
  hooks/
    useShapeSelection.ts # 選取/拖曳/縮放（見上方架構重點），依賴 Konva 但仍放這裡
    useFieldDraft.ts     # NumberField/ColorField/TextField 共用的 draft/commit 邏輯
                          # （見上方架構重點），不依賴 Konva
  constants/
    shapeConstraints.ts  # MIN_SHAPE_SIZE、MIN_FONT_SIZE——useShapeSelection.ts 的
                          # Transformer 縮放下限跟 SelectedShapePanel 的欄位輸入框共用
                          # 同一份，不屬於任一方專用，所以獨立成頂層目錄
```

> 分資料夾的原則：① 元件與同名 `*.module.scss` 放進同名資料夾（例如 `Toolbar/Toolbar.tsx` + `Toolbar/Toolbar.module.scss`）；② 元件與它專用、只有自己會用的資料/邏輯檔放在一起（例如 `TemplatePanel/templateList.ts`）；③ `KonvaSkill/` 專放 Konva 畫布元件本體（`KonvaBoard.tsx`、`URLImage.tsx`），`hooks/` 放所有自訂 hook——不分是否依賴 Konva，`useShapeSelection.ts` 雖然直接用到 `Konva.Node`/`Transformer` 也放這裡，不因為依賴 Konva 就搬進 `KonvaSkill/`。單純沒有拆分需求的元件不用特地包資料夾。

## Konva / react-konva 慣例

- 任何引用 `react-konva` 的檔案，開頭必須加 `"use client"`。
- `Stage` 大小需響應容器尺寸變化（監聽 `resize` 或用 `ResizeObserver`），不要寫死 px。
- 縮放圖形時，`onTransformEnd` 一律要把 `scaleX/scaleY` 讀出來後重置回 1，並改寫 `width/height`（或 `fontSize`），避免下次拖曳時尺寸疊加跑掉。
- 橡皮擦透過 `globalCompositeOperation: "destination-out"` 實作，不要用「畫白色線」模擬（白色線在深色背景或匯出 PNG 時會出錯）。
- 可選取的物件（圖片、文字）用單一 `selectedId` 狀態管理，搭配一個共用的 `Transformer`，不要每個物件各自掛一個 Transformer 實例。
- 畫筆/橡皮擦產生的 `Line` 預設不可選取、不可拖曳，避免跟畫圖手勢衝突。

> 圖片（`URLImage`）、文字選取縮放、共用 `Transformer` 已經實作（見上方「架構重點」）。橡皮擦、`EditableText`（雙擊進入編輯模式）這兩條對應的功能還沒做，是後續開發時要遵守的慣例，不代表目前程式碼已有。

## 程式碼風格

- Function component + hooks，不使用 class component。
- 畫布物件狀態用 `CanvasShape`（`RectShape | ImageShape | TextShape`）union + `type` 判別欄位放單一扁平陣列，不要塞進同一個巢狀結構（例如 group-of-groups）；也不要拆成 `shapes`/`texts`/`images` 三個平行陣列——渲染迴圈、選取邏輯都要遍歷同一份資料，拆開只會讓查找/同步邏輯變複雜。
- 型別定義集中放在 `src/types/`，畫布物件（`RectShape`、`ImageShape`、`TextShape`，之後畫筆功能的 `Line`）都要有明確 interface。
- commit message 用 Conventional Commits（`feat:`, `fix:`, `chore:`, `refactor:`...）。

## 目前開發階段

- [x] Step 1：Next.js 專案初始化 + 依賴安裝
- [ ] Step 2：Web UI 設計（Toolbar、版面配置、色彩系統）
- [ ] Step 3：Konva 核心功能（畫筆、橡皮擦、上傳圖片、文字、Transformer）——上傳圖片/文字/Transformer 選取縮放/旋轉已完成，畫筆、橡皮擦尚未開始

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
