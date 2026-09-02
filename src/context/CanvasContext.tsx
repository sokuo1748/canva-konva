"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type Konva from "konva";
import type { BrushCap, CanvasShape, CanvasSnapshot, ShapePatch } from "../types/shape";
import { toggleSelection } from "../utils/selection";
import { eraseBrushStroke } from "../utils/eraseBrushStroke";
import type { Point } from "../utils/eraseBrushStroke";
import { MIN_CANVAS_SIZE, MAX_CANVAS_SIZE } from "../constants/shapeConstraints";
import { DEFAULT_FONT_FAMILY } from "../constants/fontFamilies";

// 畫布尺寸初始值
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 800;
const SQUARE_SIZE = 100;
const SQUARE_DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_ROTATION = 0;
const TEXT_DEFAULT_CONTENT = "預設文字";
const TEXT_DEFAULT_FONT_SIZE = 24;
// 估算新增文字置中位置用，不會存進資料
const TEXT_ESTIMATED_WIDTH = 120;
// 圖片超過此尺寸就等比縮小
const MAX_IMAGE_DIMENSION = 400;
// 圓形/三角形/星形/線的預設插入尺寸
const SHAPE_DEFAULT_SIZE = 100;
const LINE_DEFAULT_STROKE_WIDTH = 4;
// 虛線的預設 dash pattern
const LINE_DASH_PATTERN = [12, 8];
// 畫筆/橡皮擦工具參數預設值
const DEFAULT_BRUSH_COLOR = "#000000";
const DEFAULT_BRUSH_SIZE = 8;
const DEFAULT_BRUSH_CAP: BrushCap = "round";
const DEFAULT_ERASER_SIZE = 20;

