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
  buildClusterEdgeGeometry,
  CardBox,
  CardPosition,
  layoutDataClusters,
  Point,
} from './dataGraphLayout';

const CARD = { height: 200, width: 236 };
const sizeOf = () => CARD;

function box(left: number, top: number): CardBox {
  return { left, top, ...CARD };
}

function endpoints(path: string) {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

  return {
    start: { x: numbers[0], y: numbers[1] },
    end: { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] },
  };
}

function isInside(point: Point, position: CardPosition): boolean {
  return (
    point.x > position.left &&
    point.x < position.left + CARD.width &&
    point.y > position.top &&
    point.y < position.top + CARD.height
  );
}

function isOnBorder(point: Point, position: CardPosition): boolean {
  const right = position.left + CARD.width;
  const bottom = position.top + CARD.height;
  const isNear = (value: number, edge: number) => Math.abs(value - edge) < 1;
  const isWithin = (value: number, low: number, high: number) =>
    value >= low - 1 && value <= high + 1;
  const isOnVerticalSide =
    isWithin(point.y, position.top, bottom) &&
    (isNear(point.x, position.left) || isNear(point.x, right));
  const isOnHorizontalSide =
    isWithin(point.x, position.left, right) &&
    (isNear(point.y, position.top) || isNear(point.y, bottom));

  return isOnVerticalSide || isOnHorizontalSide;
}

function samplePolyline(points: Point[]): Point[] {
  return points.slice(1).flatMap((end, index) => {
    const start = points[index];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 4)
    );

    return Array.from({ length: steps }, (_, step) => ({
      x: start.x + ((end.x - start.x) * step) / steps,
      y: start.y + ((end.y - start.y) * step) / steps,
    }));
  });
}

function overlaps(a: CardPosition, b: CardPosition): boolean {
  return (
    a.left < b.left + CARD.width &&
    b.left < a.left + CARD.width &&
    a.top < b.top + CARD.height &&
    b.top < a.top + CARD.height
  );
}

describe('buildClusterEdgeGeometry', () => {
  it('runs from the facing side of the source to the facing side of the target', () => {
    const geometry = buildClusterEdgeGeometry(
      [{ from: 'a', key: 'a-b', to: 'b' }],
      new Map([
        ['a', box(0, 0)],
        ['b', box(500, 0)],
      ])
    ).get('a-b');
    const { start, end } = endpoints(geometry?.path ?? '');

    expect(start.x).toBe(236);
    expect(start.y).toBeGreaterThan(0);
    expect(start.y).toBeLessThan(200);
    expect(end.x).toBe(500);
    expect(geometry?.arrowPath).toMatch(/^M 500 /);
    expect(geometry?.labelLeft).toBeGreaterThan(236);
    expect(geometry?.labelLeft).toBeLessThan(500);
  });

  it('leaves through the bottom and enters through the top for stacked cards', () => {
    const geometry = buildClusterEdgeGeometry(
      [{ from: 'upper', key: 'down', to: 'lower' }],
      new Map([
        ['upper', box(0, 0)],
        ['lower', box(0, 400)],
      ])
    ).get('down');
    const { start, end } = endpoints(geometry?.path ?? '');

    expect(start.y).toBe(200);
    expect(end.y).toBe(400);
  });

  it('spreads links that share a card side instead of stacking them', () => {
    const geometry = buildClusterEdgeGeometry(
      [
        { from: 'upper', key: 'upper-target', to: 'target' },
        { from: 'lower', key: 'lower-target', to: 'target' },
      ],
      new Map([
        ['upper', box(0, 0)],
        ['lower', box(0, 260)],
        ['target', box(600, 130)],
      ])
    );
    const upperEnd = endpoints(geometry.get('upper-target')?.path ?? '').end;
    const lowerEnd = endpoints(geometry.get('lower-target')?.path ?? '').end;

    expect(upperEnd.x).toBe(600);
    expect(lowerEnd.x).toBe(600);
    expect(upperEnd.y).toBeLessThan(lowerEnd.y);
  });

  it('follows a laid-out route from border to border instead of the chord', () => {
    const route = [
      { x: 236, y: 100 },
      { x: 400, y: 330 },
      { x: 700, y: 330 },
      { x: 864, y: 100 },
    ];
    const geometry = buildClusterEdgeGeometry(
      [{ from: 'a', key: 'a-c', to: 'c' }],
      new Map([
        ['a', box(0, 0)],
        ['c', box(864, 0)],
      ]),
      new Map([['a-c', route]])
    ).get('a-c');
    const { start, end } = endpoints(geometry?.path ?? '');

    expect(start).toEqual({ x: 236, y: 100 });
    expect(end).toEqual({ x: 864, y: 100 });
    expect(geometry?.arrowPath).toMatch(/^M 864 100 /);
    // The label sits on the drawn curve, which rounds off the route's bends.
    expect(geometry?.labelLeft).toBeCloseTo(550, 0);
    expect(geometry?.labelTop).toBeCloseTo(320.4, 0);
  });

  it('leaves a routed link through the side facing the next column, not onto a stacked card', () => {
    // Dagre ends this route on the source's bottom border, aiming at a bend far
    // below; a card stacked under the source would sit in the way.
    const route = [
      { x: 150, y: 200 },
      { x: 296, y: 700 },
      { x: 360, y: 700 },
    ];
    const geometry = buildClusterEdgeGeometry(
      [{ from: 'source', key: 'down', to: 'target' }],
      new Map([
        ['source', box(0, 0)],
        ['stacked', box(0, 260)],
        ['target', box(360, 600)],
      ]),
      new Map([['down', route]])
    ).get('down');
    const { start, end } = endpoints(geometry?.path ?? '');

    expect(start.x).toBe(236);
    expect(start.y).toBeGreaterThan(0);
    expect(start.y).toBeLessThan(200);
    expect(end.x).toBe(360);
  });

  it('skips self links and links to cards that are not laid out', () => {
    const geometry = buildClusterEdgeGeometry(
      [
        { from: 'a', key: 'self', to: 'a' },
        { from: 'a', key: 'dangling', to: 'missing' },
      ],
      new Map([['a', box(0, 0)]])
    );

    expect(geometry.size).toBe(0);
  });
});

