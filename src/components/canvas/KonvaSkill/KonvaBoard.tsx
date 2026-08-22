"use client";

import { useCallback, useEffect, useState } from "react";
import { Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../../../context/CanvasContext";
import { useShapeSelection } from "../../../hooks/useShapeSelection";
import { URLImage } from "./URLImage";

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const SCALE_BY = 1.05;
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

      // 容器比畫布小時，用固定 scale=1 置中會讓白色畫布蓋滿整個容器、
      // 看不到黑色底色。改成算出「完整放得下」的縮放比例（並留一點邊），
      // 這樣不管視窗多大，四周都看得到黑底，畫布邊界才分得出來。
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
    // canvasWidth/canvasHeight 本身變動（畫布尺寸被改）時也要重新 fit，不只容器 resize 時。
  }, [containerRef, canvasWidth, canvasHeight]);

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;

      const oldScale = scale;
      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const nextScale = direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY;
      const clampedScale = Math.min(Math.max(nextScale, MIN_SCALE), MAX_SCALE);

      setScale(clampedScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
    },
    [scale, stagePos],
  );

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
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
            // 這塊白色 Rect 是畫布本體（純背景，不是可選取物件）。不設 listening={false}
            // 的話，點在它上面（也就是視覺上的「畫布空白處」）時 e.target 會是這個 Rect
            // 而不是 Stage，handleStageMouseDown 判斷「點到 Stage 本身」就會失效，
            // 點空白處反而取消不了選取。listening={false} 讓事件穿透給 Stage。
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
                width={shape.width}
                height={shape.height}
                fill={shape.fill}
                {...commonHandlers}
              />
            );
          })}
          {/* RectShape/TextShape/ImageShape 都沒有 rotation 欄位，handleTransformEnd
              也沒有讀寫它——旋轉後 Konva node 當下看起來會轉，但狀態沒存到 shapes 裡，
              之後任何觸發 re-render 的操作都會讓角度悄悄消失。目前階段先關掉旋轉，
              避免「看起來能用、實際上沒存到」；之後要支援旋轉時，三種 shape 型別跟
              handleTransformEnd 都要一起補上 rotation。 */}
          <Transformer ref={transformerRef} rotateEnabled={false} />
        </Layer>
      </Stage>
    </div>
  );
}
