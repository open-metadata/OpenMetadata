/*
 *  Copyright 2022 Collate.
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

import { Edge } from 'reactflow';
import { EdgeTypeEnum } from '../components/Entity/EntityLineage/EntityLineage.interface';
import { EdgeDetails } from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { EntityType } from '../enums/entity.enum';
import { AddLineage, ColumnLineage } from '../generated/api/lineage/addLineage';
import { MOCK_NODES_AND_EDGES } from '../mocks/Lineage.mock';
import { addLineage } from '../rest/miscAPI';
import {
  addLineageHandler,
  createNewEdge,
  getAllTracedEdges,
  getColumnFunctionValue,
  getColumnLineageData,
  getColumnSourceTargetHandles,
  getConnectedNodesEdges,
  getEntityChildrenAndLabel,
  getLineageDetailsObject,
  getLineageEdge,
  getLineageEdgeForAPI,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
} from './EntityLineageUtils';

jest.mock('../rest/miscAPI', () => ({
  addLineage: jest.fn(),
}));

// test
describe('Test EntityLineageUtils utility', () => {
  it('getAllTracedEdges function should work properly', () => {
    const { edges } = MOCK_NODES_AND_EDGES;
    const selectedIncomerColumn =
      'sample_data.ecommerce_db.shopify.dim_location.location_id';
    const incomerNode = getAllTracedEdges(
      selectedIncomerColumn,
      edges,
      [],
      true
    );
    const noData = getAllTracedEdges(selectedIncomerColumn, [], [], true);

    expect(incomerNode).toStrictEqual([
      'sample_data.ecommerce_db.shopify.raw_product_catalog.comments',
    ]);
    expect(noData).toStrictEqual([]);
  });

  it('getLineageDetailsObject should return correct object', () => {
    const edgeWithData = {
      data: {
        edge: {
          sqlQuery: 'SELECT * FROM table',
          columns: ['column1', 'column2'],
          description: 'This is a test',
          pipeline: undefined,
          source: 'Test Source',
        },
      },
    } as Edge;

    const resultWithData = getLineageDetailsObject(edgeWithData);

    expect(resultWithData).toEqual({
      sqlQuery: 'SELECT * FROM table',
      columnsLineage: ['column1', 'column2'],
      description: 'This is a test',
      pipeline: undefined,
      source: 'Test Source',
    });

    const edgeWithoutData = {} as Edge;
    const resultWithoutData = getLineageDetailsObject(edgeWithoutData);

    expect(resultWithoutData).toEqual({
      sqlQuery: '',
      columnsLineage: [],
      description: '',
      pipeline: undefined,
      source: undefined,
    });
  });

  it('should return the correct lineage edge with valid source and target nodes', () => {
    const sourceNode = {
      id: 'sourceId',
      entityType: 'table',
    } as SourceType;
    const targetNode = {
      id: 'targetId',
      entityType: 'table',
    } as SourceType;
    const expectedEdge = {
      fromEntity: { id: 'sourceId', type: 'table' },
      toEntity: { id: 'targetId', type: 'table' },
      lineageDetails: {
        sqlQuery: '',
        columnsLineage: [],
      },
    };

    const result = getLineageEdgeForAPI(sourceNode, targetNode);

    expect(result).toEqual({ edge: expectedEdge });
  });

  it('getLineageEdge should return the lineage edge with correct properties', () => {
    const sourceNode = {
      id: 'sourceId',
      entityType: 'table',
      fullyQualifiedName: 'sourceFqn',
    } as SourceType;
    const targetNode = {
      id: 'targetId',
      entityType: 'table',
      fullyQualifiedName: 'targetFqn',
    } as SourceType;

    const result = getLineageEdge(sourceNode, targetNode);

    expect(result).toEqual({
      edge: {
        fromEntity: {
          id: 'sourceId',
          type: 'table',
          fqn: 'sourceFqn',
        },
        toEntity: {
          id: 'targetId',
          type: 'table',
          fqn: 'targetFqn',
        },
        sqlQuery: '',
      },
    });
    expect(result.edge.fromEntity.type).toBe('table');
    expect(result.edge.toEntity.fqn).toBe('targetFqn');
    expect(result.edge.fromEntity.fqn).toBe('sourceFqn');
    expect(result.edge.toEntity.type).toBe('table');
  });

  it('should handle different scenarios for getColumnLineageData', () => {
    const mockEdge = {
      data: { targetHandle: 'target', sourceHandle: 'source' },
    } as Edge;
    const columnsDataNoMatch = [
      { toColumn: 'column1', fromColumns: ['column2', 'column3'] },
      { toColumn: 'column4', fromColumns: ['column5', 'column6'] },
    ];
    const columnsDataRemoveSource = [
      { toColumn: 'column1', fromColumns: ['column2', 'column3', 'source'] },
      { toColumn: 'column4', fromColumns: ['column5', 'column6'] },
    ];
    const columnsDataEmptyResult = [
      { toColumn: 'column1', fromColumns: ['source'] },
      { toColumn: 'column4', fromColumns: ['column5', 'column6'] },
    ];

    const resultUndefined = getColumnLineageData([], mockEdge);
    const resultNoMatch = getColumnLineageData(columnsDataNoMatch, mockEdge);
    const resultRemoveSource = getColumnLineageData(
      columnsDataRemoveSource,
      mockEdge
    );
    const resultEmptyResult = getColumnLineageData(
      columnsDataEmptyResult,
      mockEdge
    );

    expect(resultUndefined).toEqual([]);
    expect(resultNoMatch).toEqual(columnsDataNoMatch);
    expect(resultRemoveSource).toEqual([
      { toColumn: 'column1', fromColumns: ['column2', 'column3', 'source'] },
      { toColumn: 'column4', fromColumns: ['column5', 'column6'] },
    ]);
    expect(resultEmptyResult).toEqual([
      {
        fromColumns: ['source'],
        toColumn: 'column1',
      },
      { toColumn: 'column4', fromColumns: ['column5', 'column6'] },
    ]);
  });

  it('getConnectedNodesEdges should return an object with nodes, edges, and nodeFqn properties for downstream', () => {
    const selectedNode = { id: '1', position: { x: 0, y: 0 }, data: {} };
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '1' } },
      },
      {
        id: '2',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '2' } },
      },
      {
        id: '3',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '3' } },
      },
    ];
    const edges = [
      { id: '1', source: '1', target: '2' },
      { id: '2', source: '1', target: '3' },
      { id: '3', source: '2', target: '3' },
    ];
    const direction = EdgeTypeEnum.DOWN_STREAM;

    const result = getConnectedNodesEdges(
      selectedNode,
      nodes,
      edges,
      direction
    );

    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('nodeFqn');

    expect(result.nodes).toContainEqual(nodes[1]);
    expect(result.nodes).toContainEqual(nodes[2]);
    expect(result.edges).toContainEqual(edges[1]);
    expect(result.edges).toContainEqual(edges[2]);

    const emptyResult = getConnectedNodesEdges(selectedNode, [], [], direction);

    expect(emptyResult.nodes).toEqual([]);
    expect(emptyResult.edges).toEqual([]);
  });

  it('getConnectedNodesEdges should return an object with nodes, edges, and nodeFqn properties for upstream', () => {
    const selectedNode = { id: '1', position: { x: 0, y: 0 }, data: {} };
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '1' } },
      },
      {
        id: '2',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '2' } },
      },
      {
        id: '3',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '3' } },
      },
    ];
    const edges = [
      { id: '1', source: '1', target: '2' },
      { id: '2', source: '1', target: '3' },
      { id: '3', source: '2', target: '3' },
    ];
    const direction = EdgeTypeEnum.UP_STREAM;

    const result = getConnectedNodesEdges(
      selectedNode,
      nodes,
      edges,
      direction
    );

    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('nodeFqn');

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);

    const emptyResult = getConnectedNodesEdges(selectedNode, [], [], direction);

    expect(emptyResult.nodes).toEqual([]);
    expect(emptyResult.edges).toEqual([]);
  });

  it('should call addLineage with the provided edge', async () => {
    const edge = {
      edge: { fromEntity: {}, toEntity: {} },
    } as AddLineage;
    await addLineageHandler(edge);

    expect(addLineage).toHaveBeenCalledWith(edge);
  });

  it('getUpdatedColumnsFromEdge should appropriate columns', () => {
    const edgeToConnect = {
      source: 'dim_customer',
      sourceHandle: 'shopId',
      target: 'dim_client',
      targetHandle: 'shopId',
    };
    const currentEdge: EdgeDetails = {
      fromEntity: {
        id: 'source',
        type: 'table',
        fqn: 'sourceFqn',
      },
      toEntity: {
        id: 'target',
        type: 'table',
        fqn: 'targetFqn',
      },
      columns: [],
    };

    const result = getUpdatedColumnsFromEdge(edgeToConnect, currentEdge);

    expect(result).toEqual([
      {
        fromColumns: ['shopId'],
        toColumn: 'shopId',
      },
    ]);

    currentEdge.columns = [
      {
        fromColumns: ['customerId'],
        toColumn: 'customerId',
      },
    ];
    const result1 = getUpdatedColumnsFromEdge(edgeToConnect, currentEdge);

    expect(result1).toEqual([
      {
        fromColumns: ['customerId'],
        toColumn: 'customerId',
      },
      {
        fromColumns: ['shopId'],
        toColumn: 'shopId',
      },
    ]);
  });

  // generate test for getColumnSourceTargetHandles
  describe('getColumnSourceTargetHandles', () => {
    it('should handle various states of source and target handles correctly', () => {
      // Test with both handles defined
      const obj1 = {
        sourceHandle: 'c291cmNlSGFuZGxl',
        targetHandle: 'dGFyZ2V0SGFuZGxl',
      };
      const result1 = getColumnSourceTargetHandles(obj1);

      expect(result1).toEqual({
        sourceHandle: 'sourceHandle',
        targetHandle: 'targetHandle',
      });

      // Test with null source handle
      const obj2 = {
        sourceHandle: null,
        targetHandle: 'dGFyZ2V0SGFuZGxl',
      };
      const result2 = getColumnSourceTargetHandles(obj2);

      expect(result2).toEqual({
        sourceHandle: null,
        targetHandle: 'targetHandle',
      });

      // Test with null target handle
      const obj3 = {
        sourceHandle: 'c291cmNlSGFuZGxl',
        targetHandle: null,
      };
      const result3 = getColumnSourceTargetHandles(obj3);

      expect(result3).toEqual({
        sourceHandle: 'sourceHandle',
        targetHandle: null,
      });
    });
  });

  describe('createNewEdge', () => {
    it('should create a new edge with the correct properties', () => {
      const edge = {
        data: {
          edge: {
            fromEntity: {
              id: 'fromEntityId',
              type: 'fromEntityType',
            },
            toEntity: {
              id: 'toEntityId',
              type: 'toEntityType',
            },
            columns: [],
          },
        },
      };

      const result = createNewEdge(edge as Edge);

      expect(result.edge.fromEntity.id).toEqual('fromEntityId');
      expect(result.edge.fromEntity.type).toEqual('fromEntityType');
      expect(result.edge.toEntity.id).toEqual('toEntityId');
      expect(result.edge.toEntity.type).toEqual('toEntityType');
      expect(result.edge.lineageDetails).toBeDefined();
      expect(result.edge.lineageDetails?.columnsLineage).toBeDefined();
    });

    it('should update the columns lineage details correctly', () => {
      const edge = {
        data: {
          edge: {
            fromEntity: {
              id: 'table1',
              type: 'table',
            },
            toEntity: {
              id: 'table2',
              type: 'table',
            },
            columns: [
              { name: 'column1', type: 'type1' },
              { name: 'column2', type: 'type2' },
            ],
          },
        },
      };

      const result = createNewEdge(edge as Edge);

      expect(result).toEqual({
        edge: {
          fromEntity: {
            id: 'table1',
            type: 'table',
          },
          toEntity: {
            id: 'table2',
            type: 'table',
          },
          lineageDetails: {
            columnsLineage: [],
            description: '',
            pipeline: undefined,
            source: undefined,
            sqlQuery: '',
          },
        },
      });
    });
  });

  describe('getUpstreamDownstreamNodesEdges', () => {
    const edges = [
      {
        fromEntity: { fqn: 'node1', type: 'table', id: '1' },
        toEntity: { fqn: 'node2', type: 'table', id: '2' },
      },
      {
        fromEntity: { fqn: 'node2', type: 'table', id: '2' },
        toEntity: { fqn: 'node3', type: 'table', id: '3' },
      },
      {
        fromEntity: { fqn: 'node3', type: 'table', id: '3' },
        toEntity: { fqn: 'node4', type: 'table', id: '4' },
      },
    ];

    const nodes = [
      { fullyQualifiedName: 'node1', type: 'table', id: '1' },
      { fullyQualifiedName: 'node2', type: 'table', id: '2' },
      { fullyQualifiedName: 'node3', type: 'table', id: '3' },
      { fullyQualifiedName: 'node4', type: 'table', id: '4' },
    ];

    it('should return empty arrays for downstream and upstream edges and nodes if activeNode is not found', () => {
      const currentNode = 'node5';
      const result = getUpstreamDownstreamNodesEdges(edges, nodes, currentNode);

      expect(result.downstreamEdges).toEqual([]);
      expect(result.upstreamEdges).toEqual([]);
      expect(result.downstreamNodes).toEqual([]);
      expect(result.upstreamNodes).toEqual([]);
    });

    it('should return correct downstream edges, upstream edges, downstream nodes, and upstream nodes', () => {
      const currentNode = 'node2';
      const result = getUpstreamDownstreamNodesEdges(edges, nodes, currentNode);

      expect(result.downstreamEdges).toEqual([
        {
          fromEntity: { fqn: 'node2', type: 'table', id: '2' },
          toEntity: { fqn: 'node3', type: 'table', id: '3' },
        },
        {
          fromEntity: { fqn: 'node3', type: 'table', id: '3' },
          toEntity: { fqn: 'node4', type: 'table', id: '4' },
        },
      ]);
      expect(result.upstreamEdges).toEqual([
        {
          fromEntity: { fqn: 'node1', type: 'table', id: '1' },
          toEntity: { fqn: 'node2', type: 'table', id: '2' },
        },
      ]);
      expect(result.downstreamNodes).toEqual([
        { fullyQualifiedName: 'node3', type: 'table', id: '3' },
        { fullyQualifiedName: 'node4', type: 'table', id: '4' },
      ]);
      expect(result.upstreamNodes).toEqual([
        { fullyQualifiedName: 'node1', type: 'table', id: '1' },
      ]);
    });
  });

  describe('getEntityChildrenAndLabel', () => {
    it('should return empty values for null input', () => {
      const result = getEntityChildrenAndLabel(null as any);

      expect(result).toEqual({
        children: [],
        childrenHeading: '',
        childrenHeight: 0,
        childrenFlatten: [],
      });
    });

    it('should handle an unknown entity type correctly', () => {
      const node = {
        entityType: 'UNKNOWN',
      };
      const result = getEntityChildrenAndLabel(node as any);

      expect(result).toEqual({
        children: [],
        childrenHeading: '',
        childrenHeight: 0,
        childrenFlatten: [],
      });
    });

    it('should calculate properties for a node with no children', () => {
      const node = {
        entityType: EntityType.TABLE,
        columns: [],
      };
      const result = getEntityChildrenAndLabel(node as any);

      expect(result).toEqual({
        children: [],
        childrenHeading: 'label.column-plural',
        childrenHeight: 0,
        childrenFlatten: [],
      });
    });

    it('should calculate properties for a node with nested children', () => {
      const node = {
        entityType: EntityType.CONTAINER,
        dataModel: {
          columns: [
            {
              children: [{}, { children: [{}] }],
            },
          ],
        },
      };
      const result = getEntityChildrenAndLabel(node as any);

      expect(result.childrenHeight).toBeGreaterThan(0);
      expect(result.childrenFlatten.length).toBeGreaterThan(0);
      expect(result.childrenHeading).toEqual('label.column-plural');
    });
  });

  describe('getColumnFunctionValue', () => {
    it('should return the correct function value when a matching column is found', () => {
      const columns = [
        {
          toColumn: 'targetColumn',
          fromColumns: ['sourceColumn'],
          function: 'SUM',
        },
        {
          toColumn: 'anotherTargetColumn',
          fromColumns: ['anotherSourceColumn'],
          function: 'AVG',
        },
      ];
      const sourceFqn = 'sourceColumn';
      const targetFqn = 'targetColumn';

      const result = getColumnFunctionValue(columns, sourceFqn, targetFqn);

      expect(result).toBe('SUM');
    });

    it('should return undefined when no matching column is found', () => {
      const columns = [
        {
          toColumn: 'targetColumn',
          fromColumns: ['sourceColumn'],
          function: 'SUM',
        },
        {
          toColumn: 'anotherTargetColumn',
          fromColumns: ['anotherSourceColumn'],
          function: 'AVG',
        },
      ];
      const sourceFqn = 'nonExistentSourceColumn';
      const targetFqn = 'nonExistentTargetColumn';

      const result = getColumnFunctionValue(columns, sourceFqn, targetFqn);

      expect(result).toBeUndefined();
    });

    it('should return undefined when columns array is empty', () => {
      const columns: ColumnLineage[] = [];
      const sourceFqn = 'sourceColumn';
      const targetFqn = 'targetColumn';

      const result = getColumnFunctionValue(columns, sourceFqn, targetFqn);

      expect(result).toBeUndefined();
    });

    it('should return undefined when fromColumns is undefined', () => {
      const columns = [
        {
          toColumn: 'targetColumn',
          fromColumns: undefined,
          function: 'SUM',
        },
      ];
      const sourceFqn = 'sourceColumn';
      const targetFqn = 'targetColumn';

      const result = getColumnFunctionValue(columns, sourceFqn, targetFqn);

      expect(result).toBeUndefined();
    });
  });
});
