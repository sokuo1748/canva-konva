"use client";

import { useState } from "react";

// 本地 draft，blur/Enter 才 commit，避免逐字元灌爆 undo history；沒 focus 時永遠顯示外部最新 value。
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

  // keepEditing：TextField 的 Enter 送出內容但不失焦，靠 isEditing 保持 true 避免 controlled textarea 把新內容彈掉。
  const commit = (options?: { keepEditing?: boolean }) => {
    if (!options?.keepEditing) setIsEditing(false);

    const parsed = parseValue(draft);
    // 無效輸入放棄 commit，isEditing 變 false 後畫面自動還原成目前的真實值。
    if (parsed === null) return;
    // 值沒真的改變就不 commit，避免多推一筆沒意義的 undo history。
    if (parsed !== value) onCommit(parsed);
  };

  return { displayValue, handleFocus, handleChange, commit };
}
