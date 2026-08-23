"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../context/CanvasContext";
import type { ShapePatch } from "../types/shape";
import { MIN_FONT_SIZE, MIN_SHAPE_SIZE } from "../constants/shapeConstraints";

// 非文字物件用 Transformer 預設的八個控點，可以不等比縮放。
const DEFAULT_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "middle-left",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
// 文字只留四角控點並鎖 keepRatio，縮放時只用一個 scale 值改 fontSize。
const TEXT_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];

// 抽成共用函式：node 掛載時的 useEffect、圖片非同步載入後的延遲 attach 都要套用同一套 anchors 規則。
function applyTransformerTarget(transformer: Konva.Transformer, node: Konva.Node | undefined) {
  transformer.nodes(node ? [node] : []);

  const isText = node?.getClassName() === "Text";
  transformer.enabledAnchors(isText ? TEXT_ANCHORS : DEFAULT_ANCHORS);
  transformer.keepRatio(isText);

  transformer.getLayer()?.batchDraw();
}

interface UseShapeSelectionResult {
  selectedId: string | null;
  transformerRef: RefObject<Konva.Transformer | null>;
  registerShapeRef: (id: string) => (node: Konva.Node | null) => void;
  handleSelect: (id: string) => void;
  handleStageMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  handleDragEnd: (id: string) => (e: KonvaEventObject<DragEvent>) => void;
  handleTransformEnd: (id: string) => (e: KonvaEventObject<Event>) => void;
}

// 選取/拖曳/縮放的 Konva 細節都封裝在這裡；selectedId 讀寫 CanvasContext，不是這裡的 local state。
export function useShapeSelection(): UseShapeSelectionResult {
  const { selectedId, setSelectedId, updateShape, shapes } = useCanvas();
  const transformerRef = useRef<Konva.Transformer>(null);
  // 存每個 shape 目前掛載的 Konva node，Transformer 才不用每次選取都重新查找。
  const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  // get-or-create 快取 ref callback，讓身分跨 render 穩定，避免不必要的 ref churn。
  const shapeRefCallbacksRef = useRef<Map<string, (node: Konva.Node | null) => void>>(new Map());

  // 快取住的 callback 若直接讀 selectedId 會抓到建立當下的 stale closure，改用 ref 讀最新值。
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const registerShapeRef = useCallback((id: string) => {
    const cached = shapeRefCallbacksRef.current.get(id);
    if (cached) return cached;

    const callback = (node: Konva.Node | null) => {
      if (node) {
        shapeNodesRef.current.set(id, node);
        // node 剛掛上時如果正是目前選中的 id（例如圖片非同步載入完成才有 node），補一次手動 attach。
        if (id === selectedIdRef.current && transformerRef.current) {
          applyTransformerTarget(transformerRef.current, node);
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

    const node = selectedId ? shapeNodesRef.current.get(selectedId) : undefined;
    applyTransformerTarget(transformer, node);
  }, [selectedId]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
    },
    [setSelectedId],
  );

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 點到 Stage 本身（畫布空白處）才取消選取。
      if (e.target === e.target.getStage()) {
        setSelectedId(null);
      }
    },
    [setSelectedId],
  );

  const handleDragEnd = useCallback(
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      // x/y 統一只能整數。
      updateShape(id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
    },
    [updateShape],
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
    transformerRef,
    registerShapeRef,
    handleSelect,
    handleStageMouseDown,
    handleDragEnd,
    handleTransformEnd,
  };
}
