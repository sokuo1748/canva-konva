"use client";

import { IconBold, IconStrikethrough, IconUnderline } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import type { CanvasShape, ShapePatch } from "../../../types/shape";
import {
  MIN_SHAPE_SIZE,
  MIN_FONT_SIZE,
  MAX_BRUSH_SIZE,
  MAX_ERASER_SIZE,
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

  return (
    <div className={styles.form}>
      <NumberField label="x" value={shape.x} round onCommit={(v) => commit({ x: v })} />
      <NumberField label="y" value={shape.y} round onCommit={(v) => commit({ y: v })} />
      <NumberField label="rotation" value={shape.rotation} round onCommit={(v) => commit({ rotation: v })} />

      {(shape.type === "rect" || shape.type === "image") && (
        <>
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
        </>
      )}

      {/* circle/triangle/star 只存一個 size，width/height 兩欄位背後讀寫同一個值 */}
      {(shape.type === "circle" || shape.type === "triangle" || shape.type === "star") && (
        <>
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
        </>
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
        </>
      )}

      {/* 畫筆筆畫沒有 fill，橡皮擦沒有顏色 */}
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
