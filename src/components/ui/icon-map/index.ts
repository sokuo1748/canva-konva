import type { IconHome } from "@tabler/icons-react";

// 用一顆已知存在的 icon 反推元件型別——@tabler/icons-react 沒有 export 共用的 Icon 型別。
export type TablerIconComponent = typeof IconHome;

// TODO: 之後把實際用到的 icon 加進來
export const iconMap = {
  // plus: IconPlus, trash: IconTrash,
} satisfies Record<string, TablerIconComponent>;

// 型別從 iconMap 物件反推，只維護一份 source of truth，之後加 icon 不用兩邊改。
export type IconName = keyof typeof iconMap;
