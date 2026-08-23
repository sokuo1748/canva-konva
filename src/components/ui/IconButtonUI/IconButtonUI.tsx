import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButtonUI.module.scss";

interface IconButtonUIProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  // 必填，映射成 aria-label/title，不然螢幕閱讀器唸不出用途。
  label: string;
}

// 跟 ButtonUI 分開：ButtonUI 是「圖示+文字」設計，這裡是純 icon 按鈕，語意不同。
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