describe('layoutDataClusters', () => {
  it('lays a link out left to right without overlapping cards', () => {
    const { positions } = layoutDataClusters(['source', 'target'], sizeOf, [
      { from: 'source', key: 'source-target', to: 'target' },
    ]);
    const source = positions.get('source') as CardPosition;
    const target = positions.get('target') as CardPosition;

    expect(target.left).toBeGreaterThanOrEqual(source.left + CARD.width);
    expect(overlaps(source, target)).toBe(false);
  });

  it('routes a link that skips a column around the card in that column', () => {
    const { positions, routes } = layoutDataClusters(['a', 'b', 'c'], sizeOf, [
      { from: 'a', key: 'a-b', to: 'b' },
      { from: 'b', key: 'b-c', to: 'c' },
      { from: 'a', key: 'a-c', to: 'c' },
    ]);
    const route = routes.get('a-c') ?? [];

    expect(route.length).toBeGreaterThan(2);
    expect(isOnBorder(route[0], positions.get('a') as CardPosition)).toBe(true);
    expect(
      isOnBorder(route[route.length - 1], positions.get('c') as CardPosition)
    ).toBe(true);

    samplePolyline(route).forEach((point) => {
      expect(isInside(point, positions.get('b') as CardPosition)).toBe(false);
    });
  });

  it('packs unrelated clusters in a grid below the related ones', () => {
    const ids = ['a', 'b', 'lone-1', 'lone-2', 'lone-3', 'lone-4'];
    const { height, positions, width } = layoutDataClusters(ids, sizeOf, [
      { from: 'a', key: 'a-b', to: 'b' },
    ]);
    const relatedBottom = Math.max(
      ...['a', 'b'].map((id) => (positions.get(id)?.top ?? 0) + CARD.height)
    );
    const placed = ids.map((id) => positions.get(id) as CardPosition);

    ['lone-1', 'lone-2', 'lone-3', 'lone-4'].forEach((id) => {
      expect(positions.get(id)?.top).toBeGreaterThan(relatedBottom);
    });
    placed.forEach((position, index) => {
      placed.slice(index + 1).forEach((other) => {
        expect(overlaps(position, other)).toBe(false);
      });

      expect(position.left + CARD.width).toBeLessThanOrEqual(width);
      expect(position.top + CARD.height).toBeLessThanOrEqual(height);
    });
  });
});