interface CanvasContextValue {
  shapes: CanvasShape[]; // 畫布上所有物件
  addSquare: () => void; // 新增正方形
  addText: () => void; // 新增文字
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => void; // 新增圖片
  addCircle: () => void; // 新增圓形
  addTriangle: () => void; // 新增三角形
  addStar: () => void; // 新增星形
  addLine: (dashed: boolean) => void; // 新增直線/虛線
  addBrushStroke: (params: {
    // 提交一筆完整的畫筆軌跡（橡皮擦不再走這裡，見 eraseBrushStrokes）
    x: number;
    y: number;
    points: number[];
    stroke: string;
    strokeWidth: number;
    cap: BrushCap;
  }) => void;
  eraseBrushStrokes: (pathPoints: Point[], eraserSize: number) => void; // 資料層級擦除既有畫筆筆畫
  updateShape: (id: string, patch: ShapePatch) => void; // 更新單一物件屬性
  updateShapes: (patches: { id: string; patch: ShapePatch }[]) => void; // 批次更新多個物件屬性
  reorderShapes: (orderedIds: string[]) => void; // 依圖層清單拖曳結果重新排序
  deleteShape: (id: string) => void; // 刪除單一物件
  deleteShapes: (ids: string[]) => void; // 批次刪除多個物件
  resetCanvas: () => void; // 清空畫布
  canvasWidth: number; // 畫布寬度
  canvasHeight: number; // 畫布高度
  setCanvasSize: (width: number, height: number) => void; // 調整畫布尺寸
  selectedId: string | null; // 單選時的衍生值，唯讀
  selectedIds: string[]; // 目前選取的物件 id
  setSelectedIds: (ids: string[]) => void; // 設定選取的物件
  activeId: string | null; // 目前操作的明確目標（分組展開時用）
  setActiveId: (id: string | null) => void; // 設定明確操作目標
  selectShape: (id: string, additive: boolean) => void; // 畫布點擊用的選取邏輯，點到鎖定分組會展開成整組
  selectShapeExact: (id: string, additive: boolean) => void; // 圖層清單點擊用，不展開成整組
  lockShapes: (ids: string[]) => void; // 鎖定選取物件成一組
  unlockShapes: (ids: string[]) => void; // 解除鎖定
  isShapePickerOpen: boolean; // Shape 圖形選單是否開啟
  setIsShapePickerOpen: (open: boolean) => void; // 開關 Shape 圖形選單
  activeTool: "select" | "brush" | "eraser"; // 目前作用中的工具
  setActiveTool: (tool: "select" | "brush" | "eraser") => void; // 切換工具
  brushColor: string; // 畫筆顏色
  setBrushColor: (color: string) => void; // 設定畫筆顏色
  brushSize: number; // 畫筆大小
  setBrushSize: (size: number) => void; // 設定畫筆大小
  brushCap: BrushCap; // 畫筆筆刷形狀
  setBrushCap: (cap: BrushCap) => void; // 設定筆刷形狀
  eraserSize: number; // 橡皮擦大小
  setEraserSize: (size: number) => void; // 設定橡皮擦大小
  undo: () => void; // 復原
  redo: () => void; // 取消復原
  canUndo: boolean; // 是否可復原
  canRedo: boolean; // 是否可取消復原
  getSnapshot: () => string; // 取得目前畫布資料的 JSON 快照
  containerRef: RefObject<HTMLDivElement | null>; // 畫布容器 DOM ref
  stageRef: RefObject<Konva.Stage | null>; // Konva Stage 實例，供匯出使用
  overlayLayerRef: RefObject<Konva.Layer | null>; // 選取框/預覽線的 UI 覆蓋層，匯出時暫時隱藏
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [selectedIds, setSelectedIdsRaw] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [isShapePickerOpen, setIsShapePickerOpen] = useState(false);
  // 選取一改變就自動關閉 Shape 選單；唯一關閉入口，其他地方不要繞過去直接呼叫 setSelectedIdsRaw（修過的 bug，見 CLAUDE.md）
  const setSelectedIds = useCallback((update: string[] | ((prev: string[]) => string[])) => {
    setIsShapePickerOpen(false);
    setSelectedIdsRaw(update);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const overlayLayerRef = useRef<Konva.Layer>(null);

  const [activeTool, setActiveToolRaw] = useState<"select" | "brush" | "eraser">("select");
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [brushCap, setBrushCap] = useState<BrushCap>(DEFAULT_BRUSH_CAP);
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE);

  // 切到畫筆/橡皮擦模式時關閉選單並清空選取
  const setActiveTool = useCallback((tool: "select" | "brush" | "eraser") => {
    setActiveToolRaw(tool);
    if (tool !== "select") {
      setIsShapePickerOpen(false);
      setSelectedIdsRaw([]);
      setActiveId(null);
    }
  }, []);

  // undo/redo 歷史紀錄
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  // 各類型 id 計數器，只增不減
  const idCountersRef = useRef<{
    shape: number;
    text: number;
    image: number;
    group: number;
    circle: number;
    triangle: number;
    star: number;
    line: number;
    brush: number;
  }>({
    shape: 0,
    text: 0,
    image: 0,
    group: 0,
    circle: 0,
    triangle: 0,
    star: 0,
    line: 0,
    brush: 0,
  });

  // 產生遞增 id，例如 shape-1、text-2
  const nextId = useCallback(
    (prefix: "shape" | "text" | "image" | "group" | "circle" | "triangle" | "star" | "line" | "brush") => {
      idCountersRef.current[prefix] += 1;
      return `${prefix}-${idCountersRef.current[prefix]}`;
    },
    [],
  );

  // 推入 undo 歷史並清空 redo
  const pushHistoryEntry = useCallback(() => {
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    setFuture([]);
  }, [shapes, canvasWidth, canvasHeight]);

  // 還原一筆快照到畫布
  const applySnapshot = useCallback((entry: CanvasSnapshot) => {
    setShapes(entry.shapes);
    setCanvasWidth(entry.canvasWidth);
    setCanvasHeight(entry.canvasHeight);
    setSelectedIds((prev) => prev.filter((id) => entry.shapes.some((s) => s.id === id)));
    setActiveId((prev) => (prev && entry.shapes.some((s) => s.id === prev) ? prev : null));
  }, [setSelectedIds]);

  // 新增正方形
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
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增文字
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
        fontFamily: DEFAULT_FONT_FAMILY,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
      },
    ]);
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增圖片
  const addImage = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      // 尺寸無效時不新增，避免看不到的幽靈物件
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
      setSelectedIds([id]);
      setActiveId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds],
  );

  // 新增圓形（x/y 是中心點）
  const addCircle = useCallback(() => {
    pushHistoryEntry();
    const id = nextId("circle");
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "circle",
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        size: SHAPE_DEFAULT_SIZE,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
      },
    ]);
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增三角形（x/y 是中心點）
  const addTriangle = useCallback(() => {
    pushHistoryEntry();
    const id = nextId("triangle");
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "triangle",
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        size: SHAPE_DEFAULT_SIZE,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
      },
    ]);
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增星形（x/y 是中心點）
  const addStar = useCallback(() => {
    pushHistoryEntry();
    const id = nextId("star");
    setShapes((prev) => [
      ...prev,
      {
        id,
        type: "star",
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        size: SHAPE_DEFAULT_SIZE,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
      },
    ]);
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增直線/虛線（x/y 是線段起點）
  const addLine = useCallback(
    (dashed: boolean) => {
      pushHistoryEntry();
      const id = nextId("line");
      setShapes((prev) => [
        ...prev,
        {
          id,
          type: "line",
          x: (canvasWidth - SHAPE_DEFAULT_SIZE) / 2,
          y: canvasHeight / 2,
          points: [0, 0, SHAPE_DEFAULT_SIZE, 0],
          stroke: "#000000",
          strokeWidth: LINE_DEFAULT_STROKE_WIDTH,
          dash: dashed ? LINE_DASH_PATTERN : undefined,
          rotation: DEFAULT_ROTATION,
        },
      ]);
      setSelectedIds([id]);
      setActiveId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds],
  );

  // 提交一筆完整的畫筆軌跡，不自動選取（避免畫下一筆時被 Transformer 干擾）
  const addBrushStroke = useCallback(
    (params: {
      x: number;
      y: number;
      points: number[];
      stroke: string;
      strokeWidth: number;
      cap: BrushCap;
    }) => {
      pushHistoryEntry();
      const id = nextId("brush");
      setShapes((prev) => [
        ...prev,
        {
          id,
          type: "brush",
          x: params.x,
          y: params.y,
          points: params.points,
          stroke: params.stroke,
          strokeWidth: params.strokeWidth,
          cap: params.cap,
          rotation: DEFAULT_ROTATION,
        },
      ]);
    },
    [nextId, pushHistoryEntry],
  );

  // 橡皮擦：資料層級擦除，不產生任何持久化 shape，而是直接切割/裁切被擦到的既有畫筆筆畫
  const eraseBrushStrokes = useCallback(
    (pathPoints: Point[], eraserSize: number) => {
      if (pathPoints.length === 0) return;

      let anyChanged = false;
      const nextShapes: CanvasShape[] = [];
      for (const shape of shapes) {
        if (shape.type !== "brush") {
          nextShapes.push(shape);
          continue;
        }
        const result = eraseBrushStroke(shape, pathPoints, eraserSize);
        if (!result.changed) {
          nextShapes.push(shape); // 沒被擦到，維持同一個物件參考
          continue;
        }
        anyChanged = true;
        // 刻意不帶原本的 groupId：切段後的新畫筆片段變成獨立筆畫，不繼承原本鎖定分組的成員身分
        // （被擦剩的部分理論上已經不是使用者鎖定當下的那個完整物件了）
        for (const segment of result.segments) {
          nextShapes.push({
            id: nextId("brush"),
            type: "brush",
            x: segment.x,
            y: segment.y,
            points: segment.points,
            stroke: segment.stroke,
            strokeWidth: segment.strokeWidth,
            cap: segment.cap,
            rotation: DEFAULT_ROTATION,
          });
        }
      }

      if (!anyChanged) return; // 這筆橡皮擦完全沒碰到任何畫筆筆畫，不推無意義的 history
      pushHistoryEntry();
      setShapes(nextShapes);
    },
    [shapes, nextId, pushHistoryEntry],
  );

  // 更新單一物件屬性
  const updateShape = useCallback(
    (id: string, patch: ShapePatch) => {
      pushHistoryEntry();
      setShapes((prev) =>
        prev.map((shape) => (shape.id === id ? ({ ...shape, ...patch } as CanvasShape) : shape)),
      );
    },
    [pushHistoryEntry],
  );

  // 批次更新多個物件屬性（只推一筆 history）
  const updateShapes = useCallback(
    (patches: { id: string; patch: ShapePatch }[]) => {
      if (patches.length === 0) return;
      pushHistoryEntry();
      const patchMap = new Map(patches.map(({ id, patch }) => [id, patch]));
      setShapes((prev) =>
        prev.map((shape) => {
          const patch = patchMap.get(shape.id);
          return patch ? ({ ...shape, ...patch } as CanvasShape) : shape;
        }),
      );
    },
    [pushHistoryEntry],
  );

  // 依圖層清單拖曳結果重新排序
  const reorderShapes = useCallback(
    (orderedIds: string[]) => {
      if (orderedIds.length !== shapes.length) return;
      const shapeMap = new Map(shapes.map((shape) => [shape.id, shape]));
      if (new Set(orderedIds).size !== orderedIds.length) return; // 有重複 id，不是合法排列
      if (!orderedIds.every((id) => shapeMap.has(id))) return; // 有陌生 id 或漏掉現有 shape

      // 重用既有物件參考，維持 undo 記憶體共享
      const nextShapes = orderedIds.map((id) => shapeMap.get(id)!);
      const isSameOrder = nextShapes.every((shape, index) => shape === shapes[index]);
      if (isSameOrder) return; // 順序沒變就不推無意義的 history entry

      pushHistoryEntry();
      setShapes(nextShapes);
    },
    [shapes, pushHistoryEntry],
  );

  // 畫布/圖層清單的選取切換，點到鎖定分組會展開成整組
  const selectShape = useCallback(
    (id: string, additive: boolean) => {
      // 畫筆模式下點選會先切回 select 模式
      if (activeTool !== "select") setActiveTool("select");
      const shape = shapes.find((s) => s.id === id);
      const groupMemberIds = shape?.groupId
        ? shapes.filter((s) => s.groupId === shape.groupId).map((s) => s.id)
        : [];
      const idsToToggle = groupMemberIds.length >= 2 ? groupMemberIds : [id];
      const nextIds = toggleSelection(selectedIds, idsToToggle, additive);
      setSelectedIds(nextIds);
      // 只有分組展開時才設 activeId，一般 shift+click 多選刻意排除（修過的 regression，見 CLAUDE.md）
      setActiveId(idsToToggle.length > 1 && nextIds.includes(id) ? id : null);
    },
    [shapes, selectedIds, setSelectedIds, activeTool, setActiveTool],
  );

  // 圖層清單列點擊專用，不展開成整組
  const selectShapeExact = useCallback(
    (id: string, additive: boolean) => {
      // 畫筆模式下先切回 select 模式
      if (activeTool !== "select") setActiveTool("select");
      const nextIds = toggleSelection(selectedIds, [id], additive);
      setSelectedIds(nextIds);
      setActiveId(null);
    },
    [selectedIds, setSelectedIds, activeTool, setActiveTool],
  );

  // 批次刪除物件（只推一筆 history）
  const deleteShapes = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      if (!shapes.some((shape) => idSet.has(shape.id))) return;
      pushHistoryEntry();
      setShapes((prev) => prev.filter((shape) => !idSet.has(shape.id)));
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
      setActiveId((prev) => (prev && idSet.has(prev) ? null : prev));
    },
    [shapes, pushHistoryEntry, setSelectedIds],
  );

  const deleteShape = useCallback((id: string) => deleteShapes([id]), [deleteShapes]); // 刪除單一物件

  // 鎖定選取物件成一組，並搬到相鄰位置
  const lockShapes = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const matchedCount = shapes.filter((shape) => idSet.has(shape.id)).length;
      if (matchedCount < 2) return;
      setIsShapePickerOpen(false); // 手動關閉選單（不會經過 setSelectedIds）
      pushHistoryEntry();
      const groupId = nextId("group");
      setShapes((prev) => {
        const selectedIndices = prev.reduce<number[]>(
          (acc, shape, index) => (idSet.has(shape.id) ? [...acc, index] : acc),
          [],
        );
        const insertAt = Math.min(...selectedIndices);
        const rest = prev.filter((shape) => !idSet.has(shape.id));
        const restBeforeCount = prev.slice(0, insertAt).filter((shape) => !idSet.has(shape.id)).length;
        const selected = prev
          .filter((shape) => idSet.has(shape.id))
          .map((shape) => ({ ...shape, groupId }) as CanvasShape);
        return [...rest.slice(0, restBeforeCount), ...selected, ...rest.slice(restBeforeCount)];
      });
    },
    [shapes, pushHistoryEntry, nextId],
  );

  // 解除鎖定，只清除 groupId
  const unlockShapes = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      if (!shapes.some((shape) => idSet.has(shape.id))) return;
      setIsShapePickerOpen(false);
      pushHistoryEntry();
      setShapes((prev) =>
        prev.map((shape) => (idSet.has(shape.id) ? ({ ...shape, groupId: undefined } as CanvasShape) : shape)),
      );
    },
    [shapes, pushHistoryEntry],
  );

  // 清空畫布
  const resetCanvas = useCallback(() => {
    if (shapes.length === 0) return; // 畫布已空就不做事
    pushHistoryEntry();
    setShapes([]);
    setSelectedIds([]);
    setActiveId(null);
  }, [shapes, pushHistoryEntry, setSelectedIds]);

  // 調整畫布尺寸
  const setCanvasSize = useCallback(
    (width: number, height: number) => {
      pushHistoryEntry();
      // 保底 clamp，避免呼叫端沒驗證範圍
      setCanvasWidth(Math.min(Math.max(Math.round(width), MIN_CANVAS_SIZE), MAX_CANVAS_SIZE));
      setCanvasHeight(Math.min(Math.max(Math.round(height), MIN_CANVAS_SIZE), MAX_CANVAS_SIZE));
    },
    [pushHistoryEntry],
  );

  // 復原
  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previousEntry = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    applySnapshot(previousEntry);
  }, [past, shapes, canvasWidth, canvasHeight, applySnapshot]);

  // 取消復原
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextEntry = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    applySnapshot(nextEntry);
  }, [future, shapes, canvasWidth, canvasHeight, applySnapshot]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // 給 getSnapshot() 用的唯讀鏡像
  const snapshotRef = useRef<string>("");

  useEffect(() => {
    snapshotRef.current = JSON.stringify({ shapes, canvasWidth, canvasHeight });
  }, [shapes, canvasWidth, canvasHeight]);

  const getSnapshot = useCallback(() => snapshotRef.current, []); // 取得目前畫布資料的 JSON 快照

  const value = useMemo(
    () => ({
      shapes,
      addSquare,
      addText,
      addImage,
      addCircle,
      addTriangle,
      addStar,
      addLine,
      addBrushStroke,
      eraseBrushStrokes,
      updateShape,
      updateShapes,
      reorderShapes,
      deleteShape,
      deleteShapes,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      selectedId,
      selectedIds,
      setSelectedIds,
      activeId,
      setActiveId,
      selectShape,
      selectShapeExact,
      lockShapes,
      unlockShapes,
      isShapePickerOpen,
      setIsShapePickerOpen,
      activeTool,
      setActiveTool,
      brushColor,
      setBrushColor,
      brushSize,
      setBrushSize,
      brushCap,
      setBrushCap,
      eraserSize,
      setEraserSize,
      undo,
      redo,
      canUndo,
      canRedo,
      getSnapshot,
      containerRef,
      stageRef,
      overlayLayerRef,
    }),
    // ref 物件 identity 不變，不用列進依賴陣列
    [
      shapes,
      addSquare,
      addText,
      addImage,
      addCircle,
      addTriangle,
      addStar,
      addLine,
      addBrushStroke,
      eraseBrushStrokes,
      updateShape,
      updateShapes,
      reorderShapes,
      deleteShape,
      deleteShapes,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      selectedId,
      selectedIds,
      setSelectedIds,
      activeId,
      setActiveId,
      selectShape,
      selectShapeExact,
      lockShapes,
      unlockShapes,
      isShapePickerOpen,
      setIsShapePickerOpen,
      activeTool,
      setActiveTool,
      brushColor,
      setBrushColor,
      brushSize,
      setBrushSize,
      brushCap,
      setBrushCap,
      eraserSize,
      setEraserSize,
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
