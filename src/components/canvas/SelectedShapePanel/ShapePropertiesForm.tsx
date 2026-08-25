"use client";

import { IconBold, IconStrikethrough, IconUnderline } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import type { CanvasShape, ShapePatch } from "../../../types/shape";
import { MIN_SHAPE_SIZE, MIN_FONT_SIZE } from "../../../constants/shapeConstraints";
import { NumberField } from "../../ui/NumberField/NumberField";
import { ColorField } from "../../ui/ColorField/ColorField";
import { TextField } from "../../ui/TextField/TextField";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
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

      {/* circle/triangle/star 的 width/height 在 Konva 裡綁死同一顆半徑（見 types/shape.ts
          的註解），資料只存一個 size，但面板刻意顯示兩個獨立的 width/height 欄位
          （跟 rect/image 介面一致，方便直接輸入調整）——兩個欄位背後讀寫同一個 size，
          改其中一個另一個會自動同步顯示新值，等比縮放的事實不用另外加提示文字說明。 */}
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

      {shape.type !== "image" && shape.type !== "line" && (
        <ColorField label="fill" value={shape.fill} onCommit={(v) => commit({ fill: v })} />
      )}

      {/* line 沒有 fill，只有 stroke（線條顏色）+ strokeWidth（線條粗細）。 */}
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

      {/* 單次點擊、立即生效的布林切換，不是連續輸入/拖曳，不透過 useFieldDraft
          （跟 ColorField 同一類「單次確定動作」的欄位）——一次點擊就該對應一次
          updateShape/一筆 undo entry，沒有「打字打到一半」的中間態需要 draft 緩衝。 */}
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
