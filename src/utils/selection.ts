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

// 依「畫面顯示順序」的 id 陣列，算出 anchor 到 target 之間（含頭尾）的所有 id；
// 任一端不在 orderedIds 裡（例如 anchor 對應的 shape 已被刪除）就退化成只選 target 自己
export function getRangeIds(orderedIds: string[], anchorId: string, targetId: string): string[] {
  const anchorIndex = orderedIds.indexOf(anchorId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (anchorIndex === -1 || targetIndex === -1) return [targetId];
  const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  return orderedIds.slice(start, end + 1);
}
