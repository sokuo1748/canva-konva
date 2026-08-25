"use client";

import type { CSSProperties } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SHAPE_TYPE_ICONS } from "../../../constants/shapeTypeIcons";
import { useCanvas } from "../../../context/CanvasContext";
import { isAdditiveClick } from "../../../utils/selection";
import type { CanvasShape } from "../../../types/shape";
import styles from "./LayersPanel.module.scss";

// 跟 useShapeSelection.ts 的 MARQUEE_DRAG_THRESHOLD 同樣哲學（區分單純點擊跟真的要拖曳），這裡是螢幕座標系 px，量綱不同不共用常數。
const ROW_DRAG_ACTIVATION_DISTANCE = 4;

type RenderGroup =
  | { kind: "single"; shape: CanvasShape }
  | { kind: "group"; groupId: string; shapes: CanvasShape[] };

// 把 shapes 中「連續且共用同一個 groupId」的區段收成一個 bracket 群組（長度剛好 1 的落單 groupId 不算群組，當一般列渲染）。
function buildRenderGroups(shapes: CanvasShape[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < shapes.length) {
    const shape = shapes[i];
    if (shape.groupId) {
      let j = i + 1;
      while (j < shapes.length && shapes[j].groupId === shape.groupId) j += 1;
      const run = shapes.slice(i, j);
      groups.push(
        run.length >= 2 ? { kind: "group", groupId: shape.groupId, shapes: run } : { kind: "single", shape },
      );
      i = j;
    } else {
      groups.push({ kind: "single", shape });
      i += 1;
    }
  }
  return groups;
}

// dnd-kit 排序用的最小單位 id：single 是 shape 自己的 id，group 是 groupId（跟 shape-N/text-N/image-N 前綴不同不會撞號）。
function unitIdOf(group: RenderGroup): string {
  return group.kind === "single" ? group.shape.id : group.groupId;
}

interface LayerRowProps {
  shape: CanvasShape;
  // 以下都是 optional，只有「這一列本身就是 dnd-kit 可拖曳單位」時才會傳；分組裡一般成員列不傳，可拖曳的是外層 .bracket。
  rootRef?: (node: HTMLElement | null) => void;
  rootStyle?: CSSProperties;
  dragAttributes?: ReturnType<typeof useSortable>["attributes"];
  dragListeners?: ReturnType<typeof useSortable>["listeners"];
  isDragging?: boolean;
}

function LayerRow({ shape, rootRef, rootStyle, dragAttributes, dragListeners, isDragging }: LayerRowProps) {
  const { selectedIds, selectShapeExact } = useCanvas();
  const Icon = SHAPE_TYPE_ICONS[shape.type];
  const isSelected = selectedIds.includes(shape.id);

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${isDragging ? styles.dragging : ""}`}
      // 用 selectShapeExact 不是共用的 selectShape：清單點特定一列就是想針對那一個 id，即使屬於鎖定分組也不展開成整組。
      onClick={(e) => selectShapeExact(shape.id, isAdditiveClick(e))}
      {...dragAttributes}
      {...dragListeners}
    >
      <Icon size={16} className={styles.rowIcon} />
      <span className={styles.rowLabel}>{shape.id}</span>
    </div>
  );
}

// 單一 shape 的可拖曳單位：直接讓 LayerRow 自己的 .row div 當 dnd-kit 的可拖曳節點。
function SortableLayerRow({ shape }: { shape: CanvasShape }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shape.id,
  });
  return (
    <LayerRow
      shape={shape}
      rootRef={setNodeRef}
      rootStyle={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}

// 鎖定分組的可拖曳單位：可拖曳節點是整個 .bracket 包裝 div，attributes/listeners 只掛在外層，內層任一 LayerRow 的 pointerdown 會 bubble 上來觸發整組一起移動。
function SortableBracket({ groupId, shapes }: { groupId: string; shapes: CanvasShape[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupId,
  });
  // 分組內部成員列表也反過來顯示，讓「第一筆＝畫布最上層」規則在分組裡遞迴成立（純顯示順序，不影響任何排序運算）。
  const displayShapes = [...shapes].reverse();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.bracket} ${isDragging ? styles.dragging : ""}`}
      {...attributes}
      {...listeners}
    >
      {displayShapes.map((shape) => (
        <LayerRow key={shape.id} shape={shape} />
      ))}
    </div>
  );
}

// 清單第一筆＝畫布最上層、最後一筆＝畫布最下層（跟 Figma/Photoshop/Canva 一致）；這只是顯示順序，shapes 陣列本身的 z-order 語意（越後面疊在越上層）完全不變，只有這個檔案把陣列順序（資料順序）跟畫面顯示順序反過來。
export function LayersPanel() {
  const { shapes, reorderShapes } = useCanvas();
  // 資料順序：依陣列原始順序算出的 render units，拖曳結束要換算回真正的陣列順序時會用到。
  const ascendingGroups = buildRenderGroups(shapes);
  // 顯示順序：畫面實際由上到下渲染的順序，unitOrder 必須跟實際 DOM 渲染順序一致（dnd-kit 排序動畫依賴這個）。
  const displayGroups = [...ascendingGroups].reverse();
  const unitOrder = displayGroups.map(unitIdOf);

  // PointerSensor 的 activationConstraint 讓單純點擊不會被 dnd-kit 攔截，onClick/selectShapeExact 才不受影響。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ROW_DRAG_ACTIVATION_DISTANCE } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = unitOrder.indexOf(String(active.id));
    const newIndex = unitOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // drop 目標永遠是整個 unit，不可能是分組裡的某個位置，鎖定分組的相鄰不變量自動維持，不需要額外驗證。
    const nextDisplayUnitOrder = arrayMove(unitOrder, oldIndex, newIndex);
    // 算出來的還是顯示順序，要 reverse 回資料順序才能餵給 reorderShapes；分組內部維持原本相對順序，不再 reverse 一次。
    const nextAscendingUnitOrder = [...nextDisplayUnitOrder].reverse();
    const unitMap = new Map(ascendingGroups.map((group) => [unitIdOf(group), group]));
    const expandedIds = nextAscendingUnitOrder.flatMap((unitId) => {
      const group = unitMap.get(unitId);
      if (!group) return [];
      return group.kind === "single" ? [group.shape.id] : group.shapes.map((s) => s.id);
    });
    reorderShapes(expandedIds);
  }

  return (
    <div className={styles.panel}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={unitOrder} strategy={verticalListSortingStrategy}>
          {displayGroups.map((group) =>
            group.kind === "single" ? (
              <SortableLayerRow key={group.shape.id} shape={group.shape} />
            ) : (
              <SortableBracket key={group.groupId} groupId={group.groupId} shapes={group.shapes} />
            ),
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
