"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { templateList } from "./templateList";
import { useCanvas } from "../../../context/CanvasContext";

// panelLeft 底部的 Image/Shape/Text/Paint 新增按鈕
export function TemplatePanel() {
  const { addText, addImage, isShapePickerOpen, setIsShapePickerOpen, activeTool, setActiveTool } = useCanvas();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  // 選擇圖片檔案並新增到畫布
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget; // 先存住，非同步 callback 都靠它清空 value
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
          active={item.id === "paint" ? activeTool !== "select" : undefined}
          onClick={
            item.id === "shape"
              ? () => {
                  setActiveTool("select"); // Shape 選單跟 Paint 面板互斥
                  setIsShapePickerOpen(!isShapePickerOpen);
                }
              : item.id === "text"
                ? addText
                : item.id === "image"
                  ? handleImageButtonClick
                  : item.id === "paint"
                    ? () => {
                        setIsShapePickerOpen(false);
                        setActiveTool(activeTool === "select" ? "brush" : "select");
                      }
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
