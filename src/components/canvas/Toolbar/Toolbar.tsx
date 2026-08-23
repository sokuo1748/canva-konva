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
  // useCallback 保持函式參考穩定，避免 Modal 開著時 Escape 監聽被不必要地重掛。
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
      {/* key 隨 open 切換，重新打開就是全新實例，filename state 自動歸零。 */}
      <ExportModal key={String(isExportModalOpen)} open={isExportModalOpen} onClose={closeExportModal} />
    </div>
  );
}
