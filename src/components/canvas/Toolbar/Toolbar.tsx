"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconFileExport,
  IconLayoutAlignBottom,
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignMiddle,
  IconLayoutAlignRight,
  IconLayoutAlignTop,
  IconLock,
  IconLockOpen,
  IconRefresh,
} from "@tabler/icons-react";
import type { AlignMode } from "../../../context/CanvasContext";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import { useCanvas } from "../../../context/CanvasContext";
import { ExportModal } from "../ExportModal/ExportModal";
import { CanvasSizeInput } from "./CanvasSizeInput";
import styles from "./Toolbar.module.scss";

// 對齊按鈕的顯示資料：icon + label + 對應的 AlignMode
const ALIGN_BUTTONS: { mode: AlignMode; icon: ReactNode; label: string }[] = [
  { mode: "left", icon: <IconLayoutAlignLeft size={20} />, label: "靠左對齊" },
  { mode: "center-h", icon: <IconLayoutAlignCenter size={20} />, label: "水平置中" },
  { mode: "right", icon: <IconLayoutAlignRight size={20} />, label: "靠右對齊" },
  { mode: "top", icon: <IconLayoutAlignTop size={20} />, label: "靠上對齊" },
  { mode: "center-v", icon: <IconLayoutAlignMiddle size={20} />, label: "垂直置中" },
  { mode: "bottom", icon: <IconLayoutAlignBottom size={20} />, label: "靠下對齊" },
];

export function Toolbar() {
  const {
    resetCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedIds,
    shapes,
    lockShapes,
    unlockShapes,
    alignShapes,
  } = useCanvas();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), []);

  // 目前選取是否剛好是某個既有群組的全部成員
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
        {selectedIds.length >= 1 && (
          <>
            <div className={styles.divider} />
            {ALIGN_BUTTONS.map(({ mode, icon, label }) => (
              <IconButtonUI key={mode} icon={icon} label={label} onClick={() => alignShapes(selectedIds, mode)} />
            ))}
          </>
        )}
      </div>
      <div className={styles.group}>
        <CanvasSizeInput />
        <ButtonUI
          name="Export"
          icon={<IconFileExport size={20} />}
          selectedStyle="template"
          width={100}
          height={40}
          onClick={() => setIsExportModalOpen(true)}
        />
      </div>
      <ExportModal key={String(isExportModalOpen)} open={isExportModalOpen} onClose={closeExportModal} />
    </div>
  );
}
