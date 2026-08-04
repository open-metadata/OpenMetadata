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
  COMBO_HEADER_HEIGHT,
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_TERM_TO_FIRST_RING_GAP,
  LayoutEngine,
} from '../OntologyExplorer.constants';
import { OntologyNode } from '../OntologyExplorer.interface';
import {
  DAGRE_NODE_SEP,
  DAGRE_RANK_SEP,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './graphConfig';
import {
  computeAssetRingPositions,
  computeGlossaryGroupPositions,
  computeOutermostRingRadius,
} from './layoutCalculations';

// Mirrors the module-private COMBO_PADDING in layoutCalculations.ts, used to
// derive the origin offset applied to every group's local node positions.
const COMBO_PADDING = 12;
const FIRST_RING_RADIUS =
  DATA_MODE_TERM_TO_FIRST_RING_GAP + DATA_MODE_ASSET_CIRCLE_SIZE;

type Point = { x: number; y: number };

const makeNode = (id: string, glossaryId?: string): OntologyNode => ({
  id,
  label: id,
  type: 'term',
  glossaryId,
});

const centroidOf = (points: Point[]): Point => {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });

  return { x: sum.x / points.length, y: sum.y / points.length };
};

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('computeGlossaryGroupPositions', () => {
  it('groups nodes by glossaryId and places ungrouped nodes in their own group', () => {
    const nodes: OntologyNode[] = [
      makeNode('a', 'g1'),
      makeNode('b', 'g1'),
      makeNode('c', 'g2'),
      makeNode('u1'),
      makeNode('u2'),
    ];

    const positions = computeGlossaryGroupPositions(nodes, LayoutEngine.Dagre);

    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c', 'u1', 'u2']);
    // Same-glossary nodes share a macro row inside their group box.
    expect(positions.a.y).toBe(positions.b.y);
    expect(positions.a.x).not.toBe(positions.b.x);
    // Ungrouped nodes form a distinct group placed on a later macro row.
    expect(positions.u1.y).toBeGreaterThan(positions.a.y);
  });

  it('returns an empty map when there are no input nodes', () => {
    expect(computeGlossaryGroupPositions([], LayoutEngine.Dagre)).toEqual({});
  });

  it('centers a single-node group at the group box origin', () => {
    const positions = computeGlossaryGroupPositions(
      [makeNode('solo', 'g1')],
      LayoutEngine.Circular
    );

    expect(positions.solo).toEqual({
      x: COMBO_PADDING + NODE_WIDTH / 2,
      y: COMBO_PADDING + NODE_HEIGHT / 2 + COMBO_HEADER_HEIGHT,
    });
  });

  it('arranges a multi-node circular group evenly on a ring', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`n${i}`, 'g1'));

    const positions = computeGlossaryGroupPositions(
      nodes,
      LayoutEngine.Circular
    );

    const points = nodes.map((n) => positions[n.id]);
    const center = centroidOf(points);
    const radii = points.map((p) => distance(p, center));
    const firstRadius = radii[0];

    radii.forEach((r) => {
      expect(r).toBeCloseTo(firstRadius, 5);
    });

    expect(firstRadius).toBeGreaterThan(100);
  });

  it('clamps the circular ring radius for very large groups', () => {
    const nodes = Array.from({ length: 500 }, (_, i) =>
      makeNode(`n${i}`, 'g1')
    );

    const positions = computeGlossaryGroupPositions(
      nodes,
      LayoutEngine.Circular
    );

    const points = nodes.map((n) => positions[n.id]);
    const center = centroidOf(points);
    const maxRadius = Math.max(...points.map((p) => distance(p, center)));

    // MAX_RING_RADIUS is 480 in the module; radius is capped there.
    expect(Math.abs(maxRadius - 480)).toBeLessThan(1);
  });

  it('spaces dagre grid nodes by nodesPerRow using default H_STEP/V_STEP', () => {
    const nodes: OntologyNode[] = [
      makeNode('a', 'g1'),
      makeNode('b', 'g1'),
      makeNode('c', 'g1'),
      makeNode('d', 'g1'),
    ];

    const positions = computeGlossaryGroupPositions(nodes, LayoutEngine.Dagre);

    // 4 nodes -> 2 cols: a(0,0) b(1,0) c(0,1) d(1,1).
    expect(positions.b.x - positions.a.x).toBe(NODE_WIDTH + DAGRE_NODE_SEP);
    expect(positions.c.y - positions.a.y).toBe(NODE_HEIGHT + DAGRE_RANK_SEP);
    expect(positions.a.y).toBe(positions.b.y);
    expect(positions.a.x).toBe(positions.c.x);
  });

  it('overrides default step sizes with custom nodeSpacingH/nodeSpacingV', () => {
    const nodes: OntologyNode[] = [
      makeNode('a', 'g1'),
      makeNode('b', 'g1'),
      makeNode('c', 'g1'),
      makeNode('d', 'g1'),
    ];

    const positions = computeGlossaryGroupPositions(
      nodes,
      LayoutEngine.Dagre,
      200,
      300
    );

    expect(positions.b.x - positions.a.x).toBe(200);
    expect(positions.c.y - positions.a.y).toBe(300);
  });

  it('falls back to nodeSpacingH for vertical step when nodeSpacingV is omitted', () => {
    const nodes: OntologyNode[] = [
      makeNode('a', 'g1'),
      makeNode('b', 'g1'),
      makeNode('c', 'g1'),
      makeNode('d', 'g1'),
    ];

    const positions = computeGlossaryGroupPositions(
      nodes,
      LayoutEngine.Dagre,
      200
    );

    expect(positions.b.x - positions.a.x).toBe(200);
    expect(positions.c.y - positions.a.y).toBe(200);
  });
});

