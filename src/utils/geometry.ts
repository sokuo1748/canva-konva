export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 標準矩形相交判斷，給拖框選取（marquee）用來測試每個 shape 的 client rect 有沒有跟框選範圍重疊。
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
