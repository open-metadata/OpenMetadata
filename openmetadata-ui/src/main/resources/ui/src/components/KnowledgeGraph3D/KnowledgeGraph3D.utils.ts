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

import { Graph3DData, GraphLink3D, GraphNode3D, Lens, Level } from './types';

export const idOf = (endpoint: string | GraphNode3D): string =>
  typeof endpoint === 'object' ? endpoint.id : endpoint;

const linkMatchesLens = (link: GraphLink3D, lens: Lens): boolean =>
  lens === 'all' || link.kind === lens;

/**
 * Derives the nodes/links visible for the current level + relationship lens.
 * In a focused lens (not "all") nodes with no visible link are pruned so the
 * scene shows only what is in context. Ported from the reference `view()`.
 */
export const viewGraph = (
  graph: Graph3DData,
  level: Level,
  lens: Lens
): Graph3DData => {
  const nodes = graph.nodes.filter((node) => node.levels.includes(level));
  const ids = new Set(nodes.map((node) => node.id));
  const links = graph.links.filter(
    (link) =>
      link.levels.includes(level) &&
      ids.has(idOf(link.source)) &&
      ids.has(idOf(link.target)) &&
      linkMatchesLens(link, lens)
  );

  let visibleNodes = nodes;
  if (lens !== 'all') {
    const live = new Set<string>();
    links.forEach((link) => {
      live.add(idOf(link.source));
      live.add(idOf(link.target));
    });
    visibleNodes = nodes.filter((node) => live.has(node.id));
  }

  // Return the original node/link object references (filtered, not cloned) so
  // react-force-graph keeps each node's identity — and therefore its settled
  // x/y/z position — across level/lens toggles. Spread-cloning gave every node
  // a new identity, forcing the whole simulation to reheat to full alpha and
  // every three.js node object to be rebuilt on what is only a re-filter.
  return { nodes: visibleNodes, links };
};

export interface HighlightSet {
  nodes: Set<string>;
  links: Set<GraphLink3D>;
}

/**
 * Builds the highlight set for a selected node: the node, its direct
 * neighbors, and the incident links from the currently visible graph.
 */
export const computeHighlight = (
  links: GraphLink3D[],
  nodeId: string
): HighlightSet => {
  const nodes = new Set<string>([nodeId]);
  const incident = new Set<GraphLink3D>();
  links.forEach((link) => {
    const source = idOf(link.source);
    const target = idOf(link.target);
    if (source === nodeId || target === nodeId) {
      incident.add(link);
      nodes.add(source);
      nodes.add(target);
    }
  });

  return { nodes, links: incident };
};

/**
 * Stable identity for a link (source/target may be ids or, after the force
 * simulation runs, node objects). Used to track the selected edge.
 */
export const linkKey = (link: GraphLink3D): string =>
  `${idOf(link.source)}|${idOf(link.target)}|${link.label}`;

/** Highlight set for a selected edge: the edge plus its two endpoints. */
export const computeLinkHighlight = (
  links: GraphLink3D[],
  key: string
): HighlightSet => {
  const nodes = new Set<string>();
  const incident = new Set<GraphLink3D>();
  links.forEach((link) => {
    if (linkKey(link) === key) {
      incident.add(link);
      nodes.add(idOf(link.source));
      nodes.add(idOf(link.target));
    }
  });

  return { nodes, links: incident };
};
