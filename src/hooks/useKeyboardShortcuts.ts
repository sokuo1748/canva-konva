"use client";

import { useEffect } from "react";
import { useCanvas } from "../context/CanvasContext";

// 使用者正在可編輯元素上打字時，快捷鍵應該讓出瀏覽器原生行為（複製/貼上/刪除字元/Ctrl+Z 等）
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('input, textarea, [contenteditable="true"]');
}

// 全域鍵盤快捷鍵：undo/redo、複製/剪下/貼上、刪除
export function useKeyboardShortcuts() {
  const { undo, redo, selectedIds, deleteShapes, copyShapes, cutShapes, pasteShapes } = useCanvas();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey; // Mac 用 metaKey，Windows/Linux 用 ctrlKey
      const key = event.key.toLowerCase();

      if (mod && key === "z" && event.shiftKey) {
        // Cmd/Ctrl+Shift+Z：重做
        event.preventDefault();
        redo();
        return;
      }

      if (mod && key === "z") {
        // Cmd/Ctrl+Z：復原
        event.preventDefault();
        undo();
        return;
      }

      if (mod && key === "y") {
        // Ctrl+Y：重做（Windows 慣用組合）
        event.preventDefault();
        redo();
        return;
      }

      if (mod && key === "c") {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        copyShapes(selectedIds);
        return;
      }

      if (mod && key === "x") {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        cutShapes(selectedIds);
        return;
      }

      if (mod && key === "v") {
        event.preventDefault();
        pasteShapes();
        return;
      }

      if (key === "delete" || key === "backspace") {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        deleteShapes(selectedIds);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectedIds, deleteShapes, copyShapes, cutShapes, pasteShapes]);
}
