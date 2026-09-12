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

import { GraphData } from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { getGraphRelationCategory } from '../../components/KnowledgeGraph/KnowledgeGraph.relations';

export const getGraphRelationshipRows = (
  data: GraphData | null
): string[][] => {
  const nodes = new Map(data?.nodes.map((node) => [node.id, node]));
  const types = new Map(data?.nodes.map((node) => [node.id, node.type]));

  return [
    ['subject', 'predicate', 'object', 'family', 'iri'],
    ...(data?.edges ?? []).map((edge) => [
      nodes.get(edge.from)?.label ?? edge.from,
      edge.label,
      nodes.get(edge.to)?.label ?? edge.to,
      getGraphRelationCategory(edge, types),
      edge.relationType ?? '',
    ]),
  ];
};
