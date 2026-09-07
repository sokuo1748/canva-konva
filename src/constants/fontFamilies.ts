// 常見「網頁安全字體」清單，不需載入外部字型檔，Konva/canvas 找不到會自動 fallback 到瀏覽器預設。
// 給 SelectField 的 options 用，跟 shapeTypeIcons.ts 一樣是 Record/常數表的風格。
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", cursive' },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Segoe UI", value: '"Segoe UI", sans-serif' },
];

// addText 新增文字時的預設字體
export const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0].value;
