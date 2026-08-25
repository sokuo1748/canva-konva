"use client";

import { useEffect, useState } from "react";
import { Circle, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../../../context/CanvasContext";
import { useShapeSelection } from "../../../hooks/useShapeSelection";
import { URLImage } from "./URLImage";

// 滑鼠滾輪縮放已停用，這兩個常數只給 ResizeObserver 的 fit-scale 邏輯當上下限用。
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
// 讓 800x800 畫布完整落在容器內時，四周留一點空間，這樣才看得到 canvas 的黑底邊界。
const FIT_PADDING_RATIO = 0.9;

export function KonvaBoard() {
  const { shapes, canvasWidth, canvasHeight, containerRef } = useCanvas();
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });

      // 算出讓畫布完整放進容器並留一點邊的縮放比例，避免蓋滿容器看不到底色。
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
    // canvasWidth/canvasHeight 變動時也要重新 fit，不只容器 resize 時。
  }, [containerRef, canvasWidth, canvasHeight]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="#ffffff"
            stroke="#d1d5db"
            strokeWidth={1}
            // 純背景 Rect，listening={false} 讓點擊穿透給 Stage 才能正確判斷「點到空白處」。
            listening={false}
          />
          {shapes.map((shape) => {
            const commonHandlers = {
              draggable: true,
              onClick: (e: KonvaEventObject<MouseEvent>) => handleSelect(shape.id, e),
              onDragStart: handleDragStart(shape.id),
              onDragMove: handleDragMove(shape.id),
              onDragEnd: handleDragEnd(shape.id),
              onTransformEnd: handleTransformEnd(shape.id),
            };

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
                  // Konva 用 .indexOf('underline')/.indexOf('line-through') 判斷，空白分隔可以同時套用兩種。
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

            // circle/triangle/star 直接傳 radius/innerRadius/outerRadius，不透過 width/height 這層便利介面繞。
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
                  // Konva 預設縮放時筆畫粗細會跟著視覺拉伸，關掉這個讓拖曳中筆畫粗細維持恆定，跟放開後一致。
                  strokeScaleEnabled={false}
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
                {...commonHandlers}
              />
            );
          })}
          {marqueeRect && (
            // 框選中的視覺提示，純視覺不接事件；放開滑鼠後（見 handleStageMouseUp）就會消失。
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
          <Transformer ref={transformerRef} rotateEnabled />
        </Layer>
      </Stage>
    </div>
  );
}
