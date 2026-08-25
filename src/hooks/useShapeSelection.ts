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

// 大部分 shape 類型（含多選）都只留四角控點，不給邊控點（不能只改寬或只改高），文字/rect/image 合併成同一個常數。
const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
// Line 只留左中／右中兩個控點，符合「拉一條線的兩端來拉長/縮短」的直覺操作，不需要角控點。
const LINE_ANCHORS = ["middle-left", "middle-right"];

// 拖曳距離小於這個值（canvas 座標系下的 px）視為單純點擊，不當作框選。
const MARQUEE_DRAG_THRESHOLD = 4;
// 線段縮放後兩端點距離不能低於這個值，跟其他形狀「絕不縮到消失」一致，直接沿用 MIN_SHAPE_SIZE。
const MIN_LINE_LENGTH = MIN_SHAPE_SIZE;

// Circle/RegularPolygon/Star 的 width/height 在 Konva 裡都綁死同一顆半徑換算，跟 Text 一樣單一選取時必須鎖 keepRatio，否則 scaleX/scaleY 不一致時縮放結果會跟拖曳手感對不上。
const UNIFORM_SCALE_CLASS_NAMES = new Set(["Text", "Circle", "RegularPolygon", "Star"]);

// 共用函式：控點預設四角，只有單選 Line 才換成 LINE_ANCHORS；keepRatio 獨立於控點種類，只有單選且在 UNIFORM_SCALE_CLASS_NAMES 裡才鎖。
function applyTransformerTarget(transformer: Konva.Transformer, nodes: Konva.Node[]) {
  transformer.nodes(nodes);

  const isSingleLine = nodes.length === 1 && nodes[0].getClassName() === "Line";
  const keepRatio = nodes.length === 1 && UNIFORM_SCALE_CLASS_NAMES.has(nodes[0].getClassName());
  transformer.enabledAnchors(isSingleLine ? LINE_ANCHORS : CORNER_ANCHORS);
  transformer.keepRatio(keepRatio);

  transformer.getLayer()?.batchDraw();
}

interface UseShapeSelectionResult {
  selectedId: string | null;
  selectedIds: string[];
  marqueeRect: Rect | null;
  transformerRef: RefObject<Konva.Transformer | null>;
  registerShapeRef: (id: string) => (node: Konva.Node | null) => void;
  handleSelect: (id: string, e: KonvaEventObject<MouseEvent>) => void;
  handleStageMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleStageMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  handleStageMouseUp: (e: KonvaEventObject<MouseEvent>) => void;
  handleDragStart: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleDragMove: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleDragEnd: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleTransformEnd: (id: string) => (e: KonvaEventObject<Event>) => void;
}

