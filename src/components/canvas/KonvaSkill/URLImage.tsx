"use client";

import { forwardRef, useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ImageShape } from "../../../types/shape";

interface URLImageProps {
  shape: ImageShape;
  draggable?: boolean;
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<Event>) => void;
}

// 快取已載入完成的圖片，remount 時（例如交錯排序切換 Layer）避免重新載入閃爍
const imageCache = new Map<string, HTMLImageElement>();

// 依 src 非同步載入圖片，載入完成前不渲染
export const URLImage = forwardRef<Konva.Image, URLImageProps>(function URLImage(
  { shape, ...handlers },
  ref,
) {
  const [image, setImage] = useState<HTMLImageElement | null>(() => imageCache.get(shape.src) ?? null);

  useEffect(() => {
    const cached = imageCache.get(shape.src);
    if (cached) {
      setImage(cached);
      return;
    }

    let cancelled = false; // 避免 unmount 後才 setState

    const img = new window.Image();
    img.onload = () => {
      imageCache.set(shape.src, img);
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
      rotation={shape.rotation}
      width={shape.width}
      height={shape.height}
      opacity={shape.opacity / 100}
      {...handlers}
    />
  );
});
