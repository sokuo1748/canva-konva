"use client";

import { useEffect, useState } from "react";
import { Circle, Group, Layer, Line, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCanvas } from "../../../context/CanvasContext";
import { usePaintSettings } from "../../../context/PaintSettingsContext";
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
  } = useCanvas();
  const { brushSize, eraserSize } = usePaintSettings();
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
    erasePreview,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    enterBrushEdit,
  } = useFreehandDraw();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  // 畫筆/橡皮擦模式下，游標目前在畫布上的相對座標（跟 shape 同一個座標系），用來畫出
  // 跟著滑鼠移動、大小反映目前筆刷/橡皮擦尺寸的範圍指示；null 代表滑鼠不在畫布上
  // （剛切換工具、或滑鼠移出容器），這時不畫任何指示，維持既有的「沒資料就不畫」慣例
  const [drawCursorPos, setDrawCursorPos] = useState<{ x: number; y: number } | null>(null);

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

  // 工具剛切成 brush/eraser 的那一刻（例如滑鼠靜止不動、從左側面板按鈕切換），主動讀一次
  // 目前的指標位置補上游標圈初始值，不用等下一次 mousemove 事件才有東西可畫——容器 CSS
  // 把原生 cursor 關掉了（見下方 Stage 的 cursor: "none"），這段空窗期完全看不到任何游標
  // 會比原生 crosshair 明顯退步。跟 handleStageMouseMoveForCursor 用同一個
  // getRelativePointerPosition()，維持同一個座標系；滑鼠當下不在 Stage 範圍內會回傳 null，
  // 維持沒有游標圈的現狀即可，不用額外處理
  useEffect(() => {
    if (!isDrawMode) return;
    const pos = stageRef.current?.getRelativePointerPosition();
    setDrawCursorPos(pos ?? null);
  }, [isDrawMode, stageRef]);

  // 畫筆/橡皮擦模式下，滑鼠在 Stage 上移動時除了原本的畫圖取樣（handleDrawMouseMove），
  // 順便更新遊標範圍指示的位置；跟 shape 用同一個 getRelativePointerPosition() 座標系，
  // 不用額外處理 Stage 的 scaleX/scaleY（畫在同一層、同一個座標系裡自然正確）
  const handleStageMouseMoveForCursor = (e: KonvaEventObject<MouseEvent>) => {
    handleDrawMouseMove(e);
    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    setDrawCursorPos(pos ?? null);
  };

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

  return (
    <div
      ref={containerRef}
      // 畫筆/橡皮擦模式下隱藏原生游標（"none"），改用畫在 overlay layer 上、跟著滑鼠移動的
      // 範圍指示圈當游標（見下方 Transformer 同一層的 Circle），比固定的 crosshair 更能
      // 直覺反映目前筆刷/橡皮擦的實際大小
      style={{ width: "100%", height: "100%", cursor: isDrawMode ? "none" : undefined }}
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
        onMouseMove={isDrawMode ? handleStageMouseMoveForCursor : handleStageMouseMove}
        onMouseUp={isDrawMode ? handleDrawMouseUp : handleStageMouseUp}
        onMouseLeave={isDrawMode ? () => setDrawCursorPos(null) : undefined}
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
            （不是限制拖曳座標本身）。橡皮擦不靠 destination-out 疊圖層遮罩，而是對 BrushShape
            的 strokes 點資料做向量挖除，拖曳中先存在 erasePreview 即時預覽、放開滑鼠才寫回
            shapes[]（見 useFreehandDraw.ts），所以不需要再依是否為畫筆切成多個交錯的 Layer，
            單一 Layer 就能正確反映圖層順序 */}
        <Layer clipX={0} clipY={0} clipWidth={canvasWidth} clipHeight={canvasHeight}>
          {shapes.map((shape) => {
              const commonHandlers = buildCommonHandlers(shape.id);

              if (shape.type === "brush") {
                // shapes[] 現在就是即時最新的資料（每一筆/每次橡皮擦手勢都已經提交），正常
                // 情況直接照它渲染；只有這個 shape 正在被橡皮擦即時挖除中，才改成渲染這次
                // 手勢的即時預覽結果（取代 shapes[] 裡這份還沒被這次手勢更新的舊資料）
                const strokesToRender =
                  erasePreview?.shapeId === shape.id ? erasePreview.strokes : shape.strokes;
                // 這個 shape 正在被追加畫下一筆、且那一筆還沒收尾（放開滑鼠）：已提交的
                // strokes 之外，額外疊一條正在畫的 inProgressStroke
                const showInProgress = session?.shapeId === shape.id && inProgressStroke;

                return (
                  <Group
                    key={shape.id}
                    id={shape.id}
                    ref={registerShapeRef(shape.id)}
                    x={shape.x}
                    y={shape.y}
                    rotation={shape.rotation}
                    onDblClick={activeTool === "select" ? () => enterBrushEdit(shape) : undefined}
                    {...commonHandlers}
                  >
                    {strokesToRender.map((stroke, index) => (
                      <Line
                        key={index}
                        points={stroke.points}
                        stroke={stroke.color}
                        strokeWidth={stroke.strokeWidth}
                        opacity={stroke.opacity / 100}
                        {...brushStrokeLineProps(stroke.cap)}
                      />
                    ))}
                    {showInProgress && (
                      <Line
                        points={inProgressStroke.points}
                        stroke={inProgressStroke.color}
                        strokeWidth={inProgressStroke.strokeWidth}
                        opacity={inProgressStroke.opacity / 100}
                        {...brushStrokeLineProps(inProgressStroke.cap)}
                      />
                    )}
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
          {/* 全新 session 還沒有任何對應 shape、且正在畫第一筆（還沒放開滑鼠收尾）的即時預覽，
              附加在所有既有 shape 後面（最上層），因為收尾時 addBrushShape 也是 append 到
              shapes 陣列最後面（最上層），z-order 保持一致。放開滑鼠收尾後 shapes[] 會多一個
              對應的 shape，下一個 render 就會走上面「正常情況」那條路徑，這裡自然不再顯示 */}
          {session && session.shapeId === null && inProgressStroke && (
            <Group
              x={session.x}
              y={session.y}
              rotation={session.rotation}
              listening={false}
            >
              <Line
                points={inProgressStroke.points}
                stroke={inProgressStroke.color}
                strokeWidth={inProgressStroke.strokeWidth}
                opacity={inProgressStroke.opacity / 100}
                {...brushStrokeLineProps(inProgressStroke.cap)}
              />
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
          {/* 畫筆/橡皮擦模式下取代原生游標的範圍指示：跟著滑鼠移動，直徑＝目前的
              brushSize/eraserSize。畫在跟筆畫同一個座標系、同一個被 Stage scaleX/scaleY
              （fit-scale）縮放的層級內，半徑不用額外乘任何縮放係數就能正確反映實際塗抹範圍。
              簡化成固定圓形（不管 brushCap 是圓形還是方形），足以當一個範圍提示；疊兩層
              stroke（外層較粗的白色 + 內層較細的深色）做出在淺色/深色背景下都看得清楚的
              描邊效果，strokeScaleEnabled=false 讓線條粗細不受縮放影響（比照專案其他
              shape 的既有慣例） */}
          {isDrawMode && drawCursorPos && (
            <>
              <Circle
                x={drawCursorPos.x}
                y={drawCursorPos.y}
                radius={(activeTool === "eraser" ? eraserSize : brushSize) / 2}
                stroke="#ffffff"
                strokeWidth={3}
                strokeScaleEnabled={false}
                listening={false}
              />
              <Circle
                x={drawCursorPos.x}
                y={drawCursorPos.y}
                radius={(activeTool === "eraser" ? eraserSize : brushSize) / 2}
                stroke="#333333"
                strokeWidth={1}
                strokeScaleEnabled={false}
                listening={false}
              />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
