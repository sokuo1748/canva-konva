"use client";

import { useLayoutEffect, useState } from "react";
import { useCanvas } from "../../../context/CanvasContext";
import { Modal } from "../../ui/Modal/Modal";
import { InputUI } from "../../ui/InputUI/InputUI";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import styles from "./ExportModal.module.scss";

const DEFAULT_FILENAME = "picture_01";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// 已有 .png 副檔名就不重複加
function withPngExtension(name: string) {
  return /\.png$/i.test(name) ? name : `${name}.png`;
}

// 依 open 切換 key 讓呼叫端強制重掛此元件來重置 state（見 Toolbar.tsx）
export function ExportModal({ open, onClose }: ExportModalProps) {
  const { stageRef, overlayLayerRef } = useCanvas();
  const [filename, setFilename] = useState(DEFAULT_FILENAME);

  // 匯出前產生的預覽圖，跟實際下載共用同一份資料
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  useLayoutEffect(() => {
    // ExportModal 是無條件常駐掛載的（見 Toolbar.tsx），沒有這個 guard 會在頁面剛載入、Stage 還沒
    // 準備好時就先跑一次
    if (!open) return;

    const stage = stageRef.current;
    if (!stage) {
      console.error("找不到畫布的 Stage 實例，無法產生預覽/匯出");
      return;
    }

    // 匯出前暫時隱藏 UI 覆蓋層（選取框/預覽線），輸出的圖片才不含這些編輯用的視覺提示
    const overlayLayer = overlayLayerRef.current;
    overlayLayer?.hide();
    try {
      setPreviewDataUrl(stage.toDataURL({ mimeType: "image/png" }));
    } catch (error) {
      console.error("產生預覽圖片失敗", error);
    } finally {
      overlayLayer?.show();
    }
  }, [open, stageRef, overlayLayerRef]);

  const handleExport = () => {
    if (!previewDataUrl) return;

    const trimmedName = filename.trim() || DEFAULT_FILENAME;

    const link = document.createElement("a");
    link.href = previewDataUrl;
    link.download = withPngExtension(trimmedName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onClose();
  };

  return (
    <Modal open={open} title="Export" onClose={onClose}>
      {previewDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL，不是 next/image 能優化的靜態資源
        <img src={previewDataUrl} alt="匯出預覽" className={styles.preview} />
      ) : (
        <span className={styles.previewError}>無法產生預覽</span>
      )}
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
        disabled={!previewDataUrl}
      />
    </Modal>
  );
}
