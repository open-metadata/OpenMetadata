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

import { DependencyType } from '../../generated/type/entityLineage';
import type {
  EdgeDetails,
  EntityLineageResponse,
  LineageNodeType,
  NodeData,
} from '../../interface/lineage.interface';
import {
  applyIndirectEdgeVisibility,
  isIndirectEdgeDetails,
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
} from './LineagePureUtils';

const makeNode = (id: string, fqn = `svc.db.${id}`): LineageNodeType => ({
  id,
  name: id,
  type: 'table',
  fullyQualifiedName: fqn,
});

const makeEdge = (
  fromId: string,
  toId: string,
  dependencyType?: DependencyType
): EdgeDetails => ({
  fromEntity: {
    id: fromId,
    type: 'table',
    fullyQualifiedName: `svc.db.${fromId}`,
  },
  toEntity: { id: toId, type: 'table', fullyQualifiedName: `svc.db.${toId}` },
  dependencyType,
});

describe('LineagePureUtils', () => {
  describe('isIndirectEdgeDetails', () => {
    it('identifies INDIRECT vs DIRECT and unset edges', () => {
      expect(
        isIndirectEdgeDetails({ dependencyType: DependencyType.Indirect })
      ).toBe(true);
      expect(
        isIndirectEdgeDetails({ dependencyType: DependencyType.Direct })
      ).toBe(false);
      expect(isIndirectEdgeDetails({})).toBe(false);
      expect(isIndirectEdgeDetails(undefined)).toBe(false);
    });
  });

  describe('applyIndirectEdgeVisibility', () => {
    it('returns lineage unchanged when showIndirectEdges is true', () => {
      const root = makeNode('root');
      const lineage: EntityLineageResponse = {
        entity: root,
        nodes: [root, makeNode('indirect')],
        edges: [makeEdge('root', 'indirect', DependencyType.Indirect)],
      };

      expect(
        applyIndirectEdgeVisibility(lineage, true, root.fullyQualifiedName)
      ).toBe(lineage);
    });

    it('hides indirect edges and nodes reachable only through hidden indirect edges', () => {
      const root = makeNode('root');
      const directA = makeNode('directA');
      const indirectB = makeNode('indirectB');
      const afterIndirectC = makeNode('afterIndirectC');
      const upstreamIndirect = makeNode('upstreamIndirect');
      const upstreamDirect = makeNode('upstreamDirect');

      const lineage: EntityLineageResponse = {
        entity: root,
        nodes: [
          root,
          directA,
          indirectB,
          afterIndirectC,
          upstreamIndirect,
          upstreamDirect,
        ],
        edges: [
          makeEdge('root', 'directA', DependencyType.Direct),
          makeEdge('root', 'indirectB', DependencyType.Indirect),
          makeEdge('indirectB', 'afterIndirectC', DependencyType.Direct),
          makeEdge('upstreamIndirect', 'root', DependencyType.Indirect),
          makeEdge('upstreamDirect', 'root'),
        ],
      };

      const filtered = applyIndirectEdgeVisibility(
        lineage,
        false,
        root.fullyQualifiedName
      );

      expect(filtered.nodes?.map((node) => node.id)).toEqual([
        'root',
        'directA',
        'upstreamDirect',
      ]);
      expect(
        filtered.edges?.map(
          (edge) => `${edge.fromEntity.id}->${edge.toEntity.id}`
        )
      ).toEqual(['root->directA', 'upstreamDirect->root']);
    });

    it('retains diamond nodes that still have an alternate direct path', () => {
      const root = makeNode('root');
      const directA = makeNode('directA');
      const indirectB = makeNode('indirectB');
      const diamondC = makeNode('diamondC');

      const lineage: EntityLineageResponse = {
        entity: root,
        nodes: [root, directA, indirectB, diamondC],
        edges: [
          makeEdge('root', 'directA', DependencyType.Direct),
          makeEdge('directA', 'diamondC', DependencyType.Direct),
          makeEdge('root', 'indirectB', DependencyType.Indirect),
          makeEdge('indirectB', 'diamondC', DependencyType.Direct),
        ],
      };

      const filtered = applyIndirectEdgeVisibility(
        lineage,
        false,
        root.fullyQualifiedName
      );

      expect(filtered.nodes?.map((node) => node.id)).toEqual([
        'root',
        'directA',
        'diamondC',
      ]);
      expect(
        filtered.edges?.map(
          (edge) => `${edge.fromEntity.id}->${edge.toEntity.id}`
        )
      ).toEqual(['root->directA', 'directA->diamondC']);
    });
  });

  describe('prepareDownstreamColumnLevelNodesFromDownstreamEdges', () => {
    it('preserves dependencyType on column-level impact rows', () => {
      const edge: EdgeDetails = {
        ...makeEdge('root', 'target', DependencyType.Indirect),
        columns: [
          {
            fromColumns: ['svc.db.root.col_a'],
            toColumn: 'svc.db.target.col_b',
          },
        ],
      };
      const nodes: Record<string, NodeData> = {
        'svc.db.target': {
          entity: makeNode('target'),
          paging: {},
          nodeDepth: 1,
          dependencyType: DependencyType.Indirect,
        },
      };

      const rows = prepareDownstreamColumnLevelNodesFromDownstreamEdges(
        [edge],
        nodes
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].dependencyType).toBe(DependencyType.Indirect);
      expect(rows[0].fromColumn).toBe('svc.db.root.col_a');
      expect(rows[0].toColumn).toBe('svc.db.target.col_b');
    });
  });
});
