// 一般 shape 尺寸/字級下限
export const MIN_SHAPE_SIZE = 1;
export const MIN_FONT_SIZE = 8;

// 畫筆/橡皮擦大小上下限，各自獨立
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 100;
export const MIN_ERASER_SIZE = 1;
export const MAX_ERASER_SIZE = 150;

// 單筆畫筆/橡皮擦軌跡的取樣點數上限（每個點佔陣列兩格 x/y），避免按住不放畫很久
// 導致 points 陣列無限成長；正常使用幾乎不可能碰到，達到上限後單純不再取樣新點，
// 不會自動 commit 或分割成多筆
export const MAX_BRUSH_POINTS = 4000;


// 畫布尺寸上下限
export const MIN_CANVAS_SIZE = 100;
export const MAX_CANVAS_SIZE = 4000;

// 透明度：0~100 整數百分比，渲染到 Konva 時再除以 100
export const MIN_OPACITY = 0;
export const MAX_OPACITY = 100;
