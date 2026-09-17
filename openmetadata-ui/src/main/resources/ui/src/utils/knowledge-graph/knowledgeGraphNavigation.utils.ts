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

import { GraphNode } from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { EntityType } from '../../enums/entity.enum';
import { getEntityLinkFromType } from '../EntityLinkUtils';
import { getTableFQNFromColumnFQN } from '../FqnUtils';
import { getEntityDetailsPath, getUserPath } from '../RouterUtils';

export const isGraphColumnNode = (node: GraphNode) =>
  ['column', EntityType.TABLE_COLUMN].includes(node.type);

/** Where a graph card leads: columns open their table, users their profile. */
export const getGraphNodeHref = (node?: GraphNode): string => {
  if (!node?.fullyQualifiedName) {
    return '';
  }
  if (isGraphColumnNode(node)) {
    return getEntityDetailsPath(
      EntityType.TABLE,
      getTableFQNFromColumnFQN(node.fullyQualifiedName)
    );
  }
  if (node.type === EntityType.USER) {
    return getUserPath(node.fullyQualifiedName);
  }

  return getEntityLinkFromType(
    node.fullyQualifiedName,
    node.type as EntityType
  );
};
