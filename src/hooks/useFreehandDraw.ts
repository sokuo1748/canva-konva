"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../context/CanvasContext";
import { usePaintSettings } from "../context/PaintSettingsContext";
import type { BrushShape, BrushStroke } from "../types/shape";
import {
  areStrokesEqual,
  eraseStrokesAlongPath,
  eraseStrokesAtPoint,
  toSessionLocalPoint,
} from "../utils/brush";
import { MAX_BRUSH_POINTS } from "../constants/shapeConstraints";

// 兩點間距離小於這個值就跳過，避免長筆畫產生過多點
const MIN_POINT_DISTANCE = 2;

// 一次連續的「工具使用期間」：從工具開啟（或雙擊既有 brush 圖層進入編輯）到工具關閉
// （切回 select）之間畫的所有筆畫，仍然合併進同一個 BrushShape——但現在每完成一筆
// （或一次連續的橡皮擦拖曳手勢）就立刻寫進 shapes[] 並各自推一筆 undo history，不再
// 等到工具關閉那一刻才批次提交一整個 session（見 CLAUDE.md 畫筆/橡皮擦條目這輪的變更）。
// strokes 的真實資料現在活在 shapes[]（context）裡，這裡只保留「目前對應到哪個 shape」
interface DraftSession {
  shapeId: string | null; // null = 這個 session 還沒有對應的 shape（還沒畫出第一筆，或先前的 shape 中途被 undo 掉、下一筆要當全新處理）
  x: number;
  y: number;
  rotation: number;
}

interface UseFreehandDrawResult {
  session: DraftSession | null; // 目前的草稿 session，供 KonvaBoard 判斷要不要疊加即時預覽用
  inProgressStroke: BrushStroke | null; // 正在畫的這一筆（mousedown 到 mouseup 之間）
  erasePreview: { shapeId: string; strokes: BrushStroke[] } | null; // 橡皮擦拖曳中的即時挖除結果，取代 shapes[] 裡該 shape 舊資料的顯示
  handleDrawMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  enterBrushEdit: (shape: BrushShape) => void; // 雙擊既有 brush 圖層時呼叫，進入編輯模式
}

