import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButtonUI.module.scss";

interface IconButtonUIProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  // 必填，映射成 aria-label（同時當原生 title tooltip）——這顆按鈕不顯示文字，
  // 沒有這個就完全沒有可讀的用途說明，螢幕閱讀器唸不出來。
  label: string;
}

// 跟 ButtonUI 分開的原因見 CLAUDE.md：ButtonUI 的兩個 variant 都是「圖示+文字」設計，
// 工具列常駐的純 icon 按鈕（Reset/Undo/Redo）視覺定位不同，硬把 name 改成「有時顯示、
// 有時只當 aria-label」會讓 ButtonUI 的介面語意變得不直覺，所以另開一個小元件。
export const IconButtonUI = forwardRef<HTMLButtonElement, IconButtonUIProps>(function IconButtonUI(
  { icon, label, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={styles.iconButton}
      aria-label={label}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  );
});
