/*
 *  Copyright 2025 Collate.
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

import { NodeData } from '../../components/Lineage/Lineage.interface';
import { EImpactLevel } from '../../components/LineageTable/LineageTable.interface';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { TagSource } from '../../generated/type/tagLabel';
import {
  getSearchNameEsQuery,
  LINEAGE_DEPENDENCY_OPTIONS,
  LINEAGE_IMPACT_OPTIONS,
  prepareColumnLevelNodesFromEdges,
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
  prepareUpstreamColumnLevelNodesFromUpstreamEdges,
} from './LineageUtils';

describe('LineageUtils', () => {
  const mockNodes: Record<string, NodeData> = {
    'test.table1': {
      entity: {
        id: 'entity1',
        fullyQualifiedName: 'test.table1',
        name: 'table1',
        type: 'table',
        owners: [
          {
            id: 'owner1',
            name: 'John Doe',
            fullyQualifiedName: 'john.doe',
            type: 'user',
          },
        ],
        tier: {
          tagFQN: 'Tier.Tier1',
          name: 'Tier1',
          description: 'Tier 1 data',
          source: TagSource.Classification,
          labelType: 'Manual',
          state: 'Confirmed',
        },
        tags: [
          {
            tagFQN: 'PII.Sensitive',
            name: 'Sensitive',
            description: 'Sensitive data',
            source: TagSource.Classification,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
        domains: [
          {
            id: 'domain1',
            name: 'Customer Data',
            fullyQualifiedName: 'customer.data',
            type: 'domain',
          },
        ],
        description: 'Test table description',
      },
      nodeDepth: 1,
      paging: {
        entityDownstreamCount: 0,
        entityUpstreamCount: 0,
      },
    },
    'test.table2': {
      entity: {
        id: 'entity2',
        fullyQualifiedName: 'test.table2',
        name: 'table2',
        type: 'table',
        owners: [],
        tags: [],
        domains: [],
        description: 'Another test table',
      },
      nodeDepth: 2,
      paging: {
        entityDownstreamCount: 0,
        entityUpstreamCount: 0,
      },
    },
  };

  const mockEdges = [
    {
      fromEntity: {
        id: 'entity1',
        fullyQualifiedName: 'test.table1',
        name: 'table1',
        type: 'table',
      },
      toEntity: {
        id: 'entity2',
        fullyQualifiedName: 'test.table2',
        name: 'table2',
        type: 'table',
      },
      columns: [
        {
          fromColumns: ['customer_id', 'customer_name'],
          toColumn: 'customer_id1',
        },
        {
          fromColumns: ['order_date'],
          toColumn: 'created_date',
        },
      ],
      docId: 'edge1',
    },
    {
      fromEntity: {
        id: 'entity2',
        fullyQualifiedName: 'test.table2',
        name: 'table2',
        type: 'table',
      },
      toEntity: {
        id: 'entity3',
        fullyQualifiedName: 'test.table3',
        name: 'table3',
        type: 'table',
      },
      columns: [
        {
          fromColumns: ['status'],
          toColumn: 'order_status',
        },
      ],
      docId: 'edge2',
    },
  ];

  describe('Constants', () => {
    describe('LINEAGE_IMPACT_OPTIONS', () => {
      it('should contain correct impact level options', () => {
        expect(LINEAGE_IMPACT_OPTIONS).toHaveLength(2);

        const tableLevel = LINEAGE_IMPACT_OPTIONS.find(
          (option) => option.key === EImpactLevel.TableLevel
        );
        const columnLevel = LINEAGE_IMPACT_OPTIONS.find(
          (option) => option.key === EImpactLevel.ColumnLevel
        );

        expect(tableLevel).toBeDefined();
        expect(tableLevel?.label).toBe('label.asset-level');
        expect(tableLevel?.key).toBe(EImpactLevel.TableLevel);
        expect(tableLevel?.icon).toBeDefined();

        expect(columnLevel).toBeDefined();
        expect(columnLevel?.label).toBe('label.column-level');
        expect(columnLevel?.key).toBe(EImpactLevel.ColumnLevel);
        expect(columnLevel?.icon).toBeDefined();
      });
    });

    describe('LINEAGE_DEPENDENCY_OPTIONS', () => {
      it('should contain correct dependency options', () => {
        expect(LINEAGE_DEPENDENCY_OPTIONS).toHaveLength(2);

        const direct = LINEAGE_DEPENDENCY_OPTIONS.find(
          (option) => option.key === 'direct'
        );
        const indirect = LINEAGE_DEPENDENCY_OPTIONS.find(
          (option) => option.key === 'indirect'
        );

        expect(direct).toBeDefined();
        expect(direct?.label).toBe('Direct');
        expect(direct?.key).toBe('direct');
        expect(direct?.icon).toBeDefined();

        expect(indirect).toBeDefined();
        expect(indirect?.label).toBe('Indirect');
        expect(indirect?.key).toBe('indirect');
        expect(indirect?.icon).toBeDefined();
      });
    });
  });

  describe('prepareColumnLevelNodesFromEdges', () => {
    it('should prepare column nodes for downstream direction', () => {
      const result = prepareColumnLevelNodesFromEdges(
        mockEdges,
        mockNodes,
        LineageDirection.Downstream
      );

      // Only 3 nodes from first edge (2+1 fromColumns), second edge skipped due to missing entity
      expect(result).toHaveLength(3);

      // Check first column node - should be flattened to single fromColumn
      const firstNode = result[0];

      expect(firstNode.fromEntity).toEqual(mockEdges[0].fromEntity);
      expect(firstNode.toEntity).toEqual(mockEdges[0].toEntity);
      expect(firstNode.column?.toColumn).toBe('customer_id1');
      expect(firstNode.column?.fromColumns).toEqual(['customer_id']); // Flattened to single item
      expect(firstNode.docId).toBe('customer_id->customer_id1');
      expect(firstNode.nodeDepth).toBe(2); // nodeDepth from toEntity (test.table2)
      expect(firstNode.owners).toEqual([]);
      expect(firstNode.description).toBe('Another test table');

      // Verify columns property is omitted
      expect(firstNode).not.toHaveProperty('columns');

      // Check second column node - second fromColumn from same column mapping
      const secondNode = result[1];

      expect(secondNode.column.toColumn).toBe('customer_id1');
      expect(secondNode.column.fromColumns).toEqual(['customer_name']); // Second flattened fromColumn
      expect(secondNode.docId).toBe('customer_name->customer_id1');
    });

    it('should prepare column nodes for upstream direction', () => {
      const result = prepareColumnLevelNodesFromEdges(
        mockEdges,
        mockNodes,
        LineageDirection.Upstream
      );

      // Only 3 nodes from first edge, second edge skipped (fromEntity is table2 which exists, but it's edge 2)
      expect(result).toHaveLength(4);

      // Check first column node for upstream - should be flattened
      const firstNode = result[0];

      expect(firstNode.fromEntity).toEqual(mockEdges[0].fromEntity);
      expect(firstNode.toEntity).toEqual(mockEdges[0].toEntity);
      expect(firstNode.column.toColumn).toBe('customer_id1');
      expect(firstNode.column.fromColumns).toEqual(['customer_id']); // Flattened
      expect(firstNode.docId).toBe('customer_id->customer_id1');
      expect(firstNode.nodeDepth).toBe(1); // nodeDepth from fromEntity (test.table1)
      expect(firstNode.owners).toEqual(mockNodes['test.table1'].entity.owners);
      expect(firstNode.tier).toEqual(mockNodes['test.table1'].entity.tier);
      expect(firstNode.tags).toEqual(mockNodes['test.table1'].entity.tags);
      expect(firstNode.domains).toEqual(
        mockNodes['test.table1'].entity.domains
      );
      expect(firstNode.description).toBe('Test table description');

      // Fourth node should be from second edge (fromEntity is test.table2, which exists)
      const fourthNode = result[3];

      expect(fourthNode.fromEntity).toEqual(mockEdges[1].fromEntity);
      expect(fourthNode.column?.fromColumns).toEqual(['status']);
      expect(fourthNode.nodeDepth).toBe(2); // nodeDepth from test.table2
    });

    it('should handle edges without columns', () => {
      const edgesWithoutColumns = [
        {
          ...mockEdges[0],
          columns: undefined,
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgesWithoutColumns,
        mockNodes,
        LineageDirection.Downstream
      );

      expect(result).toHaveLength(0);
    });

    it('should handle edges with empty columns array', () => {
      const edgesWithEmptyColumns = [
        {
          ...mockEdges[0],
          columns: [],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgesWithEmptyColumns,
        mockNodes,
        LineageDirection.Downstream
      );

      expect(result).toHaveLength(0);
    });

    it('should skip nodes when entity data is missing', () => {
      const edgesWithMissingEntity = [
        {
          fromEntity: {
            id: 'missing',
            fullyQualifiedName: 'missing.table',
            name: 'missing',
            type: 'table',
          },
          toEntity: {
            id: 'missing2',
            fullyQualifiedName: 'missing.table2',
            name: 'missing2',
            type: 'table',
          },
          columns: [
            {
              fromColumns: ['col1'],
              toColumn: 'col2',
            },
          ],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgesWithMissingEntity,
        mockNodes,
        LineageDirection.Downstream
      );

      // Should skip the node entirely when entityData is missing
      expect(result).toHaveLength(0);
    });

    it('should preserve lineage details and other edge properties', () => {
      const result = prepareColumnLevelNodesFromEdges(
        mockEdges,
        mockNodes,
        LineageDirection.Downstream
      );

      const firstNode = result[0];

      // docId is now generated from fromColumn->toColumn, not from the original edge docId
      expect(firstNode.docId).toBe('customer_id->customer_id1');
      expect(firstNode.fromEntity).toEqual(mockEdges[0].fromEntity);
      expect(firstNode.toEntity).toEqual(mockEdges[0].toEntity);
    });
  });

  describe('prepareDownstreamColumnLevelNodesFromDownstreamEdges', () => {
    it('should call prepareColumnLevelNodesFromEdges with downstream direction', () => {
      const result = prepareDownstreamColumnLevelNodesFromDownstreamEdges(
        mockEdges,
        mockNodes
      );

      // Only 3 nodes from first edge, second edge skipped due to missing entity
      expect(result).toHaveLength(3);

      // Verify it's using downstream direction (toEntity data)
      const firstNode = result[0];

      expect(firstNode.nodeDepth).toBe(2); // nodeDepth from toEntity
      expect(firstNode.description).toBe('Another test table'); // description from toEntity
    });
  });

  describe('prepareUpstreamColumnLevelNodesFromUpstreamEdges', () => {
    it('should call prepareColumnLevelNodesFromEdges with upstream direction', () => {
      const result = prepareUpstreamColumnLevelNodesFromUpstreamEdges(
        mockEdges,
        mockNodes
      );

      expect(result).toHaveLength(4); // 3 fromColumns from first edge, 1 from second

      // Verify it's using upstream direction (fromEntity data)
      const firstNode = result[0];

      expect(firstNode.nodeDepth).toBe(1); // nodeDepth from fromEntity
      expect(firstNode.description).toBe('Test table description'); // description from fromEntity
    });
  });

  describe('getSearchNameEsQuery', () => {
    it('should create correct Elasticsearch query for search text', () => {
      const searchText = 'customer';
      const result = getSearchNameEsQuery(searchText);

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '*customer*',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '*customer*',
                },
              },
            },
          ],
        },
      });
    });

    it('should handle empty search text', () => {
      const result = getSearchNameEsQuery('');

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '**',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '**',
                },
              },
            },
          ],
        },
      });
    });

    it('should handle special characters in search text', () => {
      const searchText = 'test@domain.com';
      const result = getSearchNameEsQuery(searchText);

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '*test@domain.com*',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '*test@domain.com*',
                },
              },
            },
          ],
        },
      });
    });

    it('should handle numeric search text', () => {
      const searchText = '123';
      const result = getSearchNameEsQuery(searchText);

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '*123*',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '*123*',
                },
              },
            },
          ],
        },
      });
    });

    it('should handle search text with spaces', () => {
      const searchText = 'customer data';
      const result = getSearchNameEsQuery(searchText);

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '*customer data*',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '*customer data*',
                },
              },
            },
          ],
        },
      });
    });

    it('should use table fields', () => {
      const searchText = 'status';
      const result = getSearchNameEsQuery(searchText);

      expect(result).toEqual({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: '*status*',
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: '*status*',
                },
              },
            },
          ],
        },
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null or undefined edges gracefully', () => {
      const result = prepareColumnLevelNodesFromEdges(
        [],
        mockNodes,
        LineageDirection.Downstream
      );

      expect(result).toEqual([]);
    });

    it('should skip nodes when nodes map is empty', () => {
      const result = prepareColumnLevelNodesFromEdges(
        mockEdges,
        {},
        LineageDirection.Downstream
      );

      // Should skip all nodes when entity data is not found
      expect(result).toHaveLength(0);
    });

    it('should skip edges with missing entity references', () => {
      const edgesWithMissingEntityRefs = [
        {
          fromEntity: {
            id: 'entity1',
            fullyQualifiedName: '', // Empty FQN
            name: 'table1',
            type: 'table',
          },
          toEntity: {
            id: 'entity2',
            fullyQualifiedName: undefined, // Undefined FQN
            name: 'table2',
            type: 'table',
          },
          columns: [
            {
              fromColumns: ['col1'],
              toColumn: 'col2',
            },
          ],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgesWithMissingEntityRefs,
        mockNodes,
        LineageDirection.Downstream
      );

      // Should skip nodes when FQN is missing or empty
      expect(result).toHaveLength(0);
    });
  });

  describe('Data transformation accuracy', () => {
    it('should correctly pick only specified entity fields', () => {
      const result = prepareColumnLevelNodesFromEdges(
        [mockEdges[0]],
        mockNodes,
        LineageDirection.Upstream
      );

      const firstNode = result[0];

      // Should include these fields
      expect(firstNode.owners).toBeDefined();
      expect(firstNode.tier).toBeDefined();
      expect(firstNode.tags).toBeDefined();
      expect(firstNode.domains).toBeDefined();
      expect(firstNode.description).toBeDefined();

      // Should not include other entity fields
      expect(firstNode['entityType']).toBeUndefined();
      expect(firstNode['id']).toBeUndefined();
      expect(firstNode['name']).toBeUndefined();
    });

    it('should maintain original edge structure except for columns', () => {
      const result = prepareColumnLevelNodesFromEdges(
        [mockEdges[0]],
        mockNodes,
        LineageDirection.Downstream
      );

      const firstNode = result[0];

      expect(firstNode.fromEntity).toEqual(mockEdges[0].fromEntity);
      expect(firstNode.toEntity).toEqual(mockEdges[0].toEntity);
      expect(firstNode.docId).toBe('customer_id->customer_id1'); // Custom docId based on fromColumn and toColumn
      expect(firstNode).not.toHaveProperty('columns');
      expect(firstNode.column?.toColumn).toBe('customer_id1');
      expect(firstNode.column?.fromColumns).toEqual(['customer_id']); // Flattened
    });
  });

  describe('Flattening fromColumns', () => {
    it('should create separate nodes for each fromColumn', () => {
      const edgeWithMultipleFromColumns = [
        {
          fromEntity: {
            id: 'entity1',
            fullyQualifiedName: 'test.table1',
            name: 'table1',
            type: 'table',
          },
          toEntity: {
            id: 'entity2',
            fullyQualifiedName: 'test.table2',
            name: 'table2',
            type: 'table',
          },
          columns: [
            {
              fromColumns: ['col1', 'col2', 'col3'],
              toColumn: 'result',
            },
          ],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgeWithMultipleFromColumns,
        mockNodes,
        LineageDirection.Downstream
      );

      // Should create 3 separate nodes, one for each fromColumn
      expect(result).toHaveLength(3);

      expect(result[0].column?.fromColumns).toEqual(['col1']);
      expect(result[0].column?.toColumn).toBe('result');
      expect(result[0].docId).toBe('col1->result');

      expect(result[1].column?.fromColumns).toEqual(['col2']);
      expect(result[1].column?.toColumn).toBe('result');
      expect(result[1].docId).toBe('col2->result');

      expect(result[2].column?.fromColumns).toEqual(['col3']);
      expect(result[2].column?.toColumn).toBe('result');
      expect(result[2].docId).toBe('col3->result');
    });

    it('should handle empty fromColumns array', () => {
      const edgeWithEmptyFromColumns = [
        {
          fromEntity: {
            id: 'entity1',
            fullyQualifiedName: 'test.table1',
            name: 'table1',
            type: 'table',
          },
          toEntity: {
            id: 'entity2',
            fullyQualifiedName: 'test.table2',
            name: 'table2',
            type: 'table',
          },
          columns: [
            {
              fromColumns: [],
              toColumn: 'result',
            },
          ],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgeWithEmptyFromColumns,
        mockNodes,
        LineageDirection.Downstream
      );

      // Should not create any nodes when fromColumns is empty
      expect(result).toHaveLength(0);
    });

    it('should handle undefined fromColumns', () => {
      const edgeWithUndefinedFromColumns = [
        {
          fromEntity: {
            id: 'entity1',
            fullyQualifiedName: 'test.table1',
            name: 'table1',
            type: 'table',
          },
          toEntity: {
            id: 'entity2',
            fullyQualifiedName: 'test.table2',
            name: 'table2',
            type: 'table',
          },
          columns: [
            {
              fromColumns: undefined,
              toColumn: 'result',
            },
          ],
        },
      ];

      const result = prepareColumnLevelNodesFromEdges(
        edgeWithUndefinedFromColumns,
        mockNodes,
        LineageDirection.Downstream
      );

      // Should not create any nodes when fromColumns is undefined
      expect(result).toHaveLength(0);
    });
  });
});
