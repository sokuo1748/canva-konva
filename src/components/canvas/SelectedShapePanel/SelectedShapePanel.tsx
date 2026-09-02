"use client";

import { IconTrash } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import { ShapePropertiesForm } from "./ShapePropertiesForm";
import { AlignButtons } from "./AlignButtons";
import { ShapePicker } from "../ShapePicker/ShapePicker";
import { PaintPanel } from "../PaintPanel/PaintPanel";
import styles from "./SelectedShapePanel.module.scss";

// panelRight：依目前狀態顯示 Shape 選單、Paint 面板、批次刪除、或單一物件屬性表單
export function SelectedShapePanel() {
  const { isShapePickerOpen, activeTool, selectedIds, activeId, shapes, deleteShape, deleteShapes } = useCanvas();

  if (isShapePickerOpen) return <ShapePicker />;

  if (activeTool !== "select") return <PaintPanel />;

  if (selectedIds.length === 0) return null;

  // activeId 有明確目標時顯示個別編輯內容，否則顯示批次摘要
  const hasActiveShape = activeId !== null && selectedIds.includes(activeId);

  if (selectedIds.length >= 2 && !hasActiveShape) {
    return (
      <>
        <div className={styles.panel}>
          <span className={styles.value}>{selectedIds.length} shapes selected</span>
          <button
            type="button"
            className={styles.deleteButton}
            aria-label="刪除選取的物件"
            title="刪除選取的物件"
            onClick={() => deleteShapes(selectedIds)}
          >
            <IconTrash size={18} />
          </button>
        </div>
        <AlignButtons ids={selectedIds} />
      </>
    );
  }

  const id = hasActiveShape ? (activeId as string) : selectedIds[0];
  const shape = shapes.find((s) => s.id === id);
  // 一般情況只對齊這一個 shape 自己（跟其他欄位一樣是單一物件的個別編輯）；
  // 但如果目前是「分組展開」狀態（canvas 點鎖定分組成員，activeId 設成這個 shape，
  // selectedIds 是整組，也就是 hasActiveShape 為 true），改傳整組 id，讓 alignShapes
  // 判斷成整組對齊，維持跟拖曳分組一致的「整組一起移動」觀感，見 CLAUDE.md 對齊功能條目
  const alignIds = hasActiveShape ? selectedIds : [id];

  return (
    <>
      <div className={styles.panel}>
        <span className={styles.label}>ID:</span>
        <span className={styles.value}>{id}</span>
        <button
          type="button"
          className={styles.deleteButton}
          aria-label="刪除選取的物件"
          title="刪除選取的物件"
          onClick={() => deleteShape(id)}
        >
          <IconTrash size={18} />
        </button>
      </div>
      {shape && <ShapePropertiesForm key={id} shape={shape} alignIds={alignIds} />}
    </>
  );
}
