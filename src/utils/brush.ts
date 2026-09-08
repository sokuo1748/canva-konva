import type { BrushStroke } from "../types/shape";

// 一個 stroke 至少要有兩個點（4 個數字）才能畫成一條可見的 Konva.Line；縮放/擦除後
// 任何不足這個長度的殘留段一律捨棄，維持「絕不留下詭異殘留點」的既有精神（見 CLAUDE.md）
const MIN_STROKE_POINT_COUNT = 4;

function isValidStrokePoints(points: number[]): boolean {
  return points.length >= MIN_STROKE_POINT_COUNT;
}

// 把 Stage 相對座標（畫布座標系）轉成畫筆 session 的本地座標：先減去 session 原點位移，
// 再反向套用 rotation。Konva 是先用本地座標畫完 path，才由外層 Group 套用 rotation，
// 所以記錄下來的點必須是「未旋轉」的本地座標——正在編輯一個本身已經有旋轉角度的既有
// BrushShape 時，新畫的/被擦的點都要先轉換回這個座標系，不然畫出來的方向會跟游標對不上
export function toSessionLocalPoint(
  pos: { x: number; y: number },
  origin: { x: number; y: number },
  rotationDeg: number,
): { x: number; y: number } {
  const dx = pos.x - origin.x;
  const dy = pos.y - origin.y;
  if (rotationDeg === 0) return { x: dx, y: dy };
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

// Transformer 縮放結束後，把 scaleX/scaleY 套用到每一筆 stroke 的所有座標點，邏輯跟
// useShapeSelection.ts 對單一 Line 的 points 縮放一致，只是要迴圈套用到多筆 stroke。
// 縮放後點數不足以構成一條線的 stroke 直接捨棄——跟 Line 那種「只有兩個端點」不同，
// 畫筆筆畫是任意多點的手繪路徑，沒有單一「長度」可以硬 clamp 回一個假的最小值，
// 捨棄比硬湊一個座標更符合「使用者確實把它縮到看不見」的直覺
export function scaleStrokes(strokes: BrushStroke[], scaleX: number, scaleY: number): BrushStroke[] {
  return strokes
    .map((stroke) => ({
      ...stroke,
      points: stroke.points.map((p, i) => Math.round(i % 2 === 0 ? p * scaleX : p * scaleY)),
    }))
    .filter((stroke) => isValidStrokePoints(stroke.points));
}

// 橡皮擦核心：把落在 center 半徑 radius 內的點從每一筆 stroke 移除；一個 stroke 中間
// 被挖空時斷成兩個獨立 stroke（不能讓斷開的兩段被誤連成一直線）。用點對點距離判斷，
// 不是線段對點距離——筆畫記錄時已經用 MIN_POINT_DISTANCE（見 useFreehandDraw.ts）密集
// 取樣，逐點檢查已經有足夠精細度，不需要再算線段最近距離這種較貴的運算
export function eraseStrokesAtPoint(
  strokes: BrushStroke[],
  center: { x: number; y: number },
  radius: number,
): BrushStroke[] {
  const result: BrushStroke[] = [];
  for (const stroke of strokes) {
    let current: number[] = [];
    for (let i = 0; i < stroke.points.length; i += 2) {
      const x = stroke.points[i];
      const y = stroke.points[i + 1];
      const inside = Math.hypot(x - center.x, y - center.y) <= radius;
      if (inside) {
        if (isValidStrokePoints(current)) result.push({ ...stroke, points: current });
        current = [];
      } else {
        current.push(x, y);
      }
    }
    if (isValidStrokePoints(current)) result.push({ ...stroke, points: current });
  }
  return result;
}

// 橡皮擦上限，避免單次 sweep 取樣數量在極端拖曳距離下失控
const MAX_ERASE_SAMPLES = 200;

// 沿著 from -> to 的路徑取樣多個中心點依序呼叫 eraseStrokesAtPoint，避免滑鼠移動快時
// 兩次 mousemove 之間「跳過」一截沒被擦到（tunneling）。取樣間距用半徑的一半，
// 保證相鄰兩個取樣圓之間至少有重疊
export function eraseStrokesAlongPath(
  strokes: BrushStroke[],
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radius: number,
): BrushStroke[] {
  if (!from) return eraseStrokesAtPoint(strokes, to, radius);

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.max(radius / 2, 1);
  const sampleCount = Math.min(Math.ceil(distance / step), MAX_ERASE_SAMPLES);

  let current = strokes;
  for (let i = 1; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    current = eraseStrokesAtPoint(current, point, radius);
  }
  return current;
}

// 編輯模式收尾時，判斷這次編輯有沒有真的改動任何東西——沒改動就不推無意義的 history entry，
// 跟專案既有 reorderShapes/lockShapes 的「靜默 no-op」慣例一致。單一 session 的筆畫數量
// 通常不大，用 JSON.stringify 比較即可，不需要手刻逐欄位 diff
export function areStrokesEqual(a: BrushStroke[], b: BrushStroke[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
