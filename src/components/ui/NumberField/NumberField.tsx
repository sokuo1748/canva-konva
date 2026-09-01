"use client";

import type { ReactNode } from "react";
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
  icon?: ReactNode; // 有傳時用圖示取代文字標籤，label 改當 aria-label/title 用（無障礙）
}

// 數字屬性欄位（x/y/width/height/fontSize 等）
export function NumberField({ label, value, onCommit, min, max, round = false, icon }: NumberFieldProps) {
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
      {icon ? (
        <span className={styles.label} title={label}>
          {icon}
        </span>
      ) : (
        <span className={styles.label}>{label}</span>
      )}
      <InputUI
        type="number"
        value={displayValue}
        min={min}
        max={max}
        width="100%"
        height={36}
        aria-label={icon ? label : undefined}
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
