"use client";

import { IconTrash } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import styles from "./SelectedShapePanel.module.scss";

export function SelectedShapePanel() {
  const { selectedId, deleteShape } = useCanvas();

  if (!selectedId) return null;

  // 獨立變數而不是繼續用 selectedId：selectedId 本身是 string | null，
  // 上面已經窄化過，這裡另存一個確定是 string 的變數，意圖更清楚，
  // 也避免之後改動這段程式碼時不小心弄丟窄化。
  const id = selectedId;

  return (
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
  );
}
