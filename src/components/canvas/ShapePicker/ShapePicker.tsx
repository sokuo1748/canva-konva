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

// Shape 按鈕點下去後顯示的圖形選單
export function ShapePicker() {
  const { addSquare, addCircle, addTriangle, addStar, addLine, setIsShapePickerOpen } = useCanvas();

  const options: ShapePickerOption[] = [
    { id: "square", name: "Square", icon: SHAPE_TYPE_ICONS.rect, onSelect: addSquare }, // 新增正方形
    { id: "circle", name: "Circle", icon: SHAPE_TYPE_ICONS.circle, onSelect: addCircle }, // 新增圓形
    { id: "triangle", name: "Triangle", icon: SHAPE_TYPE_ICONS.triangle, onSelect: addTriangle }, // 新增三角形
    { id: "star", name: "Star", icon: SHAPE_TYPE_ICONS.star, onSelect: addStar }, // 新增星形
    { id: "line", name: "Line", icon: SHAPE_TYPE_ICONS.line, onSelect: () => addLine(false) }, // 新增直線
    { id: "dashedLine", name: "Dashed Line", icon: IconLineDashed, onSelect: () => addLine(true) }, // 新增虛線
  ];

  // 新增物件後關閉選單
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
