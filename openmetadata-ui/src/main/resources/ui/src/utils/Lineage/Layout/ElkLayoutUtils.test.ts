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

import type { Node } from 'reactflow';
import { layoutLargeGraphWithoutElk } from './LargeGraphLayout';

const createNode = (id: string, nodeDepth: number, height = 66): Node => ({
  id,
  type: 'default',
  position: { x: 0, y: 0 },
  width: 400,
  height,
  data: {
    nodeDepth,
  },
});

describe('layoutLargeGraphWithoutElk', () => {
  it('positions nodes by lineage depth', () => {
    const nodes = [
      createNode('upstream', -1),
      createNode('root', 0),
      createNode('downstream', 1),
    ];

    const result = layoutLargeGraphWithoutElk(nodes);

    expect(result.map((node) => node.position.x)).toEqual([-580, 0, 580]);
  });

  it('stacks nodes vertically within the same depth', () => {
    const nodes = [
      createNode('root-1', 0, 66),
      createNode('root-2', 0, 100),
      createNode('root-3', 0, 50),
    ];

    const result = layoutLargeGraphWithoutElk(nodes);

    expect(result.map((node) => node.position.y)).toEqual([0, 106, 246]);
  });

  it('uses calculated heights to prevent expanded nodes from overlapping', () => {
    const nodes = [createNode('expanded', 0, 66), createNode('next', 0, 66)];

    const calculatedHeights = new Map([
      ['expanded', 300],
      ['next', 66],
    ]);

    const result = layoutLargeGraphWithoutElk(nodes, calculatedHeights);

    expect(result[0].height).toBe(300);
    expect(result[1].position.y).toBe(340);
    expect(result[1].position.y).toBeGreaterThanOrEqual(
      result[0].position.y + (result[0].height ?? 66) + 40
    );
  });

  it('preserves all nodes and makes them visible', () => {
    const nodes = [
      createNode('upstream', -1),
      createNode('root', 0),
      createNode('downstream', 1),
    ];

    const result = layoutLargeGraphWithoutElk(nodes);

    expect(result).toHaveLength(nodes.length);
    expect(result.map((node) => node.id)).toEqual([
      'upstream',
      'root',
      'downstream',
    ]);
    expect(result.every((node) => node.hidden === false)).toBe(true);
  });

  it('treats missing node depth as the root layer', () => {
    const nodes = [
      createNode('root', 0),
      {
        ...createNode('missing-depth', 0),
        data: {},
      },
    ];

    const result = layoutLargeGraphWithoutElk(nodes);

    expect(result[0].position.x).toBe(0);
    expect(result[1].position.x).toBe(0);
    expect(result[1].position.y).toBe(106);
  });

  it('uses the default node height when height is undefined', () => {
    const nodes = [
      { ...createNode('first', 0), height: undefined },
      { ...createNode('second', 0), height: undefined },
    ];

    const result = layoutLargeGraphWithoutElk(nodes);

    expect(result.map((node) => node.position.y)).toEqual([0, 106]);
  });
});
