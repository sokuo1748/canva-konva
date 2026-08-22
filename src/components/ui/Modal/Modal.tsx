"use client";

import { useEffect, useId } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { IconButtonUI } from "../IconButtonUI/IconButtonUI";
import styles from "./Modal.module.scss";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
}

// 通用 modal 殼：置中標題 + 右上角 X 關閉鈕的 header 版面內建在這裡（不是讓呼叫端
// 各自傳 header/main 兩個 slot），因為這個版面幾乎是所有 modal 的通用結構，之後有
// 其他 modal（例如確認刪除、畫布尺寸設定）直接傳 title 就好，不用重新組一次。
export function Modal({ open, title, onClose, children, closeLabel = "關閉" }: ModalProps) {
  const titleId = useId();

  // Esc 關閉。open 為 false 時不掛監聽，避免背景還留著看不見的 keydown handler。
  // 已知限制：每個 Modal 實例都各自對 document 掛監聽，目前只有一層 modal 沒問題；
  // 之後如果做出巢狀/多個 modal 同時開啟，按一次 Esc 會讓所有開著的 modal 一起關閉
  // （沒有「只關最上層」的機制），屆時要另外處理。
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // open 初始值是 false，一定會先在這裡 return，才有機會走到下面的 createPortal，
  // 所以不需要另外判斷 typeof document !== "undefined" 這種 SSR guard。
  if (!open) return null;

  return createPortal(
    // 點遮罩本身要關閉；面板要擋掉冒泡，不然點面板內容（例如 input）也會被
    // 判定成點了遮罩，兩者缺一都會出錯。
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span aria-hidden="true" />
          <span id={titleId} className={styles.title}>
            {title}
          </span>
          <IconButtonUI icon={<IconX size={20} />} label={closeLabel} onClick={onClose} />
        </div>
        <div className={styles.main}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
