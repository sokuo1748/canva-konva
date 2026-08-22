"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { CanvasShape, CanvasSnapshot, ShapePatch } from "../types/shape";

// 不 export：畫布尺寸已經改成 context state（見下方 canvasWidth/canvasHeight），
// 這兩個常數只當 useState 的初始值。外部一律透過 useCanvas() 取得目前尺寸，
// 避免尺寸變成可變之後，還有地方直接 import 到過期的寫死值。
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 800;
const SQUARE_SIZE = 100;
const TEXT_DEFAULT_CONTENT = "預設文字";
const TEXT_DEFAULT_FONT_SIZE = 24;
// Konva.Text 沒有固定 width，實際寬度要等 Konva 依內容/fontSize 算完才知道。
// 這個值只用來估算「新增當下」大概置中的位置，不會存進 TextShape。
const TEXT_ESTIMATED_WIDTH = 120;
// 圖片任一邊超過這個值就等比縮小，不會放大小圖。
const MAX_IMAGE_DIMENSION = 400;

interface CanvasContextValue {
  shapes: CanvasShape[];
  addSquare: () => void;
  addText: () => void;
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => void;
  updateShape: (id: string, patch: ShapePatch) => void;
  deleteShape: (id: string) => void;
  resetCanvas: () => void;
  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (width: number, height: number) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getSnapshot: () => string;
  // KonvaBoard 量測容器尺寸用的 DOM ref，搬進 context 是因為之後 Toolbar 做「匯出畫布」
  // 需要拿到同一個節點，而 Toolbar 跟 KonvaBoard 是平行元件、不能直接互傳 ref。
  containerRef: RefObject<HTMLDivElement | null>;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // undo/redo 歷史。存 CanvasSnapshot「物件」而不是 JSON 字串：ImageShape.src 是
  // 可能幾百 KB～幾 MB 的 base64，存字串的話每次 push 都要整包重新 stringify、
  // 且字串之間不會共享記憶體；存物件則可以維持現有的 immutable 更新寫法
  // （[...prev, x] / .map 只換命中的元素），未變動的 shape（含大 base64 字串）
  // 在多個 history entry 之間是同一個物件參考，不會被重複複製。
  // 前提是：往後任何修改 shapes 的程式碼都必須「不原地 mutate、只能整個換新物件/陣列」，
  // 否則舊的 history entry 會被意外改到。
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  // 每種類型各自遞增的計數器，產生 shape-1/text-1/image-1 這種可讀 id。
  // 用 ref 存、只增不減，不受 undo/redo/reset 影響，避免 id 重複
  // （即使 undo 把舊 shape 復原回來，下一個新 id 也不會撞到）。
  const idCountersRef = useRef<{ shape: number; text: number; image: number }>({
    shape: 0,
    text: 0,
    image: 0,
  });

  const nextId = useCallback((prefix: "shape" | "text" | "image") => {
    idCountersRef.current[prefix] += 1;
    return `${prefix}-${idCountersRef.current[prefix]}`;
  }, []);

  // 在真正修改狀態之前，把「目前狀態」推進 past，並清空 future（新動作會讓
  // 舊的 redo 分支失效，這是標準 undo/redo 語意）。
  // 依賴 shapes/canvasWidth/canvasHeight（不是零依賴）：如果同一個事件處理器裡
  // 連續呼叫兩個會修改狀態的 action（目前沒有這種寫法），第二個 action 呼叫這裡時
  // 讀到的 shapes 還是這次 render 開始時的舊值，會漏記第一個動作，寫程式時要留意。
  const pushHistoryEntry = useCallback(() => {
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    setFuture([]);
  }, [shapes, canvasWidth, canvasHeight]);

  // undo/redo 共用的「整包套用某個 snapshot」邏輯。用 setSelectedId 的 functional
  // updater 處理「還原後，原本選取的 shape 已經不在了就清空選取」——這個 updater
  // 純粹從 prev 推導下一個值、不呼叫其他 setState，可以維持 stable identity。
  const applySnapshot = useCallback((entry: CanvasSnapshot) => {
    setShapes(entry.shapes);
    setCanvasWidth(entry.canvasWidth);
    setCanvasHeight(entry.canvasHeight);
    setSelectedId((prev) => (prev !== null && !entry.shapes.some((s) => s.id === prev) ? null : prev));
  }, []);

