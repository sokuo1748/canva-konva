import { forwardRef } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import styles from "./InputUI.module.scss";

interface InputUIProps extends InputHTMLAttributes<HTMLInputElement> {
  width?: number | string;
  height?: number | string;
}

// 共用的原生 input 樣式包裝
export const InputUI = forwardRef<HTMLInputElement, InputUIProps>(function InputUI(
  { width, height, style, ...rest },
  ref,
) {
  const mergedStyle: CSSProperties = {
    width,
    height,
    ...style,
  };

  return <input ref={ref} className={styles.input} style={mergedStyle} {...rest} />;
});
