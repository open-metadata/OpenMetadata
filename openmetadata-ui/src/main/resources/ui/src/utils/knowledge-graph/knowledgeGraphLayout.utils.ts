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

import type { EdgeData, NodeData, NodePortStyleProps } from '@antv/g6';
import type { GraphNodePresentation } from '../../components/KnowledgeGraph/KnowledgeGraph.interface';

type PortSide = 'left' | 'right' | 'top' | 'bottom';
type Point = [number, number];
const CARD_PORTS: NodePortStyleProps[] = ['left', 'right', 'top', 'bottom'].map(
  (side) => ({
    key: side,
    placement: side as PortSide,
    linkToCenter: true,
  })
);

const presentation = (node: NodeData) =>
  node.data?.presentation as GraphNodePresentation | undefined;
const center = (node: NodeData): Point => [
  Number(node.style?.x ?? 0),
  Number(node.style?.y ?? 0),
];
const size = (node: NodeData): Point => presentation(node)?.size ?? [212, 58];
const isDock = (node: NodeData) =>
  ['top', 'bottom'].includes(presentation(node)?.side ?? '');

const joinsDock = (node: NodeData, dock: NodeData) =>
  isDock(dock) &&
  (presentation(node)?.root || presentation(node)?.groupId === dock.id);

const portPair = (from: NodeData, to: NodeData): [PortSide, PortSide] => {
  const a = center(from),
    b = center(to);
  if (joinsDock(from, to) || joinsDock(to, from)) {
    return a[1] < b[1] ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  if (a[0] === b[0]) {
    const side = presentation(from)?.side === 'left' ? 'left' : 'right';

    return [side, side];
  }

  return a[0] < b[0] ? ['right', 'left'] : ['left', 'right'];
};

const attach = (
  node: NodeData,
  side: PortSide,
  index: number,
  count: number,
  edgeId: string
) => {
  const [x, y] = center(node),
    [width, height] = size(node);
  const horizontal = side === 'left' || side === 'right';
  const extent = horizontal ? height : width;
  const offset =
    (index - (count - 1) / 2) *
    Math.min(12, (extent - 20) / Math.max(1, count - 1));
  const fraction = 0.5 + offset / extent;
  const placement: Point = horizontal
    ? [side === 'left' ? 0 : 1, fraction]
    : [fraction, side === 'top' ? 0 : 1];
  const key = count === 1 ? side : side + ':' + edgeId;
  if (count > 1) {
    node.style?.ports?.push({ key, placement, linkToCenter: true });
  }

  return {
    key,
    point: [
      x + (placement[0] - 0.5) * width,
      y + (placement[1] - 0.5) * height,
    ] as Point,
  };
};

const PORT_DIRECTION: Record<PortSide, Point> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

const controlPoint = (
  point: Point,
  side: PortSide,
  distance: number
): Point => [
  point[0] + PORT_DIRECTION[side][0] * distance,
  point[1] + PORT_DIRECTION[side][1] * distance,
];

/** Explicit ports keep branches tangent to card edges, including separated parallel predicates. */
export const routeGraphEdges = (
  sourceNodes: NodeData[],
  sourceEdges: EdgeData[]
) => {
  const nodes = sourceNodes.map((node) => ({
    ...node,
    style: { ...node.style, ports: [...CARD_PORTS] },
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pairs = new Map<string, EdgeData[]>();
  const pairKey = (edge: EdgeData) =>
    JSON.stringify([edge.source, edge.target].sort());
  sourceEdges.forEach((edge) => {
    const key = pairKey(edge),
      pair = pairs.get(key) ?? [];
    pair.push(edge);
    pairs.set(key, pair);
  });
  pairs.forEach((edges) =>
    edges.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  );
  const edges: EdgeData[] = sourceEdges.map((edge) => {
    const from = byId.get(edge.source),
      to = byId.get(edge.target);
    if (!from || !to || from.id === to.id) {
      return {
        ...edge,
        type: 'cubic',
        style: { ...edge.style, loopPlacement: 'top-right', loopDist: 48 },
      };
    }
    const pair = pairs.get(pairKey(edge)) ?? [edge];
    const index = pair.indexOf(edge);
    const [sourceSide, targetSide] = portPair(from, to);
    const source = attach(
      from,
      sourceSide,
      index,
      pair.length,
      String(edge.id)
    );
    const target = attach(to, targetSide, index, pair.length, String(edge.id));
    const vertical = sourceSide === 'top' || sourceSide === 'bottom';
    const length = Math.abs(
      source.point[vertical ? 1 : 0] - target.point[vertical ? 1 : 0]
    );
    const maxDistance = vertical ? 110 : 140;
    const distance =
      sourceSide === targetSide
        ? 80 + index * 18
        : Math.min(maxDistance, Math.max(40, length * 0.45));

    return {
      ...edge,
      type: 'cubic',
      style: {
        ...edge.style,
        sourcePort: source.key,
        targetPort: target.key,
        controlPoints: [
          controlPoint(source.point, sourceSide, distance),
          controlPoint(target.point, targetSide, distance),
        ],
      },
    };
  });

  return { nodes, edges };
};
