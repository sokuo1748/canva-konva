// 純函式、不依賴 Konva 或 React：canvas 的 shape 點擊跟圖層清單的 row 點擊都靠這兩支函式決定要不要加選/取消選。

/**
 * 依 additive 決定：false 時直接取代成 ids（單一 shape 傳 [id]，鎖定分組傳整組成員 id）；
 * true 時把 ids 當一個整體加入/移出目前選取——ids 全部都已經在目前選取裡才視為「已選中」
 * 而移除，否則（不管原本有沒有部分命中）視為加選，把還沒選到的部分補齊。
 */
export function toggleSelection(currentIds: string[], ids: string[], additive: boolean): string[] {
  if (!additive) return ids;
  const allSelected = ids.every((id) => currentIds.includes(id));
  return allSelected
    ? currentIds.filter((id) => !ids.includes(id))
    : [...currentIds, ...ids.filter((id) => !currentIds.includes(id))];
}

/** Konva 的 KonvaEventObject["evt"] 跟 React 的 MouseEvent 都有這三個欄位，結構相容即可共用。 */
export function isAdditiveClick(evt: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return evt.shiftKey || evt.ctrlKey || evt.metaKey;
}
