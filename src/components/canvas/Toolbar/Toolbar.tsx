"use client";

import { useCallback, useState } from "react";
import { IconArrowBackUp, IconArrowForwardUp, IconFileExport, IconRefresh } from "@tabler/icons-react";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import { useCanvas } from "../../../context/CanvasContext";
import { ExportModal } from "../ExportModal/ExportModal";
import styles from "./Toolbar.module.scss";

export function Toolbar() {
  const { resetCanvas, undo, redo, canUndo, canRedo } = useCanvas();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // useCallback：Modal 內部的 Escape 監聽 effect 依賴 onClose，這裡訂閱了
  // useCanvas() 的多個值，任何畫布狀態變動都會讓 Toolbar 重新渲染；如果直接傳
  // inline arrow function，每次渲染都是新的函式參考，會讓 Modal 開著時不斷
  // 重新掛載/卸載 keydown 監聽器（不是 leak，但是可避免的重複工作）。
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), []);

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <IconButtonUI icon={<IconRefresh size={20} />} label="重置畫布" onClick={resetCanvas} />
        <div className={styles.divider} />
        <IconButtonUI
          icon={<IconArrowBackUp size={20} />}
          label="復原"
          onClick={undo}
          disabled={!canUndo}
        />
        <IconButtonUI
          icon={<IconArrowForwardUp size={20} />}
          label="取消復原"
          onClick={redo}
          disabled={!canRedo}
        />
      </div>
      <div className={styles.group}>
        <ButtonUI
          name="Export"
          icon={<IconFileExport size={20} />}
          selectedStyle="template"
          width={100}
          height={40}
          onClick={() => setIsExportModalOpen(true)}
        />
      </div>
      {/* key 隨 open 狀態切換：每次重新打開都是一個全新的 ExportModal 實例，
          內部的 filename state 自然拿到初始值，不用額外的 reset 邏輯。 */}
      <ExportModal key={String(isExportModalOpen)} open={isExportModalOpen} onClose={closeExportModal} />
    </div>
  );
}
