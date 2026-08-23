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
  // 是否強制四捨五入成整數，跟拖曳/Transformer 縮放的行為保持一致。
  round?: boolean;
}

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
      // 先 round 再 clamp，避免 round 把值拉回超過非整數的 max。
      if (round) next = Math.round(next);
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
          // Enter 委派給 blur() 觸發同一份 commit 邏輯，不重寫第二套。
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
