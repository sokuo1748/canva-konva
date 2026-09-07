import type { CanvasShape } from "../types/shape";
import type { Rect } from "./geometry";

// 對齊模式：完整 3x3 方位（水平 left/center/right x 垂直 top/center/bottom 兩兩組合），
// 給 AlignButtons / alignShapes 共用，CanvasContext.tsx 直接 re-export 這個型別對外曝露
export type AlignMode =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

// 把 AlignMode 拆成水平/垂直兩個獨立分量，方便分別算位移量
export function decomposeAlignMode(mode: AlignMode): {
  h: "left" | "center" | "right";
  v: "top" | "center" | "bottom";
} {
  switch (mode) {
    case "top-left":
      return { h: "left", v: "top" };
    case "top":
      return { h: "center", v: "top" };
    case "top-right":
      return { h: "right", v: "top" };
    case "left":
      return { h: "left", v: "center" };
    case "center":
      return { h: "center", v: "center" };
    case "right":
      return { h: "right", v: "center" };
    case "bottom-left":
      return { h: "left", v: "bottom" };
    case "bottom":
      return { h: "center", v: "bottom" };
    case "bottom-right":
      return { h: "right", v: "bottom" };
  }
}

// 依包圍盒跟畫布尺寸，算出對齊到指定方位所需的位移量；位移量對任何 shape 的 x/y
// 錨點語意都通用（rect 左上角／circle-triangle-star 中心點／line 線段起點皆可直接套用）
export function computeAlignDelta(
  rect: Rect,
  mode: AlignMode,
  canvasWidth: number,
  canvasHeight: number,
): { deltaX: number; deltaY: number } {
  const { h, v } = decomposeAlignMode(mode);
  let deltaX = 0;
  let deltaY = 0;
  switch (h) {
    case "left":
      deltaX = -rect.x;
      break;
    case "center":
      deltaX = (canvasWidth - rect.width) / 2 - rect.x;
      break;
    case "right":
      deltaX = canvasWidth - (rect.x + rect.width);
      break;
  }
  switch (v) {
    case "top":
      deltaY = -rect.y;
      break;
    case "center":
      deltaY = (canvasHeight - rect.height) / 2 - rect.y;
      break;
    case "bottom":
      deltaY = canvasHeight - (rect.y + rect.height);
      break;
  }
  return { deltaX, deltaY };
}

// 找不到對應 Konva node 時（例如圖片還沒載入完成）的 fallback：直接用 shape 自己的資料
// 算出一個「邏輯包圍盒」取代 node.getClientRect()。不考慮 rotation——fallback 情境通常是
// 剛新增、rotation 還是預設值 0，先不做旋轉換算，合理簡化（見 CLAUDE.md 對齊功能條目）。
// text 沒有明確的 width/height 欄位，沒有合理近似值，維持回傳 null（跳過，不強行處理）。
export function getShapeLogicalRect(shape: CanvasShape): Rect | null {
  switch (shape.type) {
    case "rect":
    case "image":
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case "circle":
    case "triangle":
      return {
        x: shape.x - shape.width / 2,
        y: shape.y - shape.height / 2,
        width: shape.width,
        height: shape.height,
      };
    case "star":
      return {
        x: shape.x - shape.size / 2,
        y: shape.y - shape.size / 2,
        width: shape.size,
        height: shape.size,
      };
    case "line":
    case "brush": {
      if (shape.points.length < 2) return null;
      const xs = shape.points.filter((_, index) => index % 2 === 0);
      const ys = shape.points.filter((_, index) => index % 2 === 1);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: shape.x + minX, y: shape.y + minY, width: maxX - minX, height: maxY - minY };
    }
    case "text":
      return null;
  }
}

// 多個包圍盒的聯集，給鎖定分組整體對齊用（先算整組的聯集包圍盒，再對這個聯集算位移量）
export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
