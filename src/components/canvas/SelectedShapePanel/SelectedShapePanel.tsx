"use client";

import { IconTrash } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import { ShapePropertiesForm } from "./ShapePropertiesForm";
import styles from "./SelectedShapePanel.module.scss";

export function SelectedShapePanel() {
  const { selectedId, shapes, deleteShape } = useCanvas();

  if (!selectedId) return null;

  // 另存已窄化為 string 的變數，意圖更清楚。
  const id = selectedId;
  // context 沒有 derived「selectedShape」，自己找；防禦性檢查找不到就不渲染表單。
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
      {/* key={id} 讓切換選中物件時欄位整批 remount 重置。 */}
      {shape && <ShapePropertiesForm key={id} shape={shape} />}
    </>
  );
}
