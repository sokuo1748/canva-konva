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

// 「每次重新打開都要重置檔名」不是在這裡用 useEffect + setState 做（ESLint 的
// react-hooks/set-state-in-effect 也會擋這種寫法：在 effect 裡直接呼叫 setState
// 會多觸發一次 cascading render）。改成讓呼叫端（Toolbar）在 open 狀態切換時
// 用不同的 key 掛這個元件——key 變了 React 就會整個卸載重掛，useState 自然拿到
// 新的初始值，不用額外邏輯，也是 React 官方文件推薦的「依 prop 重置 state」做法。
export function ExportModal({ open, onClose }: ExportModalProps) {
  const { containerRef } = useCanvas();
  const [filename, setFilename] = useState(DEFAULT_FILENAME);

  // 直接對 containerRef 底下實際的 <canvas> 元素呼叫 toDataURL()（KonvaBoard 目前
  // 只有一個 Layer，container 裡就只有這一個 canvas，不用另外查 Konva Stage 實例）。
  // 這個假設只在「永遠只有一個 Layer」時成立——之後如果為了效能或匯出品質把
  // Transformer 拆到獨立 Layer（見下面的已知限制），container 底下就會有第二個
  // canvas，這裡要跟著改成用 querySelectorAll 精準指定要匯出哪一個，不然會靜默
  // 選到錯的畫面、匯出結果不對但不會報錯。
  //
  // 已知限制：這樣匯出的是「目前畫面看到的樣子」——包含當下滾輪縮放/平移的狀態，
  // 如果匯出當下剛好有物件被選取，Transformer 的控制框也會一起被匯出進圖片。
  // 要做到「穩定 1:1 完整畫布內容、不含選取框」需要另外幫 Stage 加 ref、把
  // Transformer 拆到獨立 Layer，這次先用最直接的方式做，之後有需要再優化。
  const handleExport = () => {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) {
      console.error("找不到畫布的 canvas 元素，無法匯出");
      return;
    }

    // toDataURL 在 canvas 被跨來源圖片污染（tainted）時會丟 SecurityError。目前
    // 所有圖片都是透過 FileReader 讀成 base64 data URL 載入（見 TemplatePanel.tsx），
    // 不會觸發這個問題，但這是「目前資料流剛好安全」，不是 API 本身的保證——
    // 之後如果加了「貼上圖片網址」之類的功能，這裡就可能真的丟例外，包一層
    // try/catch 先擋著，不要讓整個點擊處理器噴未捕捉例外。
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

    // 只有真的觸發下載才關閉；上面兩個失敗的 return 分支不會走到這裡，
    // 讓使用者留在 modal 裡看得到（至少 console 裡的）錯誤、可以重試。
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
