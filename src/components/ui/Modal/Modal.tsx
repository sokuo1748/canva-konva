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

// 通用 modal 殼：置中標題 + 右上角 X 的 header 版面內建，呼叫端直接傳 title 就好。
export function Modal({ open, title, onClose, children, closeLabel = "關閉" }: ModalProps) {
  const titleId = useId();

  // Esc 關閉，open 為 false 時不掛監聽。
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // open 一定先 return，不需要另外判斷 SSR 的 document 是否存在。
  if (!open) return null;

  return createPortal(
    // 點遮罩關閉，面板要擋掉冒泡避免點面板內容也被判定成點了遮罩。
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
