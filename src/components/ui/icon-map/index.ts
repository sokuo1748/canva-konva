import type { IconHome } from "@tabler/icons-react";

// 用一顆已知存在的 icon 反推元件型別 —— @tabler/icons-react 沒有 export 出共用的
// Icon/TablerIcon 型別，所以用 typeof 某個實際 icon 當作所有 icon 元件共用的型別。
export type TablerIconComponent = typeof IconHome;

// TODO: 之後把實際用到的 Tabler icon 加進來，例如：
// import { IconPlus, IconTrash } from "@tabler/icons-react";
export const iconMap = {
  // plus: IconPlus,
  // trash: IconTrash,
} satisfies Record<string, TablerIconComponent>;

// 型別從 iconMap 物件反推，只維護一份 source of truth，之後加 icon 不用兩邊改。
export type IconName = keyof typeof iconMap;
