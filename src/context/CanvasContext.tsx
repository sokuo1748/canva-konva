"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { CanvasShape, CanvasSnapshot, ShapePatch } from "../types/shape";

// 不 export：畫布尺寸已經改成 context state，這兩個常數只當 useState 初始值。
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 800;
const SQUARE_SIZE = 100;
const SQUARE_DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_ROTATION = 0;
const TEXT_DEFAULT_CONTENT = "預設文字";
const TEXT_DEFAULT_FONT_SIZE = 24;
// Konva.Text 沒有固定 width，這個值只用來估算新增時的置中位置，不會存進 TextShape。
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
  // KonvaBoard 量測容器尺寸用的 DOM ref，放 context 是為了讓 ExportModal 匯出時也能拿到同一個節點。
  containerRef: RefObject<HTMLDivElement | null>;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // undo/redo 歷史存 CanvasSnapshot 物件（不是 JSON 字串），沿用 immutable 更新讓未變動的 shape 共享參考不被重複複製。
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  // 每種類型各自遞增的計數器，產生 shape-1/text-1/image-1，只增不減不受 undo/redo/reset 影響。
  const idCountersRef = useRef<{ shape: number; text: number; image: number }>({
    shape: 0,
    text: 0,
    image: 0,
  });

  const nextId = useCallback((prefix: "shape" | "text" | "image") => {
    idCountersRef.current[prefix] += 1;
    return `${prefix}-${idCountersRef.current[prefix]}`;
  }, []);

  // 修改狀態前把目前狀態推進 past、清空 future（標準 undo/redo 語意）。
  const pushHistoryEntry = useCallback(() => {
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    setFuture([]);
  }, [shapes, canvasWidth, canvasHeight]);

  // undo/redo 共用的整包套用 snapshot 邏輯，還原後若原選取的 shape 已不在就清空選取。
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
        cornerRadius: SQUARE_DEFAULT_CORNER_RADIUS,
        rotation: DEFAULT_ROTATION,
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
        rotation: DEFAULT_ROTATION,
      },
    ]);
    setSelectedId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry]);

  const addImage = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      // SVG 沒有明確尺寸時 naturalWidth/Height 可能是 0，擋掉不新增避免看不到、拖不動的幽靈物件。
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
          rotation: DEFAULT_ROTATION,
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
    // 畫布已經是空的就不用做事，避免推一筆沒有變化的 history entry。
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

  // 純讀鏡像給 getSnapshot() 用（未來 Export 功能），跟上面 past/future undo 歷史是獨立機制。
  const snapshotRef = useRef<string>("");

  useEffect(() => {
    const snapshot: CanvasSnapshot = { shapes, canvasWidth, canvasHeight };
    snapshotRef.current = JSON.stringify(snapshot);
    // 開發用：印出目前畫布狀態的 JSON 格式方便檢查，只在開發模式跑，正式站不印（避免大型 base64 洗版 console）。
    if (process.env.NODE_ENV !== "production") {
      console.log(JSON.stringify(snapshot, null, 2));
    }
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
    // containerRef 沒列在依賴陣列：useRef 物件 identity 全生命週期不變，exhaustive-deps 不會要求列出。
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
