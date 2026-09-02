"use client";

import type { ReactNode } from "react";
import {
  IconAlignBoxCenterBottom,
  IconAlignBoxCenterTop,
  IconAlignBoxLeftBottom,
  IconAlignBoxLeftMiddle,
  IconAlignBoxLeftTop,
  IconAlignBoxRightBottom,
  IconAlignBoxRightMiddle,
  IconAlignBoxRightTop,
  IconAlignCenter,
} from "@tabler/icons-react";
import type { AlignMode } from "../../../utils/align";
import { useCanvas } from "../../../context/CanvasContext";
import { IconButtonUI } from "../../ui/IconButtonUI/IconButtonUI";
import styles from "./AlignButtons.module.scss";

// 9 顆對齊按鈕的顯示資料：icon + label + 對應的 AlignMode，涵蓋完整 3x3 方位
const ALIGN_BUTTONS: { mode: AlignMode; icon: ReactNode; label: string }[] = [
  { mode: "top-left", icon: <IconAlignBoxLeftTop size={18} />, label: "靠左上對齊" },
  { mode: "top", icon: <IconAlignBoxCenterTop size={18} />, label: "靠上置中對齊" },
  { mode: "top-right", icon: <IconAlignBoxRightTop size={18} />, label: "靠右上對齊" },
  { mode: "left", icon: <IconAlignBoxLeftMiddle size={18} />, label: "靠左置中對齊" },
  { mode: "center", icon: <IconAlignCenter size={18} />, label: "水平垂直置中對齊" },
  { mode: "right", icon: <IconAlignBoxRightMiddle size={18} />, label: "靠右置中對齊" },
  { mode: "bottom-left", icon: <IconAlignBoxLeftBottom size={18} />, label: "靠左下對齊" },
  { mode: "bottom", icon: <IconAlignBoxCenterBottom size={18} />, label: "靠下置中對齊" },
  { mode: "bottom-right", icon: <IconAlignBoxRightBottom size={18} />, label: "靠右下對齊" },
];

interface AlignButtonsProps {
  ids: string[]; // 要對齊的物件 id，單一明確目標跟批次多選畫面都共用這個元件
}

// 3x3 對齊按鈕（比照 ShapePropertiesForm 粗體/底線/中線那排 IconButtonUI 的呈現風格），
// 呼叫端傳入的 ids 剛好等於某個鎖定分組的全部成員時，alignShapes 內部會自動改成整組對齊
// （見 CanvasContext.tsx），這個元件本身不用理會分組邏輯
export function AlignButtons({ ids }: AlignButtonsProps) {
  const { alignShapes } = useCanvas();

  return (
    <div className={styles.row}>
      {ALIGN_BUTTONS.map(({ mode, icon, label }) => (
        <IconButtonUI key={mode} icon={icon} label={label} onClick={() => alignShapes(ids, mode)} />
      ))}
    </div>
  );
}
