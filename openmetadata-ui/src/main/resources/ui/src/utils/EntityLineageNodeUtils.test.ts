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
import type { EntityReference } from '../generated/type/entityReference';
import type { EdgeDetails } from '../interface/lineage.interface';
import {
  getNodeLineageData,
  getUpstreamDownstreamNodesEdges,
} from './EntityLineageNodeUtils';

const ref = (fqn: string): EntityReference => ({
  id: `id-${fqn}`,
  type: 'table',
  fullyQualifiedName: fqn,
});

const edge = (from: string, to: string): EdgeDetails => ({
  fromEntity: ref(from) as EdgeDetails['fromEntity'],
  toEntity: ref(to) as EdgeDetails['toEntity'],
});

describe('getNodeLineageData', () => {
  it('should keep lineageSqlQueries on the node so the edge drawer can resolve sqlQueryKey', () => {
    const lineageSqlQueries = {
      '1': 'CREATE TABLE t AS SELECT * FROM s',
    };
    const node = {
      id: 'n1',
      name: 'target',
      fullyQualifiedName: 'svc.db.sch.target',
      lineageSqlQueries,
    } as unknown as EntityReference;

    const result = getNodeLineageData(node) as {
      lineageSqlQueries?: Record<string, string>;
    };

    expect(result.lineageSqlQueries).toEqual(lineageSqlQueries);
  });
});

describe('getUpstreamDownstreamNodesEdges', () => {
  it('visits each node of a cycle once and stops', () => {
    const nodes = ['root', 'a', 'b'].map(ref);
    const edges = [edge('root', 'a'), edge('a', 'b'), edge('b', 'root')];

    const { downstreamNodes, upstreamNodes } = getUpstreamDownstreamNodesEdges(
      edges,
      nodes,
      'root'
    );

    expect(downstreamNodes.map((node) => node.fullyQualifiedName)).toEqual([
      'a',
      'b',
      'root',
    ]);
    expect(upstreamNodes.map((node) => node.fullyQualifiedName)).toEqual([
      'b',
      'a',
      'root',
    ]);
  });

  it('keeps edges to nodes that were not returned but does not walk past them', () => {
    const nodes = ['root', 'a'].map(ref);
    const edges = [edge('unfetched', 'a'), edge('a', 'root')];

    const { upstreamEdges, upstreamNodes } = getUpstreamDownstreamNodesEdges(
      edges,
      nodes,
      'root'
    );

    expect(upstreamEdges).toEqual([edge('a', 'root'), edge('unfetched', 'a')]);
    expect(upstreamNodes.map((node) => node.fullyQualifiedName)).toEqual(['a']);
  });

  describe('at the size a busy table returns', () => {
    beforeAll(() => {
      jest.useRealTimers();
    });

    afterAll(() => {
      jest.useFakeTimers();
    });

    // Scanning every edge per visited node grows with nodes x edges and took
    // over a second here; the indexed walk takes tens of milliseconds.
    it('walks 2,551 nodes and 52,550 edges in well under a second', () => {
      const nodes = [ref('root')];
      const edges: EdgeDetails[] = [];
      for (let i = 0; i < 50; i++) {
        nodes.push(ref(`u${i}`));
        edges.push(edge(`u${i}`, 'root'));
        for (let j = 0; j < 50; j++) {
          nodes.push(ref(`u${i}.u${j}`));
          edges.push(edge(`u${i}.u${j}`, `u${i}`));
          for (let k = 0; k < 20; k++) {
            edges.push(edge(`unfetched.u${i}.u${j}.u${k}`, `u${i}.u${j}`));
          }
        }
      }

      const started = performance.now();
      const { upstreamNodes, upstreamEdges } = getUpstreamDownstreamNodesEdges(
        edges,
        nodes,
        'root'
      );
      const elapsedMs = performance.now() - started;

      expect(upstreamNodes).toHaveLength(2550);
      expect(upstreamEdges).toHaveLength(52550);
      expect(elapsedMs).toBeLessThan(300);
    });
  });
});
