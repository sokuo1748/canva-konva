"use client";

import { useCallback, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../context/CanvasContext";
import type { BrushCap } from "../types/shape";
import { ERASER_STROKE_COLOR } from "../constants/shapeConstraints";

// 兩點間距離小於這個值就跳過，避免長筆畫產生過多點
const MIN_POINT_DISTANCE = 2;

interface PreviewStroke {
  x: number;
  y: number;
  points: number[];
}

interface UseFreehandDrawResult {
  previewStroke: PreviewStroke | null; // 進行中、尚未提交的軌跡預覽
  handleDrawMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
}

// 畫筆/橡皮擦的自由路徑繪製：mousedown 開筆、mousemove 取樣累積、mouseup 提交一筆完整軌跡
export function useFreehandDraw(): UseFreehandDrawResult {
  const {
    activeTool,
    brushColor,
    brushSize,
    brushCap,
    eraserSize,
    brushOpacity,
    addBrushStroke,
    canvasWidth,
    canvasHeight,
  } = useCanvas();
  const [previewStroke, setPreviewStroke] = useState<PreviewStroke | null>(null);
  // 用 ref 存最新值，避免 mousemove closure 讀到 stale 的 previewStroke
  const strokeRef = useRef<PreviewStroke | null>(null);

  // 開始畫一筆
  const handleDrawMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const pos = stage?.getRelativePointerPosition();
      if (!pos) return;

      // 起點在畫布範圍外就取消，不開始畫
      if (pos.x < 0 || pos.x > canvasWidth || pos.y < 0 || pos.y > canvasHeight) return;

      const stroke: PreviewStroke = { x: pos.x, y: pos.y, points: [0, 0] };
      strokeRef.current = stroke;
      setPreviewStroke(stroke);
    },
    [canvasWidth, canvasHeight],
  );

  // 提交目前這一筆
  const commitStroke = useCallback(() => {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    setPreviewStroke(null);
    if (!stroke) return;

    // 單純點擊只有一個點時補成兩份，才能畫出可見的點（見 CLAUDE.md 已知細節）
    const points = stroke.points.length <= 2 ? [0, 0, 0, 0] : stroke.points;

    const isEraser = activeTool === "eraser";
    addBrushStroke({
      tool: isEraser ? "eraser" : "brush",
      x: stroke.x,
      y: stroke.y,
      points,
      stroke: isEraser ? ERASER_STROKE_COLOR : brushColor,
      strokeWidth: isEraser ? eraserSize : brushSize,
      cap: isEraser ? ("round" as BrushCap) : brushCap, // 橡皮擦固定圓形
      opacity: isEraser ? 100 : brushOpacity, // 橡皮擦不開放調整透明度
    });
  }, [activeTool, brushColor, brushSize, brushCap, eraserSize, brushOpacity, addBrushStroke]);

  const handleDrawMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stroke = strokeRef.current;
      if (!stroke) return;

      // 偵測到左鍵已放開就直接收尾
      if ((e.evt.buttons & 1) === 0) {
        commitStroke();
        return;
      }

      const stage = e.target.getStage();
      const pos = stage?.getRelativePointerPosition();
      if (!pos) return;

      // 拖出畫布範圍時剪裁到邊界，拖回來能自動接續
      const clampedX = Math.min(Math.max(pos.x, 0), canvasWidth);
      const clampedY = Math.min(Math.max(pos.y, 0), canvasHeight);

      const localX = clampedX - stroke.x;
      const localY = clampedY - stroke.y;
      const { points } = stroke;
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      if (Math.hypot(localX - lastX, localY - lastY) < MIN_POINT_DISTANCE) return;

      const nextStroke: PreviewStroke = { ...stroke, points: [...points, localX, localY] };
      strokeRef.current = nextStroke;
      setPreviewStroke(nextStroke);
    },
    [commitStroke, canvasWidth, canvasHeight],
  );

  const handleDrawMouseUp = useCallback(() => {
    commitStroke();
  }, [commitStroke]);

  return { previewStroke, handleDrawMouseDown, handleDrawMouseMove, handleDrawMouseUp };
}
