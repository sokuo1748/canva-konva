"use client";

import { IconLineDashed } from "@tabler/icons-react";
import { ButtonUI } from "../../ui/ButtonUI/ButtonUI";
import { useCanvas } from "../../../context/CanvasContext";
import type { TablerIconComponent } from "../../ui/icon-map";
import { SHAPE_TYPE_ICONS } from "../../../constants/shapeTypeIcons";
import styles from "./ShapePicker.module.scss";

interface ShapePickerOption {
  id: string;
  name: string;
  icon: TablerIconComponent;
  onSelect: () => void;
}

// 點 Shape 按鈕後 panelRight 顯示的圖形選單（見 SelectedShapePanel.tsx 的 isShapePickerOpen 分流）；直線／虛線是同一個 addLine，差別只在傳入的 dashed 參數。
export function ShapePicker() {
  const { addSquare, addCircle, addTriangle, addStar, addLine, setIsShapePickerOpen } = useCanvas();

  // 前五個選項的圖示拿 SHAPE_TYPE_ICONS（選單顯示「Square」但底層 type 是 "rect"，沿用既有命名落差）；IconLineDashed 是虛線選項專用，不屬於 SHAPE_TYPE_ICONS 職責範圍。
  const options: ShapePickerOption[] = [
    { id: "square", name: "Square", icon: SHAPE_TYPE_ICONS.rect, onSelect: addSquare },
    { id: "circle", name: "Circle", icon: SHAPE_TYPE_ICONS.circle, onSelect: addCircle },
    { id: "triangle", name: "Triangle", icon: SHAPE_TYPE_ICONS.triangle, onSelect: addTriangle },
    { id: "star", name: "Star", icon: SHAPE_TYPE_ICONS.star, onSelect: addStar },
    { id: "line", name: "Line", icon: SHAPE_TYPE_ICONS.line, onSelect: () => addLine(false) },
    { id: "dashedLine", name: "Dashed Line", icon: IconLineDashed, onSelect: () => addLine(true) },
  ];

  // 新增動作本身已經會 setSelectedIds([id]) 自動選取剛插入的物件，選單關閉後 panelRight 自然接著顯示新物件的屬性表單。
  const handleSelect = (onSelect: () => void) => {
    onSelect();
    setIsShapePickerOpen(false);
  };

  return (
    <div className={styles.picker}>
      {options.map((option) => (
        <ButtonUI
          key={option.id}
          name={option.name}
          icon={<option.icon size={20} />}
          selectedStyle="template"
          width="100%"
          height={60}
          onClick={() => handleSelect(option.onSelect)}
        />
      ))}
    </div>
  );
}