// 畫筆/橡皮擦：管理「一次連續工具使用期間」的 session 狀態、mousedown/mousemove/mouseup
// 取樣，以及雙擊既有 brush 圖層進入編輯模式。每完成一筆（brush）或一次拖曳手勢（eraser）
// 就立刻透過 context 的 appendBrushStroke/setBrushStrokes/addBrushShape 寫回 shapes[]，
// 各自推一筆 undo history，讓使用者可以逐筆 Ctrl+Z（見 CLAUDE.md 這輪的變更說明）
export function useFreehandDraw(): UseFreehandDrawResult {
  const {
    activeTool,
    setActiveTool,
    shapes,
    addBrushShape,
    appendBrushStroke,
    setBrushStrokes,
    setSelectedIds,
    canvasWidth,
    canvasHeight,
  } = useCanvas();
  const { brushColor, brushSize, brushCap, eraserSize, brushOpacity } = usePaintSettings();

  const [session, setSession] = useState<DraftSession | null>(null);
  const sessionRef = useRef<DraftSession | null>(null);
  const [inProgressStroke, setInProgressStroke] = useState<BrushStroke | null>(null);
  const inProgressRef = useRef<BrushStroke | null>(null);

  // 橡皮擦這次拖曳手勢的即時預覽：mousedown 當下從 shapes[] 讀出目前的 strokes 當基準，
  // 沿路徑挖除的結果先存在這裡，直到手勢收尾才真正寫回 shapes[]（見下方 finishStroke）
  const [erasePreview, setErasePreview] = useState<{ shapeId: string; strokes: BrushStroke[] } | null>(null);
  const erasePreviewRef = useRef<{ shapeId: string; strokes: BrushStroke[] } | null>(null);

  // 橡皮擦是否正在拖曳中（沒有像 brush 一樣的「進行中筆畫」概念，另外用旗標追蹤）
  const isErasingRef = useRef(false);
  // 上一次橡皮擦取樣位置（session 本地座標），mousemove 沿路徑取樣用來避免快速拖曳漏擦
  const lastErasePosRef = useRef<{ x: number; y: number } | null>(null);

  // 收尾目前這次手勢：橡皮擦（把 erasePreview 的挖除結果寫回 shapes[]）跟畫筆
  // （把 inProgressStroke 收尾成一筆完整的 stroke 並提交）共用同一個清理入口
  const finishStroke = useCallback(() => {
    // 收尾橡皮擦手勢：跟 shapes 裡這個 shapeId 目前實際的 strokes（挖除前的基準）比較，
    // 完全沒變動（拖曳整個沒擦到任何東西）就不呼叫任何 context action，不推無意義的 history
    const erasePreviewSnapshot = erasePreviewRef.current;
    if (erasePreviewSnapshot) {
      erasePreviewRef.current = null;
      setErasePreview(null);
      isErasingRef.current = false;
      lastErasePosRef.current = null;

      const { shapeId, strokes } = erasePreviewSnapshot;
      const baseline = shapes.find((s): s is BrushShape => s.id === shapeId && s.type === "brush");

      if (!baseline) {
        // shape 在這次橡皮擦手勢途中就已經不存在了（例如中途被 Ctrl+Z 復原掉）：
        // 這個 session 之後如果再畫，要當全新一筆處理
        if (sessionRef.current?.shapeId === shapeId) {
          const next = { ...sessionRef.current, shapeId: null };
          sessionRef.current = next;
          setSession(next);
        }
      } else if (!areStrokesEqual(baseline.strokes, strokes)) {
        const stillExists = setBrushStrokes(shapeId, strokes);
        if (!stillExists && sessionRef.current?.shapeId === shapeId) {
          // 整個擦光被刪除了，同樣把 session 重置成「還沒有對應的 shape」
          const next = { ...sessionRef.current, shapeId: null };
          sessionRef.current = next;
          setSession(next);
        }
      }
    } else {
      isErasingRef.current = false;
      lastErasePosRef.current = null;
    }

    // 收尾畫筆正在畫的這一筆
    const stroke = inProgressRef.current;
    if (!stroke) return;
    inProgressRef.current = null;
    setInProgressStroke(null);

    const current = sessionRef.current;
    if (!current) return; // 保底：理論上有 inProgressStroke 就一定有 session

    // 單純點擊只有一個點時複製成兩份，才能畫出可見的點（見 CLAUDE.md 已知細節）
    const points = stroke.points.length <= 2 ? [...stroke.points, ...stroke.points] : stroke.points;
    const finalizedStroke: BrushStroke = { ...stroke, points };

    if (current.shapeId === null) {
      // 這個 session 目前還沒有對應的 shape（不管是真的第一筆，還是先前的 shape 被中途
      // undo 掉、shapeId 被重置成 null 之後的下一筆），建立一個新的 BrushShape
      const newId = addBrushShape({ x: current.x, y: current.y, rotation: current.rotation, strokes: [finalizedStroke] });
      const next: DraftSession = { ...current, shapeId: newId };
      sessionRef.current = next;
      setSession(next);
      return;
    }

    const appended = appendBrushStroke(current.shapeId, finalizedStroke);
    if (!appended) {
      // 對應的 shape 中途被 undo 掉了：退回成全新一筆處理，沿用同一個 session 原點
      const newId = addBrushShape({ x: current.x, y: current.y, rotation: current.rotation, strokes: [finalizedStroke] });
      const next: DraftSession = { ...current, shapeId: newId };
      sessionRef.current = next;
      setSession(next);
    }
  }, [shapes, addBrushShape, appendBrushStroke, setBrushStrokes]);

  // 雙擊已提交的 brush 圖層，把它讀進 session 繼續編輯；只在 activeTool==="select"
  // 時由 KonvaBoard 掛上這個 handler（見 KonvaBoard.tsx），避免雙擊事件跟畫圖手勢互相干擾。
  // 這個定義刻意放在下面「工具切換」的 effect 之前——effect 的依賴陣列會用到
  // enterBrushEdit，宣告順序在 JS 裡必須先於使用它的地方（const 沒有函式那種 hoisting）
  const enterBrushEdit = useCallback(
    (shape: BrushShape) => {
      // 理論上呼叫這裡時不會有其他未收尾的手勢，保險起見還是先收尾一次，避免真的發生時
      // 悄悄丟掉使用者剛畫的/剛擦除的內容
      finishStroke();

      const next: DraftSession = {
        shapeId: shape.id,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation,
      };
      sessionRef.current = next;
      setSession(next);
      inProgressRef.current = null;
      setInProgressStroke(null);
      erasePreviewRef.current = null;
      setErasePreview(null);

      // 透明度已經下放到每一筆 stroke 自己身上（跟 color/strokeWidth/cap 一致），
      // 進入編輯模式不對面板上的 brushOpacity 滑桿做任何同步：滑桿代表「目前畫筆設定」，
      // 只影響接下來新畫的筆畫，既有筆畫的透明度不受影響、也不會被滑桿追溯覆蓋
      if (activeTool === "select") setActiveTool("brush");
    },
    [finishStroke, activeTool, setActiveTool],
  );

  // 工具切回 select 的那一刻：每一筆/每次橡皮擦手勢現在都已經即時提交，不再需要「批次提交
  // 整個 session」，只需要保留「切回 select 後，剛剛畫/編輯的那個 shape 保持選取」的既有
  // 體驗（涵蓋「雙擊進入編輯、什麼都沒改就切回 select」這種情境），然後把整個 session 重置。
  // 切換 brush/eraser 兩個子工具彼此不會觸發，只有回到 select 才算「工具關閉」。
  // 反方向（select -> brush/eraser 的 rising edge）刻意不做任何事：手動按工具按鈕一律開一個
  // 全新 session，續編輯既有 brush 圖層唯一入口是雙擊該圖層（見上面 enterBrushEdit）
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    const prevTool = prevToolRef.current;
    prevToolRef.current = activeTool;

    if (prevTool !== "select" && activeTool === "select") {
      // 保險：理論上 mouseup/放開左鍵時的偵測已經收尾過任何進行中的手勢，這裡再收一次
      finishStroke();

      const shapeId = sessionRef.current?.shapeId;
      if (shapeId) setSelectedIds([shapeId]);

      sessionRef.current = null;
      setSession(null);
      inProgressRef.current = null;
      setInProgressStroke(null);
      erasePreviewRef.current = null;
      setErasePreview(null);
    }
  }, [activeTool, finishStroke, setSelectedIds]);

  // 開始畫一筆（brush）或按下就先擦一次（eraser）
  const handleDrawMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const rawPos = stage?.getRelativePointerPosition();
      if (!rawPos) return;

      // 起點在畫布範圍外就取消，不開始畫/擦（沿用既有限制）
      if (rawPos.x < 0 || rawPos.x > canvasWidth || rawPos.y < 0 || rawPos.y > canvasHeight) return;

      const current: DraftSession = sessionRef.current ?? { shapeId: null, x: 0, y: 0, rotation: 0 };

      if (activeTool === "eraser") {
        if (current.shapeId === null) return; // 這個 session 還沒有任何 shape 可擦，維持既有的「沒東西可擦」行為

        const targetShape = shapes.find(
          (s): s is BrushShape => s.id === current.shapeId && s.type === "brush",
        );
        if (!targetShape) {
          // 對應的 shape 中途被 undo 掉了：跟 finishStroke 找不到 baseline 時一致，把
          // session 重置成「還沒有對應的 shape」，避免之後切回 brush 時仍卡著一個已經
          // 不存在的 shapeId
          const next = { ...current, shapeId: null };
          sessionRef.current = next;
          setSession(next);
          return;
        }

        isErasingRef.current = true;
        const local = toSessionLocalPoint(rawPos, current, current.rotation);
        lastErasePosRef.current = local;
        const erasedStrokes = eraseStrokesAtPoint(targetShape.strokes, local, eraserSize / 2);
        const preview = { shapeId: current.shapeId, strokes: erasedStrokes };
        erasePreviewRef.current = preview;
        setErasePreview(preview);
        return;
      }

      // brush：全新 session（還沒有對應 shape，或對應的 shape 已經被中途 undo 掉）的
      // 第一筆，用它的起點當作整個 session 的原點。只看 shapeId 是不是 null 不夠——undo
      // 會直接改 context 的 shapes[]，不會通知這支 hook 把 sessionRef.current.shapeId
      // 重置掉，所以這裡要額外確認 shapeId 指向的 shape 是否還真的存在於 shapes[] 裡
      // （跟上面 eraser 分支、finishStroke 裡已經有的同一套檢查邏輯一致）
      const existingShapeStillValid =
        current.shapeId !== null &&
        shapes.some((s) => s.id === current.shapeId && s.type === "brush");
      const isFirstStrokeOfNewSession = !existingShapeStillValid;
      const workingSession = isFirstStrokeOfNewSession
        ? { shapeId: null, x: rawPos.x, y: rawPos.y, rotation: 0 }
        : current;
      const local = toSessionLocalPoint(rawPos, workingSession, workingSession.rotation);
      const stroke: BrushStroke = {
        points: [local.x, local.y],
        color: brushColor,
        strokeWidth: brushSize,
        cap: brushCap,
        opacity: brushOpacity,
      };

      sessionRef.current = workingSession;
      setSession(workingSession);
      inProgressRef.current = stroke;
      setInProgressStroke(stroke);
    },
    [activeTool, shapes, brushColor, brushSize, brushCap, brushOpacity, eraserSize, canvasWidth, canvasHeight],
  );

  const handleDrawMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 偵測到左鍵已放開就直接收尾，避免筆畫/橡皮擦拖曳卡著跟游標跑
      if ((e.evt.buttons & 1) === 0) {
        finishStroke();
        return;
      }

      const stage = e.target.getStage();
      const rawPos = stage?.getRelativePointerPosition();
      if (!rawPos) return;

      // 拖出畫布範圍時剪裁到邊界，拖回來能自動接續
      const clamped = {
        x: Math.min(Math.max(rawPos.x, 0), canvasWidth),
        y: Math.min(Math.max(rawPos.y, 0), canvasHeight),
      };

      if (activeTool === "eraser") {
        if (!isErasingRef.current) return;
        const preview = erasePreviewRef.current;
        const current = sessionRef.current;
        if (!preview || !current) return;
        const local = toSessionLocalPoint(clamped, current, current.rotation);
        const nextStrokes = eraseStrokesAlongPath(preview.strokes, lastErasePosRef.current, local, eraserSize / 2);
        lastErasePosRef.current = local;
        const next = { shapeId: preview.shapeId, strokes: nextStrokes };
        erasePreviewRef.current = next;
        setErasePreview(next);
        return;
      }

      const stroke = inProgressRef.current;
      const current = sessionRef.current;
      if (!stroke || !current) return;

      const local = toSessionLocalPoint(clamped, current, current.rotation);
      const { points } = stroke;

      // 達到取樣點數上限就不再延伸，維持目前最後位置、忽略後續 mousemove
      if (points.length >= MAX_BRUSH_POINTS * 2) return;

      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];
      if (Math.hypot(local.x - lastX, local.y - lastY) < MIN_POINT_DISTANCE) return;

      const nextStroke: BrushStroke = { ...stroke, points: [...points, local.x, local.y] };
      inProgressRef.current = nextStroke;
      setInProgressStroke(nextStroke);
    },
    [activeTool, canvasWidth, canvasHeight, eraserSize, finishStroke],
  );

  const handleDrawMouseUp = useCallback(() => {
    finishStroke();
  }, [finishStroke]);

  return {
    session,
    inProgressStroke,
    erasePreview,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    enterBrushEdit,
  };
}
