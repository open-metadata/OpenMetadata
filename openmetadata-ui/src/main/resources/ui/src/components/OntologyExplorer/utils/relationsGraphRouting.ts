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

export interface RoutingNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutingEdge {
  id: string;
  source: string;
  target: string;
  labelWidth: number;
  labelHeight: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export interface EdgeRoute {
  curveOffset: number;
  labelPlacement: number;
}

type Point = [number, number];

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NODE_CLEARANCE = 12;
const LABEL_GAP = 4;
const CURVE_SAMPLES = 32;
const CURVE_OFFSETS = [
  0, 60, -60, 120, -120, 180, -180, 240, -240, 320, -320, 400, -400,
];
// Nearest-to-centre first, so ties keep the label close to the middle.
const LABEL_RATIOS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
// Covering a term or another badge is never acceptable while any position
// avoids it; an edge drawn across the badge only costs one point per edge.
const LABEL_OVERLAP_COST = 1000;

const toRect = (
  x: number,
  y: number,
  width: number,
  height: number,
  pad: number
): Rect => ({
  left: x - width / 2 - pad,
  top: y - height / 2 - pad,
  right: x + width / 2 + pad,
  bottom: y + height / 2 + pad,
});

const containsPoint = (rect: Rect, [x, y]: Point): boolean =>
  x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Liang–Barsky clip: does segment a→b pass through the rect?
const segmentHitsRect = (a: Point, b: Point, rect: Rect): boolean => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const bounds: Array<[number, number]> = [
    [-dx, a[0] - rect.left],
    [dx, rect.right - a[0]],
    [-dy, a[1] - rect.top],
    [dy, rect.bottom - a[1]],
  ];
  let enter = 0;
  let exit = 1;
  for (const [p, q] of bounds) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
    } else if (p < 0) {
      enter = Math.max(enter, q / p);
    } else {
      exit = Math.min(exit, q / p);
    }
    if (enter > exit) {
      return false;
    }
  }

  return true;
};

const curveHitsRect = (curve: Point[], rect: Rect): boolean =>
  curve.some((point, i) => i > 0 && segmentHitsRect(curve[i - 1], point, rect));

// Where G6 attaches an edge to a rect node: the border point facing `toward`.
const borderPoint = (node: RoutingNode, toward: Point): Point => {
  const dx = toward[0] - node.x;
  const dy = toward[1] - node.y;
  if (dx === 0 && dy === 0) {
    return [node.x, node.y];
  }
  const scale = Math.min(
    dx === 0 ? Infinity : node.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : node.height / 2 / Math.abs(dy)
  );

  return [node.x + dx * scale, node.y + dy * scale];
};

// Mirrors G6's Quadratic edge (border endpoints, getCurveControlPoint at
// curvePosition 0.5) so the sampled curve is the one actually drawn.
const sampleCurve = (
  source: RoutingNode,
  target: RoutingNode,
  curveOffset: number
): Point[] => {
  const start = borderPoint(source, [target.x, target.y]);
  const end = borderPoint(target, [source.x, source.y]);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  const control: Point = [
    start[0] + dx / 2 + (curveOffset * dy) / length,
    start[1] + dy / 2 - (curveOffset * dx) / length,
  ];

  return Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) => {
    const t = i / CURVE_SAMPLES;
    const u = 1 - t;

    return [
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ];
  });
};

// G6 places a label at a fraction of the path's length, not of the curve
// parameter, so walk the sampled polyline to the same distance.
const pointAtLengthRatio = (points: Point[], ratio: number): Point => {
  const segments = points
    .slice(1)
    .map((point, i) =>
      Math.hypot(point[0] - points[i][0], point[1] - points[i][1])
    );
  let remaining = segments.reduce((sum, len) => sum + len, 0) * ratio;
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= segments[i] && segments[i] > 0) {
      const f = remaining / segments[i];

      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * f,
        points[i][1] + (points[i + 1][1] - points[i][1]) * f,
      ];
    }
    remaining -= segments[i];
  }

  return points[points.length - 1];
};