describe('computeOutermostRingRadius', () => {
  it('returns 0 when there are no assets', () => {
    expect(computeOutermostRingRadius(0)).toBe(0);
  });

  it('places a single asset on the first ring', () => {
    expect(computeOutermostRingRadius(1)).toBe(
      FIRST_RING_RADIUS + DATA_MODE_ASSET_CIRCLE_SIZE / 2
    );
  });

  it('grows the radius as more rings are required', () => {
    const single = computeOutermostRingRadius(1);
    const overflow = computeOutermostRingRadius(50);
    const large = computeOutermostRingRadius(500);

    expect(single).toBeGreaterThan(0);
    expect(overflow).toBeGreaterThan(single);
    expect(large).toBeGreaterThan(overflow);
  });
});

describe('computeAssetRingPositions', () => {
  const TERM_X = 1000;
  const TERM_Y = 500;

  it('returns an empty map for no asset ids', () => {
    expect(computeAssetRingPositions(TERM_X, TERM_Y, [])).toEqual({});
  });

  it('places a single asset at the top of the ring (angle -PI/2)', () => {
    const positions = computeAssetRingPositions(TERM_X, TERM_Y, ['asset-1']);

    expect(positions['asset-1'].x).toBeCloseTo(TERM_X, 5);
    expect(positions['asset-1'].y).toBeCloseTo(TERM_Y - FIRST_RING_RADIUS, 5);
    expect(positions['asset-1'].y).toBeLessThan(TERM_Y);
  });

  it('overflows extra assets onto a farther second ring', () => {
    const assetIds = Array.from({ length: 8 }, (_, i) => `asset-${i}`);

    const positions = computeAssetRingPositions(TERM_X, TERM_Y, assetIds);

    expect(Object.keys(positions)).toHaveLength(8);

    const maxDistance = Math.max(
      ...assetIds.map((id) => distance(positions[id], { x: TERM_X, y: TERM_Y }))
    );

    expect(maxDistance).toBeGreaterThan(FIRST_RING_RADIUS + 1);
  });

  it('offsets every asset position relative to the term coordinates', () => {
    const assetIds = ['asset-1', 'asset-2', 'asset-3'];

    const positions = computeAssetRingPositions(TERM_X, TERM_Y, assetIds);

    assetIds.forEach((id) => {
      expect(distance(positions[id], { x: TERM_X, y: TERM_Y })).toBeCloseTo(
        FIRST_RING_RADIUS,
        5
      );
    });
  });
});
