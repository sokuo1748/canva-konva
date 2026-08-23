"use client";

import { useFieldDraft } from "../../../hooks/useFieldDraft";
import styles from "./TextField.module.scss";

interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

// 打字不即時同步，離開欄位或按 Enter 才 commit，避免逐字元灌爆 undo history。
export function TextField({ label, value, onCommit }: TextFieldProps) {
  const { displayValue, handleFocus, handleChange, commit } = useFieldDraft<string>(
    value,
    (v) => v,
    // 空字串（或全空白）擋掉不 commit，避免變成選不到的零面積節點。
    (raw) => (raw.trim().length === 0 ? null : raw),
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
          // Enter 送出但不失焦（keepEditing）、Shift+Enter 換行、isComposing 排除 IME 選字中的 Enter。
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit({ keepEditing: true });
          }
        }}
      />
    </label>
  );
}
