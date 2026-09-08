"use client";

import { useEffect, useState } from "react";
import { Circle, Group, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../../../context/CanvasContext";
import { useShapeSelection } from "../../../hooks/useShapeSelection";
import { useFreehandDraw } from "../../../hooks/useFreehandDraw";
import { DEFAULT_FONT_FAMILY } from "../../../constants/fontFamilies";
import { URLImage } from "./URLImage";

// ResizeObserver 的 fit-scale 上下限
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
// 讓畫布完整落在容器內時四周留一點邊
const FIT_PADDING_RATIO = 0.9;

// 圓形/三角形的固定 draw 半徑：Konva.Circle/RegularPolygon 的 width/height getter 都綁死同一顆半徑，
// 沒辦法直接拿 shape.width/height 兩個獨立值去畫。改成半徑永遠固定這個常數，
// 實際 width/height 全靠 scaleX/scaleY 這層變形矩陣表現（Konva 在畫完 path 之後才套用 scale，
// 所以 scaleX !== scaleY 時圓形會被拉成橢圓、正三角形會被拉成不等邊三角形，見 CLAUDE.md）。
// 數值跟 CanvasContext 的 SHAPE_DEFAULT_SIZE 一致，新增時 scaleX/scaleY 剛好都是 1。
const SHAPE_BASE_RADIUS = 50;

// 畫筆 Group 底下的每一筆 stroke 共用的 Line 渲染屬性
function brushStrokeLineProps(cap: "round" | "square") {
  return {
    lineCap: cap === "round" ? ("round" as const) : ("square" as const),
    lineJoin: cap === "round" ? ("round" as const) : ("miter" as const),
    strokeScaleEnabled: false,
  };
}

export function KonvaBoard() {
  const {
    shapes,
    canvasWidth,
    canvasHeight,
    canvasBackgroundColor,
    containerRef,
    stageRef,
    overlayLayerRef,
    activeTool,
    brushOpacity,
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
    handleDragBound,
    handleTransformEnd,
    rotateAnchorStyleFunc,
  } = useShapeSelection();
  const {
    session,
    inProgressStroke,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    enterBrushEdit,
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
    dragBoundFunc: handleDragBound(id), // 不能整個拖出畫布，見 useShapeSelection.ts
    onTransformEnd: handleTransformEnd(id),
  });

  // 草稿 session 的即時預覽內容（已完成的 strokes + 正在畫的這一筆），全新 session 用目前
  // 的 brushOpacity（即時反映滑動透明度），編輯模式固定用原本 shape 的 opacity
  const sessionPreview = session && (
    <>
      {session.strokes.map((stroke, index) => (
        <Line
          key={`stroke-${index}`}
          points={stroke.points}
          stroke={stroke.color}
          strokeWidth={stroke.strokeWidth}
          {...brushStrokeLineProps(stroke.cap)}
        />
      ))}
      {inProgressStroke && (
        <Line
          points={inProgressStroke.points}
          stroke={inProgressStroke.color}
          strokeWidth={inProgressStroke.strokeWidth}
          {...brushStrokeLineProps(inProgressStroke.cap)}
        />
      )}
    </>
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
            fill={canvasBackgroundColor}
            stroke="#000000"
            strokeWidth={2}
            listening={false}
          />
        </Layer>

        {/* 依陣列順序渲染所有 shape，clip 到畫布範圍，物件拖出畫布外時超出的部分要被裁掉看不見
            （不是限制拖曳座標本身）。橡皮擦不再靠 destination-out 疊圖層遮罩（是直接修改草稿
            資料的點，見 useFreehandDraw.ts），所以不需要再依是否為畫筆切成多個交錯的 Layer，
            單一 Layer 就能正確反映圖層順序 */}
        <Layer clipX={0} clipY={0} clipWidth={canvasWidth} clipHeight={canvasHeight}>
          {shapes.map((shape) => {
              const commonHandlers = buildCommonHandlers(shape.id);

              if (shape.type === "brush") {
                // 正在編輯這個 shape 時，改成渲染草稿 session 的即時內容（同一個位置，
                // 維持原本的圖層順序），不渲染它已提交的靜態版本，避免兩份畫面同時出現
                if (session?.editingId === shape.id) {
                  return (
                    <Group
                      key={shape.id}
                      x={session.x}
                      y={session.y}
                      rotation={session.rotation}
                      opacity={shape.opacity / 100}
                      listening={false}
                    >
                      {sessionPreview}
                    </Group>
                  );
                }

                return (
                  <Group
                    key={shape.id}
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    opacity={shape.opacity / 100}
                    onDblClick={activeTool === "select" ? () => enterBrushEdit(shape) : undefined}
                    {...commonHandlers}
                  >
                    {shape.strokes.map((stroke, index) => (
                      <Line
                        key={index}
                        points={stroke.points}
                        stroke={stroke.color}
                        strokeWidth={stroke.strokeWidth}
                        {...brushStrokeLineProps(stroke.cap)}
                      />
                    ))}
                  </Group>
                );
              }

              if (shape.type === "text") {
                return (
                  <Text
                    key={shape.id}
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    text={shape.text}
                    fontSize={shape.fontSize}
                    fontFamily={shape.fontFamily ?? DEFAULT_FONT_FAMILY}
                    fill={shape.fill}
                    fontStyle={shape.bold ? "bold" : "normal"}
                    textDecoration={[shape.underline && "underline", shape.strikethrough && "line-through"]
                      .filter(Boolean)
                      .join(" ")}
                    opacity={shape.opacity / 100}
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
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    radius={SHAPE_BASE_RADIUS}
                    scaleX={shape.width / (SHAPE_BASE_RADIUS * 2)}
                    scaleY={shape.height / (SHAPE_BASE_RADIUS * 2)}
                    fill={shape.fill}
                    stroke={shape.strokeEnabled ? shape.stroke : undefined}
                    strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                    strokeScaleEnabled={false} // 避免縮放時邊框粗細跟著視覺拉伸
                    opacity={shape.opacity / 100}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "triangle") {
                return (
                  <RegularPolygon
                    key={shape.id}
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    sides={3}
                    radius={SHAPE_BASE_RADIUS}
                    scaleX={shape.width / (SHAPE_BASE_RADIUS * 2)}
                    scaleY={shape.height / (SHAPE_BASE_RADIUS * 2)}
                    fill={shape.fill}
                    stroke={shape.strokeEnabled ? shape.stroke : undefined}
                    strokeWidth={shape.strokeEnabled ? shape.strokeWidth : undefined}
                    strokeScaleEnabled={false}
                    opacity={shape.opacity / 100}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "star") {
                return (
                  <Star
                    key={shape.id}
                    id={shape.id}
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
                    opacity={shape.opacity / 100}
                    {...commonHandlers}
                  />
                );
              }

              if (shape.type === "line") {
                return (
                  <Line
                    key={shape.id}
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    points={shape.points}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    dash={shape.dash}
                    strokeScaleEnabled={false} // 避免縮放時筆畫粗細跟著視覺拉伸
                    opacity={shape.opacity / 100}
                    {...commonHandlers}
                  />
                );
              }

              return (
                <Rect
                  key={shape.id}
                  id={shape.id}
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
                  opacity={shape.opacity / 100}
                  {...commonHandlers}
                />
              );
            })}
          {/* 全新 session（不是編輯既有 shape）的即時預覽，附加在所有既有 shape 後面（最上層），
              因為之後提交時也是 append 到 shapes 陣列最後面（最上層），z-order 保持一致 */}
          {session && session.editingId === null && (
            <Group
              x={session.x}
              y={session.y}
              rotation={session.rotation}
              opacity={brushOpacity / 100}
              listening={false}
            >
              {sessionPreview}
            </Group>
          )}
        </Layer>

        {/* UI 覆蓋層：永遠最上層，放框選提示/Transformer，匯出前會暫時隱藏 */}
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
          <Transformer ref={transformerRef} rotateEnabled anchorStyleFunc={rotateAnchorStyleFunc} />
        </Layer>
      </Stage>
    </div>
  );
}
