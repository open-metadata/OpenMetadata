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
import {
  STUDIO_FOCUS_DEPTH,
  STUDIO_FOCUS_HUB_DEGREE,
  STUDIO_FOCUS_NODE_CAP,
  STUDIO_GRAPH_NODE_LIMIT,
} from '../OntologyExplorer.constants';
import { OntologyGraphData } from '../OntologyExplorer.interface';

export interface StudioGraphScope {
  readonly graph: OntologyGraphData;
  readonly isFocused: boolean;
  readonly shownCount: number;
  readonly totalCount: number;
}

interface StudioGraphScopeOptions {
  readonly limit?: number;
  readonly seedIds: readonly string[];
}

/**
 * Past the node limit the whole ontology is too small to read once Fit has
 * shrunk it, so the canvas shows the neighbourhood of the seeds (the selected
 * concept and search matches) and leaves the rest to Tree and Find.
 */
export function buildStudioGraphScope(
  graph: OntologyGraphData,
  { limit = STUDIO_GRAPH_NODE_LIMIT, seedIds }: StudioGraphScopeOptions
): StudioGraphScope {
  const totalCount = graph.nodes.length;
  if (totalCount <= limit) {
    return { graph, isFocused: false, shownCount: totalCount, totalCount };
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const neighbours = new Map<string, string[]>();
  graph.edges.forEach(({ from, to }) => {
    if (nodeById.has(from) && nodeById.has(to) && from !== to) {
      neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
      neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
    }
  });

  const included = new Set<string>();
  let frontier = seedIds.filter((id) => nodeById.has(id));
  frontier.forEach((id) => {
    if (included.size < STUDIO_FOCUS_NODE_CAP) {
      included.add(id);
    }
  });
  for (let depth = 0; depth < STUDIO_FOCUS_DEPTH; depth++) {
    const next: string[] = [];
    // A hub reached through the seed (a base class like DomainResource) would pull in every
    // sibling of the seed, so only the seeds themselves expand however linked they are.
    const expandable =
      depth === 0
        ? frontier
        : frontier.filter(
            (id) =>
              new Set(neighbours.get(id) ?? []).size <= STUDIO_FOCUS_HUB_DEGREE
          );
    expandable.forEach((id) => {
      [...new Set(neighbours.get(id) ?? [])]
        .sort((left, right) =>
          (nodeById.get(left)?.label ?? '').localeCompare(
            nodeById.get(right)?.label ?? ''
          )
        )
        .forEach((neighbour) => {
          if (
            !included.has(neighbour) &&
            included.size < STUDIO_FOCUS_NODE_CAP
          ) {
            included.add(neighbour);
            next.push(neighbour);
          }
        });
    });
    frontier = next;
  }

  const nodes = graph.nodes.filter((node) => included.has(node.id));
  const edges = graph.edges.filter(
    ({ from, to }) => included.has(from) && included.has(to)
  );

  return {
    graph: { nodes, edges },
    isFocused: true,
    shownCount: nodes.length,
    totalCount,
  };
}
