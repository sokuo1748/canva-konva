"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type Konva from "konva";
import type { BrushStroke, CanvasShape, CanvasSnapshot, ShapePatch } from "../types/shape";
import { toggleSelection } from "../utils/selection";
import { MIN_CANVAS_SIZE, MAX_CANVAS_SIZE } from "../constants/shapeConstraints";
import type { AlignMode } from "../utils/align";
import { computeAlignDelta, getShapeLogicalRect, unionRects } from "../utils/align";
import { clearOrphanGroupIds, isExactlyOneWholeGroup } from "../utils/groups";
import { DEFAULT_FONT_FAMILY } from "../constants/fontFamilies";

// 畫布尺寸初始值
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 800;
const DEFAULT_CANVAS_BACKGROUND_COLOR = "#ffffff";
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
// Rect/Circle/Triangle/Star 的邊框預設值：strokeEnabled 預設 false，維持「新增形狀預設沒有
// 邊框」的既有視覺；顏色/粗度預設值刻意設得顯眼，讓使用者一打開開關就有明顯效果
const SHAPE_DEFAULT_STROKE = "#ff0000";
const SHAPE_DEFAULT_STROKE_WIDTH = 5;
const SHAPE_DEFAULT_STROKE_ENABLED = false;
// 虛線的預設 dash pattern
const LINE_DASH_PATTERN = [12, 8];
// 一般 shape 新增時預設不透明；橡皮擦筆畫固定不透明（destination-out 擦除不開放調整）
const DEFAULT_OPACITY = 100;
// 貼上時跟原本位置的位移量，讓使用者能明顯區分新舊物件
const PASTE_OFFSET = 20;

// shape.type 對應到 nextId() 的 prefix（"rect" 沿用既有的 "shape" 前綴，不是巧合命名錯誤）
const TYPE_TO_ID_PREFIX: Record<
  CanvasShape["type"],
  "shape" | "text" | "image" | "circle" | "triangle" | "star" | "line" | "brush"
> = {
  rect: "shape",
  text: "text",
  image: "image",
  circle: "circle",
  triangle: "triangle",
  star: "star",
  line: "line",
  brush: "brush",
};

// 對齊模式（完整 3x3 方位）定義在 utils/align.ts（純函式，不依賴 Konva/React），這裡單純
// re-export 給 Toolbar/panelRight 消費，維持既有「AlignMode 從 CanvasContext 匯出」的呼叫慣例
export type { AlignMode };

interface CanvasContextValue {
  shapes: CanvasShape[]; // 畫布上所有物件
  addSquare: () => void; // 新增正方形
  addText: () => void; // 新增文字
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => void; // 新增圖片
  addCircle: () => void; // 新增圓形
  addTriangle: () => void; // 新增三角形
  addStar: () => void; // 新增星形
  addLine: (dashed: boolean) => void; // 新增直線/虛線
  addBrushShape: (params: {
    // 建立一個新 BrushShape：畫筆/橡皮擦連續使用期間的「第一筆」呼叫這個，回傳新 id 讓
    // 呼叫端（useFreehandDraw.ts）記住這個 session 接下來要往哪個 shape 追加
    x: number;
    y: number;
    rotation: number;
    strokes: BrushStroke[];
  }) => string;
  appendBrushStroke: (id: string, stroke: BrushStroke) => boolean; // 把一筆新畫完的 stroke 追加進既有 BrushShape，id 不存在（例如中途被 undo 掉）回傳 false
  setBrushStrokes: (id: string, strokes: BrushStroke[]) => boolean; // 橡皮擦一次手勢結束時整批換掉 strokes；換成空陣列會改成刪除該 shape，回傳值＝這個 shape 之後是否還存在
  updateShape: (id: string, patch: ShapePatch) => void; // 更新單一物件屬性
  updateShapes: (patches: { id: string; patch: ShapePatch }[]) => void; // 批次更新多個物件屬性
  alignShapes: (ids: string[], mode: AlignMode) => void; // 對齊選取物件到畫布邊界/中心
  reorderShapes: (orderedIds: string[]) => void; // 依圖層清單拖曳結果重新排序
  deleteShape: (id: string) => void; // 刪除單一物件
  deleteShapes: (ids: string[]) => void; // 批次刪除多個物件
  copyShapes: (ids: string[]) => void; // 複製到 clipboard（純 UI 暫態，不進 history）
  cutShapes: (ids: string[]) => void; // 複製後刪除
  pasteShapes: () => void; // 貼上 clipboard 內容，產生新 id 並套用位移，只推一筆 history
  resetCanvas: () => void; // 清空畫布
  canvasWidth: number; // 畫布寬度
  canvasHeight: number; // 畫布高度
  setCanvasSize: (width: number, height: number) => void; // 調整畫布尺寸
  canvasBackgroundColor: string; // 畫布背景色
  setCanvasBackgroundColor: (color: string) => void; // 調整畫布背景色
  selectedId: string | null; // 單選時的衍生值，唯讀
  selectedIds: string[]; // 目前選取的物件 id
  setSelectedIds: (ids: string[]) => void; // 設定選取的物件
  activeId: string | null; // 目前操作的明確目標（分組展開時用）
  setActiveId: (id: string | null) => void; // 設定明確操作目標
  selectShape: (id: string, additive: boolean) => void; // 畫布點擊用的選取邏輯，點到鎖定分組會展開成整組
  selectShapeExact: (id: string, additive: boolean) => void; // 圖層清單點擊用，不展開成整組
  selectShapesExact: (ids: string[], additive: boolean) => void; // 圖層清單 shift 範圍選取用，批次版本，不展開成整組
  lockShapes: (ids: string[]) => void; // 鎖定選取物件成一組
  unlockShapes: (ids: string[]) => void; // 解除鎖定
  isShapePickerOpen: boolean; // Shape 圖形選單是否開啟
  setIsShapePickerOpen: (open: boolean) => void; // 開關 Shape 圖形選單
  activeTool: "select" | "brush" | "eraser"; // 目前作用中的工具
  setActiveTool: (tool: "select" | "brush" | "eraser") => void; // 切換工具
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
  const [canvasBackgroundColor, setCanvasBackgroundColorRaw] = useState(DEFAULT_CANVAS_BACKGROUND_COLOR);
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

