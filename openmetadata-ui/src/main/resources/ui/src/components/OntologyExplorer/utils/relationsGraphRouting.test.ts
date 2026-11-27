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
import { routeRelationsGraphEdges, RoutingNode } from './relationsGraphRouting';

const node = (id: string, x: number, y: number): RoutingNode => ({
  id,
  x,
  y,
  width: 100,
  height: 32,
});

const label = { labelWidth: 80, labelHeight: 20 };

describe('routeRelationsGraphEdges', () => {
  it('keeps an edge straight with a centred label when nothing is in its way', () => {
    const routes = routeRelationsGraphEdges(
      [node('a', 0, 0), node('b', 300, 0)],
      [{ id: 'e', source: 'a', target: 'b', ...label }]
    );

    expect(routes.get('e')).toEqual({ curveOffset: 0, labelPlacement: 0.5 });
  });

  it('bends an edge around a term sitting between its ends', () => {
    const routes = routeRelationsGraphEdges(
      [node('a', 0, 0), node('middle', 300, 0), node('b', 600, 0)],
      [{ id: 'e', source: 'a', target: 'b', ...label }]
    );

    expect(routes.get('e')?.curveOffset).not.toBe(0);
  });

  it('bends a long edge around a term that sits between two curve samples', () => {
    const routes = routeRelationsGraphEdges(
      [node('a', 0, 0), node('middle', 1100, 0), node('b', 10000, 0)],
      [{ id: 'e', source: 'a', target: 'b', ...label }]
    );

    expect(routes.get('e')?.curveOffset).not.toBe(0);
  });

  it('picks the bend crossing the fewest terms when none clears them all', () => {
    // A column of terms at x=500 blocks every bend; the straight line also
    // crosses the terms at x=300 and x=700, which a wide enough bend avoids.
    const wall = Array.from({ length: 21 }, (_, i) =>
      node(`wall-${i}`, 500, -500 + i * 50)
    );
    const routes = routeRelationsGraphEdges(
      [
        node('a', 0, 0),
        node('b', 1000, 0),
        node('left', 300, 0),
        node('right', 700, 0),
        ...wall,
      ],
      [{ id: 'e', source: 'a', target: 'b', ...label }]
    );

    expect(routes.get('e')?.curveOffset).not.toBe(0);
  });

  it('slides apart the labels of two edges that share a midpoint', () => {
    const routes = routeRelationsGraphEdges(
      [
        node('left', 0, 0),
        node('right', 400, 0),
        node('top', 200, -200),
        node('bottom', 200, 200),
      ],
      [
        { id: 'horizontal', source: 'left', target: 'right', ...label },
        { id: 'vertical', source: 'top', target: 'bottom', ...label },
      ]
    );
    const placements = [
      routes.get('horizontal')?.labelPlacement,
      routes.get('vertical')?.labelPlacement,
    ];

    expect(placements).not.toEqual([0.5, 0.5]);
  });

  it('skips self-loops and edges to terms that are not on the canvas', () => {
    const routes = routeRelationsGraphEdges(
      [node('a', 0, 0)],
      [
        { id: 'loop', source: 'a', target: 'a', ...label },
        { id: 'dangling', source: 'a', target: 'gone', ...label },
      ]
    );

    expect(routes.size).toBe(0);
  });
});
