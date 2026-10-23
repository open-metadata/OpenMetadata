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

import type {
  Concept,
  OntologyPackSample,
} from '../../generated/api/data/ontologyPackSample';

const NODE_WIDTH = 148;
const NODE_HEIGHT = 44;
const LAYER_HEIGHT = 110;
const GRAPH_WIDTH = 720;

export const layoutOntologyPackSample = (sample: OntologyPackSample) => {
  const byIri = new Map(
    sample.concepts.map((concept) => [concept.iri, concept])
  );
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  sample.relations.forEach(({ sourceIri, targetIri }) => {
    parents.set(sourceIri, [...(parents.get(sourceIri) ?? []), targetIri]);
    children.set(targetIri, [...(children.get(targetIri) ?? []), sourceIri]);
  });
  const order = (a: Concept, b: Concept) =>
    a.label.localeCompare(b.label) || a.iri.localeCompare(b.iri);
  const sorted = [...sample.concepts].sort(order);
  const depths = new Map<string, number>();
  const queue = sorted.filter((concept) => !parents.has(concept.iri));
  queue.forEach((concept) => depths.set(concept.iri, 0));
  while (queue.length > 0) {
    const parent = queue.shift();
    if (!parent) {
      break;
    }
    (children.get(parent.iri) ?? []).forEach((iri) => {
      const child = byIri.get(iri);
      if (!depths.has(iri) && child) {
        depths.set(iri, (depths.get(parent.iri) ?? 0) + 1);
        queue.push(child);
      }
    });
  }
  sorted.forEach((concept) => {
    if (!depths.has(concept.iri)) {
      depths.set(concept.iri, 0);
    }
  });
  const layers = new Map<number, Concept[]>();
  sorted.forEach((concept) => {
    const depth = depths.get(concept.iri) ?? 0;
    layers.set(depth, [...(layers.get(depth) ?? []), concept]);
  });
  const nodes = [...layers.entries()].flatMap(([depth, layer]) =>
    layer.map((concept, index) => ({
      ...concept,
      x: ((index + 1) * GRAPH_WIDTH) / (layer.length + 1),
      y: 36 + depth * LAYER_HEIGHT,
    }))
  );
  const positions = new Map(nodes.map((node) => [node.iri, node]));
  const edges = sample.relations.flatMap((relation) => {
    const source = positions.get(relation.sourceIri);
    const target = positions.get(relation.targetIri);
    if (!source || !target) {
      return [];
    }
    const startY = source.y - NODE_HEIGHT / 2;
    const endY = target.y + NODE_HEIGHT / 2;
    const middleY = (startY + endY) / 2;

    return [
      {
        ...relation,
        path: `M ${source.x} ${startY} C ${source.x} ${middleY}, ${target.x} ${middleY}, ${target.x} ${endY}`,
      },
    ];
  });

  return {
    nodes,
    edges,
    width: GRAPH_WIDTH,
    height: Math.max(160, 70 + layers.size * LAYER_HEIGHT),
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  };
};
