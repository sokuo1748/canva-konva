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

// 一次「繪畫工作階段」的草稿：從工具開啟（或雙擊既有 brush 圖層進入編輯）到工具關閉
// （切回 select）之間累積的所有筆畫，都先暫存在這裡，不進 shapes[]、不推 undo history，
// 直到工具關閉那一刻才合併成一個 BrushShape 一次性提交（見 CLAUDE.md 畫筆/橡皮擦條目）
interface DraftSession {
  editingId: string | null; // 非 null 代表正在編輯這個既有 shape，而不是畫一個全新的
  x: number;
  y: number;
  rotation: number;
  strokes: BrushStroke[]; // 已經收尾（mouseup）的筆畫
  originalStrokes: BrushStroke[] | null; // 編輯模式載入當下的快照，收尾時用來判斷有沒有真的改動
}

interface UseFreehandDrawResult {
  session: DraftSession | null; // 目前的草稿 session，供 KonvaBoard 即時預覽用
  inProgressStroke: BrushStroke | null; // 正在畫的這一筆（mousedown 到 mouseup 之間）
  handleDrawMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  handleDrawMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  enterBrushEdit: (shape: BrushShape) => void; // 雙擊既有 brush 圖層時呼叫，進入編輯模式
}

// 畫筆/橡皮擦：管理「一次繪畫工作階段」的草稿狀態、mousedown/mousemove/mouseup 取樣，
// 以及雙擊既有 brush 圖層進入編輯模式。橡皮擦是直接對草稿裡的 strokes 點資料做向量挖除
// （必要時把一筆斷成兩筆），不再用 globalCompositeOperation: destination-out 疊加遮罩
// （見 CLAUDE.md 這輪的變更說明）
export function useFreehandDraw(): UseFreehandDrawResult {
  const {
    activeTool,
    setActiveTool,
    addBrushShape,
    updateShape,
    deleteShape,
    setSelectedIds,
    setActiveId,
    canvasWidth,
    canvasHeight,
  } = useCanvas();
  const { brushColor, brushSize, brushCap, eraserSize, brushOpacity } = usePaintSettings();

  const [session, setSession] = useState<DraftSession | null>(null);
  const sessionRef = useRef<DraftSession | null>(null);
  const [inProgressStroke, setInProgressStroke] = useState<BrushStroke | null>(null);
  const inProgressRef = useRef<BrushStroke | null>(null);

  // 橡皮擦是否正在拖曳中（沒有像 brush 一樣的「進行中筆畫」概念，另外用旗標追蹤）
  const isErasingRef = useRef(false);
  // 上一次橡皮擦取樣位置（session 本地座標），mousemove 沿路徑取樣用來避免快速拖曳漏擦
  const lastErasePosRef = useRef<{ x: number; y: number } | null>(null);

  // 收尾目前正在畫的這一筆（brush），橡皮擦沒有這個概念但共用同一個清理入口
  const finishStroke = useCallback(() => {
    isErasingRef.current = false;
    lastErasePosRef.current = null;

    const stroke = inProgressRef.current;
    if (!stroke) return;
    inProgressRef.current = null;
    setInProgressStroke(null);

    const current = sessionRef.current;
    if (!current) return;

    // 單純點擊只有一個點時複製成兩份，才能畫出可見的點（見 CLAUDE.md 已知細節）
    const points = stroke.points.length <= 2 ? [...stroke.points, ...stroke.points] : stroke.points;
    const finalizedStroke: BrushStroke = { ...stroke, points };
    const next: DraftSession = { ...current, strokes: [...current.strokes, finalizedStroke] };
    sessionRef.current = next;
    setSession(next);
  }, []);

  // 把目前 session 的最終結果提交：全新 session 合併成一個新 BrushShape；編輯模式寫回
  // 同一個 shape id，沒有實質改動或全部擦光時分別靜默跳過/刪除。只推一筆 undo entry
  const commitSession = useCallback(() => {
    // 保險：理論上呼叫這裡之前 mouseup 應該已經收尾過，這裡再收一次避免漏掉邊界情況
    // （例如滑鼠在畫布容器外放開，Stage 收不到 mouseup）
    finishStroke();

    const current = sessionRef.current;
    if (!current) return;
    sessionRef.current = null;
    setSession(null);

    if (current.editingId) {
      const unchanged =
        current.originalStrokes !== null && areStrokesEqual(current.originalStrokes, current.strokes);
      if (unchanged) {
        // 沒有真的改動，不推無意義的 history entry，但 enterBrushEdit 進入編輯模式時已經
        // 透過 setActiveTool("brush") 把 selectedIds 清空，這裡要跟「有改動」分支一樣
        // 重新選取該 shape，避免「雙擊進入編輯、什麼都沒改就切回 select」後圖層變成未選取
        setSelectedIds([current.editingId]);
        return;
      }

      if (current.strokes.length === 0) {
        deleteShape(current.editingId);
        return;
      }

      updateShape(current.editingId, { strokes: current.strokes });
      setSelectedIds([current.editingId]);
      setActiveId(current.editingId);
      return;
    }

    if (current.strokes.length === 0) return; // 一筆都沒畫（或全部被擦光），不新增
    addBrushShape({
      x: current.x,
      y: current.y,
      rotation: current.rotation,
      strokes: current.strokes,
    });
  }, [finishStroke, deleteShape, updateShape, addBrushShape, setSelectedIds, setActiveId]);

  // 雙擊已提交的 brush 圖層，把它的 strokes 讀回草稿狀態繼續編輯；只在 activeTool==="select"
  // 時由 KonvaBoard 掛上這個 handler（見 KonvaBoard.tsx），避免雙擊事件跟畫圖手勢互相干擾。
  // 這個定義刻意放在下面「工具切換」的 effect 之前——effect 的依賴陣列會用到
  // enterBrushEdit，宣告順序在 JS 裡必須先於使用它的地方（const 沒有函式那種 hoisting）
  const enterBrushEdit = useCallback(
    (shape: BrushShape) => {
      // 理論上呼叫這裡時不會有其他未提交的 session（見上面的限制），保險起見還是先收尾一次，
      // 避免真的發生時悄悄丟掉前一個 session 的內容
      commitSession();

      const strokes = shape.strokes.map((stroke) => ({ ...stroke }));
      const next: DraftSession = {
        editingId: shape.id,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation,
        strokes,
        originalStrokes: strokes,
      };
      sessionRef.current = next;
      setSession(next);
      inProgressRef.current = null;
      setInProgressStroke(null);

      // 透明度已經下放到每一筆 stroke 自己身上（跟 color/strokeWidth/cap 一致），
      // 進入編輯模式不對面板上的 brushOpacity 滑桿做任何同步：滑桿代表「目前畫筆設定」，
      // 只影響接下來新畫的筆畫，既有筆畫的透明度不受影響、也不會被滑桿追溯覆蓋
      if (activeTool === "select") setActiveTool("brush");
    },
    [commitSession, activeTool, setActiveTool],
  );

  // 工具切回 select 的那一刻才提交整個 session；切換 brush/eraser 兩個子工具彼此
  // 不會觸發提交（同一個 session 繼續累積），只有回到 select 才算「工具關閉」。
  // 反方向（select -> brush/eraser 的 rising edge）刻意不做任何事：手動按工具按鈕一律開一個
  // 全新 session，不管切換前選取了什麼——續編輯既有 brush 圖層唯一入口是雙擊該圖層
  // （見下面 enterBrushEdit、KonvaBoard.tsx 的 onDblClick）。這是收回上一輪「切工具前單選
  // 既有 brush 圖層就自動續編輯」的行為：使用者實測後發現選到舊圖層時按按鈕會非預期地
  // 續編輯，不是預期中的「開新的一筆」，見 CLAUDE.md 這輪的變更說明。
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    const prevTool = prevToolRef.current;
    prevToolRef.current = activeTool;

    if (prevTool !== "select" && activeTool === "select") {
      commitSession();
    }
  }, [activeTool, commitSession]);

  // 開始畫一筆（brush）或按下就先擦一次（eraser）
  const handleDrawMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const rawPos = stage?.getRelativePointerPosition();
      if (!rawPos) return;

      // 起點在畫布範圍外就取消，不開始畫/擦（沿用既有限制）
      if (rawPos.x < 0 || rawPos.x > canvasWidth || rawPos.y < 0 || rawPos.y > canvasHeight) return;

      const current: DraftSession =
        sessionRef.current ?? {
          editingId: null,
          x: 0,
          y: 0,
          rotation: 0,
          strokes: [],
          originalStrokes: null,
        };

      if (activeTool === "eraser") {
        isErasingRef.current = true;
        const local = toSessionLocalPoint(rawPos, current, current.rotation);
        lastErasePosRef.current = local;
        const next: DraftSession = { ...current, strokes: eraseStrokesAtPoint(current.strokes, local, eraserSize / 2) };
        sessionRef.current = next;
        setSession(next);
        return;
      }

      // brush：全新 session（不是編輯既有 shape）的第一筆，用它的起點當作整個 session 的原點
      const isFirstStrokeOfNewSession = current.editingId === null && current.strokes.length === 0;
      const workingSession = isFirstStrokeOfNewSession
        ? { ...current, x: rawPos.x, y: rawPos.y, rotation: 0 }
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
    [activeTool, brushColor, brushSize, brushCap, brushOpacity, eraserSize, canvasWidth, canvasHeight],
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
        const current = sessionRef.current;
        if (!current) return;
        const local = toSessionLocalPoint(clamped, current, current.rotation);
        const nextStrokes = eraseStrokesAlongPath(current.strokes, lastErasePosRef.current, local, eraserSize / 2);
        lastErasePosRef.current = local;
        const next: DraftSession = { ...current, strokes: nextStrokes };
        sessionRef.current = next;
        setSession(next);
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
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    enterBrushEdit,
  };
}
