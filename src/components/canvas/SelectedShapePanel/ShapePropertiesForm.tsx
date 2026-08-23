"use client";

import { useCanvas } from "../../../context/CanvasContext";
import type { CanvasShape, ShapePatch } from "../../../types/shape";
import { MIN_SHAPE_SIZE, MIN_FONT_SIZE } from "../../../constants/shapeConstraints";
import { NumberField } from "../../ui/NumberField/NumberField";
import { ColorField } from "../../ui/ColorField/ColorField";
import { TextField } from "../../ui/TextField/TextField";
import styles from "./ShapePropertiesForm.module.scss";

interface ShapePropertiesFormProps {
  shape: CanvasShape;
}

// 呼叫端要用 key={shape.id} 掛這個元件，切換選取物件時所有欄位的 local state 才會整批歸零重置。
export function ShapePropertiesForm({ shape }: ShapePropertiesFormProps) {
  const { updateShape } = useCanvas();
  const commit = (patch: ShapePatch) => updateShape(shape.id, patch);

  return (
    <div className={styles.form}>
      {/* x/y/width/height 都只能整數，跟拖曳/Transformer 縮放的行為一致。 */}
      <NumberField label="x" value={shape.x} round onCommit={(v) => commit({ x: v })} />
      <NumberField label="y" value={shape.y} round onCommit={(v) => commit({ y: v })} />
      {/* 三種 type 都有，不做 0–360 正規化。已知限制：這裡只改 rotation 不動 x/y，
          物件會繞 (x,y) 錨點（左上角）轉；Konva Transformer 拖控點旋轉時會連帶
          調整 x/y 讓視覺上繞中心轉，兩種操作方式轉出來的位置會不一樣。 */}
      <NumberField label="rotation" value={shape.rotation} round onCommit={(v) => commit({ rotation: v })} />

      {shape.type !== "text" && (
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

      {shape.type === "text" && (
        <NumberField
          label="fontSize"
          value={shape.fontSize}
          min={MIN_FONT_SIZE}
          round
          onCommit={(v) => commit({ fontSize: v })}
        />
      )}

      {shape.type !== "image" && (
        <ColorField label="fill" value={shape.fill} onCommit={(v) => commit({ fill: v })} />
      )}

      {shape.type === "rect" && (
        <NumberField
          label="cornerRadius"
          value={shape.cornerRadius}
          min={0}
          // 圓角上限是短邊一半，Math.floor 保證上限本身也是整數。
          max={Math.floor(Math.min(shape.width, shape.height) / 2)}
          round
          onCommit={(v) => commit({ cornerRadius: v })}
        />
      )}

      {shape.type === "text" && (
        <TextField label="text" value={shape.text} onCommit={(v) => commit({ text: v })} />
      )}
    </div>
  );
}
