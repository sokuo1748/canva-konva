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
import { IconEraser } from "@tabler/icons-react";
import { SHAPE_TYPE_ICONS } from "../../../constants/shapeTypeIcons";
import { useCanvas } from "../../../context/CanvasContext";
import { isAdditiveClick } from "../../../utils/selection";
import type { CanvasShape } from "../../../types/shape";
import styles from "./LayersPanel.module.scss";

// 拖曳距離門檻，區分單純點擊跟真的要拖曳
const ROW_DRAG_ACTIVATION_DISTANCE = 4;

type RenderGroup =
  | { kind: "single"; shape: CanvasShape }
  | { kind: "group"; groupId: string; shapes: CanvasShape[] };

// 把連續且共用 groupId 的區段收成一個 bracket 群組
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

// dnd-kit 排序用的最小單位 id
function unitIdOf(group: RenderGroup): string {
  return group.kind === "single" ? group.shape.id : group.groupId;
}

interface LayerRowProps {
  shape: CanvasShape;
  // 只有這一列本身是 dnd-kit 可拖曳單位時才會傳；分組成員列不傳
  rootRef?: (node: HTMLElement | null) => void;
  rootStyle?: CSSProperties;
  dragAttributes?: ReturnType<typeof useSortable>["attributes"];
  dragListeners?: ReturnType<typeof useSortable>["listeners"];
  isDragging?: boolean;
}

// 單一圖層列
function LayerRow({ shape, rootRef, rootStyle, dragAttributes, dragListeners, isDragging }: LayerRowProps) {
  const { selectedIds, selectShapeExact } = useCanvas();
  // 橡皮擦筆畫換成 IconEraser 方便區分
  const Icon = shape.type === "brush" && shape.tool === "eraser" ? IconEraser : SHAPE_TYPE_ICONS[shape.type];
  const isSelected = selectedIds.includes(shape.id);

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${isDragging ? styles.dragging : ""}`}
      onClick={(e) => selectShapeExact(shape.id, isAdditiveClick(e))} // 不展開成整組
      {...dragAttributes}
      {...dragListeners}
    >
      <Icon size={16} className={styles.rowIcon} />
      <span className={styles.rowLabel}>{shape.id}</span>
    </div>
  );
}

// 單一 shape 的可拖曳單位
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

// 鎖定分組的可拖曳單位，拖曳整個 .bracket
function SortableBracket({ groupId, shapes }: { groupId: string; shapes: CanvasShape[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupId,
  });
  const displayShapes = [...shapes].reverse(); // 分組內部也套用「第一筆＝最上層」
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

// 圖層清單，第一筆＝畫布最上層
export function LayersPanel() {
  const { shapes, reorderShapes } = useCanvas();
  const ascendingGroups = buildRenderGroups(shapes); // 資料順序
  const displayGroups = [...ascendingGroups].reverse(); // 畫面顯示順序
  const unitOrder = displayGroups.map(unitIdOf);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ROW_DRAG_ACTIVATION_DISTANCE } }),
  );

  // 拖曳結束後換算回資料順序，展開回 shape id 陣列並重新排序
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = unitOrder.indexOf(String(active.id));
    const newIndex = unitOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const nextDisplayUnitOrder = arrayMove(unitOrder, oldIndex, newIndex);
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
