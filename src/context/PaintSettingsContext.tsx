"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BrushCap } from "../types/shape";

// 畫筆/橡皮擦工具參數預設值
const DEFAULT_BRUSH_COLOR = "#000000";
const DEFAULT_BRUSH_SIZE = 8;
const DEFAULT_BRUSH_CAP: BrushCap = "round";
const DEFAULT_ERASER_SIZE = 20;
// 一般 shape 新增時預設不透明；橡皮擦筆畫固定不透明（destination-out 擦除不開放調整）
const DEFAULT_BRUSH_OPACITY = 100;

interface PaintSettingsContextValue {
  brushColor: string; // 畫筆顏色
  setBrushColor: (color: string) => void; // 設定畫筆顏色
  brushSize: number; // 畫筆大小
  setBrushSize: (size: number) => void; // 設定畫筆大小
  brushCap: BrushCap; // 畫筆筆刷形狀
  setBrushCap: (cap: BrushCap) => void; // 設定筆刷形狀
  eraserSize: number; // 橡皮擦大小
  setEraserSize: (size: number) => void; // 設定橡皮擦大小
  brushOpacity: number; // 畫筆透明度（0~100），橡皮擦不開放調整
  setBrushOpacity: (opacity: number) => void; // 設定畫筆透明度
}

const PaintSettingsContext = createContext<PaintSettingsContextValue | null>(null);

// 畫筆/橡皮擦的參數設定，從 CanvasContext 抽出的獨立扁平 Context——這 5 組值不算進
// CanvasSnapshot/undo history，純粹是工具面板的暫態設定，跟 CanvasContext 完全不依賴彼此，
// 避免調整畫筆設定時連動整個 CanvasContext 的 identity、讓不相關的消費者也重新 render
export function PaintSettingsProvider({ children }: { children: ReactNode }) {
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [brushCap, setBrushCap] = useState<BrushCap>(DEFAULT_BRUSH_CAP);
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE);
  const [brushOpacity, setBrushOpacity] = useState(DEFAULT_BRUSH_OPACITY);

  const value = useMemo(
    () => ({
      brushColor,
      setBrushColor,
      brushSize,
      setBrushSize,
      brushCap,
      setBrushCap,
      eraserSize,
      setEraserSize,
      brushOpacity,
      setBrushOpacity,
    }),
    [brushColor, brushSize, brushCap, eraserSize, brushOpacity],
  );

  return <PaintSettingsContext.Provider value={value}>{children}</PaintSettingsContext.Provider>;
}

export function usePaintSettings() {
  const ctx = useContext(PaintSettingsContext);
  if (!ctx) {
    throw new Error("usePaintSettings 必須在 PaintSettingsProvider 底下使用");
  }
  return ctx;
}
