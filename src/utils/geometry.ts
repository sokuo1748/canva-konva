export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 矩形相交判斷，給框選使用
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
