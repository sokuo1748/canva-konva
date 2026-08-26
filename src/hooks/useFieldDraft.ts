"use client";

import { useState } from "react";

// 本地 draft，blur/Enter 才 commit，避免逐字元灌爆 undo history
export function useFieldDraft<T>(
  value: T,
  serialize: (value: T) => string,
  parseValue: (raw: string) => T | null,
  onCommit: (value: T) => void,
) {
  const [draft, setDraft] = useState(() => serialize(value));
  const [isEditing, setIsEditing] = useState(false);

  const displayValue = isEditing ? draft : serialize(value);

  const handleFocus = () => {
    setIsEditing(true);
    setDraft(serialize(value));
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
  };

  // keepEditing：TextField 的 Enter 送出內容但不失焦
  const commit = (options?: { keepEditing?: boolean }) => {
    if (!options?.keepEditing) setIsEditing(false);

    const parsed = parseValue(draft);
    if (parsed === null) return; // 無效輸入放棄 commit
    if (parsed !== value) onCommit(parsed); // 值沒變就不 commit
  };

  return { displayValue, handleFocus, handleChange, commit };
}
