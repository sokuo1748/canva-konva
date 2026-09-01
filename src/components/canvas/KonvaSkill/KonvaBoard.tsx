"use client";

import { useEffect, useState } from "react";
import { Circle, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../../../context/CanvasContext";
import { useShapeSelection } from "../../../hooks/useShapeSelection";
import { useFreehandDraw } from "../../../hooks/useFreehandDraw";
import type { CanvasShape } from "../../../types/shape";
import { ERASER_STROKE_COLOR } from "../../../constants/shapeConstraints";
import { URLImage } from "./URLImage";

// ResizeObserver 的 fit-scale 上下限
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
// 讓畫布完整落在容器內時四周留一點邊
const FIT_PADDING_RATIO = 0.9;

interface LayerRun {
  shapes: CanvasShape[];
  isBrush: boolean;
}

// 把 shapes[] 依是否為畫筆切成連續區段，每段各自渲染成一個獨立 Konva Layer，讓畫筆塗層能交錯排序
function buildLayerRuns(shapes: CanvasShape[]): LayerRun[] {
  const runs: LayerRun[] = [];
  for (const shape of shapes) {
    const isBrush = shape.type === "brush";
    const last = runs[runs.length - 1];
    if (last && last.isBrush === isBrush) {
      last.shapes.push(shape);
    } else {
      runs.push({ shapes: [shape], isBrush });
    }
  }
  return runs;
}

export function KonvaBoard() {
  const {
    shapes,
    canvasWidth,
    canvasHeight,
    containerRef,
    stageRef,
    overlayLayerRef,
    activeTool,
    brushColor,
    brushSize,
    brushCap,
    eraserSize,
  } = useCanvas();
  const {
    marqueeRect,
    transformerRef,
    registerShapeRef,
    handleSelect,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTransformEnd,
  } = useShapeSelection();
  const {
    previewStroke,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
  } = useFreehandDraw();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // 依容器尺寸即時計算畫布的 fit-scale 與置中位置
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });

      const fitScale = Math.min(
        (width / canvasWidth) * FIT_PADDING_RATIO,
        (height / canvasHeight) * FIT_PADDING_RATIO,
      );
      const clampedFitScale = Math.min(Math.max(fitScale, MIN_SCALE), MAX_SCALE);

      setScale(clampedFitScale);
      setStagePos({
        x: (width - canvasWidth * clampedFitScale) / 2,
        y: (height - canvasHeight * clampedFitScale) / 2,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, canvasWidth, canvasHeight]);

  // select 模式走選取/框選邏輯；brush/eraser 模式走自由繪圖邏輯，兩者互斥
  const isDrawMode = activeTool !== "select";

  // 一般 shape 跟畫筆筆畫共用的事件組裝
  const buildCommonHandlers = (id: string) => ({
    draggable: !isDrawMode, // 畫筆模式下停用拖曳/選取
    onClick: isDrawMode ? undefined : (e: KonvaEventObject<MouseEvent>) => handleSelect(id, e),
    onDragStart: handleDragStart(id),
    onDragMove: handleDragMove(id),
    onDragEnd: handleDragEnd(id),
    onTransformEnd: handleTransformEnd(id),
  });

  const layerRuns = buildLayerRuns(shapes);
  // 新筆畫會併入最後一個區段（如果它是畫筆類型），預覽線要畫在同一層，橡皮擦擦除效果才會即時可見
  const lastRunIsBrush = layerRuns.length > 0 && layerRuns[layerRuns.length - 1].isBrush;

  // 進行中、尚未提交的畫筆/橡皮擦預覽線
  const previewLine = previewStroke && (
    <Line
      x={previewStroke.x}
      y={previewStroke.y}
      points={previewStroke.points}
      stroke={activeTool === "eraser" ? ERASER_STROKE_COLOR : brushColor}
      strokeWidth={activeTool === "eraser" ? eraserSize : brushSize}
      lineCap={activeTool === "eraser" || brushCap === "round" ? "round" : "square"}
      lineJoin={activeTool === "eraser" || brushCap === "round" ? "round" : "miter"}
      globalCompositeOperation={activeTool === "eraser" ? "destination-out" : "source-over"}
      listening={false}
    />
  );

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: isDrawMode ? "crosshair" : undefined }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={isDrawMode ? handleDrawMouseDown : handleStageMouseDown}
        onMouseMove={isDrawMode ? handleDrawMouseMove : handleStageMouseMove}
        onMouseUp={isDrawMode ? handleDrawMouseUp : handleStageMouseUp}
      >
        {/* 背景層：永遠最底層，listening={false} 讓點擊穿透給 Stage 判斷「點到空白處」 */}
        <Layer>
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="#ffffff"
            stroke="#d1d5db"
            strokeWidth={1}
            listening={false}
          />
        </Layer>

        {/* 依陣列順序把一般 shape/畫筆筆畫的連續區段各自拆成一個 Layer，讓圖層排序能真實反映到畫面 */}
        {layerRuns.map((run, index) => (
          // key 用領頭 shape id，不是陣列 index，避免交錯排序時圖片被誤判成新節點而重新載入閃爍
          <Layer key={run.shapes[0].id}>
            {run.shapes.map((shape) => {
              const commonHandlers = buildCommonHandlers(shape.id);

              if (shape.type === "brush") {
                return (
                  <Line
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    name="freehand" // 跟一般直線區分控點樣式
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    lineCap={shape.cap === "round" ? "round" : "square"}
                    lineJoin={shape.cap === "round" ? "round" : "miter"}
                    globalCompositeOperation={shape.tool === "eraser" ? "destination-out" : "source-over"}
                    strokeScaleEnabled={false}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "text") {
                return (
                  <Text
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    text={shape.text}
                    fontSize={shape.fontSize}
                    fill={shape.fill}
                    fontStyle={shape.bold ? "bold" : "normal"}
                    textDecoration={[shape.underline && "underline", shape.strikethrough && "line-through"]
                      .filter(Boolean)
                      .join(" ")}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "image") {
                return (
                  <URLImage
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    shape={shape}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "circle") {
                return (
                  <Circle
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    radius={shape.size / 2}
                    fill={shape.fill}
                    stroke={shape.strokeEnabled ? shape.stroke : undefined}
                    strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                    strokeScaleEnabled={false} // 避免縮放時邊框粗細跟著視覺拉伸
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "triangle") {
                return (
                  <RegularPolygon
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    sides={3}
                    radius={shape.size / 2}
                    fill={shape.fill}
                    stroke={shape.strokeEnabled ? shape.stroke : undefined}
                    strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                    strokeScaleEnabled={false}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "star") {
                return (
                  <Star
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    numPoints={5}
                    innerRadius={shape.size / 4}
                    outerRadius={shape.size / 2}
                    fill={shape.fill}
                    stroke={shape.strokeEnabled ? shape.stroke : undefined}
                    strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                    strokeScaleEnabled={false}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "line") {
                return (
                  <Line
                    key={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    dash={shape.dash}
                    strokeScaleEnabled={false} // 避免縮放時筆畫粗細跟著視覺拉伸
                    {...commonHandlers}
                  />
                );
              }

              return (
                <Rect
                  key={shape.id}
                  ref={registerShapeRef(shape.id)}
                  x={shape.x}
                  y={shape.y}
                  rotation={shape.rotation}
                  width={shape.width}
                  height={shape.height}
                  fill={shape.fill}
                  cornerRadius={shape.cornerRadius}
                  stroke={shape.strokeEnabled ? shape.stroke : undefined}
                  strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                  strokeScaleEnabled={false} // 避免縮放時邊框粗細跟著視覺拉伸
                  {...commonHandlers}
                />
              );
            })}
            {/* 最後一個區段是畫筆類型時，預覽線畫在這裡跟真正內容同一層 */}
            {index === layerRuns.length - 1 && lastRunIsBrush && previewLine}
          </Layer>
        ))}

        {/* UI 覆蓋層：永遠最上層，放框選提示/Transformer/畫筆預覽線，匯出前會暫時隱藏 */}
        <Layer ref={overlayLayerRef}>
          {marqueeRect && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="rgba(79, 70, 229, 0.08)"
              stroke="#4f46e5"
              dash={[4, 4]}
              listening={false}
            />
          )}
          {!lastRunIsBrush && previewLine}
          <Transformer ref={transformerRef} rotateEnabled />
        </Layer>
      </Stage>
    </div>
  );
}
