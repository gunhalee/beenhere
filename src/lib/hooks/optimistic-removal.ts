export type RemovedItemSnapshot<TItem> = {
  item: TItem;
  index: number;
};

type GetItemId<TItem> = (item: TItem) => string;

export function getRemovedItemSnapshot<TItem>(
  items: TItem[],
  targetId: string,
  getItemId: GetItemId<TItem>,
): RemovedItemSnapshot<TItem> | null {
  const index = items.findIndex((item) => getItemId(item) === targetId);
  if (index < 0) return null;

  return {
    item: items[index],
    index,
  };
}

export function removeItemById<TItem>(
  items: TItem[],
  targetId: string,
  getItemId: GetItemId<TItem>,
): TItem[] {
  const removeIndex = items.findIndex((item) => getItemId(item) === targetId);
  if (removeIndex < 0) return items;

  const nextItems = [...items];
  nextItems.splice(removeIndex, 1);
  return nextItems;
}

export function restoreRemovedItemInList<TItem>(
  items: TItem[],
  snapshot: RemovedItemSnapshot<TItem>,
  getItemId: GetItemId<TItem>,
): TItem[] {
  const targetId = getItemId(snapshot.item);
  if (items.some((item) => getItemId(item) === targetId)) {
    return items;
  }

  const nextItems = [...items];
  const insertIndex = Math.max(0, Math.min(snapshot.index, nextItems.length));
  nextItems.splice(insertIndex, 0, snapshot.item);
  return nextItems;
}
