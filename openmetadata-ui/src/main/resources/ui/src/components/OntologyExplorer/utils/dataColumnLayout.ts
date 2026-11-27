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
import { CardBox } from './dataGraphLayout';

export const columnNodeKey = (assetId: string, path: string[]) =>
  `${assetId}::${path.join('.')}`;

export const COLUMN_NODE_CAP = 5;
export const COLUMN_NODE_WIDTH = 210;
export const COLUMN_NODE_HEIGHT = 30;

const COLUMN_NODE_PITCH = 36;
const COLUMN_GAP_FROM_CARD = 72;
const ASSET_GROUP_GAP = 12;
const EDGE_HANDLE = 30;

export interface ColumnLayoutAsset {
  assetId: string;
  columnKeys: string[];
  /** Past the cap, every column is drawn instead of a "+N more" node. */
  isShowingAll: boolean;
  row: CardBox;
}

interface SlotBox {
  assetId: string;
  height: number;
  left: number;
  top: number;
  width: number;
}

export type ColumnSlot =
  | (SlotBox & { kind: 'column'; columnKey: string })
  | (SlotBox & { kind: 'more'; hiddenCount: number })
  | (SlotBox & { kind: 'fewer' });

export interface ColumnEdge {
  assetId: string;
  columnKey: string;
  path: string;
}

export interface ColumnLayout {
  bottom: number;
  edges: ColumnEdge[];
  right: number;
  slots: ColumnSlot[];
}

/**
 * Stacks each asset's bound columns in a lane to the right of its card, the
 * first column level with the asset row. A group that would overlap the one
 * above moves down, so the edges stay in row order.
 */
export function layoutColumnNodes(assets: ColumnLayoutAsset[]): ColumnLayout {
  const slots: ColumnSlot[] = [];
  const edges: ColumnEdge[] = [];
  let cursor = Number.NEGATIVE_INFINITY;
  let right = 0;

  [...assets]
    .filter(({ columnKeys }) => columnKeys.length > 0)
    .sort((left, right_) => left.row.top - right_.row.top)
    .forEach(({ assetId, columnKeys, isShowingAll, row }) => {
      const left = row.left + row.width + COLUMN_GAP_FROM_CARD;
      const startX = row.left + row.width;
      const startY = row.top + row.height / 2;
      const shown = isShowingAll
        ? columnKeys
        : columnKeys.slice(0, COLUMN_NODE_CAP);
      let top = Math.max(
        row.top + (row.height - COLUMN_NODE_HEIGHT) / 2,
        cursor
      );
      const box = (slotTop: number): SlotBox => ({
        assetId,
        height: COLUMN_NODE_HEIGHT,
        left,
        top: slotTop,
        width: COLUMN_NODE_WIDTH,
      });

      shown.forEach((columnKey) => {
        const endY = top + COLUMN_NODE_HEIGHT / 2;
        slots.push({ ...box(top), columnKey, kind: 'column' });
        edges.push({
          assetId,
          columnKey,
          path: `M${startX} ${startY} C${startX + EDGE_HANDLE} ${startY} ${
            left - EDGE_HANDLE
          } ${endY} ${left} ${endY}`,
        });
        top += COLUMN_NODE_PITCH;
      });
      const hiddenCount = columnKeys.length - shown.length;
      if (hiddenCount > 0) {
        slots.push({ ...box(top), hiddenCount, kind: 'more' });
        top += COLUMN_NODE_PITCH;
      } else if (isShowingAll && columnKeys.length > COLUMN_NODE_CAP) {
        slots.push({ ...box(top), kind: 'fewer' });
        top += COLUMN_NODE_PITCH;
      }
      cursor = top - COLUMN_NODE_PITCH + COLUMN_NODE_HEIGHT + ASSET_GROUP_GAP;
      right = Math.max(right, left + COLUMN_NODE_WIDTH);
    });

  return {
    bottom: Math.max(0, ...slots.map(({ height, top }) => top + height)),
    edges,
    right,
    slots,
  };
}
