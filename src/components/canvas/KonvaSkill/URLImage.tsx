"use client";

import { forwardRef, useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ImageShape } from "../../../types/shape";

interface URLImageProps {
  shape: ImageShape;
  draggable?: boolean;
  onClick?: () => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<Event>) => void;
}

// react-konva 的 <Image> 需要吃一個已經載入好的 HTMLImageElement，不是 src 字串，
// 這裡包一層元件，內部載入完成前先不渲染任何東西。
export const URLImage = forwardRef<Konva.Image, URLImageProps>(function URLImage(
  { shape, ...handlers },
  ref,
) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    // 避免 unmount 後或 shape.src 快速變動時，舊的非同步載入完成才 setState
    // （React Strict Mode 在開發環境會讓 effect 故意跑兩次，沒有這個 guard 容易觸發）。
    let cancelled = false;

    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) console.error("圖片載入失敗");
    };
    img.src = shape.src;

    return () => {
      cancelled = true;
    };
  }, [shape.src]);

  if (!image) return null;

  return (
    <KonvaImage
      ref={ref}
      image={image}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      {...handlers}
    />
  );
});
