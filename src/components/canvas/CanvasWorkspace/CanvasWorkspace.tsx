import { Toolbar } from "../Toolbar/Toolbar";
import { TemplatePanel } from "../TemplatePanel/TemplatePanel";
import { LayersPanel } from "../LayersPanel/LayersPanel";
import { KonvaBoard } from "../KonvaSkill/KonvaBoard";
import { SelectedShapePanel } from "../SelectedShapePanel/SelectedShapePanel";
import { CanvasProvider } from "../../../context/CanvasContext";
import styles from "./CanvasWorkspace.module.scss";

// 畫布頁面組裝：Toolbar + panelLeft（圖層清單+新增按鈕）+ 畫布 + panelRight（屬性面板）
export function CanvasWorkspace() {
  return (
    <CanvasProvider>
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
    </CanvasProvider>
  );
}
