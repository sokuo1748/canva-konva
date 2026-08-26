"use client";

import { IconTrash } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import { ShapePropertiesForm } from "./ShapePropertiesForm";
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
    );
  }

  const id = hasActiveShape ? (activeId as string) : selectedIds[0];
  const shape = shapes.find((s) => s.id === id);

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
      {shape && <ShapePropertiesForm key={id} shape={shape} />}
    </>
  );
}
