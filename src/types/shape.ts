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
  opacity: number; // 0~100 整數百分比，渲染到 Konva 時除以 100
  lockAspectRatio: boolean; // 縮放時是否鎖定寬高比
  groupId?: string; // 有值代表被鎖定進某個圖層群組
  stroke: string; // 邊框顏色
  strokeWidth: number; // 邊框粗度
  strokeEnabled: boolean; // 是否顯示邊框，取代原本用 strokeWidth: 0 表示不顯示的隱性寫法
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
  opacity: number;
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
  opacity: number;
  lockAspectRatio: boolean; // 縮放時是否鎖定寬高比
  groupId?: string;
}

// 圓形（存 width/height 可獨立拉伸成橢圓，x/y 是中心點）
export interface CircleShape {
  id: string;
  type: "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rotation: number;
  opacity: number;
  lockAspectRatio: boolean; // 縮放時是否鎖定寬高比
  groupId?: string;
  stroke: string; // 邊框顏色
  strokeWidth: number; // 邊框粗度
  strokeEnabled: boolean; // 是否顯示邊框，取代原本用 strokeWidth: 0 表示不顯示的隱性寫法
}

// 三角形（Konva.RegularPolygon，sides 固定 3，存 width/height 可獨立拉伸成不等邊，x/y 是中心點）
export interface TriangleShape {
  id: string;
  type: "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rotation: number;
  opacity: number;
  lockAspectRatio: boolean; // 縮放時是否鎖定寬高比
  groupId?: string;
  stroke: string; // 邊框顏色
  strokeWidth: number; // 邊框粗度
  strokeEnabled: boolean; // 是否顯示邊框，取代原本用 strokeWidth: 0 表示不顯示的隱性寫法
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
  opacity: number;
  groupId?: string;
  stroke: string; // 邊框顏色
  strokeWidth: number; // 邊框粗度
  strokeEnabled: boolean; // 是否顯示邊框，取代原本用 strokeWidth: 0 表示不顯示的隱性寫法
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
  opacity: number;
  groupId?: string;
}

export type BrushCap = "round" | "square"; // 筆刷頭部形狀

// 一筆完成的手繪路徑（一次 mousedown→mouseup），points 是相對所屬 BrushShape 的 x/y、
// 且已經反向套用過該 shape 的 rotation 的本地座標（未旋轉座標系，Konva 畫完再由外層
// Group 的 rotation 統一轉正，見 CLAUDE.md 畫筆/橡皮擦條目）。顏色/粗度/筆刷頭/透明度都存在
// 每一筆自己身上而不是整個 BrushShape 共用一份——同一個繪畫 session 中途切換顏色/大小/
// 透明度再畫下一筆是常見操作，若只在 shape 層級存一份會讓 session 中途改過的筆畫全部跑掉樣式
export interface BrushStroke {
  points: number[];
  color: string;
  strokeWidth: number;
  cap: BrushCap;
  opacity: number; // 0~100 整數百分比，渲染到 Konva 時除以 100，畫下這一筆當下的滑桿值
}

// 畫筆自由路徑：一次「繪畫工作階段（session）」從開始到關閉工具期間畫的所有筆畫，
// 合併成的單一物件（Konva 端渲染成一個 Group，底下多個 Line，見 KonvaBoard.tsx），
// 可以整體被選取/拖曳/縮放/旋轉。橡皮擦不再產生自己的 shape/tool 類型——橡皮擦是直接
// 修改 session 草稿裡 strokes 的點資料（真的刪除點，必要時把一筆斷成兩筆），不使用
// globalCompositeOperation: destination-out 疊加遮罩（見 CLAUDE.md 這輪的變更說明）
export interface BrushShape {
  id: string;
  type: "brush";
  x: number;
  y: number;
  strokes: BrushStroke[];
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
  opacity: number;
  groupId: string;
  lockAspectRatio: boolean;
  size: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  strokeEnabled: boolean;
  dash: number[];
  strokes: BrushStroke[];
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
  canvasBackgroundColor: string;
}