/**
 * Bends each edge of the relations graph just enough to stop it running
 * through an unrelated term, then slides its label along the edge until it no
 * longer covers a term or an earlier label. Edges that already clear every
 * term stay straight (curveOffset 0) with a centred label.
 */
export function routeRelationsGraphEdges(
  nodes: RoutingNode[],
  edges: RoutingEdge[]
): Map<string, EdgeRoute> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routable = edges.filter(
    (edge) =>
      edge.source !== edge.target &&
      nodeById.has(edge.source) &&
      nodeById.has(edge.target)
  );

  const curveOffsets = new Map<string, number>();
  routable.forEach((edge) => {
    const source = nodeById.get(edge.source) as RoutingNode;
    const target = nodeById.get(edge.target) as RoutingNode;
    const obstacles = nodes
      .filter((node) => node.id !== edge.source && node.id !== edge.target)
      .map((node) =>
        toRect(node.x, node.y, node.width, node.height, NODE_CLEARANCE)
      );
    const offset = CURVE_OFFSETS.find((candidate) =>
      sampleCurve(source, target, candidate).every(
        (point) => !obstacles.some((rect) => containsPoint(rect, point))
      )
    );
    curveOffsets.set(edge.id, offset ?? 0);
  });

  const curves = new Map(
    routable.map((edge) => [
      edge.id,
      sampleCurve(
        nodeById.get(edge.source) as RoutingNode,
        nodeById.get(edge.target) as RoutingNode,
        curveOffsets.get(edge.id) ?? 0
      ),
    ])
  );
  const nodeRects = nodes.map((node) =>
    toRect(node.x, node.y, node.width, node.height, LABEL_GAP)
  );
  const placedLabels: Rect[] = [];
  const routes = new Map<string, EdgeRoute>();
  const edgeLength = (edge: RoutingEdge) => {
    const source = nodeById.get(edge.source) as RoutingNode;
    const target = nodeById.get(edge.target) as RoutingNode;

    return Math.hypot(target.x - source.x, target.y - source.y);
  };

  // ponytail: every candidate is tested against every other curve, O(E² × 9 × 32);
  // fine for a glossary's few hundred edges, use a spatial index beyond that.
  const placementCost = (edgeId: string, rect: Rect): number => {
    const hardOverlaps =
      nodeRects.filter((nodeRect) => overlaps(rect, nodeRect)).length +
      placedLabels.filter((label) => overlaps(rect, label)).length;
    let crossings = 0;
    curves.forEach((curve, otherId) => {
      if (otherId !== edgeId && curveHitsRect(curve, rect)) {
        crossings++;
      }
    });

    return hardOverlaps * LABEL_OVERLAP_COST + crossings;
  };

  // Short edges have the least room to slide a label, so they pick first.
  [...routable]
    .sort((a, b) => edgeLength(a) - edgeLength(b))
    .forEach((edge) => {
      const curveOffset = curveOffsets.get(edge.id) ?? 0;
      if (edge.labelWidth <= 0) {
        routes.set(edge.id, { curveOffset, labelPlacement: 0.5 });

        return;
      }
      const curve = curves.get(edge.id) as Point[];
      const labelRectAt = (ratio: number): Rect => {
        const [x, y] = pointAtLengthRatio(curve, ratio);

        return toRect(
          x + (edge.labelOffsetX ?? 0),
          y + (edge.labelOffsetY ?? 0),
          edge.labelWidth,
          edge.labelHeight,
          LABEL_GAP / 2
        );
      };
      let best = { ratio: 0.5, cost: Infinity };
      for (const ratio of LABEL_RATIOS) {
        const cost = placementCost(edge.id, labelRectAt(ratio));
        if (cost < best.cost) {
          best = { ratio, cost };
        }
        if (cost === 0) {
          break;
        }
      }
      placedLabels.push(labelRectAt(best.ratio));
      routes.set(edge.id, { curveOffset, labelPlacement: best.ratio });
    });

  return routes;
}
