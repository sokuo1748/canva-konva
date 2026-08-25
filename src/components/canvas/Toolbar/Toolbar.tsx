"use client";

import { useCallback, useState } from "react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconFileExport,
  IconLock,
  IconLockOpen,
  IconRefresh,
} from "@tabler/icons-react";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import { useCanvas } from "../../../context/CanvasContext";
import { ExportModal } from "../ExportModal/ExportModal";
import styles from "./Toolbar.module.scss";

export function Toolbar() {
  const { resetCanvas, undo, redo, canUndo, canRedo, selectedIds, shapes, lockShapes, unlockShapes } =
    useCanvas();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // useCallback 保持函式參考穩定，避免 Modal 開著時 Escape 監聽被不必要地重掛。
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), []);

  // 目前選取是否剛好是某個既有群組的全部成員——是的話顯示 LockOpen 讓使用者解除，否則顯示 Lock 重新鎖成新群組。
  const isExactlyOneWholeGroup =
    selectedIds.length >= 2 &&
    (() => {
      const groupId = shapes.find((shape) => shape.id === selectedIds[0])?.groupId;
      if (!groupId) return false;
      const allSelectedShareGroup = selectedIds.every(
        (id) => shapes.find((shape) => shape.id === id)?.groupId === groupId,
      );
      if (!allSelectedShareGroup) return false;
      const groupMemberCount = shapes.filter((shape) => shape.groupId === groupId).length;
      return groupMemberCount === selectedIds.length;
    })();

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
        {selectedIds.length >= 2 &&
          (isExactlyOneWholeGroup ? (
            <IconButtonUI
              icon={<IconLockOpen size={20} />}
              label="解除圖層群組鎖定"
              onClick={() => unlockShapes(selectedIds)}
            />
          ) : (
            <IconButtonUI
              icon={<IconLock size={20} />}
              label="鎖定選取的圖層為一組"
              onClick={() => lockShapes(selectedIds)}
            />
          ))}
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
