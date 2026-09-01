"use client";

import { InputUI } from "../InputUI/InputUI";
import styles from "./ColorField.module.scss";

interface ColorFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  muted?: boolean; // 只是視覺上降低存在感（例如 strokeEnabled 關閉時），選色/commit 功能不受影響
}

// 顏色屬性欄位，onChange 直接 commit（不經過 useFieldDraft）
export function ColorField({ label, value, onCommit, muted = false }: ColorFieldProps) {
  return (
    <label className={muted ? `${styles.field} ${styles.muted}` : styles.field}>
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
