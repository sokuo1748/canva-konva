import { Toolbar } from "../Toolbar/Toolbar";
import { TemplatePanel } from "../TemplatePanel/TemplatePanel";
import { KonvaBoard } from "../KonvaSkill/KonvaBoard";
import { SelectedShapePanel } from "../SelectedShapePanel/SelectedShapePanel";
import { CanvasProvider } from "../../../context/CanvasContext";
import styles from "./CanvasWorkspace.module.scss";

export function CanvasWorkspace() {
  return (
    <CanvasProvider>
      <div className={styles.workspace}>
        <Toolbar />
        <div className={styles.body}>
          <aside className={`${styles.panel} ${styles.panelLeft}`}>
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
