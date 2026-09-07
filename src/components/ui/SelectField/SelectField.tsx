"use client";

import styles from "./SelectField.module.scss";

interface SelectFieldOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectFieldOption[];
  onCommit: (value: string) => void;
}

// 離散選項欄位，onChange 直接 commit（不經過 useFieldDraft）：
// 單次選擇沒有連續輸入/拖曳的中間態，理由跟 ColorField/布林 toggle 按鈕一致。
export function SelectField({ label, value, options, onCommit }: SelectFieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select className={styles.select} value={value} onChange={(e) => onCommit(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
