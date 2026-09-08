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

// 一段 segment（P1 -> P2）跟橡皮擦圓形邊界的相交參數 t（0~1 之間，NaN 代表無解）。
// 用參數式 P(t) = P1 + t*(P2-P1) 代入 |P(t) - center|^2 = r^2，展開成一元二次方程式
// a*t^2 + b*t + c = 0 求解；回傳依 t 由小到大排序好的交點陣列（0、1 或 2 個）
function circleSegmentIntersections(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  center: { x: number; y: number },
  r: number,
): number[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;

  const a = dx * dx + dy * dy;
  if (a === 0) return []; // 退化 segment（兩端點重合），交給外層的「單點是否在圓內」判斷處理

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return []; // 整條線（無限延伸）都不碰圓，segment 自然也不碰

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  return [t1, t2].filter((t) => t > 0 && t < 1);
}

function pointAt(p1: { x: number; y: number }, p2: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function isInsideCircle(p: { x: number; y: number }, center: { x: number; y: number }, r: number): boolean {
  return Math.hypot(p.x - center.x, p.y - center.y) <= r;
}

// 橡皮擦核心：把每一筆 stroke 跟橡皮擦圓形幾何相交的部分精確挖除，而不是只看記錄點
// 是否落在圓內。有效半徑會把該筆畫自己的 strokeWidth 算進去（Konva 畫出來的線是以記錄點
// 為中心線、往兩側各延伸 strokeWidth/2 的實際墨跡，橡皮擦圓形要完全蓋過這個視覺寬度才算
// 真的擦到），並對相鄰兩點構成的每個 segment 個別跟圓形邊界求交點，保留圓外部分、
// 在交點處插入精確座標當新端點，讓切口落在圓形邊界上、而不是隨機卡在某個記錄點。
// 沿途一旦出現被挖空的間隙就把後續的點斷成新的獨立 stroke（不能讓斷開的兩段被誤連成一直線）
export function eraseStrokesAtPoint(
  strokes: BrushStroke[],
  center: { x: number; y: number },
  radius: number,
): BrushStroke[] {
  const result: BrushStroke[] = [];

  for (const stroke of strokes) {
    const effectiveRadius = radius + stroke.strokeWidth / 2;
    let current: number[] = [];

    const flush = () => {
      if (isValidStrokePoints(current)) result.push({ ...stroke, points: current });
      current = [];
    };

    const pushPoint = (p: { x: number; y: number }) => {
      current.push(p.x, p.y);
    };

    const pointCount = stroke.points.length / 2;
    if (pointCount === 0) continue;

    // 只有一個點的退化 stroke：直接看這個點在不在圓內
    if (pointCount === 1) {
      const p = { x: stroke.points[0], y: stroke.points[1] };
      if (!isInsideCircle(p, center, effectiveRadius)) pushPoint(p);
      flush();
      continue;
    }

    let prevInside = isInsideCircle({ x: stroke.points[0], y: stroke.points[1] }, center, effectiveRadius);
    if (!prevInside) pushPoint({ x: stroke.points[0], y: stroke.points[1] });

    for (let i = 0; i < pointCount - 1; i += 1) {
      const p1 = { x: stroke.points[i * 2], y: stroke.points[i * 2 + 1] };
      const p2 = { x: stroke.points[i * 2 + 2], y: stroke.points[i * 2 + 3] };
      const p2Inside = isInsideCircle(p2, center, effectiveRadius);

      const intersections = circleSegmentIntersections(p1, p2, center, effectiveRadius);

      if (intersections.length === 0) {
        // 整段都在圓外或整段都在圓內（沒有跨越邊界）
        if (!p2Inside) pushPoint(p2);
        else if (!prevInside) {
          // p1 在圓外、p2 在圓內，但沒解出交點（數值邊界情況），保守斷開避免誤連
          flush();
        }
      } else if (intersections.length === 1) {
        // 只有一端在圓內的情況：交點就是切口
        const cut = pointAt(p1, p2, intersections[0]);
        if (prevInside && !p2Inside) {
          // 從圓內離開圓外：這是新一段的起點
          pushPoint(cut);
          pushPoint(p2);
        } else {
          // 從圓外進入圓內：在交點斷開
          pushPoint(cut);
          flush();
        }
      } else {
        // 兩個交點都落在 (0,1) 之間：整段完全跨過圓形，中間被挖空
        const [tEnter, tExit] = intersections;
        pushPoint(pointAt(p1, p2, tEnter));
        flush();
        pushPoint(pointAt(p1, p2, tExit));
        pushPoint(p2);
      }

      prevInside = p2Inside;
    }

    flush();
  }

  return result;
}

// 橡皮擦上限，避免單次 sweep 取樣數量在極端拖曳距離下失控
const MAX_ERASE_SAMPLES = 200;

// 沿著 from -> to 的路徑取樣多個中心點依序呼叫 eraseStrokesAtPoint，避免滑鼠移動快時
// 兩次 mousemove 之間「跳過」一截沒被擦到（tunneling）。取樣間距只用橡皮擦本身的
// 原始 radius（不含任何 strokeWidth 補償）換算，保證相鄰兩個取樣圓之間至少有重疊——
// 刻意不看 strokes 裡任何一筆的 strokeWidth：同一個 session 中途切換筆刷粗細後，
// strokes 陣列會同時存在粗細差很多的筆畫，取樣密度只需要保證覆蓋橡皮擦圓本身的
// 幾何範圍就夠了（eraseStrokesAtPoint 內部本來就會對每一筆 stroke 各自用自己的
// effectiveRadius 判斷是否擦到），如果反而用某一筆的 strokeWidth 去放寬取樣間距，
// 會讓其他筆畫（尤其是更細的那些）在快速拖曳時取樣點間隙沒被掃到、殘留沒擦乾淨
// （已修過的 bug：原本誤用整個 sweep 裡「最粗」那筆的 strokeWidth 放寬 step，
// 導致又細又快的筆畫大幅漏擦）
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
