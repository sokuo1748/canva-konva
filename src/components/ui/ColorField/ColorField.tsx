"use client";

import { useEffect, useRef, useState } from "react";
import { InputUI } from "../InputUI/InputUI";
import styles from "./ColorField.module.scss";

interface ColorFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  muted?: boolean; // 只是視覺上降低存在感（例如 strokeEnabled 關閉時），選色/commit 功能不受影響
  // 不需要顧慮 undo history 的呼叫端（例如畫筆顏色這類純 UI 暫態、不進
  // CanvasSnapshot 的 state）可以傳 true，讓每次選色（input 事件）就立即 commit，
  // 不用等使用者放開色盤才觸發的原生 change 事件——避免「色塊看起來已經變色，
  // 但外部 state 其實還沒 commit」這種中間態影響其他即時生效的邏輯（例如下一筆
  // 畫筆筆畫讀到舊顏色）。預設 false，行為與原本完全相同。
  instant?: boolean;
}

// 顏色屬性欄位：<input type="color"> 在原生色盤上拖曳選色時，React 的 onChange
// （對應原生 input 事件）會連續觸發，若直接 commit 會灌爆 undo history（見 CLAUDE.md）。
// 改成 onChange 只更新本地顯示用的 draft state，真正 commit 改成手動監聽原生
// change 事件（放開滑鼠/選色完成才觸發一次）。`instant` 為 true 的呼叫端沒有這個
// undo 顧慮，onChange 當下就會額外立即 commit 一次；原生 change 監聽維持不變，
// 之後仍會再 commit 一次同樣的值，屬於冪等的重複呼叫，不需要特別去重。
export function ColorField({ label, value, onCommit, muted = false, instant = false }: ColorFieldProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  // 外部 value 變動（undo/redo、切換選取物件等）時同步顯示，沒有 focus/blur 概念可
  // 判斷「使用者是否正在互動」，但拖曳選色期間外部 value 本來就不會變（要放開滑鼠
  // 觸發 change 才會 commit），所以直接同步是安全的。用「render 期間比較上一次
  // value、不同就順便 setState」的寫法（React 官方認可的 derive-from-props 手法），
  // 不透過 useEffect（ESLint 的 react-hooks/set-state-in-effect 會擋，理由同
  // CLAUDE.md 的 Modal 條目）
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayValue(value);
  }

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      onCommitRef.current(target.value);
    };

    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
  }, []);

  return (
    <label className={muted ? `${styles.field} ${styles.muted}` : styles.field}>
      <span className={styles.label}>{label}</span>
      <InputUI
        ref={inputRef}
        type="color"
        value={displayValue}
        width="100%"
        height={36}
        onChange={(e) => {
          setDisplayValue(e.target.value);
          if (instant) onCommitRef.current(e.target.value);
        }}
      />
    </label>
  );
}
