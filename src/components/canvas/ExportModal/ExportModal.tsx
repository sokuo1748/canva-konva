"use client";

import { useLayoutEffect, useState } from "react";
import type Konva from "konva";
import { useCanvas } from "../../../context/CanvasContext";
import { Modal } from "../../ui/Modal/Modal";
import { InputUI } from "../../ui/InputUI/InputUI";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import styles from "./ExportModal.module.scss";

const DEFAULT_FILENAME = "picture_01";

// 目前支援的匯出格式，之後要加新格式（例如 webp）只要在這個 union + 下面兩個對照表補一筆
const EXPORT_FORMATS = ["png", "jpeg"] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

const DEFAULT_FORMAT: ExportFormat = "png"; // 維持向下相容，既有行為（PNG）是預設值

const FORMAT_MIME_TYPE: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
};

const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  png: "png",
  jpeg: "jpg",
};

const FORMAT_LABEL: Record<ExportFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
};

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// 「辨識/去除舊副檔名用」的清單，跟「產生下載檔名用」的 FORMAT_EXTENSION 分開維護：
// FORMAT_EXTENSION 固定用 "jpg" 當 jpeg 格式的輸出副檔名，但使用者手動打字時可能打
// "photo.jpeg"，這裡額外把 "jpeg" 也算進「已知副檔名」，去除時才不會漏掉
const KNOWN_EXTENSIONS = [...new Set([...Object.values(FORMAT_EXTENSION), "jpeg"])];

// 去掉檔名裡已經帶的任何一種已知副檔名，避免使用者輸入 "foo.png"/"foo.jpeg" 卻切換格式時
// 疊成 "foo.png.jpg" 或 "foo.jpeg.png"
function stripKnownExtension(name: string) {
  const pattern = new RegExp(`\\.(${KNOWN_EXTENSIONS.join("|")})$`, "i");
  return name.replace(pattern, "");
}

function withExtension(name: string, format: ExportFormat) {
  return `${stripKnownExtension(name)}.${FORMAT_EXTENSION[format]}`;
}

// JPEG 不支援透明通道：Konva/瀏覽器原生 canvas.toDataURL("image/jpeg") 對透明像素預設會合成
// 黑色背景，不是使用者想要的效果，所以先手動墊一層白色背景再合成。stage.toCanvas() 是 Konva
// 內部 toDataURL 實際呼叫的同一份合成邏輯，回傳的是同步、已經畫好的 HTMLCanvasElement（不用
// 等圖片載入），可以直接拿來當 drawImage 的來源，不需要額外的非同步流程。抽成獨立函式（而不是
// 直接寫在 useLayoutEffect 裡）單純是為了讓 effect body 維持「單一 setState(單一 call
// expression)」的精簡型態，跟既有 PNG 分支一致。
function toJpegDataUrl(stage: Konva.Stage): string {
  const sourceCanvas = stage.toCanvas();
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = sourceCanvas.width;
  compositeCanvas.height = sourceCanvas.height;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("無法取得 2D context 來合成 JPEG 背景");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);
  return compositeCanvas.toDataURL(FORMAT_MIME_TYPE.jpeg);
}

// 依 open 切換 key 讓呼叫端強制重掛此元件來重置 state（見 Toolbar.tsx）
export function ExportModal({ open, onClose }: ExportModalProps) {
  const { stageRef, overlayLayerRef } = useCanvas();
  const [filename, setFilename] = useState(DEFAULT_FILENAME);
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_FORMAT);

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
      if (format === "jpeg") {
        setPreviewDataUrl(toJpegDataUrl(stage));
      } else {
        setPreviewDataUrl(stage.toDataURL({ mimeType: FORMAT_MIME_TYPE.png }));
      }
    } catch (error) {
      console.error("產生預覽圖片失敗", error);
      // 切換格式後若重新計算失敗，清空舊格式殘留的預覽資料，避免畫面顯示舊格式預覽、
      // 但檔名副檔名已經是新格式的不一致；Export 按鈕的 disabled={!previewDataUrl}
      // 也因此會正確擋住這個情況
      setPreviewDataUrl(null);
    } finally {
      overlayLayer?.show();
    }
  }, [open, format, stageRef, overlayLayerRef]);

  const handleExport = () => {
    if (!previewDataUrl) return;

    const trimmedName = filename.trim() || DEFAULT_FILENAME;

    const link = document.createElement("a");
    link.href = previewDataUrl;
    link.download = withExtension(trimmedName, format);
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
      <label className={styles.formatField}>
        <span className={styles.formatLabel}>檔案格式</span>
        <select
          className={styles.formatSelect}
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
        >
          {EXPORT_FORMATS.map((value) => (
            <option key={value} value={value}>
              {FORMAT_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
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
