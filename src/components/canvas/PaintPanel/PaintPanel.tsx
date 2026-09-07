"use client";

import { IconBrush, IconCircle, IconEraser, IconSquare } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import {
  MAX_BRUSH_SIZE,
  MAX_ERASER_SIZE,
  MIN_BRUSH_SIZE,
  MIN_ERASER_SIZE,
  MIN_OPACITY,
  MAX_OPACITY,
} from "../../../constants/shapeConstraints";
import { NumberField } from "../../ui/NumberField/NumberField";
import { ColorField } from "../../ui/ColorField/ColorField";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import styles from "./PaintPanel.module.scss";

// 畫筆/橡皮擦工具設定面板
export function PaintPanel() {
  const {
    activeTool,
    setActiveTool,
    brushColor,
    setBrushColor,
    brushSize,
    setBrushSize,
    brushCap,
    setBrushCap,
    eraserSize,
    setEraserSize,
    brushOpacity,
    setBrushOpacity,
  } = useCanvas();

  return (
    <div className={styles.panel}>
      <div className={styles.toolRow}>
        <IconButtonUI
          icon={<IconBrush size={18} />}
          label="畫筆"
          active={activeTool === "brush"}
          onClick={() => setActiveTool("brush")}
        />
        <IconButtonUI
          icon={<IconEraser size={18} />}
          label="橡皮擦"
          active={activeTool === "eraser"}
          onClick={() => setActiveTool("eraser")}
        />
      </div>

      {activeTool === "brush" && (
        <>
          <ColorField label="顏色" value={brushColor} onCommit={setBrushColor} />
          <NumberField
            label="大小"
            value={brushSize}
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            round
            onCommit={setBrushSize}
          />
          <NumberField
            label="透明度"
            value={brushOpacity}
            min={MIN_OPACITY}
            max={MAX_OPACITY}
            round
            onCommit={setBrushOpacity}
          />
          {/* 筆刷頭部形狀 */}
          <div className={styles.toolRow}>
            <IconButtonUI
              icon={<IconCircle size={18} />}
              label="圓形筆刷"
              active={brushCap === "round"}
              onClick={() => setBrushCap("round")}
            />
            <IconButtonUI
              icon={<IconSquare size={18} />}
              label="方形筆刷"
              active={brushCap === "square"}
              onClick={() => setBrushCap("square")}
            />
          </div>
        </>
      )}

      {/* 橡皮擦固定圓形，沒有顏色/形狀欄位 */}
      {activeTool === "eraser" && (
        <NumberField
          label="大小"
          value={eraserSize}
          min={MIN_ERASER_SIZE}
          max={MAX_ERASER_SIZE}
          round
          onCommit={setEraserSize}
        />
      )}
    </div>
  );
}
