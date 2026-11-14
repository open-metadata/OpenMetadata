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
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import ELKLayout from './ELKUtil';

const NODE_WIDTH = 400;
const MAPPED_COLUMNS = 50;

// The column layer hands ELK one edge per mapped column. Routing every one of
// them separately stretched the gap between layers to thousands of pixels and,
// at 151 tables, exhausted the browser heap (#34904).
describe('ELKLayout with column-level edges', () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.useFakeTimers();
  });

  it('keeps the configured gap between layers however many columns two tables share', async () => {
    const nodes: ElkNode[] = [{ id: 'root', width: NODE_WIDTH, height: 500 }];
    const edges: ElkExtendedEdge[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push(
        { id: `upstream${i}`, width: NODE_WIDTH, height: 500 },
        { id: `downstream${i}`, width: NODE_WIDTH, height: 500 }
      );
      for (let column = 0; column < MAPPED_COLUMNS; column++) {
        edges.push(
          {
            id: `upstream${i}.c${column}->root.c${column}`,
            sources: [`upstream${i}`],
            targets: ['root'],
          },
          {
            id: `root.c${column}->downstream${i}.c${column}`,
            sources: ['root'],
            targets: [`downstream${i}`],
          }
        );
      }
    }

    const graph = await ELKLayout.layoutGraph(nodes, edges);
    const x = new Map(
      (graph.children ?? []).map((node) => [node.id, node.x ?? 0])
    );
    const layerGap = Number(
      ELKLayout.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers']
    );

    expect(graph.children).toHaveLength(nodes.length);
    expect((x.get('root') ?? 0) - (x.get('upstream0') ?? 0)).toBe(
      NODE_WIDTH + layerGap
    );
    expect((x.get('downstream0') ?? 0) - (x.get('root') ?? 0)).toBe(
      NODE_WIDTH + layerGap
    );
  });
});
