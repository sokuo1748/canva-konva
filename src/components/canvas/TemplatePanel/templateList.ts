import { IconFileExport } from "@tabler/icons-react";
import type { TablerIconComponent } from "../../ui/icon-map";

export interface TemplateItem {
  id: "image" | "shape" | "text";
  name: string;
  icon: TablerIconComponent;
}

// 先統一用 IconFileExport 當佔位 icon，之後要分別換掉時只改這裡。
export const templateList: TemplateItem[] = [
  { id: "image", name: "Image", icon: IconFileExport },
  { id: "shape", name: "Shape", icon: IconFileExport },
  { id: "text", name: "Text", icon: IconFileExport },
];
