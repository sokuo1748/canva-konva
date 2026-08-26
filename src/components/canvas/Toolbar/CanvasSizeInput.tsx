"use client";

import { useState } from "react";
import { IconLink, IconLinkOff } from "@tabler/icons-react";
import { useCanvas } from "../../../context/CanvasContext";
import { useFieldDraft } from "../../../hooks/useFieldDraft";
import { InputUI } from "../../ui/InputUI/InputUI";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import { MIN_CANVAS_SIZE, MAX_CANVAS_SIZE } from "../../../constants/shapeConstraints";
import styles from "./CanvasSizeInput.module.scss";

// 空字串/非數字放棄 commit，否則 round 後 clamp
function parseSize(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), MIN_CANVAS_SIZE), MAX_CANVAS_SIZE);
}

// 輸入框寬度下限（字元數）
const MIN_INPUT_CHARS = 2;

// 蓋掉全域 border-box 讓 ch 寬度單位不被 padding/border 吃掉，並置中顯示數字
const CONTENT_BOX_STYLE = { boxSizing: "content-box", textAlign: "center" } as const;

// 依目前顯示內容換算寬度；InputUI.module.scss 已經隱藏原生上下箭頭，這裡的 +2 字元純粹是給游標
// 跟「ch 換算出來的寬度只是估計值、不同瀏覽器/字體實際字寬會有些微落差」留的安全餘裕，避免尾數位
// 數字被輸入框右邊圓角邊框裁掉看不到。
function inputWidthCh(displayValue: string): string {
  return `${Math.max(MIN_INPUT_CHARS, displayValue.length) + 2}ch`;
}

// Toolbar 的畫布尺寸輸入（width [ ] x height [ ]），接上 setCanvasSize
export function CanvasSizeInput() {
  const { canvasWidth, canvasHeight, setCanvasSize } = useCanvas();
  // 寬高比例鎖定，純 UI 暫態、不進 undo history
  const [isRatioLocked, setIsRatioLocked] = useState(false);

  // 比例鎖定依賴 canvasWidth/canvasHeight 恆為正整數（setCanvasSize 內部保底 clamp 到
  // MIN_CANVAS_SIZE 以上），canvasWidth > 0 這層檢查是防呆用，避免這個不變量未來被打破時算出 NaN。
  // 注意：算出的另一邊若被 clamp 到上下限，比例會悄悄變成新比例（不會回復成鎖定當下的原始比例），
  // 這是刻意接受的簡化，不另外存一個 ratio state。
  const width = useFieldDraft<number>(canvasWidth, String, parseSize, (next) => {
    if (isRatioLocked && canvasWidth > 0) {
      setCanvasSize(next, Math.round(next * (canvasHeight / canvasWidth)));
    } else {
      setCanvasSize(next, canvasHeight);
    }
  });
  const height = useFieldDraft<number>(canvasHeight, String, parseSize, (next) => {
    if (isRatioLocked && canvasHeight > 0) {
      setCanvasSize(Math.round(next * (canvasWidth / canvasHeight)), next);
    } else {
      setCanvasSize(canvasWidth, next);
    }
  });

  return (
    <div className={styles.group} role="group" aria-label="畫布尺寸">
      <label className={styles.field}>
        <span className={styles.label}>width</span>
        <InputUI
          type="number"
          value={width.displayValue}
          width={inputWidthCh(width.displayValue)}
          style={CONTENT_BOX_STYLE}
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          height={32}
          onFocus={width.handleFocus}
          onChange={(e) => width.handleChange(e.target.value)}
          onBlur={() => width.commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <span className={styles.separator}>×</span>
      <label className={styles.field}>
        <span className={styles.label}>height</span>
        <InputUI
          type="number"
          value={height.displayValue}
          width={inputWidthCh(height.displayValue)}
          style={CONTENT_BOX_STYLE}
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          height={32}
          onFocus={height.handleFocus}
          onChange={(e) => height.handleChange(e.target.value)}
          onBlur={() => height.commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <IconButtonUI
        icon={isRatioLocked ? <IconLink size={18} /> : <IconLinkOff size={18} />}
        label={isRatioLocked ? "解除寬高比例鎖定" : "鎖定寬高比例"}
        active={isRatioLocked}
        onClick={() => setIsRatioLocked((prev) => !prev)}
      />
    </div>
  );
}
