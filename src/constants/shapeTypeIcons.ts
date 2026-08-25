import {
  IconCircle,
  IconLine,
  IconPhoto,
  IconSquare,
  IconStar,
  IconTriangle,
  IconTypography,
} from "@tabler/icons-react";
import type { TablerIconComponent } from "../components/ui/icon-map";
import type { CanvasShape } from "../types/shape";

// 依 shape.type 決定的固定對應，給 LayersPanel/ShapePicker 等多個元件共用；不用 ui/icon-map 的字串查表，這裡的 icon 完全由 CanvasShape["type"] 決定。
export const SHAPE_TYPE_ICONS: Record<CanvasShape["type"], TablerIconComponent> = {
  rect: IconSquare,
  text: IconTypography,
  image: IconPhoto,
  circle: IconCircle,
  triangle: IconTriangle,
  star: IconStar,
  line: IconLine,
};
