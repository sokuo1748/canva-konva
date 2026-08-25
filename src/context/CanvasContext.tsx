"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { CanvasShape, CanvasSnapshot, ShapePatch } from "../types/shape";
import { toggleSelection } from "../utils/selection";

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
// 圓形/三角形/星形/線的預設插入尺寸，數值跟 SQUARE_SIZE 一樣但不共用常數，避免動到 addSquare 既有程式碼。
const SHAPE_DEFAULT_SIZE = 100;
const LINE_DEFAULT_STROKE_WIDTH = 4;
// 虛線的預設 dash pattern；直線（實線）是 dash: undefined。
const LINE_DASH_PATTERN = [12, 8];

interface CanvasContextValue {
  shapes: CanvasShape[];
  addSquare: () => void;
  addText: () => void;
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => void;
  addCircle: () => void;
  addTriangle: () => void;
  addStar: () => void;
  addLine: (dashed: boolean) => void;
  updateShape: (id: string, patch: ShapePatch) => void;
  updateShapes: (patches: { id: string; patch: ShapePatch }[]) => void;
  // 圖層清單拖曳排序，見下方實作註解。
  reorderShapes: (orderedIds: string[]) => void;
  deleteShape: (id: string) => void;
  deleteShapes: (ids: string[]) => void;
  resetCanvas: () => void;
  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (width: number, height: number) => void;
  // selectedId 是 selectedIds 只有一個元素時的衍生值，給只在乎「單一選取物件」的既有元件用，不是獨立 state，不能直接 set。
  selectedId: string | null;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  // 使用者實際點擊/操作的那一個 shape id，跟 selectedIds（拖曳/縮放/鎖定的操作範圍）是兩個獨立概念，沒有明確目標時是 null。
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  // 畫布點擊、圖層清單列點擊共用的選取切換邏輯：additive 為 false 取代成單選，true 時把 id 加入/移出目前選取。
  selectShape: (id: string, additive: boolean) => void;
  // selectShape 的「不展開成整組」版本，給圖層清單點特定一列用。
  selectShapeExact: (id: string, additive: boolean) => void;
  lockShapes: (ids: string[]) => void;
  unlockShapes: (ids: string[]) => void;
  // Shape 按鈕點下去要不要顯示圖形選單，放 context 是因為 TemplatePanel/SelectedShapePanel 是平行元件不能直接互傳 state。
  isShapePickerOpen: boolean;
  setIsShapePickerOpen: (open: boolean) => void;
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
  const [selectedIds, setSelectedIdsRaw] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const [isShapePickerOpen, setIsShapePickerOpen] = useState(false);
  // 選單只有在使用者還沒選定形狀時該顯示，selectedIds 一被改動就代表已經離開這個流程，統一在這裡關閉，不用每個呼叫端各自補一句。
  const setSelectedIds = useCallback((update: string[] | ((prev: string[]) => string[])) => {
    setIsShapePickerOpen(false);
    setSelectedIdsRaw(update);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  // undo/redo 歷史存 CanvasSnapshot 物件（不是 JSON 字串），沿用 immutable 更新讓未變動的 shape 共享參考不被重複複製。
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  // 每種類型各自遞增的計數器，產生 shape-1/text-1/image-1/group-1/circle-1/triangle-1/star-1/line-1，只增不減不受 undo/redo/reset 影響。
  const idCountersRef = useRef<{
    shape: number;
    text: number;
    image: number;
    group: number;
    circle: number;
    triangle: number;
    star: number;
    line: number;
  }>({
    shape: 0,
    text: 0,
    image: 0,
    group: 0,
    circle: 0,
    triangle: 0,
    star: 0,
    line: 0,
  });

  const nextId = useCallback(
    (prefix: "shape" | "text" | "image" | "group" | "circle" | "triangle" | "star" | "line") => {
      idCountersRef.current[prefix] += 1;
      return `${prefix}-${idCountersRef.current[prefix]}`;
    },
    [],
  );

  // 修改狀態前把目前狀態推進 past、清空 future（標準 undo/redo 語意）。
  const pushHistoryEntry = useCallback(() => {
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight }]);
    setFuture([]);
  }, [shapes, canvasWidth, canvasHeight]);

  // undo/redo 共用的整包套用 snapshot 邏輯，還原後把已經不存在的選取 id 濾掉（多選友善版本）。
  const applySnapshot = useCallback((entry: CanvasSnapshot) => {
    setShapes(entry.shapes);
    setCanvasWidth(entry.canvasWidth);
    setCanvasHeight(entry.canvasHeight);
    setSelectedIds((prev) => prev.filter((id) => entry.shapes.some((s) => s.id === id)));
    setActiveId((prev) => (prev && entry.shapes.some((s) => s.id === prev) ? prev : null));
  }, [setSelectedIds]);

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
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

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
      setSelectedIds([id]);
      setActiveId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds],
  );

  // circle/triangle/star 的 x/y 是形狀中心點（跟 Rect/Image 的左上角不同），置中畫布直接用畫布中心座標，不用像 addSquare 那樣扣一半尺寸。
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

  // 直線／虛線是同一個 LineShape，dashed 只決定預設 dash 屬性不同；(x, y) 是線段起點，不是左上角也不是中心點。
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

  const updateShape = useCallback(
    (id: string, patch: ShapePatch) => {
      pushHistoryEntry();
      setShapes((prev) =>
        prev.map((shape) => (shape.id === id ? ({ ...shape, ...patch } as CanvasShape) : shape)),
      );
    },
    [pushHistoryEntry],
  );

  // 批次版 updateShape：一次使用者操作只推一筆 history entry，不逐個 shape 各推一筆；不檢查 patch 是否真的改變了值，呼叫端保證每筆都對應真的變動過的 shape。
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

  // 圖層清單拖曳排序：orderedIds 必須是目前 shapes 的完整排列（不是子集合），只會被 LayersPanel.tsx 自己組出來的合法排列呼叫，驗證失敗或順序沒變都靜默不做事。
  const reorderShapes = useCallback(
    (orderedIds: string[]) => {
      if (orderedIds.length !== shapes.length) return;
      const shapeMap = new Map(shapes.map((shape) => [shape.id, shape]));
      if (new Set(orderedIds).size !== orderedIds.length) return; // 有重複 id，不是合法排列
      if (!orderedIds.every((id) => shapeMap.has(id))) return; // 有陌生 id 或漏掉現有 shape

      // 重用既有的 shape 物件參考（不是重新建立），undo history 的記憶體共享規則才不會被破壞。
      const nextShapes = orderedIds.map((id) => shapeMap.get(id)!);
      const isSameOrder = nextShapes.every((shape, index) => shape === shapes[index]);
      if (isSameOrder) return; // 順序沒變就不推無意義的 history entry

      pushHistoryEntry();
      setShapes(nextShapes);
    },
    [shapes, pushHistoryEntry],
  );

  // 畫布/圖層清單共用的選取切換：additive 為 false 取代選取，true 時整批加入/移出；點到鎖定分組成員會展開成整組。activeId 只在「這次真的展開了分組」時才設成被點的那個 id（一般多選疊加維持 null，否則會誤判成有明確目標、蓋掉批次刪除介面，是修過的 regression）。
  const selectShape = useCallback(
    (id: string, additive: boolean) => {
      const shape = shapes.find((s) => s.id === id);
      const groupMemberIds = shape?.groupId
        ? shapes.filter((s) => s.groupId === shape.groupId).map((s) => s.id)
        : [];
      const idsToToggle = groupMemberIds.length >= 2 ? groupMemberIds : [id];
      const nextIds = toggleSelection(selectedIds, idsToToggle, additive);
      setSelectedIds(nextIds);
      setActiveId(idsToToggle.length > 1 && nextIds.includes(id) ? id : null);
    },
    [shapes, selectedIds, setSelectedIds],
  );

  // 圖層清單列點擊專用：永遠只針對這個 id 本身、不展開成整組（跟畫布點擊「看到整個視覺群組」的直覺不同），activeId 一律設 null，單選靠 selectedIds[0] fallback。
  const selectShapeExact = useCallback(
    (id: string, additive: boolean) => {
      const nextIds = toggleSelection(selectedIds, [id], additive);
      setSelectedIds(nextIds);
      setActiveId(null);
    },
    [selectedIds, setSelectedIds],
  );

  // 批次刪除：一次使用者操作只推一筆 history entry，用「實際命中現有 shape 的數量」判斷要不要動作，避免推一筆沒有實際變化的 history entry。
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

  const deleteShape = useCallback((id: string) => deleteShapes([id]), [deleteShapes]);

  // 鎖定（綁定）：把選取的 shapes 標上同一個新 groupId，並搬到彼此相鄰的位置，這樣圖層清單才能用一個框把它們框在一起。
  const lockShapes = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const matchedCount = shapes.filter((shape) => idSet.has(shape.id)).length;
      if (matchedCount < 2) return;
      // 鎖定不會動到 selectedIds（收不到 setSelectedIds 那個 wrapper），另外手動關閉選單，跟其他會改變狀態的 action 語意一致。
      setIsShapePickerOpen(false);
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

  // 解除鎖定：只清掉 groupId，不重新排序（不像 lockShapes 需要順手搬到相鄰位置）。
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

  const resetCanvas = useCallback(() => {
    // 畫布已經是空的就不用做事，避免推一筆沒有變化的 history entry。
    if (shapes.length === 0) return;
    pushHistoryEntry();
    setShapes([]);
    setSelectedIds([]);
    setActiveId(null);
  }, [shapes, pushHistoryEntry, setSelectedIds]);

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
    snapshotRef.current = JSON.stringify({ shapes, canvasWidth, canvasHeight });
  }, [shapes, canvasWidth, canvasHeight]);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

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
      addCircle,
      addTriangle,
      addStar,
      addLine,
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
