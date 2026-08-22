export interface RectShape {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

// 沒有 width/height：Konva.Text 不給 width 時會依內容（含 "\n" 換行）自動算寬高，
// 縮放只透過 fontSize 處理（見 useShapeSelection 的 handleTransformEnd）。
export interface TextShape {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
}

// src 存 base64 data URL（不是 URL.createObjectURL 的 blob URL），
// 這樣才能被 CanvasContext 的 getSnapshot()（JSON.stringify）正常序列化保存。
export interface ImageShape {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export type CanvasShape = RectShape | ImageShape | TextShape;

// 手寫攤平型別，不用三種 shape 的 Omit<...> 做 `&` 交集推導——物件型別交集算出來的
// 是欄位聯集（同時要求滿足所有分支），不是共同欄位，容易讓人誤會這裡有做欄位收斂。
// 這裡就是單純把三種 shape 可能用到的欄位都列成 optional，updateShape(id, { fontSize: 20 })
// 這樣呼叫很自然；代價是編譯期不會擋「幫 RectShape 傳 fontSize」這種邏輯錯誤，
// 這次接受這個 runtime 責任的妥協，不做更嚴謹的 discriminated patch 泛型。
export type ShapePatch = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text: string;
  fontSize: number;
  src: string;
}>;

export interface CanvasSnapshot {
  shapes: CanvasShape[];
  canvasWidth: number;
  canvasHeight: number;
}
