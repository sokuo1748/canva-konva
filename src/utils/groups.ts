// 鎖定分組（groupId）相關的純函式，不依賴 Konva/React

// 清掉「群組成員數不足 2 個」的孤兒 groupId（groupId 還在，但另一半已經不在這組裡了）——
// lockShapes/unlockShapes/deleteShapes 只操作群組部分成員時，剩下沒被操作到的成員可能會落單，
// 落單的 groupId 沒有實際意義（LayersPanel 的 buildRenderGroups 也要求 run.length >= 2 才收成
// bracket），統一在這裡收斂清除，避免各個 action 各自重複判斷
export function clearOrphanGroupIds<T extends { id: string; groupId?: string }>(shapes: T[]): T[] {
  const counts = new Map<string, number>();
  for (const shape of shapes) {
    if (shape.groupId) counts.set(shape.groupId, (counts.get(shape.groupId) ?? 0) + 1);
  }
  return shapes.map((shape) =>
    shape.groupId && (counts.get(shape.groupId) ?? 0) < 2 ? { ...shape, groupId: undefined } : shape,
  );
}

// 目前選取（ids）是否剛好等於某個既有鎖定分組的全部成員，不多不少
export function isExactlyOneWholeGroup(shapes: { id: string; groupId?: string }[], ids: string[]): boolean {
  if (ids.length < 2) return false;
  const groupId = shapes.find((shape) => shape.id === ids[0])?.groupId;
  if (!groupId) return false;
  const allShareGroup = ids.every((id) => shapes.find((shape) => shape.id === id)?.groupId === groupId);
  if (!allShareGroup) return false;
  return shapes.filter((shape) => shape.groupId === groupId).length === ids.length;
}
