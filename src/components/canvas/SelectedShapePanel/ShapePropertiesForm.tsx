"use client";

import { IconAspectRatio, IconBold, IconStrikethrough, IconUnderline } from "@tabler/icons-react";
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
import { SelectField } from "../../ui/SelectField/SelectField";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import { AlignButtons } from "./AlignButtons";
import { FONT_FAMILIES, DEFAULT_FONT_FAMILY } from "../../../constants/fontFamilies";
import styles from "./ShapePropertiesForm.module.scss";

interface ShapePropertiesFormProps {
  shape: CanvasShape;
  // 對齊按鈕要作用的 id 集合：呼叫端（SelectedShapePanel）已經算好「目前是不是分組展開」，
  // 直接把結果傳下來，這裡不重新推導 selectedIds/activeId 的語意，避免跟父層的判斷邏輯
  // 各自維護、日後父層改了分流條件卻忘記同步這裡
  alignIds: string[];
}

// 選取物件的可編輯屬性表單，呼叫端要用 key={shape.id} 掛，切換選取時欄位才會重置
export function ShapePropertiesForm({ shape, alignIds }: ShapePropertiesFormProps) {
  const { updateShape } = useCanvas();
  const commit = (patch: ShapePatch) => updateShape(shape.id, patch);

  return (
    <div className={styles.form}>
      <NumberField label="x" value={shape.x} round onCommit={(v) => commit({ x: v })} />
      <NumberField label="y" value={shape.y} round onCommit={(v) => commit({ y: v })} />
      <NumberField label="rotation" value={shape.rotation} round onCommit={(v) => commit({ rotation: v })} />
      <AlignButtons ids={alignIds} />

      {/* rect/image/circle/triangle 都有獨立的 width/height，可以自由（非等比）拉伸；
          circle/triangle 這次改成跟 rect/image 一樣存兩個獨立欄位，不再只存單一 size（見 CLAUDE.md） */}
      {(shape.type === "rect" || shape.type === "image" || shape.type === "circle" || shape.type === "triangle") && (
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
          <div className={styles.toggleRow}>
            <IconButtonUI
              icon={<IconAspectRatio size={18} />}
              label="鎖定高寬比"
              active={shape.lockAspectRatio}
              onClick={() => commit({ lockAspectRatio: !shape.lockAspectRatio })}
            />
          </div>
        </>
      )}

      {/* 星形這次不開放拉伸，只存一個 size，width/height 兩欄位背後讀寫同一個值 */}
      {shape.type === "star" && (
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

      {shape.type === "text" && (
        <SelectField
          label="fontFamily"
          value={shape.fontFamily ?? DEFAULT_FONT_FAMILY}
          options={FONT_FAMILIES}
          onCommit={(v) => commit({ fontFamily: v })}
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
