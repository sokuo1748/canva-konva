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

// 通用 modal 殼：置中標題 + 右上角關閉鈕
export function Modal({ open, title, onClose, children, closeLabel = "關閉" }: ModalProps) {
  const titleId = useId();

  // Esc 關閉
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    // 點遮罩關閉，面板本身擋掉冒泡
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
