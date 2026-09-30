/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { ItemCallback, Layout, utils } from 'react-grid-layout';

/**
 * Drag callbacks for react-grid-layout that keep a widget in the column it
 * started in, so dragging only reorders it vertically.
 *
 * RGL snaps the item to whichever column the pointer is over, which leaves
 * side-panel widgets stranded between columns. It lets these callbacks mutate
 * the layout it is about to apply: `onDrag` gets the live layout and
 * `onDragStop` the final one, so the column is restored in place and the
 * other items re-flow around it.
 */
export const getColumnLockedDragHandlers = (cols: number) => {
  const lockToStartColumn: ItemCallback = (
    layout: Layout[],
    oldItem: Layout,
    newItem: Layout,
    placeholder: Layout
  ) => {
    const item = layout.find(({ i }) => i === newItem.i);
    if (!item || item.x === oldItem.x) {
      return;
    }

    // moveElement pushes whatever now collides out of the item's way, so the
    // item keeps the slot it was dropped into.
    utils.moveElement(
      layout,
      item,
      oldItem.x,
      item.y,
      true,
      false,
      'vertical',
      cols
    );
    newItem.x = oldItem.x;
    if (placeholder) {
      placeholder.x = oldItem.x;
    }

    utils.compact(layout, 'vertical', cols).forEach((settled) => {
      const target = layout.find(({ i }) => i === settled.i);
      if (target) {
        target.x = settled.x;
        target.y = settled.y;
      }
    });
  };

  return { onDrag: lockToStartColumn, onDragStop: lockToStartColumn };
};
