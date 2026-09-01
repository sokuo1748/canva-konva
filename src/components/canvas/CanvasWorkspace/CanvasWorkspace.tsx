"use client";

import { Toolbar } from "../Toolbar/Toolbar";
import { TemplatePanel } from "../TemplatePanel/TemplatePanel";
import { LayersPanel } from "../LayersPanel/LayersPanel";
import { KonvaBoard } from "../KonvaSkill/KonvaBoard";
import { SelectedShapePanel } from "../SelectedShapePanel/SelectedShapePanel";
import { CanvasProvider } from "../../../context/CanvasContext";
import { useKeyboardShortcuts } from "../../../hooks/useKeyboardShortcuts";
import styles from "./CanvasWorkspace.module.scss";

// 實際版面組裝，包在 CanvasProvider 底下才能用 useKeyboardShortcuts（依賴 useCanvas）
function CanvasWorkspaceContent() {
  useKeyboardShortcuts();

  return (
    <div className={styles.workspace}>
      <Toolbar />
      <div className={styles.body}>
        <aside className={`${styles.panel} ${styles.panelLeft}`}>
          {/* 上方圖層清單自己捲動，下方按鈕固定釘在底部 */}
          <LayersPanel />
          <div className={styles.panelDivider} />
          <TemplatePanel />
        </aside>
        <main className={styles.canvas}>
          <KonvaBoard />
        </main>
        <aside className={`${styles.panel} ${styles.panelRight}`}>
          <SelectedShapePanel />
        </aside>
      </div>
    </div>
  );
}

// 畫布頁面組裝：Toolbar + panelLeft（圖層清單+新增按鈕）+ 畫布 + panelRight（屬性面板）
export function CanvasWorkspace() {
  return (
    <CanvasProvider>
      <CanvasWorkspaceContent />
    </CanvasProvider>
  );
}
