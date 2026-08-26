import {
  IconBrush,
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

// shape.type 對應的圖示，給 LayersPanel/ShapePicker 共用
export const SHAPE_TYPE_ICONS: Record<CanvasShape["type"], TablerIconComponent> = {
  rect: IconSquare,
  text: IconTypography,
  image: IconPhoto,
  circle: IconCircle,
  triangle: IconTriangle,
  star: IconStar,
  line: IconLine,
  brush: IconBrush,
};
