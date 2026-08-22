"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { templateList } from "./templateList";
import { useCanvas } from "../../../context/CanvasContext";

export function TemplatePanel() {
  const { addSquare, addText, addImage } = useCanvas();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  // accept="image/*" 只是瀏覽器 UI 層的篩選提示，不是硬限制（使用者選「顯示所有檔案」
  // 還是能選到非圖片檔），所以這裡一定要再做一次 runtime 型別檢查。
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    // 後面要經過兩層非同步 callback（FileReader → Image）才會結束，統一先存住
    // DOM 參照，所有結束路徑都靠它清空 value，不要依賴之後還能安全存取 e.target。
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      console.error("只能選擇圖片檔案");
      inputEl.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      console.error("圖片讀取失敗");
      inputEl.value = "";
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onerror = () => {
        console.error("圖片載入失敗");
        inputEl.value = "";
      };
      img.onload = () => {
        addImage(dataUrl, img.naturalWidth, img.naturalHeight);
        inputEl.value = "";
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {templateList.map((item) => (
        <ButtonUI
          key={item.id}
          name={item.name}
          icon={<item.icon size={20} />}
          selectedStyle="template"
          width="100%"
          height={60}
          onClick={
            item.id === "shape"
              ? addSquare
              : item.id === "text"
                ? addText
                : item.id === "image"
                  ? handleImageButtonClick
                  : undefined
          }
        />
      ))}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </>
  );
}
