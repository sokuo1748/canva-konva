"use client";

import { IconTrash } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import { ShapePropertiesForm } from "./ShapePropertiesForm";
import { ShapePicker } from "../ShapePicker/ShapePicker";
import styles from "./SelectedShapePanel.module.scss";

export function SelectedShapePanel() {
  const { isShapePickerOpen, selectedIds, activeId, shapes, deleteShape, deleteShapes } = useCanvas();

  // 圖形選單開著時優先權比選取資訊高，不管目前有沒有選取東西 panelRight 都顯示選單。
  if (isShapePickerOpen) return <ShapePicker />;

  if (selectedIds.length === 0) return null;

  // activeId 是使用者實際點擊的那一個 shape，跟 selectedIds（操作範圍）是兩個獨立狀態，只要它還在最終選取裡就顯示它的個別編輯內容而不是批次摘要。
  const hasActiveShape = activeId !== null && selectedIds.includes(activeId);

  // 選 2 個以上、又沒有明確目標時類型可能不同，不渲染 ShapePropertiesForm，只給筆數 + 一次刪光的按鈕。
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

  // 有明確目標就用 activeId，否則（單選）回退成 selectedIds[0]，兩種情況都指向同一個 shape。
  const id = hasActiveShape ? (activeId as string) : selectedIds[0];
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
