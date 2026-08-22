"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../context/CanvasContext";

const MIN_FONT_SIZE = 8;
const MIN_SHAPE_SIZE = 1;

// 選中非文字物件時用 Transformer 預設的八個控點、可以不等比縮放。
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
// 選中文字時只留四個角落控點，並搭配 keepRatio 鎖等比，
// 讓拖曳一定是「整塊文字等比縮放」，對應 handleTransformEnd 只用一個 scale 值改 fontSize。
const TEXT_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];

// 「選中文字要切成四角控點+鎖等比、其他物件用預設八個控點」這個規則，有兩個地方
// 需要套用（node 同步掛載時的 useEffect、圖片非同步載入完成後的延遲 attach），
// 抽成共用函式避免兩處各寫一份、之後改規則忘了改到其中一處。
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

// 選取/拖曳/縮放的 Konva 實作細節都封裝在這裡，用 id 操作、不寫死 shape 類型，
// 文字、圖片都重用這支 hook，不用另外拆 hook。
// selectedId 本身不是這裡的 local state，是讀寫 CanvasContext 的 selectedId——
// 這樣其他元件（例如之後 panelRight 的屬性面板）只要 useCanvas().selectedId 就好，
// 不需要知道這支 hook 存在。
export function useShapeSelection(): UseShapeSelectionResult {
  const { selectedId, setSelectedId, updateShape, shapes } = useCanvas();
  const transformerRef = useRef<Konva.Transformer>(null);
  // 存每個 shape 目前掛載的 Konva node，讓 Transformer 可以直接拿到實際 node，
  // 不用每次選取都重新查找。
  const shapeNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  // registerShapeRef(id) 是在 JSX 裡用 `ref={registerShapeRef(shape.id)}` inline 呼叫，
  // 如果每次 render 都回傳新函式，React 會判定 ref 身分變了、對每個 shape 觸發一次
  // 「先 null 再重新 set」。這裡改成 get-or-create 快取同一個 id 對應的 callback，
  // 讓 ref 身分跨 render 穩定，避免不必要的 ref churn。
  // 刪除 shape 時，跟它對應的快取 callback 也要一起清掉，不然會累積永遠不會
  // 釋放的函式（見下面 registerShapeRef 的 null 分支，以及下方的保底 useEffect）。
  const shapeRefCallbacksRef = useRef<Map<string, (node: Konva.Node | null) => void>>(new Map());

  // registerShapeRef 的 callback 是跨 render 快取住的（見上面），如果直接讀外層的
  // selectedId 會抓到 callback「第一次建立當下」的舊值（stale closure）。圖片是非同步
  // 載入完成才會呼叫到這個 callback（可能發生在 selectedId 變動很久之後），
  // 所以要用 ref 保存最新的 selectedId，讓 callback 執行當下能讀到正確的值。
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
        // node 剛掛上時，如果剛好就是目前選中的 id（典型情境：新增圖片後自動選取，
        // 但圖片要等 URLImage 內部非同步載入完成才會有 Konva node），代表下面那個依
        // selectedId 變動的 useEffect 早就跑過、抓不到這個當時還不存在的 node，
        // 這裡補一次手動 attach（用 applyTransformerTarget 而不是自己重寫一次，
        // 不然又會變成兩處各寫一份判斷邏輯，之後改規則容易忘了改到其中一處）。
        if (id === selectedIdRef.current && transformerRef.current) {
          applyTransformerTarget(transformerRef.current, node);
        }
      } else {
        // node 為 null 代表這個 id 對應的 Konva node 剛 unmount（shape 被刪除）。
        shapeNodesRef.current.delete(id);
        shapeRefCallbacksRef.current.delete(id);
      }
    };
    shapeRefCallbacksRef.current.set(id, callback);
    return callback;
  }, []);

  // 保底清理：上面 registerShapeRef 的 null 分支只會在「Konva node 曾經掛載過、
  // 之後 unmount」時觸發。但 URLImage 是圖片非同步載入完成前 return null（不渲染
  // 任何帶 ref 的節點），如果一張圖片還沒載入完成就被刪除（例如手滑 undo 掉），
  // 它的 ref callback 從頭到尾不會被呼叫過一次，null 分支永遠不會觸發，兩個 Map
  // 裡就會殘留一個對應不存在 id 的 entry。這裡改成每次 shapes 變動時，主動比對
  // 「目前還存在的 id」，把 Map 裡不在名單上的殘留 entry 清掉，跟上面的即時清理
  // 並存、互補。
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
      // 點到 Stage 本身（畫布空白處）才取消選取，點到 shape 時 e.target 會是那個 shape。
      if (e.target === e.target.getStage()) {
        setSelectedId(null);
      }
    },
    [setSelectedId],
  );

  const handleDragEnd = useCallback(
    (id: string) => (e: KonvaEventObject<DragEvent>) => {
      updateShape(id, { x: e.target.x(), y: e.target.y() });
    },
    [updateShape],
  );

  const handleTransformEnd = useCallback(
    (id: string) => (e: KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // CLAUDE.md 慣例：縮放結束一律把 scale 讀出來後重置回 1，並改寫 width/height（或 fontSize），
      // 避免下次拖曳時尺寸疊加跑掉。
      node.scaleX(1);
      node.scaleY(1);

      if (node.getClassName() === "Text") {
        // 文字選取時 Transformer 鎖了 keepRatio，scaleX/scaleY 理論上相等，用 scaleX 就好。
        // 只改 fontSize，不碰 width/height——文字沒有存這兩個欄位（見 TextShape）。
        const currentFontSize = (node as Konva.Text).fontSize();
        updateShape(id, {
          x: node.x(),
          y: node.y(),
          fontSize: Math.max(Math.round(currentFontSize * scaleX), MIN_FONT_SIZE),
        });
        return;
      }

      updateShape(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(node.width() * scaleX, MIN_SHAPE_SIZE),
        height: Math.max(node.height() * scaleY, MIN_SHAPE_SIZE),
      });
    },
    [updateShape],
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
