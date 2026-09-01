// 一般 shape 尺寸/字級下限
export const MIN_SHAPE_SIZE = 1;
export const MIN_FONT_SIZE = 8;

// 畫筆/橡皮擦大小上下限，各自獨立
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 100;
export const MIN_ERASER_SIZE = 1;
export const MAX_ERASER_SIZE = 150;

// 橡皮擦筆畫顏色，視覺上不重要（destination-out 合成看不到顏色）
export const ERASER_STROKE_COLOR = "#000000";

// 畫布尺寸上下限
export const MIN_CANVAS_SIZE = 100;
export const MAX_CANVAS_SIZE = 4000;

// 透明度：0~100 整數百分比，渲染到 Konva 時再除以 100
export const MIN_OPACITY = 0;
export const MAX_OPACITY = 100;
