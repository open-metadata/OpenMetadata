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
import { graphlib, layout } from '@dagrejs/dagre';

export interface CardPosition {
  left: number;
  top: number;
}

export interface CardBox extends CardPosition {
  height: number;
  width: number;
}

export interface CardSize {
  height: number;
  width: number;
}

export interface ClusterLink {
  from: string;
  to: string;
}

export interface KeyedClusterLink extends ClusterLink {
  key: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ClusterLayout {
  height: number;
  positions: Map<string, CardPosition>;
  // Bend points per link key, from the source border to the target border,
  // detouring around the cards in the columns the link crosses.
  routes: Map<string, Point[]>;
  width: number;
}

export interface EdgeGeometry {
  arrowPath: string;
  labelLeft: number;
  labelTop: number;
  path: string;
}

type CardSide = 'left' | 'right' | 'top' | 'bottom';

interface EdgeEnd {
  cardId: string;
  key: string;
  side: CardSide;
  toward: Point;
}

interface PlannedLink extends KeyedClusterLink {
  fromBox: CardBox;
  fromSide: CardSide;
  // Where each end heads: the other card, or the route's neighbouring bend.
  fromToward: Point;
  route?: Point[];
  toBox: CardBox;
  toSide: CardSide;
  toToward: Point;
}

export const CLUSTER_LAYOUT_MARGIN = 48;
const RANK_SEPARATION = 120;
const NODE_SEPARATION = 36;
const GRID_GAP = 48;
const MIN_GRID_COLUMNS = 3;
const ANCHOR_SLOT_SPACING = 14;
const ANCHOR_SIDE_INSET = 18;
const CONTROL_DISTANCE_MIN = 36;
const CONTROL_DISTANCE_MAX = 110;
const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 3.5;
const CURVE_SAMPLES_PER_SEGMENT = 12;

const SIDE_NORMALS: Record<CardSide, Point> = {
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
};

function centerOf(box: CardBox): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// The side of `box` through which the straight line to `target` leaves it.
function exitSide(box: CardBox, target: Point): CardSide {
  const center = centerOf(box);
  const deltaX = target.x - center.x;
  const deltaY = target.y - center.y;
  const leavesThroughVerticalSide =
    Math.abs(deltaX) * box.height >= Math.abs(deltaY) * box.width;
  if (leavesThroughVerticalSide) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function isVerticalSide(side: CardSide): boolean {
  return side === 'left' || side === 'right';
}

function anchorOnSide(box: CardBox, side: CardSide, slotOffset: number): Point {
  const center = centerOf(box);
  if (isVerticalSide(side)) {
    const limit = Math.max(0, box.height / 2 - ANCHOR_SIDE_INSET);
    const clamped = Math.max(-limit, Math.min(limit, slotOffset));

    return {
      x: side === 'right' ? box.left + box.width : box.left,
      y: center.y + clamped,
    };
  }
  const limit = Math.max(0, box.width / 2 - ANCHOR_SIDE_INSET);
  const clamped = Math.max(-limit, Math.min(limit, slotOffset));

  return {
    x: center.x + clamped,
    y: side === 'bottom' ? box.top + box.height : box.top,
  };
}

// Spread the edges that share a card side along it, ordered by where they
// head, so they neither overlap nor cross at the card.
function assignSlotOffsets(ends: EdgeEnd[]): Map<string, number> {
  const groups = new Map<string, EdgeEnd[]>();
  ends.forEach((end) => {
    const groupKey = `${end.cardId}|${end.side}`;
    const group = groups.get(groupKey);
    if (group) {
      group.push(end);
    } else {
      groups.set(groupKey, [end]);
    }
  });
  const offsets = new Map<string, number>();
  groups.forEach((group) => {
    const sorted = [...group].sort((left, right) =>
      isVerticalSide(left.side)
        ? left.toward.y - right.toward.y
        : left.toward.x - right.toward.x
    );
    sorted.forEach((end, index) => {
      offsets.set(
        `${end.key}|${end.cardId}`,
        (index - (sorted.length - 1) / 2) * ANCHOR_SLOT_SPACING
      );
    });
  });

  return offsets;
}

function cubicPoint(points: Point[], t: number): Point {
  const [p0, p1, p2, p3] = points;
  const inverse = 1 - t;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * t;
  const c = 3 * inverse * t ** 2;
  const d = t ** 3;

  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function buildArrowPath(tip: Point, towards: Point): string {
  const deltaX = tip.x - towards.x;
  const deltaY = tip.y - towards.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const unitX = deltaX / length;
  const unitY = deltaY / length;
  const baseX = tip.x - unitX * ARROW_LENGTH;
  const baseY = tip.y - unitY * ARROW_LENGTH;

  return [
    `M ${tip.x} ${tip.y}`,
    `L ${baseX - unitY * ARROW_HALF_WIDTH} ${baseY + unitX * ARROW_HALF_WIDTH}`,
    `L ${baseX + unitY * ARROW_HALF_WIDTH} ${baseY - unitX * ARROW_HALF_WIDTH}`,
    'Z',
  ].join(' ');
}

function buildGeometry(
  from: { anchor: Point; side: CardSide },
  to: { anchor: Point; side: CardSide }
): EdgeGeometry {
  const distance = Math.hypot(
    to.anchor.x - from.anchor.x,
    to.anchor.y - from.anchor.y
  );
  const reach = Math.min(
    CONTROL_DISTANCE_MAX,
    Math.max(CONTROL_DISTANCE_MIN, distance / 2)
  );
  const fromNormal = SIDE_NORMALS[from.side];
  const toNormal = SIDE_NORMALS[to.side];
  const points: Point[] = [
    from.anchor,
    {
      x: from.anchor.x + fromNormal.x * reach,
      y: from.anchor.y + fromNormal.y * reach,
    },
    {
      x: to.anchor.x + toNormal.x * reach,
      y: to.anchor.y + toNormal.y * reach,
    },
    to.anchor,
  ];
  const [start, control1, control2, end] = points;
  const middle = cubicPoint(points, 0.5);

  return {
    arrowPath: buildArrowPath(end, control2),
    labelLeft: middle.x,
    labelTop: middle.y,
    path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`,
  };
}

function pointAlong(points: Point[], fraction: number): Point {
  const lengths = points
    .slice(1)
    .map((point, index) =>
      Math.hypot(point.x - points[index].x, point.y - points[index].y)
    );
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] && lengths[index] > 0) {
      const ratio = remaining / lengths[index];
      const start = points[index];
      const end = points[index + 1];

      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    remaining -= lengths[index];
  }

  return points[points.length - 1];
}

interface CubicSegment {
  control1: Point;
  control2: Point;
  end: Point;
}

function lineAsCubic(from: Point, to: Point): CubicSegment {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  return {
    control1: { x: from.x + deltaX / 3, y: from.y + deltaY / 3 },
    control2: { x: from.x + (2 * deltaX) / 3, y: from.y + (2 * deltaY) / 3 },
    end: to,
  };
}

function basisCubic(
  previous: Point,
  current: Point,
  next: Point
): CubicSegment {
  return {
    control1: {
      x: (2 * previous.x + current.x) / 3,
      y: (2 * previous.y + current.y) / 3,
    },
    control2: {
      x: (previous.x + 2 * current.x) / 3,
      y: (previous.y + 2 * current.y) / 3,
    },
    end: {
      x: (previous.x + 4 * current.x + next.x) / 6,
      y: (previous.y + 4 * current.y + next.y) / 6,
    },
  };
}

// A uniform B-spline over the bend points (d3's curveBasis): smooth through
// the bends, yet it starts and ends exactly on the card borders.
function basisCurve(points: Point[]): CubicSegment[] {
  const [first, second] = points;
  const last = points[points.length - 1];
  if (points.length < 3) {
    return [lineAsCubic(first, last)];
  }
  const lead = {
    x: (5 * first.x + second.x) / 6,
    y: (5 * first.y + second.y) / 6,
  };
  const bends = points
    .slice(2)
    .map((point, index) => basisCubic(points[index], points[index + 1], point));
  const tail = basisCubic(points[points.length - 2], last, last);

  return [
    lineAsCubic(first, lead),
    ...bends,
    tail,
    lineAsCubic(tail.end, last),
  ];
}

function sampleCurve(start: Point, segments: CubicSegment[]): Point[] {
  const samples = [start];
  segments.reduce((from, segment) => {
    for (let step = 1; step <= CURVE_SAMPLES_PER_SEGMENT; step += 1) {
      samples.push(
        cubicPoint(
          [from, segment.control1, segment.control2, segment.end],
          step / CURVE_SAMPLES_PER_SEGMENT
        )
      );
    }

    return segment.end;
  }, start);

  return samples;
}

function formatPoint(point: Point): string {
  return `${point.x} ${point.y}`;
}

function buildRouteGeometry(route: Point[]): EdgeGeometry {
  const start = route[0];
  const segments = basisCurve(route);
  // The curve rounds off each bend, so the label is placed on the curve itself.
  const label = pointAlong(sampleCurve(start, segments), 0.5);

  return {
    arrowPath: buildArrowPath(route[route.length - 1], route[route.length - 2]),
    labelLeft: label.x,
    labelTop: label.y,
    path: [
      `M ${formatPoint(start)}`,
      ...segments.map(
        ({ control1, control2, end }) =>
          `C ${formatPoint(control1)} ${formatPoint(control2)} ${formatPoint(
            end
          )}`
      ),
    ].join(' '),
  };
}

// Routed links run through the card-free gaps between columns, so they leave
// and enter through a left or right side. Dagre's own end point aims straight
// at the next bend and can cut through a card stacked in the same column.
function columnSide(box: CardBox, toward: Point): CardSide {
  return toward.x >= centerOf(box).x ? 'right' : 'left';
}

function planLink(
  link: KeyedClusterLink,
  fromBox: CardBox,
  toBox: CardBox,
  route: Point[] | undefined
): PlannedLink {
  if (route && route.length > 1) {
    const fromToward = route[1];
    const toToward = route[route.length - 2];

    return {
      ...link,
      fromBox,
      fromSide: columnSide(fromBox, fromToward),
      fromToward,
      route,
      toBox,
      toSide: columnSide(toBox, toToward),
      toToward,
    };
  }
  const fromCenter = centerOf(fromBox);
  const toCenter = centerOf(toBox);

  return {
    ...link,
    fromBox,
    fromSide: exitSide(fromBox, toCenter),
    fromToward: toCenter,
    toBox,
    toSide: exitSide(toBox, fromCenter),
    toToward: fromCenter,
  };
}

/**
 * Draws every link between the borders of the cards it joins, ending in an
 * arrowhead on the target's border. A link with a laid-out route follows it
 * around the cards in between; any other link leaves the source through the
 * side facing the target and enters the target perpendicular to its facing
 * side. Links sharing a card side fan out along it in the order they head.
 */
export function buildClusterEdgeGeometry(
  links: KeyedClusterLink[],
  boxes: Map<string, CardBox>,
  routes: Map<string, Point[]> = new Map()
): Map<string, EdgeGeometry> {
  const planned = links.flatMap((link) => {
    const fromBox = boxes.get(link.from);
    const toBox = boxes.get(link.to);

    return link.from !== link.to && fromBox && toBox
      ? [planLink(link, fromBox, toBox, routes.get(link.key))]
      : [];
  });
  const offsets = assignSlotOffsets(
    planned.flatMap((link) => [
      {
        cardId: link.from,
        key: link.key,
        side: link.fromSide,
        toward: link.fromToward,
      },
      {
        cardId: link.to,
        key: link.key,
        side: link.toSide,
        toward: link.toToward,
      },
    ])
  );
  const anchorOf = (link: PlannedLink, end: 'from' | 'to') =>
    end === 'from'
      ? anchorOnSide(
          link.fromBox,
          link.fromSide,
          offsets.get(`${link.key}|${link.from}`) ?? 0
        )
      : anchorOnSide(
          link.toBox,
          link.toSide,
          offsets.get(`${link.key}|${link.to}`) ?? 0
        );

  return new Map(
    planned.map((link): [string, EdgeGeometry] => {
      const fromAnchor = anchorOf(link, 'from');
      const toAnchor = anchorOf(link, 'to');

      return [
        link.key,
        link.route
          ? buildRouteGeometry([
              fromAnchor,
              ...link.route.slice(1, -1),
              toAnchor,
            ])
          : buildGeometry(
              { anchor: fromAnchor, side: link.fromSide },
              { anchor: toAnchor, side: link.toSide }
            ),
      ];
    })
  );
}

function layoutConnected(
  ids: string[],
  sizeOf: (id: string) => CardSize,
  links: KeyedClusterLink[]
): ClusterLayout {
  // A multigraph keeps parallel links apart, each with its own route.
  const graph = new graphlib.Graph({ multigraph: true });
  graph.setGraph({
    marginx: CLUSTER_LAYOUT_MARGIN,
    marginy: CLUSTER_LAYOUT_MARGIN,
    nodesep: NODE_SEPARATION,
    rankdir: 'LR',
    ranksep: RANK_SEPARATION,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  ids.forEach((id) => graph.setNode(id, { ...sizeOf(id) }));
  links.forEach((link) => graph.setEdge(link.from, link.to, {}, link.key));
  layout(graph);

  const positions = new Map<string, CardPosition>();
  ids.forEach((id) => {
    const node = graph.node(id);
    positions.set(id, {
      left: node.x - node.width / 2,
      top: node.y - node.height / 2,
    });
  });
  const routes = new Map(
    links.flatMap((link): Array<[string, Point[]]> => {
      const points = graph.edge(link.from, link.to, link.key)?.points ?? [];

      return points.length > 1
        ? [[link.key, points.map(({ x, y }) => ({ x, y }))]]
        : [];
    })
  );
  const bounds = graph.graph();

  return {
    height: bounds.height ?? 0,
    positions,
    routes,
    width: bounds.width ?? 0,
  };
}

function layoutGrid(
  ids: string[],
  sizeOf: (id: string) => CardSize,
  top: number,
  columns: number
): Omit<ClusterLayout, 'routes'> {
  const positions = new Map<string, CardPosition>();
  let rowTop = top;
  let width = 0;
  for (let rowStart = 0; rowStart < ids.length; rowStart += columns) {
    const row = ids.slice(rowStart, rowStart + columns);
    let left = CLUSTER_LAYOUT_MARGIN;
    let rowHeight = 0;
    row.forEach((id) => {
      const size = sizeOf(id);
      positions.set(id, { left, top: rowTop });
      left += size.width + GRID_GAP;
      rowHeight = Math.max(rowHeight, size.height);
    });
    width = Math.max(width, left - GRID_GAP + CLUSTER_LAYOUT_MARGIN);
    rowTop += rowHeight + GRID_GAP;
  }

  return {
    height: ids.length > 0 ? rowTop - GRID_GAP + CLUSTER_LAYOUT_MARGIN : top,
    positions,
    width,
  };
}

/**
 * Lays related clusters out left-to-right along their links (so every link
 * joins neighbouring columns where possible) and packs unrelated clusters in
 * a grid underneath.
 */
export function layoutDataClusters(
  ids: string[],
  sizeOf: (id: string) => CardSize,
  links: KeyedClusterLink[]
): ClusterLayout {
  const idSet = new Set(ids);
  const connectedLinks = links.filter(
    (link) =>
      link.from !== link.to && idSet.has(link.from) && idSet.has(link.to)
  );
  const linked = new Set(
    connectedLinks.flatMap((link) => [link.from, link.to])
  );
  const connectedIds = ids.filter((id) => linked.has(id));
  const isolatedIds = ids.filter((id) => !linked.has(id));
  const connected =
    connectedIds.length > 0
      ? layoutConnected(connectedIds, sizeOf, connectedLinks)
      : {
          height: 0,
          positions: new Map<string, CardPosition>(),
          routes: new Map<string, Point[]>(),
          width: 0,
        };
  const gridTop =
    connectedIds.length > 0
      ? connected.height - CLUSTER_LAYOUT_MARGIN + GRID_GAP
      : CLUSTER_LAYOUT_MARGIN;
  const cardWidth = ids.length > 0 ? sizeOf(ids[0]).width : 0;
  // As wide as the related layout above, and never a single tall column.
  const columns = Math.max(
    MIN_GRID_COLUMNS,
    Math.ceil(Math.sqrt(isolatedIds.length)),
    Math.floor(
      (connected.width - 2 * CLUSTER_LAYOUT_MARGIN + GRID_GAP) /
        (cardWidth + GRID_GAP)
    )
  );
  const grid = layoutGrid(isolatedIds, sizeOf, gridTop, columns);

  return {
    height: Math.max(connected.height, grid.height),
    positions: new Map([...connected.positions, ...grid.positions]),
    routes: connected.routes,
    width: Math.max(connected.width, grid.width),
  };
}
