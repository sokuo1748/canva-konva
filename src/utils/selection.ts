// 選取切換的純函式，畫布點擊跟圖層清單點擊共用

// additive 為 false 直接取代選取；true 時把 ids 當整體加入/移出
export function toggleSelection(currentIds: string[], ids: string[], additive: boolean): string[] {
  if (!additive) return ids;
  const allSelected = ids.every((id) => currentIds.includes(id));
  return allSelected
    ? currentIds.filter((id) => !ids.includes(id))
    : [...currentIds, ...ids.filter((id) => !currentIds.includes(id))];
}

// 是否為 shift/ctrl/cmd 加選點擊
export function isAdditiveClick(evt: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return evt.shiftKey || evt.ctrlKey || evt.metaKey;
}
