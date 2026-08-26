import { forwardRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import styles from "./ButtonUI.module.scss";

type ButtonSelectedStyle = "origin" | "template";

// 每個 selectedStyle 是獨立設計的 class，不共用基底樣式
const selectedStyleClassName: Record<ButtonSelectedStyle, string> = {
  origin: styles.origin,
  template: styles.template,
};

interface ButtonUIProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name"> {
  name: string;
  icon?: ReactNode;
  width?: number | string;
  height?: number | string;
  selectedStyle?: ButtonSelectedStyle;
}

// 圖示+文字按鈕
export const ButtonUI = forwardRef<HTMLButtonElement, ButtonUIProps>(function ButtonUI(
  { name, icon, width, height, style, type = "button", selectedStyle = "origin", ...rest },
  ref,
) {
  const mergedStyle: CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <button
      ref={ref}
      type={type}
      className={selectedStyleClassName[selectedStyle]}
      style={mergedStyle}
      {...rest}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.name}>{name}</span>
    </button>
  );
});
