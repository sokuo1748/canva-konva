"use client";

import { InputUI } from "../InputUI/InputUI";
import { useFieldDraft } from "../../../hooks/useFieldDraft";
import styles from "./NumberField.module.scss";

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  round?: boolean; // 是否強制四捨五入成整數
}

// 數字屬性欄位（x/y/width/height/fontSize 等）
export function NumberField({ label, value, onCommit, min, max, round = false }: NumberFieldProps) {
  const { displayValue, handleFocus, handleChange, commit } = useFieldDraft<number>(
    value,
    (v) => String(v),
    (raw) => {
      const trimmed = raw.trim();
      if (trimmed === "") return null;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return null;

      let next = parsed;
      if (round) next = Math.round(next); // 先 round 再 clamp
      if (min !== undefined) next = Math.max(next, min);
      if (max !== undefined) next = Math.min(next, max);
      return next;
    },
    onCommit,
  );

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <InputUI
        type="number"
        value={displayValue}
        min={min}
        max={max}
        width="100%"
        height={36}
        onFocus={handleFocus}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