  // 切到畫筆/橡皮擦模式時關閉選單並清空選取。手動按工具按鈕一律開新的 session，不會
  // 接續編輯切換前選取的既有 brush 圖層——續編輯唯一入口是雙擊該圖層（見 useFreehandDraw.ts
  // 的 enterBrushEdit），這是使用者實測後要求收回的行為（見 CLAUDE.md 這輪的變更說明）
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
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight, canvasBackgroundColor }]);
    setFuture([]);
  }, [shapes, canvasWidth, canvasHeight, canvasBackgroundColor]);

  // 還原一筆快照到畫布
  const applySnapshot = useCallback((entry: CanvasSnapshot) => {
    setShapes(entry.shapes);
    setCanvasWidth(entry.canvasWidth);
    setCanvasHeight(entry.canvasHeight);
    setCanvasBackgroundColorRaw(entry.canvasBackgroundColor);
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
        opacity: DEFAULT_OPACITY,
        lockAspectRatio: false,
        stroke: SHAPE_DEFAULT_STROKE,
        strokeWidth: SHAPE_DEFAULT_STROKE_WIDTH,
        strokeEnabled: SHAPE_DEFAULT_STROKE_ENABLED,
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
        opacity: DEFAULT_OPACITY,
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
          opacity: DEFAULT_OPACITY,
          lockAspectRatio: false,
        },
      ]);
      setSelectedIds([id]);
      setActiveId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds],
  );

  // 新增圓形（x/y 是中心點；width/height 可獨立拉伸成橢圓，見 CLAUDE.md）
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
        width: SHAPE_DEFAULT_SIZE,
        height: SHAPE_DEFAULT_SIZE,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
        opacity: DEFAULT_OPACITY,
        lockAspectRatio: false,
        stroke: SHAPE_DEFAULT_STROKE,
        strokeWidth: SHAPE_DEFAULT_STROKE_WIDTH,
        strokeEnabled: SHAPE_DEFAULT_STROKE_ENABLED,
      },
    ]);
    setSelectedIds([id]);
    setActiveId(id);
  }, [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds]);

  // 新增三角形（x/y 是中心點；width/height 可獨立拉伸成不等邊，見 CLAUDE.md）
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
        width: SHAPE_DEFAULT_SIZE,
        height: SHAPE_DEFAULT_SIZE,
        fill: "#000000",
        rotation: DEFAULT_ROTATION,
        opacity: DEFAULT_OPACITY,
        lockAspectRatio: false,
        stroke: SHAPE_DEFAULT_STROKE,
        strokeWidth: SHAPE_DEFAULT_STROKE_WIDTH,
        strokeEnabled: SHAPE_DEFAULT_STROKE_ENABLED,
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
        opacity: DEFAULT_OPACITY,
        stroke: SHAPE_DEFAULT_STROKE,
        strokeWidth: SHAPE_DEFAULT_STROKE_WIDTH,
        strokeEnabled: SHAPE_DEFAULT_STROKE_ENABLED,
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
          opacity: DEFAULT_OPACITY,
        },
      ]);
      setSelectedIds([id]);
      setActiveId(id);
    },
    [canvasWidth, canvasHeight, nextId, pushHistoryEntry, setSelectedIds],
  );

  // 建立一個新 BrushShape：畫筆/橡皮擦連續使用期間第一筆畫完（或編輯中的 shape 中途被
  // undo 掉、下一筆需要重新起一個新 shape）時由呼叫端（useFreehandDraw.ts）呼叫，回傳新
  // id 讓呼叫端記住接下來要往哪個 shape 追加（appendBrushStroke）。同一個連續使用期間
  // 的後續筆畫不會再呼叫這個函式，改呼叫 appendBrushStroke，見 CLAUDE.md 畫筆/橡皮擦條目
  const addBrushShape = useCallback(
    (params: { x: number; y: number; rotation: number; strokes: BrushStroke[] }) => {
      pushHistoryEntry();
      const id = nextId("brush");
      setShapes((prev) => [
        ...prev,
        {
          id,
          type: "brush",
          x: params.x,
          y: params.y,
          strokes: params.strokes,
          rotation: params.rotation,
        },
      ]);
      setSelectedIds([id]);
      setActiveId(id);
      return id;
    },
    [nextId, pushHistoryEntry, setSelectedIds],
  );

  // 把一筆新畫完的 stroke 追加進既有 BrushShape，一次呼叫推一筆 undo history——這是「每完成
  // 一筆就能各自被 Ctrl+Z 復原」的核心：找不到這個 id（例如同一個 session 中途使用者按了
  // Ctrl+Z，把這個 shape 復原掉了）就完全不做事、不推無意義的 history entry，回傳 false
  // 讓呼叫端知道要退回成「全新一筆」處理（見 useFreehandDraw.ts 的 finishStroke）
  const appendBrushStroke = useCallback(
    (id: string, stroke: BrushStroke) => {
      const shape = shapes.find((s) => s.id === id);
      if (!shape || shape.type !== "brush") return false;
      pushHistoryEntry();
      setShapes((prev) =>
        prev.map((s) => (s.id === id && s.type === "brush" ? { ...s, strokes: [...s.strokes, stroke] } : s)),
      );
      setSelectedIds([id]);
      setActiveId(id);
      return true;
    },
    [shapes, pushHistoryEntry, setSelectedIds],
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

  // 對齊選取物件到畫布邊界/中心（完整 3x3 方位），一次操作只推一筆 history。
  // 一般情況每個被選取的 shape 各自獨立對齊；但如果 ids 剛好等於某個鎖定分組的全部成員，
  // 改成對整組的聯集包圍盒算一次位移量、套用到每個成員，維持彼此的相對排列（跟拖曳分組的
  // handleDragMove 連動精神一致，不會讓分組成員各自貼齊、彼此重疊）。
  const alignShapes = useCallback(
    (ids: string[], mode: AlignMode) => {
      if (ids.length === 0) return;
      const stage = stageRef.current;

      // 取單一 shape 的畫布座標系包圍盒：優先讀 Konva node 的 getClientRect（考慮實際渲染狀態），
      // 找不到 node（例如圖片還沒載入完成）就 fallback 用 shape 自己的資料算邏輯包圍盒
      const getRect = (shape: CanvasShape) => {
        const node = stage?.findOne<Konva.Node>(`#${shape.id}`);
        if (node) return node.getClientRect({ relativeTo: stage! });
        return getShapeLogicalRect(shape);
      };

      // 目前 ids 是否剛好等於某個既有鎖定分組的全部成員（跟 Toolbar 判斷 Lock/Unlock icon 共用同一份邏輯）
      const isWholeGroup = isExactlyOneWholeGroup(shapes, ids);

      const patches: { id: string; patch: ShapePatch }[] = [];

      if (isWholeGroup) {
        const members = ids
          .map((id) => shapes.find((s) => s.id === id))
          .filter((s): s is CanvasShape => !!s);
        const rects = members.map(getRect).filter((r): r is NonNullable<typeof r> => !!r);
        const unionBox = unionRects(rects);
        if (unionBox) {
          const { deltaX, deltaY } = computeAlignDelta(unionBox, mode, canvasWidth, canvasHeight);
          for (const shape of members) {
            patches.push({
              id: shape.id,
              patch: { x: Math.round(shape.x + deltaX), y: Math.round(shape.y + deltaY) },
            });
          }
        }
      } else {
        for (const id of ids) {
          const shape = shapes.find((s) => s.id === id);
          if (!shape) continue;
          const rect = getRect(shape);
          if (!rect) continue;
          const { deltaX, deltaY } = computeAlignDelta(rect, mode, canvasWidth, canvasHeight);
          patches.push({
            id,
            patch: { x: Math.round(shape.x + deltaX), y: Math.round(shape.y + deltaY) },
          });
        }
      }

      if (patches.length === 0) return;
      setIsShapePickerOpen(false); // 手動關閉選單（不會經過 setSelectedIds，比照 lockShapes/unlockShapes）
      updateShapes(patches);
    },
    [shapes, canvasWidth, canvasHeight, updateShapes],
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

  // 圖層清單點擊專用的批次版本（shift 範圍選取用），不展開成整組
  const selectShapesExact = useCallback(
    (ids: string[], additive: boolean) => {
      // 畫筆模式下先切回 select 模式
      if (activeTool !== "select") setActiveTool("select");
      const nextIds = toggleSelection(selectedIds, ids, additive);
      setSelectedIds(nextIds);
      setActiveId(null);
    },
    [selectedIds, setSelectedIds, activeTool, setActiveTool],
  );

  // 圖層清單列點擊專用，不展開成整組
  const selectShapeExact = useCallback(
    (id: string, additive: boolean) => selectShapesExact([id], additive),
    [selectShapesExact],
  );

  // 批次刪除物件（只推一筆 history）
  const deleteShapes = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      if (!shapes.some((shape) => idSet.has(shape.id))) return;
      pushHistoryEntry();
      // filter 完可能讓某些群組只剩 1 個成員，順手清掉這種孤兒 groupId（修過的 bug，見 CLAUDE.md）
      setShapes((prev) => clearOrphanGroupIds(prev.filter((shape) => !idSet.has(shape.id))));
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
      setActiveId((prev) => (prev && idSet.has(prev) ? null : prev));
    },
    [shapes, pushHistoryEntry, setSelectedIds],
  );

  const deleteShape = useCallback((id: string) => deleteShapes([id]), [deleteShapes]); // 刪除單一物件

  // 橡皮擦一次連續拖曳手勢（mousedown -> mouseup）結束時，把整個 shape 的 strokes 換成
  // 挖除後的結果，只推一筆 undo history。挖光（strokes 變成空陣列）時改呼叫既有的
  // deleteShapes（已經會自己推一筆 history，這裡不要重複推）；找不到這個 id 一樣靜默跳過。
  // 回傳值語意＝「這個 shape 之後是否還存在」，讓呼叫端能判斷是否要把 session 重置成全新
  const setBrushStrokes = useCallback(
    (id: string, strokes: BrushStroke[]) => {
      const shape = shapes.find((s) => s.id === id);
      if (!shape || shape.type !== "brush") return false;

      if (strokes.length === 0) {
        deleteShapes([id]);
        return false;
      }

      pushHistoryEntry();
      setShapes((prev) => prev.map((s) => (s.id === id && s.type === "brush" ? { ...s, strokes } : s)));
      setSelectedIds([id]);
      setActiveId(id);
      return true;
    },
    [shapes, pushHistoryEntry, deleteShapes, setSelectedIds],
  );

  // clipboard 是純 UI 暫態（跟 isShapePickerOpen 同類），不進 CanvasSnapshot，用 ref 存即可不用觸發 re-render
  const clipboardRef = useRef<CanvasShape[]>([]);

  // 複製選取物件到 clipboard；ids 為空時保留原本 clipboard 內容不動
  const copyShapes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const matched = shapes.filter((shape) => idSet.has(shape.id));
      if (matched.length === 0) return;
      clipboardRef.current = matched;
    },
    [shapes],
  );

  // 剪下：複製後刪除（刪除走既有 deleteShapes，自動推一筆 history）
  const cutShapes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      copyShapes(ids);
      deleteShapes(ids);
    },
    [copyShapes, deleteShapes],
  );

  // 貼上 clipboard 內容：新 id、位移 PASTE_OFFSET；原本有 groupId 的成員會重新產生一個新 groupId
  // （同一批貼上的鎖定分組彼此還是同一組，但跟畫布上原本的分組脫鉤，不會誤併入原組），只推一筆 history。
  // 貼上後把 clipboard 內容本身換成剛貼上的結果（新 id + 新位置 + 新 groupId），讓連續按 Ctrl+V 每次都再疊加
  // PASTE_OFFSET、呈階梯狀散開，而不是每次都疊在同一個位置；copyShapes/cutShapes 會整包覆蓋
  // clipboardRef，因此重新複製一律回到「未疊加位移」的狀態，不會延續上一次貼上殘留的偏移
  const pasteShapes = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    pushHistoryEntry();
    const newIds: string[] = [];
    const groupIdMap = new Map<string, string>(); // 原 groupId -> 這批貼上專用的新 groupId
    const pasted = clipboardRef.current.map((shape) => {
      const id = nextId(TYPE_TO_ID_PREFIX[shape.type]);
      newIds.push(id);
      let groupId: string | undefined;
      if (shape.groupId) {
        if (!groupIdMap.has(shape.groupId)) {
          groupIdMap.set(shape.groupId, nextId("group"));
        }
        groupId = groupIdMap.get(shape.groupId);
      }
      return {
        ...shape,
        id,
        x: shape.x + PASTE_OFFSET,
        y: shape.y + PASTE_OFFSET,
        groupId,
      } as CanvasShape;
    });
    setShapes((prev) => [...prev, ...pasted]);
    clipboardRef.current = pasted;
    setSelectedIds(newIds);
    setActiveId(newIds.length === 1 ? newIds[0] : null);
  }, [nextId, pushHistoryEntry, setSelectedIds]);

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
        // 選取物件裡如果有人原本屬於別的分組，剩下沒被選到的原分組成員可能會落單，
        // 順手清掉這種孤兒 groupId（修過的 bug，見 CLAUDE.md）
        return clearOrphanGroupIds([
          ...rest.slice(0, restBeforeCount),
          ...selected,
          ...rest.slice(restBeforeCount),
        ]);
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
        // 只解鎖部分成員時，剩下沒被解鎖的成員可能會落單，順手清掉這種孤兒 groupId（修過的 bug，見 CLAUDE.md）
        clearOrphanGroupIds(
          prev.map((shape) => (idSet.has(shape.id) ? ({ ...shape, groupId: undefined } as CanvasShape) : shape)),
        ),
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

  // 調整畫布背景色
  const setCanvasBackgroundColor = useCallback(
    (color: string) => {
      pushHistoryEntry();
      setCanvasBackgroundColorRaw(color);
    },
    [pushHistoryEntry],
  );

  // 復原
  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previousEntry = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, { shapes, canvasWidth, canvasHeight, canvasBackgroundColor }]);
    applySnapshot(previousEntry);
  }, [past, shapes, canvasWidth, canvasHeight, canvasBackgroundColor, applySnapshot]);

  // 取消復原
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextEntry = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, { shapes, canvasWidth, canvasHeight, canvasBackgroundColor }]);
    applySnapshot(nextEntry);
  }, [future, shapes, canvasWidth, canvasHeight, canvasBackgroundColor, applySnapshot]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // 給未來 Export 功能用的唯讀快照，目前沒有任何呼叫端在用——lazy 產生，
  // 不要常態用 useEffect 每次 shapes 變動就序列化一次（shapes 可能含大型 base64 圖片）
  const getSnapshot = useCallback(
    () => JSON.stringify({ shapes, canvasWidth, canvasHeight, canvasBackgroundColor }),
    [shapes, canvasWidth, canvasHeight, canvasBackgroundColor],
  );

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
      addBrushShape,
      appendBrushStroke,
      setBrushStrokes,
      updateShape,
      updateShapes,
      alignShapes,
      reorderShapes,
      deleteShape,
      deleteShapes,
      copyShapes,
      cutShapes,
      pasteShapes,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      canvasBackgroundColor,
      setCanvasBackgroundColor,
      selectedId,
      selectedIds,
      setSelectedIds,
      activeId,
      setActiveId,
      selectShape,
      selectShapeExact,
      selectShapesExact,
      lockShapes,
      unlockShapes,
      isShapePickerOpen,
      setIsShapePickerOpen,
      activeTool,
      setActiveTool,
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
      addBrushShape,
      appendBrushStroke,
      setBrushStrokes,
      updateShape,
      updateShapes,
      alignShapes,
      reorderShapes,
      deleteShape,
      deleteShapes,
      copyShapes,
      cutShapes,
      pasteShapes,
      resetCanvas,
      canvasWidth,
      canvasHeight,
      setCanvasSize,
      canvasBackgroundColor,
      setCanvasBackgroundColor,
      selectedId,
      selectedIds,
      setSelectedIds,
      activeId,
      setActiveId,
      selectShape,
      selectShapeExact,
      selectShapesExact,
      lockShapes,
      unlockShapes,
      isShapePickerOpen,
      setIsShapePickerOpen,
      activeTool,
      setActiveTool,
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