  const addSquare = useCallback(() => {
    pushHistoryEntry();
    const id = nextId("shape");
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "rect",
        x: (canvasWidth - SQUARE_SIZE) / 2,
        y: (canvasHeight - SQUARE_SIZE) / 2,
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        fill: "#000000",
      },
    ]);
    setSelectedId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry]);

  const addText = useCallback(() => {
    pushHistoryEntry();
    const id = nextId("text");
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "text",
        x: (canvasWidth - TEXT_ESTIMATED_WIDTH) / 2,
        y: (canvasHeight - TEXT_DEFAULT_FONT_SIZE) / 2,
        text: TEXT_DEFAULT_CONTENT,
        fontSize: TEXT_DEFAULT_FONT_SIZE,
        fill: "#000000",
      },
    ]);
    setSelectedId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry]);

  const addImage = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      // 部分瀏覽器對沒有明確 width/height/viewBox 的 SVG 會回傳 naturalWidth/Height = 0，
      // 這樣算出來的 width/height 也會是 0，變成一個看不到、選了也拖不動的「幽靈物件」。
      // 直接擋掉不新增（也不推 history，因為根本沒有實際變化）。
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        console.error("圖片尺寸無效，略過新增", { naturalWidth, naturalHeight });
        return;
      }

      pushHistoryEntry();
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / naturalWidth, MAX_IMAGE_DIMENSION / naturalHeight);
      const width = naturalWidth * scale;
      const height = naturalHeight * scale;
      const id = nextId("image");
      setShapes((prev) => [
        ...prev,
        {
          id,
          type: "image",
          x: (canvasWidth - width) / 2,
          y: (canvasHeight - height) / 2,
          width,
          height,
          src,
        },
      ]);
      setSelectedId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry],
  );

  const updateShape = useCallback(
    (id: string, patch: ShapePatch) => {
      pushHistoryEntry();
      setShapes((prev) =>
        prev.map((shape) => (shape.id === id ? ({ ...shape, ...patch } as CanvasShape) : shape)),
      );
    },
    [pushHistoryEntry],
  );

  const deleteShape = useCallback(
    (id: string) => {
      pushHistoryEntry();
      setShapes((prev) => prev.filter((shape) => shape.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [pushHistoryEntry],
  );

  const resetCanvas = useCallback(() => {
    // 畫布已經是空的就不用做任何事：不推一筆等於沒變化的 history entry，
    // 避免使用者在空畫布狂點 Reset 塞出一堆「看起來一樣」的 undo 步驟。
    if (shapes.length === 0) return;
    pushHistoryEntry();
    setShapes([]);
    setSelectedId(null);
  }, [shapes, pushHistoryEntry]);

  const setCanvasSize = useCallback(
    (width: number, height: number) => {
      pushHistoryEntry();
      setCanvasWidth(width);
      setCanvasHeight(height);
    },
    [pushHistoryEntry],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previousEntry = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    applySnapshot(previousEntry);
  }, [past, shapes, canvasWidth, canvasHeight, applySnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextEntry = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    applySnapshot(nextEntry);
  }, [future, shapes, canvasWidth, canvasHeight, applySnapshot]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // snapshotRef 只是「目前畫布狀態」的唯讀鏡像，給 getSnapshot() 讀，
  // 不是狀態本身的來源 —— 真正的資料仍然是上面的 useState，畫面渲染不依賴這個 ref。
  // 跟上面的 past/future undo 歷史是兩套獨立機制，不共用同一份資料：這裡純粹給
  // 未來 Export 功能用，undo/redo 已經在上面用 applySnapshot 正確處理「還原畫面」。
  //
  // 已知風險：ImageShape.src 是 base64 data URL，圖片一多，這裡整包 JSON.stringify
  // 的字串會變很大，且任何 shape 變動都會整包重算，這次不處理效能優化。
  const snapshotRef = useRef<string>("");

  useEffect(() => {
    const snapshot: CanvasSnapshot = { shapes, canvasWidth, canvasHeight };
    snapshotRef.current = JSON.stringify(snapshot);
  }, [shapes, canvasWidth, canvasHeight]);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const value = useMemo(
    () => ({
      shapes,
      addSquare,
      addText,
      addImage,
      updateShape,
      deleteShape,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      selectedId,
      setSelectedId,
      undo,
      redo,
      canUndo,
      canRedo,
      getSnapshot,
      containerRef,
    }),
    // containerRef 沒列在依賴陣列：useRef 回傳的物件 identity 全生命週期不變，
    // ESLint 的 exhaustive-deps 本來就認得這點、不會要求列出。setSelectedId 這類
    // useState setter 同樣是穩定 identity、列不列都不影響行為，這裡選擇列出只是
    // 跟其他欄位維持一致的寫法，兩種寫法功能上等價。
    [
      shapes,
      addSquare,
      addText,
      addImage,
      updateShape,
      deleteShape,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      selectedId,
      setSelectedId,
      undo,
      redo,
      canUndo,
      canRedo,
      getSnapshot,
    ],
  );

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error("useCanvas 必須在 CanvasProvider 底下使用");
  }
  return ctx;
}
