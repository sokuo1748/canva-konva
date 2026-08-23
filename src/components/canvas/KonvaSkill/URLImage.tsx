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

// react-konva 的 <Image> 要吃已載入好的 HTMLImageElement，載入完成前先不渲染。
export const URLImage = forwardRef<Konva.Image, URLImageProps>(function URLImage(
  { shape, ...handlers },
  ref,
) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    // 避免 unmount 後或 src 變動後，舊的非同步載入才 setState（Strict Mode 下容易觸發）。
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
      rotation={shape.rotation}
      width={shape.width}
      height={shape.height}
      {...handlers}
    />
  );
});
