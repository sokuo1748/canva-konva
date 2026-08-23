"use client";

import { useState } from "react";
import { useCanvas } from "../../../context/CanvasContext";
import { Modal } from "../../ui/Modal/Modal";
import { InputUI } from "../../ui/InputUI/InputUI";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";

const DEFAULT_FILENAME = "picture_01";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// 已經有 .png 副檔名就不要重複加一次（例如使用者自己在檔名欄位打了 "foo.png"）。
function withPngExtension(name: string) {
  return /\.png$/i.test(name) ? name : `${name}.png`;
}

// 依 open 切換 key 讓呼叫端（Toolbar）強制重掛此元件來重置檔名，不用 useEffect + setState。
export function ExportModal({ open, onClose }: ExportModalProps) {
  const { containerRef } = useCanvas();
  const [filename, setFilename] = useState(DEFAULT_FILENAME);

  // 直接對 containerRef 底下的 <canvas> 呼叫 toDataURL()（KonvaBoard 目前只有一個 Layer）。
  // 已知限制：匯出的是目前畫面看到的樣子，含縮放/平移狀態，選取中的 Transformer 控制框也會一起匯出。
  const handleExport = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) {
      console.error("找不到畫布的 canvas 元素，無法匯出");
      return;
    }

    // toDataURL 在 canvas 被跨來源圖片污染時會丟 SecurityError，包 try/catch 保險。
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch (error) {
      console.error("匯出圖片失敗", error);
      return;
    }

    const trimmedName = filename.trim() || DEFAULT_FILENAME;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = withPngExtension(trimmedName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 只有真的觸發下載才關閉，失敗時留在 modal 裡讓使用者能重試。
    onClose();
  };

  return (
    <Modal open={open} title="Export" onClose={onClose}>
      <InputUI
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        width="100%"
        height={40}
        aria-label="檔名"
      />
      <ButtonUI
        name="Export Image"
        selectedStyle="origin"
        width="100%"
        height={40}
        onClick={handleExport}
      />
    </Modal>
  );
}
