export interface RectShape {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  cornerRadius: number;
  rotation: number;
  // 有值代表這個 shape 被鎖定進某個圖層群組，圖層清單會框在一起顯示、畫布拖曳同組成員會連動移動（縮放/旋轉沒有群組連動）。
  groupId?: string;
}

// 沒有 width/height：Konva.Text 依內容自動算寬高，縮放透過 fontSize 處理；bold/underline/strikethrough 不設定就是 undefined，KonvaBoard.tsx 組成 Konva 的 fontStyle/textDecoration。
export interface TextShape {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  rotation: number;
  groupId?: string;
  bold?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

// src 存 base64 data URL（不是 blob URL），才能被 getSnapshot() 正常序列化保存。
export interface ImageShape {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  rotation: number;
  groupId?: string;
}

// Circle/RegularPolygon/Star 在 Konva 裡的 width/height 都綁死同一顆半徑換算，寬高沒辦法真的獨立，只存一個 size（直徑），縮放時強制 keepRatio；x/y 是形狀中心點，不是 Rect/Image/Text 那樣的左上角。
export interface CircleShape {
  id: string;
  type: "circle";
  x: number;
  y: number;
  size: number;
  fill: string;
  rotation: number;
  groupId?: string;
}

// 三角形是 Konva.RegularPolygon（sides 固定 3，正三角形），x/y 語意跟 CircleShape 一樣是中心點。
export interface TriangleShape {
  id: string;
  type: "triangle";
  x: number;
  y: number;
  size: number;
  fill: string;
  rotation: number;
  groupId?: string;
}

// numPoints/內外半徑比例目前不開放調整（固定 5 點星，比例寫死在 KonvaBoard.tsx），x/y 語意跟 CircleShape 一樣是中心點。
export interface StarShape {
  id: string;
  type: "star";
  x: number;
  y: number;
  size: number;
  fill: string;
  rotation: number;
  groupId?: string;
}

// Konva.Line 沒有實質的 width/height，縮放要直接改 points 陣列；points 是相對 (x, y) 的本地座標，(x, y) 是線段起點；dash 沒值是實線、有值是虛線，直線跟虛線是同一個型別。
export interface LineShape {
  id: string;
  type: "line";
  x: number;
  y: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  rotation: number;
  groupId?: string;
}

export type CanvasShape = RectShape | ImageShape | TextShape | CircleShape | TriangleShape | StarShape | LineShape;

// 手寫攤平型別（不是 Omit<...> 交集推導，那樣算出來是聯集不是共同欄位），代價是編譯期不擋跨型別誤傳欄位。
export type ShapePatch = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text: string;
  fontSize: number;
  src: string;
  cornerRadius: number;
  rotation: number;
  groupId: string;
  size: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash: number[];
  bold: boolean;
  underline: boolean;
  strikethrough: boolean;
}>;

export interface CanvasSnapshot {
  shapes: CanvasShape[];
  canvasWidth: number;
  canvasHeight: number;
}
