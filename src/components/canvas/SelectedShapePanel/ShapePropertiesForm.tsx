"use client";

import { IconBold, IconBorderOuter, IconStrikethrough, IconUnderline } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import type { CanvasShape, ShapePatch } from "../../../types/shape";
import {
  MIN_SHAPE_SIZE,
  MIN_FONT_SIZE,
  MAX_BRUSH_SIZE,
  MAX_ERASER_SIZE,
  MIN_OPACITY,
  MAX_OPACITY,
} from "../../../constants/shapeConstraints";
import { NumberField } from "../../ui/NumberField/NumberField";
import { ColorField } from "../../ui/ColorField/ColorField";
import { TextField } from "../../ui/TextField/TextField";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import styles from "./ShapePropertiesForm.module.scss";

interface ShapePropertiesFormProps {
  shape: CanvasShape;
}

// 選取物件的可編輯屬性表單，呼叫端要用 key={shape.id} 掛，切換選取時欄位才會重置
export function ShapePropertiesForm({ shape }: ShapePropertiesFormProps) {
  const { updateShape } = useCanvas();
  const commit = (patch: ShapePatch) => updateShape(shape.id, patch);

  // 所有 shape 類型都有 opacity（橡皮擦筆畫例外，見下方 brush 分支），欄位本身跟型別無關，共用同一份 JSX
  const opacityField = (
    <NumberField
      label="opacity"
      value={shape.opacity}
      min={MIN_OPACITY}
      max={MAX_OPACITY}
      round
      onCommit={(v) => commit({ opacity: v })}
    />
  );

  return (
    <div className={styles.form}>
      <div className={styles.fieldRow}>
        <NumberField label="x" value={shape.x} round onCommit={(v) => commit({ x: v })} />
        <NumberField label="y" value={shape.y} round onCommit={(v) => commit({ y: v })} />
      </div>
      <NumberField label="rotation" value={shape.rotation} round onCommit={(v) => commit({ rotation: v })} />

      {(shape.type === "rect" || shape.type === "image") && (
        <div className={styles.fieldRow}>
          <NumberField
            label="width"
            value={shape.width}
            min={MIN_SHAPE_SIZE}
            round
            onCommit={(v) => commit({ width: v })}
          />
          <NumberField
            label="height"
            value={shape.height}
            min={MIN_SHAPE_SIZE}
            round
            onCommit={(v) => commit({ height: v })}
          />
        </div>
      )}

      {shape.type === "image" && opacityField}

      {/* circle/triangle/star 只存一個 size，width/height 兩欄位背後讀寫同一個值 */}
      {(shape.type === "circle" || shape.type === "triangle" || shape.type === "star") && (
        <div className={styles.fieldRow}>
          <NumberField
            label="width"
            value={shape.size}
            min={MIN_SHAPE_SIZE}
            round
            onCommit={(v) => commit({ size: v })}
          />
          <NumberField
            label="height"
            value={shape.size}
            min={MIN_SHAPE_SIZE}
            round
            onCommit={(v) => commit({ size: v })}
          />
        </div>
      )}

      {shape.type === "text" && (
        <NumberField
          label="fontSize"
          value={shape.fontSize}
          min={MIN_FONT_SIZE}
          round
          onCommit={(v) => commit({ fontSize: v })}
        />
      )}

      {shape.type !== "image" && shape.type !== "line" && shape.type !== "brush" && (
        <ColorField label="fill" value={shape.fill} onCommit={(v) => commit({ fill: v })} />
      )}

      {shape.type === "text" && opacityField}

      {/* Rect/Circle/Triangle/Star 的邊框設定：strokeEnabled 是明確的顯示開關，
          不再用 strokeWidth: 0 表示不顯示（見 CLAUDE.md 這輪的變更說明） */}
      {(shape.type === "rect" || shape.type === "circle" || shape.type === "triangle" || shape.type === "star") && (
        <>
          <div className={styles.toggleRow}>
            <IconButtonUI
              icon={<IconBorderOuter size={18} />}
              label="Show border"
              active={shape.strokeEnabled}
              onClick={() => commit({ strokeEnabled: !shape.strokeEnabled })}
            />
          </div>
          <ColorField
            label="stroke"
            value={shape.stroke}
            muted={!shape.strokeEnabled}
            onCommit={(v) => commit({ stroke: v })}
          />
          <NumberField
            label="strokeWidth"
            value={shape.strokeWidth}
            min={0}
            round
            muted={!shape.strokeEnabled}
            onCommit={(v) => commit({ strokeWidth: v })}
          />
          {opacityField}
        </>
      )}

      {shape.type === "line" && (
        <>
          <ColorField label="stroke" value={shape.stroke} onCommit={(v) => commit({ stroke: v })} />
          <NumberField
            label="strokeWidth"
            value={shape.strokeWidth}
            min={1}
            round
            onCommit={(v) => commit({ strokeWidth: v })}
          />
          {opacityField}
        </>
      )}

      {/* 畫筆筆畫沒有 fill，橡皮擦沒有顏色；橡皮擦也不開放調整透明度（見 CLAUDE.md 這輪的變更說明） */}
      {shape.type === "brush" && (
        <>
          {shape.tool === "brush" && (
            <ColorField label="stroke" value={shape.stroke} onCommit={(v) => commit({ stroke: v })} />
          )}
          <NumberField
            label="strokeWidth"
            value={shape.strokeWidth}
            min={1}
            max={shape.tool === "eraser" ? MAX_ERASER_SIZE : MAX_BRUSH_SIZE}
            round
            onCommit={(v) => commit({ strokeWidth: v })}
          />
          {shape.tool === "brush" && opacityField}
        </>
      )}

      {shape.type === "rect" && (
        <NumberField
          label="cornerRadius"
          value={shape.cornerRadius}
          min={0}
          max={Math.floor(Math.min(shape.width, shape.height) / 2)} // 上限是短邊一半
          round
          onCommit={(v) => commit({ cornerRadius: v })}
        />
      )}

      {shape.type === "text" && (
        <TextField label="text" value={shape.text} onCommit={(v) => commit({ text: v })} />
      )}

      {shape.type === "text" && (
        <div className={styles.toggleRow}>
          <IconButtonUI
            icon={<IconBold size={18} />}
            label="粗體"
            active={!!shape.bold}
            onClick={() => commit({ bold: !shape.bold })}
          />
          <IconButtonUI
            icon={<IconUnderline size={18} />}
            label="底線"
            active={!!shape.underline}
            onClick={() => commit({ underline: !shape.underline })}
          />
          <IconButtonUI
            icon={<IconStrikethrough size={18} />}
            label="中線"
            active={!!shape.strikethrough}
            onClick={() => commit({ strikethrough: !shape.strikethrough })}
          />
        </div>
      )}
    </div>
  );
}
