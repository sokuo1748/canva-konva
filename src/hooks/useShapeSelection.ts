"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../context/CanvasContext";
import type { ShapePatch } from "../types/shape";
import { MIN_FONT_SIZE, MIN_SHAPE_SIZE } from "../constants/shapeConstraints";
import { isAdditiveClick } from "../utils/selection";
import { rectsIntersect } from "../utils/geometry";
import type { Rect } from "../utils/geometry";

// 大部分 shape 類型（含多選）只留四角控點，不給邊控點
const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
// Line 只留左中／右中兩個控點（拉線段兩端）
const LINE_ANCHORS = ["middle-left", "middle-right"];

// 拖曳距離小於這個值視為單純點擊，不當作框選
const MARQUEE_DRAG_THRESHOLD = 4;
// 線段縮放後兩端點距離下限
const MIN_LINE_LENGTH = MIN_SHAPE_SIZE;

// 這幾種 shape 的 width/height 都綁死同一顆半徑，單選時必須鎖 keepRatio
const UNIFORM_SCALE_CLASS_NAMES = new Set(["Text", "Circle", "RegularPolygon", "Star"]);

// 旋轉控點圖示：沿用 @tabler/icons-react 的 IconRotate path data（outline 風格）
// 顏色寫死成 Konva 預設 anchor 邊框色（rgb(0, 161, 255)），跟其餘控點視覺一致；
// 不能用 currentColor，這裡是要轉成點陣圖的獨立 SVG，不在 CSS context 裡
const ROTATE_ANCHOR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(0, 161, 255)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" /></svg>`;
const ROTATE_ANCHOR_ICON_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ROTATE_ANCHOR_ICON_SVG)}`;
// 旋轉控點的圖示尺寸（px），比預設 anchorSize（10）大一些，圖示線條才不會擠在一起
const ROTATE_ANCHOR_ICON_SIZE = 20;

// 依選取節點設定 Transformer 的控點與 keepRatio
function applyTransformerTarget(transformer: Konva.Transformer, nodes: Konva.Node[]) {
  transformer.nodes(nodes);

  // 畫筆筆畫底層也是 Line，靠 name="freehand"（見 KonvaBoard.tsx）排除，避免套用直線專用的兩端控點
  const isSingleStraightLine =
    nodes.length === 1 && nodes[0].getClassName() === "Line" && !nodes[0].hasName("freehand");
  const keepRatio = nodes.length === 1 && UNIFORM_SCALE_CLASS_NAMES.has(nodes[0].getClassName());
  transformer.enabledAnchors(isSingleStraightLine ? LINE_ANCHORS : CORNER_ANCHORS);
  transformer.keepRatio(keepRatio);

  transformer.getLayer()?.batchDraw();
}

interface UseShapeSelectionResult {
  selectedId: string | null;
  selectedIds: string[];
  marqueeRect: Rect | null; // 框選中的矩形範圍
  transformerRef: RefObject<Konva.Transformer | null>;
  registerShapeRef: (id: string) => (node: Konva.Node | null) => void; // 註冊 shape 對應的 Konva node
  handleSelect: (id: string, e: KonvaEventObject<MouseEvent>) => void; // 點擊選取
  handleStageMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleStageMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  handleStageMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  handleDragStart: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleDragMove: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleDragEnd: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleTransformEnd: (id: string) => (e: KonvaEventObject<Event>) => void; // 縮放/旋轉結束後寫回屬性
  rotateAnchorStyleFunc: (anchor: Konva.Rect) => void; // 把旋轉控點的空白方塊換成 IconRotate 圖示
}

// 選取/拖曳/縮放/框選邏輯，selectedIds 讀寫 CanvasContext
export function useShapeSelection(): UseShapeSelectionResult {
  const { selectedId, selectedIds, setSelectedIds, setActiveId, selectShape, updateShape, updateShapes, shapes } =
    useCanvas();
  const transformerRef = useRef<Konva.Transformer>(null);
  // 每個 shape 目前掛載的 Konva node
  const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  // 快取 ref callback，維持跨 render 身分穩定
  const shapeRefCallbacksRef = useRef<Map<string, (node: Konva.Node | null) => void>>(new Map());

  // 讀最新選取值，避免快取住的 callback 抓到 stale closure
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // 旋轉控點圖示：載入完成前維持 Konva 預設空白方塊，載入完成後補一次 forceUpdate 讓已顯示的控點立即補上圖示
  const rotateAnchorImageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      rotateAnchorImageRef.current = image;
      transformerRef.current?.forceUpdate();
    };
    image.src = ROTATE_ANCHOR_ICON_DATA_URI;
  }, []);

  // Transformer.update() 最後一步會對每個 anchor（含 rotater）呼叫這個 func，
  // 在這裡覆寫 rotater 的視覺內容不會被前面的統一設定蓋掉
  const rotateAnchorStyleFunc = useCallback((anchor: Konva.Rect) => {
    if (!anchor.hasName("rotater")) return;

    // 比預設 anchorSize 大一點的正方形，圖示才看得清楚
    anchor.width(ROTATE_ANCHOR_ICON_SIZE);
    anchor.height(ROTATE_ANCHOR_ICON_SIZE);
    anchor.offsetX(ROTATE_ANCHOR_ICON_SIZE / 2);
    anchor.offsetY(ROTATE_ANCHOR_ICON_SIZE / 2);

    // 明確蓋掉 Transformer.update() 前面統一套上的白底藍框方塊樣式，
    // 這個 anchor 只顯示 IconRotate 圖示本身，不要任何方形背景/邊框
    anchor.stroke("");
    anchor.strokeWidth(0);
    anchor.fill("transparent");

    // 圖片還沒載入完成前（rotateAnchorImageRef.current 為 null）沒有 pattern 可畫，
    // 加上前面已經把 fill 設成 transparent，這個控點會短暫完全不可見（無背景也無圖示）。
    // 這是刻意接受的 trade-off：圖示是 inline SVG data URI（沒有網路請求），
    // 載入幾乎是瞬間完成，這個過渡態影響極小，不特別加 loading placeholder。
    const image = rotateAnchorImageRef.current;
    if (!image) return;

    anchor.fillPriority("pattern");
    anchor.fillPatternImage(image);
    anchor.fillPatternRepeat("no-repeat");
    anchor.fillPatternScaleX(ROTATE_ANCHOR_ICON_SIZE / image.width);
    anchor.fillPatternScaleY(ROTATE_ANCHOR_ICON_SIZE / image.height);
  }, []);

  // 註冊 shape 對應的 Konva node
  const registerShapeRef = useCallback((id: string) => {
    const cached = shapeRefCallbacksRef.current.get(id);
    if (cached) return cached;

    const callback = (node: Konva.Node | null) => {
      if (node) {
        shapeNodesRef.current.set(id, node);
        // node 剛掛上時如果正是目前選取的一員，補一次手動 attach
        if (selectedIdsRef.current.includes(id) && transformerRef.current) {
          const nodes = selectedIdsRef.current
            .map((selectedShapeId) => shapeNodesRef.current.get(selectedShapeId))
            .filter((n): n is Konva.Node => n != null);
          applyTransformerTarget(transformerRef.current, nodes);
        }
      } else {
        // node 為 null 代表這個 shape 被刪除
        shapeNodesRef.current.delete(id);
        shapeRefCallbacksRef.current.delete(id);
      }
    };
    shapeRefCallbacksRef.current.set(id, callback);
    return callback;
  }, []);

  // 保底清理：處理圖片還沒載入完成就被刪除的情況
  useEffect(() => {
    const liveIds = new Set(shapes.map((shape) => shape.id));
    for (const id of shapeNodesRef.current.keys()) {
      if (!liveIds.has(id)) shapeNodesRef.current.delete(id);
    }
    for (const id of shapeRefCallbacksRef.current.keys()) {
      if (!liveIds.has(id)) shapeRefCallbacksRef.current.delete(id);
    }
  }, [shapes]);

  // 選取變動時同步 Transformer
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const nodes = selectedIds
      .map((id) => shapeNodesRef.current.get(id))
      .filter((n): n is Konva.Node => n != null);
    applyTransformerTarget(transformer, nodes);
  }, [selectedIds]);

  // 點擊選取
  const handleSelect = useCallback(
    (id: string, e: KonvaEventObject<MouseEvent>) => {
      selectShape(id, isAdditiveClick(e.evt));
    },
    [selectShape],
  );

  // 框選狀態：mousedown 記錄起點、mousemove 更新範圍、mouseup 依相交決定選取結果
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 點到 shape 交給 shape 自己的 onClick，這裡只處理點空白處
      if (e.target !== e.target.getStage()) return;

      setSelectedIds([]);
      setActiveId(null);

      const stage = e.target.getStage();
      const pos = stage?.getRelativePointerPosition();
      if (!pos) return;
      marqueeStartRef.current = pos;
      setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    },
    [setSelectedIds, setActiveId],
  );

  // mouseup/mousemove 共用的框選收尾邏輯
  const finishMarquee = useCallback(
    (rect: Rect | null, stage: Konva.Stage | null) => {
      marqueeStartRef.current = null;
      setMarqueeRect(null);

      if (!rect || (rect.width < MARQUEE_DRAG_THRESHOLD && rect.height < MARQUEE_DRAG_THRESHOLD)) return;
      if (!stage) return;

      const hitIds = shapes
        .filter((shape) => {
          const node = shapeNodesRef.current.get(shape.id);
          return node ? rectsIntersect(rect, node.getClientRect({ relativeTo: stage })) : false;
        })
        .map((shape) => shape.id);
      setSelectedIds(hitIds);
      setActiveId(null);
    },
    [shapes, setSelectedIds, setActiveId],
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!marqueeStartRef.current) return;

      // 偵測到滑鼠左鍵已放開就直接收尾，避免框選矩形卡著跟游標跑
      if ((e.evt.buttons & 1) === 0) {
        finishMarquee(marqueeRect, e.target.getStage());
        return;
      }

      const pos = e.target.getStage()?.getRelativePointerPosition();
      if (!pos) return;
      const start = marqueeStartRef.current;
      setMarqueeRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
    },
    [marqueeRect, finishMarquee],
  );

  const handleStageMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!marqueeStartRef.current) return;
      finishMarquee(marqueeRect, e.target.getStage());
    },
    [marqueeRect, finishMarquee],
  );

  // 鎖定分組拖曳連動：記錄開始當下每個成員的起始座標，再套用位移量
  const groupDragRef = useRef<{
    leadId: string;
    leadStart: { x: number; y: number };
    members: { id: string; x: number; y: number }[]; // 不含 lead 自己
  } | null>(null);

  const handleDragStart = useCallback(
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      const shape = shapes.find((s) => s.id === id);
      const memberShapes = shape?.groupId
        ? shapes.filter((s) => s.groupId === shape.groupId && s.id !== id)
        : [];

      groupDragRef.current = {
        leadId: id,
        leadStart: { x: e.target.x(), y: e.target.y() },
        members: memberShapes.map((s) => {
          const node = shapeNodesRef.current.get(s.id);
          return { id: s.id, x: node ? node.x() : s.x, y: node ? node.y() : s.y };
        }),
      };
    },
    [shapes],
  );

  const handleDragMove = useCallback((id: string) => (e: KonvaEventObject<DragEvent>) => {
    const dragState = groupDragRef.current;
    if (!dragState || dragState.leadId !== id || dragState.members.length === 0) return;

    // 直接操作其他成員的 Konva node，維持即時視覺回饋
    const deltaX = e.target.x() - dragState.leadStart.x;
    const deltaY = e.target.y() - dragState.leadStart.y;
    for (const member of dragState.members) {
      shapeNodesRef.current.get(member.id)?.position({ x: member.x + deltaX, y: member.y + deltaY });
    }
    transformerRef.current?.forceUpdate(); // 手動搬動不會觸發 Transformer 監聽的 dragmove
    e.target.getLayer()?.batchDraw();
  }, []);

  const handleDragEnd = useCallback(
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      const dragState = groupDragRef.current;
      groupDragRef.current = null;

      const leadPatch = { x: Math.round(e.target.x()), y: Math.round(e.target.y()) };

      if (!dragState || dragState.leadId !== id || dragState.members.length === 0) {
        updateShape(id, leadPatch);
        return;
      }

      // 整組一次寫回，只算一筆 undo entry
      const deltaX = e.target.x() - dragState.leadStart.x;
      const deltaY = e.target.y() - dragState.leadStart.y;
      updateShapes([
        { id, patch: leadPatch },
        ...dragState.members.map((member) => ({
          id: member.id,
          patch: { x: Math.round(member.x + deltaX), y: Math.round(member.y + deltaY) },
        })),
      ]);
    },
    [updateShape, updateShapes],
  );

  // 縮放/旋轉結束後把 scale 重置回 1，改寫實際屬性
  const handleTransformEnd = useCallback(
    (id: string) => (e: KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      const rotation = Math.round(node.rotation());

      if (node.getClassName() === "Text") {
        // 文字只用 scaleX 改 fontSize
        const currentFontSize = (node as Konva.Text).fontSize();
        updateShape(id, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation,
          fontSize: Math.max(Math.round(currentFontSize * scaleX), MIN_FONT_SIZE),
        });
        return;
      }

      if (["Circle", "RegularPolygon", "Star"].includes(node.getClassName())) {
        // 這三種只存一個 size（半徑 × 2）
        const newSize = Math.max(Math.round(node.width() * scaleX), MIN_SHAPE_SIZE);
        updateShape(id, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation,
          size: newSize,
        });
        return;
      }

      if (node.getClassName() === "Line") {
        // Line 沒有 width/height，改為縮放 points 座標
        const points = (node as Konva.Line).points();
        const newPoints = points.map((p, i) => Math.round(i % 2 === 0 ? p * scaleX : p * scaleY));

        // 兩點線段的下限 clamp，避免縮到消失
        if (newPoints.length === 4) {
          const dx = newPoints[2] - newPoints[0];
          const dy = newPoints[3] - newPoints[1];
          const length = Math.hypot(dx, dy);
          if (length < MIN_LINE_LENGTH) {
            const [scaledDx, scaledDy] =
              length === 0 ? [MIN_LINE_LENGTH, 0] : [(dx / length) * MIN_LINE_LENGTH, (dy / length) * MIN_LINE_LENGTH];
            newPoints[2] = Math.round(newPoints[0] + scaledDx);
            newPoints[3] = Math.round(newPoints[1] + scaledDy);
          }
        }

        updateShape(id, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation,
          points: newPoints,
        });
        return;
      }

      // 其餘（rect/image）：x/y/width/height 一律整數
      const width = Math.max(Math.round(node.width() * scaleX), MIN_SHAPE_SIZE);
      const height = Math.max(Math.round(node.height() * scaleY), MIN_SHAPE_SIZE);
      const patch: ShapePatch = {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        rotation,
        width,
        height,
      };

      // 矩形縮放後 cornerRadius 可能超過新尺寸上限，一併夾住
      const currentShape = shapes.find((shape) => shape.id === id);
      if (currentShape?.type === "rect") {
        const maxCornerRadius = Math.floor(Math.min(width, height) / 2);
        patch.cornerRadius = Math.min(currentShape.cornerRadius, maxCornerRadius);
      }

      updateShape(id, patch);
    },
    [updateShape, shapes],
  );

  return {
    selectedId,
    selectedIds,
    marqueeRect,
    transformerRef,
    registerShapeRef,
    handleSelect,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTransformEnd,
    rotateAnchorStyleFunc,
  };
}
