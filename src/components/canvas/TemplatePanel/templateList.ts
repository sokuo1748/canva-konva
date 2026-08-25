import { IconPhoto,IconSquare,IconTypography } from "@tabler/icons-react";
import type { TablerIconComponent } from "../../ui/icon-map";

export interface TemplateItem {
  id: "image" | "shape" | "text";
  name: string;
icon: TablerIconComponent;
}

// 先統一用 IconFileExport 當佔位 icon，之後要分別換掉時只改這裡。
export const templateList: TemplateItem[] = [
  { id: "image", name: "Image", icon: IconPhoto },
  { id: "shape", name: "Shape", icon: IconSquare },
  { id: "text", name: "Text", icon: IconTypography },
];
