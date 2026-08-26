import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButtonUI.module.scss";

interface IconButtonUIProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // 映射成 aria-label/title
  active?: boolean; // 給 toggle 按鈕用，套用實心樣式
}

// 純 icon 按鈕
export const IconButtonUI = forwardRef<HTMLButtonElement, IconButtonUIProps>(function IconButtonUI(
  { icon, label, active, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={active ? `${styles.iconButton} ${styles.active}` : styles.iconButton}
      aria-label={label}
      aria-pressed={active}
      title={label}
      {...rest}
    >
      {icon}
    </button>
  );
});
