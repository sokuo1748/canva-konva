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
}

// 沒有 width/height：Konva.Text 依內容自動算寬高，縮放透過 fontSize 處理。
export interface TextShape {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  rotation: number;
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
}

export type CanvasShape = RectShape | ImageShape | TextShape;

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
}>;

export interface CanvasSnapshot {
  shapes: CanvasShape[];
  canvasWidth: number;
  canvasHeight: number;
}
