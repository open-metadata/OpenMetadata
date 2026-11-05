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
import { Node } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { LineageNodeType } from '../../../interface/lineage.interface';

// Only these carry columns that getEntityChildrenAndLabel can flatten.
const COLUMN_CAPABLE_ENTITY_TYPES = new Set<string>([
  EntityType.TABLE,
  EntityType.DASHBOARD_DATA_MODEL,
]);

const isColumnTargetCandidate = (
  asset: LineageNodeType | undefined,
  excludeEntityId?: string
): asset is LineageNodeType =>
  Boolean(asset?.id) &&
  COLUMN_CAPABLE_ENTITY_TYPES.has(asset?.entityType ?? '') &&
  !asset?.isTempTable &&
  asset?.id !== excludeEntityId;

/**
 * The canvas nodes a column edit can connect to, as dragging between column
 * handles allowed: column-carrying, persisted, and not the node being edited.
 */
export const getCanvasColumnAssets = (
  nodes: Node[] = [],
  excludeEntityId?: string
): LineageNodeType[] => {
  const byId = new Map<string, LineageNodeType>();
  nodes.forEach((node) => {
    const asset = node.data?.node as LineageNodeType | undefined;
    if (isColumnTargetCandidate(asset, excludeEntityId)) {
      byId.set(asset.id, asset);
    }
  });

  return [...byId.values()];
};
