import type { BrushCap } from "../types/shape";

export interface Point {
  x: number;
  y: number;
}

// 切割後的一段倖存筆畫，錨點永遠是該段第一個點，rotation 內含在絕對座標裡固定為 0
export interface ErasedBrushSegment {
  x: number;
  y: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  cap: BrushCap;
}

interface BrushLikeShape {
  x: number;
  y: number;
  points: number[];
  stroke: string;
  strokeWidth: number;
  cap: BrushCap;
  rotation: number;
}

export interface EraseBrushStrokeResult {
  changed: boolean; // false 代表完全沒被擦到，呼叫端應維持原本的物件參考
  segments: ErasedBrushSegment[]; // changed 為 true 時，切割後倖存的段落（可能是空陣列＝整筆刪除）
}

// 把本地座標點依 rotation（角度）換算成世界座標，rotation 是繞節點原點（0,0）旋轉、再平移到 x/y
function toWorldPoints(shape: BrushLikeShape): Point[] {
  const rad = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points: Point[] = [];
  for (let i = 0; i < shape.points.length; i += 2) {
    const px = shape.points[i];
    const py = shape.points[i + 1];
    points.push({
      x: shape.x + px * cos - py * sin,
      y: shape.y + px * sin + py * cos,
    });
  }
  return points;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 點到線段（a-b）的最短距離，而不是只比對線段兩端點——避免橡皮擦路徑取樣點間距較大
// （mousemove 觸發間隔、移動速度影響取樣密度，只保證相鄰取樣點「至少」間隔 MIN_POINT_DISTANCE，
// 沒有上限）時，視覺上明明落在線段中段的擦除範圍卻因為離最近取樣點太遠而被誤判成沒擦到
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return distance(point, a); // a、b 重合，退化成點對點距離

  // 把 point 投影到 a-b 所在直線上，t 落在 [0, 1] 之間才算落在線段範圍內，超出則夾回端點
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
  const projection: Point = { x: a.x + t * abx, y: a.y + t * aby };
  return distance(point, projection);
}

// 判斷一個世界座標點是否落在橡皮擦路徑「附近」：對路徑上每一段相鄰取樣點構成的線段
// 算最短距離，而不是只比對取樣點本身，才能涵蓋線段中段（見 distanceToSegment 的說明）
function isNearEraserPath(point: Point, eraserPath: Point[], threshold: number): boolean {
  if (eraserPath.length === 1) return distance(point, eraserPath[0]) <= threshold;
  for (let i = 0; i < eraserPath.length - 1; i += 1) {
    if (distanceToSegment(point, eraserPath[i], eraserPath[i + 1]) <= threshold) return true;
  }
  return false;
}

// 把一筆既有畫筆筆畫依橡皮擦路徑做資料層級擦除：判斷每個點是否被擦到，
// 依「保留/擦除」切成連續倖存區間，每段變成一個獨立的新筆畫（本地座標系重新以該段第一個點為錨點）。
// 完全沒被擦到時回傳 changed: false，呼叫端應維持原物件參考（不產生新 id，符合 undo history 的
// immutable 更新慣例）；完全被擦光時回傳 changed: true 且 segments 為空陣列。
export function eraseBrushStroke(
  shape: BrushLikeShape,
  eraserPath: Point[],
  eraserSize: number,
): EraseBrushStrokeResult {
  if (eraserPath.length === 0 || shape.points.length < 2) {
    return { changed: false, segments: [] };
  }

  const threshold = eraserSize / 2 + shape.strokeWidth / 2;
  const worldPoints = toWorldPoints(shape);
  const erasedFlags = worldPoints.map((point) => isNearEraserPath(point, eraserPath, threshold));

  if (!erasedFlags.some(Boolean)) {
    return { changed: false, segments: [] };
  }

  // 依「保留/擦除」切出連續倖存區間（每個區間是原始 worldPoints 的 index 列表）
  const runs: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < worldPoints.length; i += 1) {
    if (erasedFlags[i]) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push(i);
    }
  }
  if (current.length > 0) runs.push(current);

  // 只剩 1 個點的區間沒必要產生一條退化線段，直接捨棄
  const segments: ErasedBrushSegment[] = runs
    .filter((run) => run.length >= 2)
    .map((run) => {
      const anchor = worldPoints[run[0]];
      const points: number[] = [];
      for (const index of run) {
        points.push(worldPoints[index].x - anchor.x, worldPoints[index].y - anchor.y);
      }
      return {
        x: anchor.x,
        y: anchor.y,
        points,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        cap: shape.cap,
      };
    });

  return { changed: true, segments };
}
