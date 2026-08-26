"use client";

import { useFieldDraft } from "../../../hooks/useFieldDraft";
import styles from "./TextField.module.scss";

interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

// 文字內容欄位，離開欄位或按 Enter 才 commit
export function TextField({ label, value, onCommit }: TextFieldProps) {
  const { displayValue, handleFocus, handleChange, commit } = useFieldDraft<string>(
    value,
    (v) => v,
    (raw) => (raw.trim().length === 0 ? null : raw), // 空字串不 commit
    onCommit,
  );

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea
        className={styles.textarea}
        value={displayValue}
        rows={3}
        onFocus={handleFocus}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          // Enter 送出但不失焦，Shift+Enter 換行
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit({ keepEditing: true });
          }
        }}
      />
    </label>
  );
}
