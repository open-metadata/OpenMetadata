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
import { EntityLineageNodeType, EntityType } from '../enums/entity.enum';
import type {
  EdgeDetails,
  LineageData,
  NodeData,
} from '../interface/lineage.interface';
import { parseLineageData } from './EntityLineagePureUtils';

jest.mock('../rest/miscAPI', () => ({
  addLineage: jest.fn(),
  deleteLineageEdge: jest.fn(),
}));

const ROOT = 'svc.db.schema.root';

const tableNode = (
  fqn: string,
  nodeDepth: number,
  paging: NodeData['paging'] = {}
): NodeData => ({
  entity: {
    id: `id-${fqn}`,
    type: EntityType.TABLE,
    name: fqn,
    fullyQualifiedName: fqn,
    entityType: EntityType.TABLE,
    columns: [],
  } as NodeData['entity'],
  paging,
  nodeDepth,
});

const edge = (
  from: string,
  to: string,
  extra: Partial<EdgeDetails> = {}
): EdgeDetails => ({
  fromEntity: {
    id: `id-${from}`,
    type: EntityType.TABLE,
    fullyQualifiedName: from,
  },
  toEntity: { id: `id-${to}`, type: EntityType.TABLE, fullyQualifiedName: to },
  ...extra,
});

const lineage = (
  nodes: NodeData[],
  downstream: EdgeDetails[] = [],
  upstream: EdgeDetails[] = []
): LineageData => ({
  nodes: Object.fromEntries(
    nodes.map((node, index) => [
      `${node.entity.fullyQualifiedName}-${index}`,
      node,
    ])
  ),
  downstreamEdges: Object.fromEntries(
    downstream.map((e, index) => [`down-${index}`, e])
  ),
  upstreamEdges: Object.fromEntries(
    upstream.map((e, index) => [`up-${index}`, e])
  ),
});

describe('parseLineageData', () => {
  it('keeps one copy of deep-equal nodes and every node that differs', () => {
    const root = tableNode(ROOT, 0);
    const renamed = tableNode(ROOT, 0);
    renamed.entity = { ...renamed.entity, displayName: 'renamed' };

    const { nodes } = parseLineageData(
      lineage([root, tableNode(ROOT, 0), renamed, tableNode('svc.a', 1)]),
      ROOT,
      ROOT
    );

    expect(nodes.map((node) => node.displayName)).toEqual([
      undefined,
      'renamed',
      undefined,
    ]);
    expect(nodes.map((node) => node.fullyQualifiedName)).toEqual([
      ROOT,
      ROOT,
      'svc.a',
    ]);
  });

  it('routes an edge through its pipeline node only when that node was returned', () => {
    const pipeline = {
      id: 'id-svc.pipeline',
      type: EntityType.PIPELINE,
      fullyQualifiedName: 'svc.pipeline',
    };
    const pipelineNode: NodeData = {
      entity: {
        ...pipeline,
        name: 'pipeline',
        entityType: EntityType.PIPELINE,
      } as NodeData['entity'],
      paging: {},
      nodeDepth: 1,
    };

    const { edges } = parseLineageData(
      lineage(
        [tableNode(ROOT, 0), tableNode('svc.a', 1), pipelineNode],
        [
          edge(ROOT, 'svc.a', { pipeline }),
          edge(ROOT, 'svc.b', {
            pipeline: { ...pipeline, fullyQualifiedName: 'svc.missing' },
          }),
        ]
      ),
      ROOT,
      ROOT
    );

    expect(
      edges.map(
        (e) =>
          `${e.fromEntity.fullyQualifiedName}->${e.toEntity.fullyQualifiedName}`
      )
    ).toEqual([
      `${ROOT}->svc.pipeline`,
      'svc.pipeline->svc.a',
      `${ROOT}->svc.b`,
    ]);
  });

  it('adds a load-more node for each side that has fewer edges than its paging count', () => {
    const { nodes, edges } = parseLineageData(
      lineage(
        [
          tableNode(ROOT, 0, {
            entityDownstreamCount: 3,
            entityUpstreamCount: 1,
          }),
          tableNode('svc.a', 1, { entityDownstreamCount: 1 }),
          tableNode('svc.u', -1),
        ],
        [edge(ROOT, 'svc.a'), edge('svc.a', 'svc.b')],
        [edge('svc.u', ROOT)]
      ),
      ROOT,
      ROOT
    );

    const loadMoreNodes = nodes.filter(
      (node) => node.type === EntityLineageNodeType.LOAD_MORE
    );

    expect(loadMoreNodes).toHaveLength(1);
    expect(loadMoreNodes[0].pagination_data).toEqual({
      index: 1,
      parentId: `id-${ROOT}`,
      childrenLength: 2,
    });
    expect(
      edges.some(
        (e) =>
          e.fromEntity.id === `id-${ROOT}` &&
          e.toEntity.id === loadMoreNodes[0].id
      )
    ).toBe(true);
  });

  describe('at the size a busy table returns', () => {
    beforeAll(() => {
      jest.useRealTimers();
    });

    afterAll(() => {
      jest.useFakeTimers();
    });

    // Upstream depth 2 with 50 nodes per layer returns 50 + 2,500 nodes, and
    // the last layer's own upstream edges point at nodes never fetched. The
    // quadratic parse took ~30 s on this input; the budget leaves wide margin
    // for slow CI machines while still failing on any quadratic regression.
    it('parses 2,551 nodes and 52,550 edges within a couple of seconds', () => {
      const nodes = [tableNode(ROOT, 0, { entityUpstreamCount: 50 })];
      const upstream: EdgeDetails[] = [];
      for (let i = 0; i < 50; i++) {
        const first = `svc.u${i}`;
        nodes.push(tableNode(first, -1, { entityUpstreamCount: 50 }));
        upstream.push(edge(first, ROOT));
        for (let j = 0; j < 50; j++) {
          const second = `svc.u${i}.u${j}`;
          nodes.push(tableNode(second, -2, { entityUpstreamCount: 20 }));
          upstream.push(edge(second, first));
          for (let k = 0; k < 20; k++) {
            upstream.push(edge(`svc.unfetched.u${i}.u${j}.u${k}`, second));
          }
        }
      }

      const started = performance.now();
      const result = parseLineageData(lineage(nodes, [], upstream), ROOT, ROOT);
      const elapsedMs = performance.now() - started;

      expect(result.nodes).toHaveLength(2551);
      expect(result.edges).toHaveLength(52550);
      expect(result.entity.fullyQualifiedName).toBe(ROOT);
      expect(elapsedMs).toBeLessThan(3000);
    });
  });
});
