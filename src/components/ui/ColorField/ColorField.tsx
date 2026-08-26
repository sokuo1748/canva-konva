"use client";

import { InputUI } from "../InputUI/InputUI";
import styles from "./ColorField.module.scss";

interface ColorFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

// 顏色屬性欄位，onChange 直接 commit（不經過 useFieldDraft）
export function ColorField({ label, value, onCommit }: ColorFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <InputUI
        type="color"
        value={value}
        width="100%"
        height={36}
        onChange={(e) => onCommit(e.target.value)}
      />
    </label>
  );
}