// 選取/拖曳/縮放/框選的 Konva 細節都封裝在這裡；selectedIds 讀寫 CanvasContext，不是這裡的 local state。
export function useShapeSelection(): UseShapeSelectionResult {
  const { selectedId, selectedIds, setSelectedIds, setActiveId, selectShape, updateShape, updateShapes, shapes } =
    useCanvas();
  const transformerRef = useRef<Konva.Transformer>(null);
  // 存每個 shape 目前掛載的 Konva node，Transformer 才不用每次選取都重新查找。
  const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  // get-or-create 快取 ref callback，讓身分跨 render 穩定，避免不必要的 ref churn。
  const shapeRefCallbacksRef = useRef<Map<string, (node: Konva.Node | null) => void>>(new Map());

  // 快取住的 callback 若直接讀 selectedIds 會抓到建立當下的 stale closure，改用 ref 讀最新值。
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const registerShapeRef = useCallback((id: string) => {
    const cached = shapeRefCallbacksRef.current.get(id);
    if (cached) return cached;

    const callback = (node: Konva.Node | null) => {
      if (node) {
        shapeNodesRef.current.set(id, node);
        // node 剛掛上時如果正是目前選取的一員（例如圖片非同步載入完成才有 node），補一次手動 attach。
        if (selectedIdsRef.current.includes(id) && transformerRef.current) {
          const nodes = selectedIdsRef.current
            .map((selectedShapeId) => shapeNodesRef.current.get(selectedShapeId))
            .filter((n): n is Konva.Node => n != null);
          applyTransformerTarget(transformerRef.current, nodes);
        }
      } else {
        // node 為 null 代表這個 shape 被刪除、Konva node 剛 unmount。
        shapeNodesRef.current.delete(id);
        shapeRefCallbacksRef.current.delete(id);
      }
    };
    shapeRefCallbacksRef.current.set(id, callback);
    return callback;
  }, []);

  // 保底清理：圖片還沒載入完成就被刪除時，ref callback 從沒被呼叫過，上面的 null 分支不會觸發，這裡補清。
  useEffect(() => {
    const liveIds = new Set(shapes.map((shape) => shape.id));
    for (const id of shapeNodesRef.current.keys()) {
      if (!liveIds.has(id)) shapeNodesRef.current.delete(id);
    }
    for (const id of shapeRefCallbacksRef.current.keys()) {
      if (!liveIds.has(id)) shapeRefCallbacksRef.current.delete(id);
    }
  }, [shapes]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const nodes = selectedIds
      .map((id) => shapeNodesRef.current.get(id))
      .filter((n): n is Konva.Node => n != null);
    applyTransformerTarget(transformer, nodes);
  }, [selectedIds]);

  const handleSelect = useCallback(
    (id: string, e: KonvaEventObject<MouseEvent>) => {
      selectShape(id, isAdditiveClick(e.evt));
    },
    [selectShape],
  );

  // 框選（marquee）狀態：mousedown 記錄起點、mousemove 更新範圍、mouseup 依相交決定選取結果。
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 點到 shape 本身交給 shape 自己的 onClick 處理，這裡只處理「點空白處」。
      if (e.target !== e.target.getStage()) return;

      // 已知限制（刻意簡化，不是 bug）：空白處一律直接清空選取，不像點擊會判斷 isAdditiveClick 保留原選取，框選也不支援 shift+拖曳加選。
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

  // mouseup/mousemove 共用的收尾邏輯，因為滑鼠移出 Stage 容器才放開左鍵時 Konva 的 mouseup 不會觸發，要靠 mousemove 補上同一套收尾。
  const finishMarquee = useCallback(
    (rect: Rect | null, stage: Konva.Stage | null) => {
      marqueeStartRef.current = null;
      setMarqueeRect(null);

      // 拖曳距離太小視為單純點擊，空白處的清空選取在 mousedown 時已經做過了。
      if (!rect || (rect.width < MARQUEE_DRAG_THRESHOLD && rect.height < MARQUEE_DRAG_THRESHOLD)) return;
      if (!stage) return;

      const hitIds = shapes
        .filter((shape) => {
          const node = shapeNodesRef.current.get(shape.id);
          return node ? rectsIntersect(rect, node.getClientRect({ relativeTo: stage })) : false;
        })
        .map((shape) => shape.id);
      // 已知限制：跟 selectShape 不一樣，框選沒有「框到分組其中一個成員就展開成整組」的邏輯，是刻意先不處理的範圍。
      setSelectedIds(hitIds);
      // 框選沒有「使用者實際點的那一個」這種明確目標，一律清空 activeId，交給 selectedIds.length 判斷面板要顯示什麼。
      setActiveId(null);
    },
    [shapes, setSelectedIds, setActiveId],
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!marqueeStartRef.current) return;

      // e.evt.buttons 是目前仍按著的按鍵（1 = 左鍵），偵測到已放開就直接收尾，避免框選矩形卡著跟游標跑。
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

  // 鎖定分組的拖曳連動：記錄拖曳開始當下每個成員的起始座標+算位移量，不是包進 Konva.Group，維持 shapes 陣列存絕對座標的既有模型。
  const groupDragRef = useRef<{
    leadId: string;
    leadStart: { x: number; y: number };
    // 不含 lead 自己；長度 0（沒有 groupId，或成員都被刪光）當成一般單一物件拖曳處理。
    members: { id: string; x: number; y: number }[];
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
        // 起始座標優先讀 Konva node，圖片非同步載入完成前抓不到就退回 shape.x/y，仍留在名單裡讓 handleDragEnd 一起寫回，避免跟其他成員脫節。
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

    // 拖曳過程中直接操作其他成員的 Konva node（不透過 React/setShapes）維持即時視覺回饋，正式寫回 shapes 狀態等 handleDragEnd 一次批次做完。
    const deltaX = e.target.x() - dragState.leadStart.x;
    const deltaY = e.target.y() - dragState.leadStart.y;
    for (const member of dragState.members) {
      shapeNodesRef.current.get(member.id)?.position({ x: member.x + deltaX, y: member.y + deltaY });
    }
    // node.position() 搬動不是 Konva 原生拖曳，不會觸發 Transformer 監聽的 dragmove，要手動叫它重算框的位置。
    transformerRef.current?.forceUpdate();
    e.target.getLayer()?.batchDraw();
  }, []);

  const handleDragEnd = useCallback(
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      const dragState = groupDragRef.current;
      groupDragRef.current = null;

      // x/y 統一只能整數。
      const leadPatch = { x: Math.round(e.target.x()), y: Math.round(e.target.y()) };

      if (!dragState || dragState.leadId !== id || dragState.members.length === 0) {
        updateShape(id, leadPatch);
        return;
      }

      // 整組一次寫回，一次使用者拖曳操作只算一筆 undo entry，不是每個成員各推一筆。
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

  const handleTransformEnd = useCallback(
    (id: string) => (e: KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // 縮放結束一律把 scale 重置回 1，改寫 width/height（或 fontSize），避免下次拖曳疊加跑掉。
      node.scaleX(1);
      node.scaleY(1);

      // 旋轉角度跟 x/y/width/height 一樣統一只存整數。
      const rotation = Math.round(node.rotation());

      if (node.getClassName() === "Text") {
        // 文字鎖了 keepRatio，只用 scaleX 改 fontSize，不碰 width/height（TextShape 沒有這兩個欄位）。
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
        // 這三種都鎖了 keepRatio，scaleX === scaleY，node.width() 讀到的是「半徑 × 2」，只存一個 size，不像 rect/image 分開存 width/height。
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
        // Line 沒有實質的 width/height，縮放要直接對 points 陣列每個座標分別乘上 scaleX（偶數索引）/scaleY（奇數索引）。
        const points = (node as Konva.Line).points();
        const newPoints = points.map((p, i) => Math.round(i % 2 === 0 ? p * scaleX : p * scaleY));

        // 下限 clamp：只處理簡單兩點線段 [x1, y1, x2, y2]，把第二個端點沿原本方向往回拉到剛好 MIN_LINE_LENGTH。
        if (newPoints.length === 4) {
          const dx = newPoints[2] - newPoints[0];
          const dy = newPoints[3] - newPoints[1];
          const length = Math.hypot(dx, dy);
          if (length < MIN_LINE_LENGTH) {
            // 兩端點剛好重合（極端拖曳把 scale 壓到 0）時方向不存在，退回預設水平線。
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

      // x/y/width/height 統一只能整數，先 round 再 clamp 下限。
      const width = Math.max(Math.round(node.width() * scaleX), MIN_SHAPE_SIZE);
      const height = Math.max(Math.round(node.height() * scaleY), MIN_SHAPE_SIZE);
      const patch: ShapePatch = {
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        rotation,
        width,
        height,
      };

      // 矩形縮放後 cornerRadius 可能超過新尺寸上限（不該超過短邊一半），趁縮放當下一併夾住。
      const currentShape = shapes.find((shape) => shape.id === id);
      if (currentShape?.type === "rect") {
        // Math.floor 讓上限保證是整數，避免奇數邊 /2 產生 .5 讓結果變非整數。
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
  };
}
