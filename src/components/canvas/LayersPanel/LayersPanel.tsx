"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";
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
import { getRangeIds, isAdditiveClick } from "../../../utils/selection";
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

// 把 displayGroups 攤平成畫面實際由上到下的 shape 陣列，跟 SortableBracket 內部
// 的 [...shapes].reverse() 用同一個規則，確保跟視覺順序一致——shift 範圍選取靠這份順序算範圍
function flattenDisplayRows(displayGroups: RenderGroup[]): CanvasShape[] {
  return displayGroups.flatMap((group) => (group.kind === "single" ? [group.shape] : [...group.shapes].reverse()));
}

interface LayerRowProps {
  shape: CanvasShape;
  onSelect: (id: string, e: ReactMouseEvent<HTMLDivElement>) => void;
  // 只有這一列本身是 dnd-kit 可拖曳單位時才會傳；分組成員列不傳
  rootRef?: (node: HTMLElement | null) => void;
  rootStyle?: CSSProperties;
  dragAttributes?: ReturnType<typeof useSortable>["attributes"];
  dragListeners?: ReturnType<typeof useSortable>["listeners"];
  isDragging?: boolean;
}

// 單一圖層列
function LayerRow({ shape, onSelect, rootRef, rootStyle, dragAttributes, dragListeners, isDragging }: LayerRowProps) {
  const { selectedIds } = useCanvas();
  // 橡皮擦筆畫換成 IconEraser 方便區分
  const Icon = shape.type === "brush" && shape.tool === "eraser" ? IconEraser : SHAPE_TYPE_ICONS[shape.type];
  const isSelected = selectedIds.includes(shape.id);

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${isDragging ? styles.dragging : ""}`}
      onClick={(e) => onSelect(shape.id, e)}
      {...dragAttributes}
      {...dragListeners}
    >
      <Icon size={16} className={styles.rowIcon} />
      <span className={styles.rowLabel}>{shape.id}</span>
    </div>
  );
}

// 單一 shape 的可拖曳單位
function SortableLayerRow({
  shape,
  onSelect,
}: {
  shape: CanvasShape;
  onSelect: (id: string, e: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shape.id,
  });
  return (
    <LayerRow
      shape={shape}
      onSelect={onSelect}
      rootRef={setNodeRef}
      rootStyle={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}

// 鎖定分組的可拖曳單位，拖曳整個 .bracket
function SortableBracket({
  groupId,
  shapes,
  onSelect,
}: {
  groupId: string;
  shapes: CanvasShape[];
  onSelect: (id: string, e: ReactMouseEvent<HTMLDivElement>) => void;
}) {
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
        <LayerRow key={shape.id} shape={shape} onSelect={onSelect} />
      ))}
    </div>
  );
}

// 圖層清單，第一筆＝畫布最上層
export function LayersPanel() {
  const { shapes, reorderShapes, selectShapeExact, selectShapesExact } = useCanvas();
  const ascendingGroups = buildRenderGroups(shapes); // 資料順序
  const displayGroups = [...ascendingGroups].reverse(); // 畫面顯示順序
  const unitOrder = displayGroups.map(unitIdOf);
  const displayRowIds = flattenDisplayRows(displayGroups).map((shape) => shape.id);

  // shift 範圍選取的錨點：記錄「上一次非 shift 點擊」的那一列，讓使用者能連續 shift+click
  // 從同一個錨點延伸/縮短範圍（比照 Finder 的行為）
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ROW_DRAG_ACTIVATION_DISTANCE } }),
  );

  // 圖層列點擊：shift 是範圍選取（anchor 到目前點擊列之間，依畫面顯示順序），
  // ctrl/cmd 是逐一加選，一般點擊是取代選取並更新 anchor；不展開成整組（selectShapeExact 語意）
  function handleRowClick(id: string, e: ReactMouseEvent<HTMLDivElement>) {
    if (e.shiftKey) {
      const anchor = anchorId ?? id;
      if (anchorId === null) setAnchorId(anchor); // 第一次 shift+click 隱含建立錨點，固定下來給後續延伸/縮短用
      const rangeIds = getRangeIds(displayRowIds, anchor, id);
      selectShapesExact(rangeIds, e.ctrlKey || e.metaKey);
      // 除了上面「隱含建立錨點」的情況，不再移動 anchor，讓使用者可以連續 shift+click 從同一個錨點延伸/縮短範圍
    } else {
      selectShapeExact(id, isAdditiveClick(e));
      setAnchorId(id);
    }
  }

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
              <SortableLayerRow key={group.shape.id} shape={group.shape} onSelect={handleRowClick} />
            ) : (
              <SortableBracket
                key={group.groupId}
                groupId={group.groupId}
                shapes={group.shapes}
                onSelect={handleRowClick}
              />
            ),
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
