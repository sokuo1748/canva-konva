// 矩形
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
  groupId?: string; // 有值代表被鎖定進某個圖層群組
}

// 文字（Konva.Text 依內容自動算寬高，沒有 width/height）
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
  fontFamily?: string;
}

// 圖片（src 存 base64 data URL，才能被 getSnapshot() 序列化保存）
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

// 圓形（只存 size 直徑，x/y 是中心點）
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

// 三角形（Konva.RegularPolygon，sides 固定 3，x/y 是中心點）
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

// 星形（固定 5 點，x/y 是中心點）
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

// 直線/虛線（points 是相對 x/y 的本地座標，x/y 是線段起點，dash 有值才是虛線）
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

export type BrushToolKind = "brush" | "eraser";
export type BrushCap = "round" | "square"; // 筆刷頭部形狀

// 畫筆/橡皮擦自由路徑，tool 為 eraser 時渲染會套用 destination-out 合成擦除
export interface BrushShape {
  id: string;
  type: "brush";
  x: number;
  y: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  cap: BrushCap;
  tool: BrushToolKind;
  rotation: number;
  groupId?: string;
}

export type CanvasShape =
  | RectShape
  | ImageShape
  | TextShape
  | CircleShape
  | TriangleShape
  | StarShape
  | LineShape
  | BrushShape;

// 更新物件屬性用的攤平型別，各欄位皆為 optional
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
  cap: BrushCap;
  bold: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontFamily: string;
}>;

// undo/redo 用的畫布快照
export interface CanvasSnapshot {
  shapes: CanvasShape[];
  canvasWidth: number;
  canvasHeight: number;
}
