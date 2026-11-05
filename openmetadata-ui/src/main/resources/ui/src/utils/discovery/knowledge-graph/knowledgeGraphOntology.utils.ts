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

import { GraphData } from '../../../components/discovery/knowledge-graph/KnowledgeGraph.interface';
import {
  isConceptNode,
  isMappingEdge,
} from './knowledgeGraphPresentation.utils';

export const graphEntityId = (nodeId: string) =>
  nodeId.split('/').pop() ?? nodeId;

export const getOntologyScope = (
  data: GraphData | null,
  rootId: string
): GraphData | null => {
  if (!data) {
    return null;
  }
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const edges = data.edges.filter((edge) => {
    const source = nodes.get(edge.from);
    const target = nodes.get(edge.to);
    if (!source || !target) {
      return false;
    }

    return (
      (isConceptNode(source) && isConceptNode(target)) ||
      isMappingEdge(edge, nodes)
    );
  });
  const ids = new Set([
    rootId,
    ...edges.flatMap((edge) => [edge.from, edge.to]),
  ]);

  return {
    ...data,
    edges,
    nodes: data.nodes.filter(
      (node) => ids.has(node.id) || graphEntityId(node.id) === rootId
    ),
  };
};
