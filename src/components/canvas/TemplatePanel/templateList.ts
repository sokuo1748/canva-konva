import { IconBrush, IconPhoto, IconSquare, IconTypography } from "@tabler/icons-react";
import type { TablerIconComponent } from "../../ui/icon-map";

export interface TemplateItem {
  id: "image" | "shape" | "text" | "paint";
  name: string;
  icon: TablerIconComponent;
}

// panelLeft 底部新增物件按鈕清單
export const templateList: TemplateItem[] = [
  { id: "image", name: "Image", icon: IconPhoto },
  { id: "shape", name: "Shape", icon: IconSquare },
  { id: "text", name: "Text", icon: IconTypography },
  { id: "paint", name: "Paint", icon: IconBrush },
];
