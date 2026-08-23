"use client";

import { useEffect, useState } from "react";
import { Layer, Rect, Stage, Text, Transformer } from "react-konva";
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
    transformerRef,
    registerShapeRef,
    handleSelect,
    handleStageMouseDown,
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
              onClick: () => handleSelect(shape.id),
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
          <Transformer ref={transformerRef} rotateEnabled />
        </Layer>
      </Stage>
    </div>
  );
}
