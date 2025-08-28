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

import { Edge, Node } from 'reactflow';
import {
  EdgeDetails,
  LineageData,
} from '../components/Lineage/Lineage.interface';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { EntityType } from '../enums/entity.enum';
import { AddLineage, ColumnLineage } from '../generated/api/lineage/addLineage';
import { LineageDirection } from '../generated/api/lineage/lineageDirection';
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
  getLineageTableConfig,
  getNodesBoundsReactFlow,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
  getViewportForBoundsReactFlow,
  parseLineageData,
} from './EntityLineageUtils';
jest.mock('../rest/miscAPI', () => ({
  addLineage: jest.fn(),
}));

import { get, isEqual, uniqWith } from 'lodash';
import { LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS } from '../constants/Lineage.constants';

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  uniqWith: jest.fn(),
  isEqual: jest.fn(),
  get: jest.fn(),
}));

const mockUniqWith = uniqWith as jest.MockedFunction<typeof uniqWith>;
const mockIsEqual = isEqual as jest.MockedFunction<typeof isEqual>;
const mockGet = get as jest.MockedFunction<typeof get>;

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
          fullyQualifiedName: 'sourceFqn',
        },
        toEntity: {
          id: 'targetId',
          type: 'table',
          fullyQualifiedName: 'targetFqn',
        },
        sqlQuery: '',
      },
    });
    expect(result.edge.fromEntity.type).toBe('table');
    expect(result.edge.toEntity.fullyQualifiedName).toBe('targetFqn');
    expect(result.edge.fromEntity.fullyQualifiedName).toBe('sourceFqn');
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
    const direction = LineageDirection.Downstream;

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

    const emptyResult = getConnectedNodesEdges(selectedNode, [], [], direction);

    expect(emptyResult.nodes).toEqual([]);
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
    const direction = LineageDirection.Upstream;

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

    const emptyResult = getConnectedNodesEdges(selectedNode, [], [], direction);

    expect(emptyResult.nodes).toEqual([]);
  });

  it('getConnectedNodesEdges should filter out root nodes from child nodes', () => {
    const selectedNode = {
      id: '1',
      position: { x: 0, y: 0 },
      data: { node: { fullyQualifiedName: '1' } },
    };
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '1' } },
      },
      {
        id: '2',
        position: { x: 0, y: 0 },
        data: {
          node: { fullyQualifiedName: '2' },
          isRootNode: true, // This should be filtered out
        },
      },
      {
        id: '3',
        position: { x: 0, y: 0 },
        data: {
          node: { fullyQualifiedName: '3' },
          isRootNode: false, // This should be included
        },
      },
      {
        id: '4',
        position: { x: 0, y: 0 },
        data: {
          node: { fullyQualifiedName: '4' },
          // No isRootNode property - should be included
        },
      },
    ];
    const edges = [
      { id: '1', source: '1', target: '2' },
      { id: '2', source: '1', target: '3' },
      { id: '3', source: '1', target: '4' },
    ];
    const direction = LineageDirection.Downstream;

    const result = getConnectedNodesEdges(
      selectedNode,
      nodes,
      edges,
      direction
    );

    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('nodeFqn');

    // Should only include nodes that are not root nodes
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find((node) => node.id === '2')).toBeUndefined(); // Root node should be filtered out
    expect(result.nodes.find((node) => node.id === '3')).toBeDefined(); // Non-root node should be included
    expect(result.nodes.find((node) => node.id === '4')).toBeDefined(); // Node without isRootNode should be included

    // Verify nodeFqn contains only the filtered nodes
    expect(result.nodeFqn).toHaveLength(2);
    expect(result.nodeFqn).toContain('3');
    expect(result.nodeFqn).toContain('4');
    expect(result.nodeFqn).not.toContain('2'); // Root node FQN should not be included
  });

  it('getConnectedNodesEdges should handle nodes with undefined isRootNode property', () => {
    const selectedNode = {
      id: '1',
      position: { x: 0, y: 0 },
      data: { node: { fullyQualifiedName: '1' } },
    };
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: { node: { fullyQualifiedName: '1' } },
      },
      {
        id: '2',
        position: { x: 0, y: 0 },
        data: {
          node: { fullyQualifiedName: '2' },
          isRootNode: undefined, // Should be treated as falsy and included
        },
      },
      {
        id: '3',
        position: { x: 0, y: 0 },
        data: {
          node: { fullyQualifiedName: '3' },
          isRootNode: null, // Should be treated as falsy and included
        },
      },
    ];
    const edges = [
      { id: '1', source: '1', target: '2' },
      { id: '2', source: '1', target: '3' },
    ];
    const direction = LineageDirection.Downstream;

    const result = getConnectedNodesEdges(
      selectedNode,
      nodes,
      edges,
      direction
    );

    // Should include nodes with undefined/null isRootNode
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find((node) => node.id === '2')).toBeDefined();
    expect(result.nodes.find((node) => node.id === '3')).toBeDefined();
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
        fullyQualifiedName: 'sourceFqn',
      },
      toEntity: {
        id: 'target',
        type: 'table',
        fullyQualifiedName: 'targetFqn',
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
        fromEntity: { fullyQualifiedName: 'node1', type: 'table', id: '1' },
        toEntity: { fullyQualifiedName: 'node2', type: 'table', id: '2' },
      },
      {
        fromEntity: { fullyQualifiedName: 'node2', type: 'table', id: '2' },
        toEntity: { fullyQualifiedName: 'node3', type: 'table', id: '3' },
      },
      {
        fromEntity: { fullyQualifiedName: 'node3', type: 'table', id: '3' },
        toEntity: { fullyQualifiedName: 'node4', type: 'table', id: '4' },
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
          fromEntity: { fullyQualifiedName: 'node2', type: 'table', id: '2' },
          toEntity: { fullyQualifiedName: 'node3', type: 'table', id: '3' },
        },
        {
          fromEntity: { fullyQualifiedName: 'node3', type: 'table', id: '3' },
          toEntity: { fullyQualifiedName: 'node4', type: 'table', id: '4' },
        },
      ]);
      expect(result.upstreamEdges).toEqual([
        {
          fromEntity: { fullyQualifiedName: 'node1', type: 'table', id: '1' },
          toEntity: { fullyQualifiedName: 'node2', type: 'table', id: '2' },
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

  describe('getNodesBoundsReactFlow', () => {
    it('should return correct bounds for single node', () => {
      const nodes: Node[] = [
        {
          id: '1',
          position: { x: 100, y: 200 },
          width: 50,
          height: 30,
          type: 'default',
        } as Node,
      ];

      const bounds = getNodesBoundsReactFlow(nodes);

      expect(bounds).toEqual({
        xMin: 80, // x - padding
        yMin: 180, // y - padding
        xMax: 170, // x + width + padding
        yMax: 250, // y + height + padding
      });
    });

    it('should return correct bounds for multiple nodes', () => {
      const nodes: Node[] = [
        {
          id: '1',
          position: { x: 100, y: 200 },
          width: 50,
          height: 30,
          type: 'default',
        } as Node,
        {
          id: '2',
          position: { x: 0, y: 0 },
          width: 40,
          height: 20,
          type: 'default',
        } as Node,
        {
          id: '3',
          position: { x: 200, y: 300 },
          width: 60,
          height: 40,
          type: 'default',
        } as Node,
      ];

      const bounds = getNodesBoundsReactFlow(nodes);

      expect(bounds).toEqual({
        xMin: -20, // x - padding
        yMin: -20, // y - padding
        xMax: 280, // rightmost x (200) + width (60) + padding
        yMax: 360, // bottom y (300) + height (40) + padding
      });
    });

    it('should handle nodes without width and height', () => {
      const nodes: Node[] = [
        {
          id: '1',
          position: { x: 100, y: 200 },
          type: 'default',
        } as Node,
        {
          id: '2',
          position: { x: 200, y: 300 },
          type: 'default',
        } as Node,
      ];

      const bounds = getNodesBoundsReactFlow(nodes);

      expect(bounds).toEqual({
        xMin: 80,
        yMin: 180,
        xMax: 220,
        yMax: 320,
      });
    });

    it('should return Infinity bounds for empty nodes array', () => {
      const nodes: Node[] = [];

      const bounds = getNodesBoundsReactFlow(nodes);

      expect(bounds).toEqual({
        xMin: Infinity,
        yMin: Infinity,
        xMax: -Infinity,
        yMax: -Infinity,
      });
    });

    it('should handle negative coordinates', () => {
      const nodes: Node[] = [
        {
          id: '1',
          position: { x: -100, y: -200 },
          width: 50,
          height: 30,
          type: 'default',
        } as Node,
        {
          id: '2',
          position: { x: 100, y: 200 },
          width: 40,
          height: 20,
          type: 'default',
        } as Node,
      ];

      const bounds = getNodesBoundsReactFlow(nodes);

      expect(bounds).toEqual({
        xMin: -120, // x - padding
        yMin: -220, // y - padding
        xMax: 160, // rightmost x (100) + width (40) + padding
        yMax: 240, // bottom y (200) + height (20) + padding
      });
    });
  });

  describe('getViewportForBoundsReactFlow', () => {
    it('should calculate viewport for square bounds', () => {
      const bounds = {
        xMin: 0,
        yMin: 0,
        xMax: 100,
        yMax: 100,
      };
      const imageWidth = 200;
      const imageHeight = 200;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight
      );

      expect(viewport).toEqual({
        x: 20,
        y: 20,
        zoom: 1.1428571428571428,
      });
    });

    it('should handle rectangular bounds with scale factor', () => {
      const bounds = {
        xMin: 0,
        yMin: 0,
        xMax: 200,
        yMax: 100,
      };
      const imageWidth = 400;
      const imageHeight = 300;
      const scaleFactor = 0.5;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight,
        scaleFactor
      );

      expect(viewport).toEqual({
        x: 110,
        y: 97.5,
        zoom: 0.75,
      });
    });

    it('should handle negative coordinates', () => {
      const bounds = {
        xMin: -100,
        yMin: -100,
        xMax: 100,
        yMax: 100,
      };
      const imageWidth = 400;
      const imageHeight = 400;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight
      );

      expect(viewport).toEqual({
        x: 170,
        y: 170,
        zoom: 1.5,
      });
    });

    it('should handle different aspect ratios', () => {
      const bounds = {
        xMin: 0,
        yMin: 0,
        xMax: 400,
        yMax: 200,
      };
      const imageWidth = 200;
      const imageHeight = 200;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight
      );

      expect(viewport).toEqual({
        x: 20,
        y: 56.36363636363636,
        zoom: 0.36363636363636365,
      });
    });

    it('should handle zero dimensions', () => {
      const bounds = {
        xMin: 0,
        yMin: 0,
        xMax: 0,
        yMax: 0,
      };
      const imageWidth = 200;
      const imageHeight = 200;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight
      );

      expect(viewport).toEqual({
        x: 20,
        y: 20,
        zoom: 4,
      });
    });

    it('should handle custom scale factor', () => {
      const bounds = {
        xMin: 0,
        yMin: 0,
        xMax: 100,
        yMax: 100,
      };
      const imageWidth = 200;
      const imageHeight = 200;
      const scaleFactor = 2;

      const viewport = getViewportForBoundsReactFlow(
        bounds,
        imageWidth,
        imageHeight,
        scaleFactor
      );

      expect(viewport).toEqual({
        x: -60,
        y: -60,
        zoom: 2.2857142857142856,
      });
    });
  });
});

describe('parseLineageData', () => {
  // Mock data setup
  const mockEntityFqn = 'test.database.table1';
  const mockRootFqn = 'test.database.table1';

  const mockNodeData = {
    node1: {
      entity: {
        id: 'node1',
        name: 'Table1',
        fullyQualifiedName: 'test.database.table1',
        entityType: EntityType.TABLE,
        type: EntityType.TABLE,
      },
      paging: {
        entityUpstreamCount: 2,
        entityDownstreamCount: 3,
      },
    },
    node2: {
      entity: {
        id: 'node2',
        name: 'Table2',
        fullyQualifiedName: 'test.database.table2',
        entityType: EntityType.TABLE,
        type: EntityType.TABLE,
      },
      paging: {
        entityUpstreamCount: 1,
        entityDownstreamCount: 1,
      },
    },
  };

  const mockDownstreamEdges = {
    edge1: {
      fromEntity: {
        id: 'node1',
        type: EntityType.TABLE,
        fullyQualifiedName: 'test.database.table1',
      },
      toEntity: {
        id: 'node2',
        type: EntityType.TABLE,
        fullyQualifiedName: 'test.database.table2',
      },
    },
  };

  const mockUpstreamEdges = {
    edge2: {
      fromEntity: {
        id: 'node3',
        type: EntityType.TABLE,
        fullyQualifiedName: 'test.database.table3',
      },
      toEntity: {
        id: 'node1',
        type: EntityType.TABLE,
        fullyQualifiedName: 'test.database.table1',
      },
    },
  };

  const mockLineageData: LineageData = {
    nodes: mockNodeData,
    downstreamEdges: mockDownstreamEdges,
    upstreamEdges: mockUpstreamEdges,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockUniqWith.mockImplementation((array: any) => array || []);
    mockIsEqual.mockImplementation((a: any, b: any) => a === b);
    mockGet.mockImplementation((obj: any, path: any, defaultValue?: any) => {
      if (!obj || !path) {
        return defaultValue;
      }
      const pathStr = Array.isArray(path) ? path.join('.') : String(path);
      const keys = pathStr.split('.');
      let result = obj;
      for (const key of keys) {
        result = result?.[key];
        if (result === undefined) {
          return defaultValue;
        }
      }

      return result;
    });
  });

  describe('Basic functionality', () => {
    it('should parse lineage data correctly with nodes and edges', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('entity');
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should process nodes with correct properties', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      expect(result.nodes.length).toBeGreaterThan(0);

      result.nodes.forEach((node) => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('fullyQualifiedName');
      });
    });

    it('should process edges from both downstream and upstream', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      expect(result.edges.length).toBeGreaterThan(0);

      result.edges.forEach((edge) => {
        expect(edge).toHaveProperty('fromEntity');
        expect(edge).toHaveProperty('toEntity');
        expect(edge.fromEntity).toHaveProperty('id');
        expect(edge.fromEntity).toHaveProperty('type');
        expect(edge.toEntity).toHaveProperty('id');
        expect(edge.toEntity).toHaveProperty('type');
      });
    });

    it('should find and return the main entity', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      expect(result.entity).toBeDefined();
      expect(result.entity.fullyQualifiedName).toBe(mockEntityFqn);
    });
  });

  describe('Node processing', () => {
    it('should set expand flags correctly for root entity', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      const rootNode = result.nodes.find(
        (node) => node.fullyQualifiedName === mockRootFqn
      );

      expect(rootNode?.upstreamExpandPerformed).toBe(true);
      expect(rootNode?.downstreamExpandPerformed).toBe(true);
    });

    it('should preserve paging information in nodes', () => {
      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      const nodeWithPaging = result.nodes.find((node) => node.id === 'node1');

      expect(nodeWithPaging?.paging).toEqual({
        entityUpstreamCount: 2,
        entityDownstreamCount: 3,
      });
    });

    it('should handle nodes without paging data', () => {
      const dataWithoutPaging = {
        ...mockLineageData,
        nodes: {
          node1: {
            entity: mockNodeData.node1.entity,
            paging: {}, // Empty paging instead of missing
          },
        },
      };

      const result = parseLineageData(
        dataWithoutPaging,
        mockEntityFqn,
        mockRootFqn
      );

      const node = result.nodes.find((node) => node.id === 'node1');

      expect(node?.paging).toEqual({
        entityUpstreamCount: 0,
        entityDownstreamCount: 0,
      });
    });
  });

  describe('Edge processing with pipelines', () => {
    it('should handle edges with pipeline information', () => {
      const edgeWithPipeline = {
        fromEntity: {
          id: 'source',
          type: EntityType.TABLE,
          fullyQualifiedName: 'source.table',
        },
        toEntity: {
          id: 'target',
          type: EntityType.TABLE,
          fullyQualifiedName: 'target.table',
        },
        pipeline: {
          id: 'pipeline1',
          name: 'Test Pipeline',
          fullyQualifiedName: 'test.pipeline',
          type: EntityType.PIPELINE,
        },
      };

      const dataWithPipeline = {
        ...mockLineageData,
        nodes: {
          ...mockNodeData,
          pipeline1: {
            entity: {
              id: 'pipeline1',
              name: 'Test Pipeline',
              fullyQualifiedName: 'test.pipeline',
              entityType: EntityType.PIPELINE,
              type: EntityType.PIPELINE,
            },
            paging: {},
          },
        },
        downstreamEdges: {
          edge1: edgeWithPipeline,
        },
      };

      const result = parseLineageData(
        dataWithPipeline,
        mockEntityFqn,
        mockRootFqn
      );

      // Should create separate edges for pipeline processing
      expect(result.edges.length).toBeGreaterThan(1);
    });
  });

  describe('Pagination handling', () => {
    it('should create load more nodes for entities with pagination', () => {
      // Mock get function to return pipeline type for filtering
      mockGet.mockImplementation((obj: any, path: any) => {
        if (path === 'entityType') {
          return obj?.entityType || EntityType.TABLE;
        }
        const pathStr = Array.isArray(path) ? path.join('.') : String(path);

        return obj?.[pathStr];
      });

      const result = parseLineageData(
        mockLineageData,
        mockEntityFqn,
        mockRootFqn
      );

      // Should include load more nodes for entities with pagination counts
      const loadMoreNodes = result.nodes.filter(
        (node) => node.type === 'load-more' || node.name?.includes('load_more')
      );

      expect(loadMoreNodes.length).toBeGreaterThanOrEqual(0);
    });

    it('should not create load more nodes for pipeline entities', () => {
      const pipelineNodeData = {
        pipeline1: {
          entity: {
            id: 'pipeline1',
            name: 'Pipeline',
            fullyQualifiedName: 'test.pipeline',
            entityType: EntityType.PIPELINE,
            type: EntityType.PIPELINE,
          },
          paging: {
            entityUpstreamCount: 5,
            entityDownstreamCount: 5,
          },
        },
      };

      mockGet.mockImplementation((obj: any, path: any) => {
        if (path === 'entityType') {
          return obj?.entityType;
        }
        const pathStr = Array.isArray(path) ? path.join('.') : String(path);

        return obj?.[pathStr];
      });

      const dataWithPipeline = {
        ...mockLineageData,
        nodes: pipelineNodeData,
      };

      const result = parseLineageData(
        dataWithPipeline,
        mockEntityFqn,
        mockRootFqn
      );

      // Pipeline nodes should not generate load more nodes
      const loadMoreNodes = result.nodes.filter((node) =>
        node.name?.includes('load_more')
      );

      expect(loadMoreNodes).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty lineage data', () => {
      const emptyData: LineageData = {
        nodes: {},
        downstreamEdges: {},
        upstreamEdges: {},
      };

      const result = parseLineageData(emptyData, mockEntityFqn, mockRootFqn);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.entity).toBeUndefined();
    });

    it('should handle missing entity in nodes', () => {
      const result = parseLineageData(
        mockLineageData,
        'non.existent.entity',
        mockRootFqn
      );

      expect(result.entity).toBeUndefined();
    });

    it('should handle nodes without fullyQualifiedName', () => {
      const dataWithIncompleteNode = {
        ...mockLineageData,
        nodes: {
          incomplete: {
            entity: {
              id: 'incomplete',
              name: 'Incomplete Node',
              entityType: EntityType.TABLE,
              type: EntityType.TABLE,
              // Missing fullyQualifiedName
            },
            paging: {},
          },
        },
      };

      const result = parseLineageData(
        dataWithIncompleteNode,
        mockEntityFqn,
        mockRootFqn
      );

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].fullyQualifiedName).toBeUndefined();
    });
  });

  describe('Unique filtering', () => {
    it('should call uniqWith to remove duplicate nodes', () => {
      // Set up the mocks to expect calls
      mockUniqWith.mockReturnValue([]);
      mockIsEqual.mockReturnValue(false);

      parseLineageData(mockLineageData, mockEntityFqn, mockRootFqn);

      expect(mockUniqWith).toHaveBeenCalled();
    });

    it('should handle duplicate nodes in input data', () => {
      const duplicateNodeData = {
        ...mockNodeData,
        node1_duplicate: mockNodeData.node1,
      };

      const dataWithDuplicates = {
        ...mockLineageData,
        nodes: duplicateNodeData,
      };

      // Mock uniqWith to actually remove duplicates
      mockUniqWith.mockImplementation((array: any, compareFn?: any) => {
        if (!array) {
          return [];
        }
        const unique: any[] = [];
        for (const item of array) {
          if (
            !unique.some((existing) =>
              compareFn ? compareFn(existing, item) : existing === item
            )
          ) {
            unique.push(item);
          }
        }

        return unique;
      });

      mockIsEqual.mockImplementation(
        (a: any, b: any) => a.fullyQualifiedName === b.fullyQualifiedName
      );

      parseLineageData(dataWithDuplicates, mockEntityFqn, mockRootFqn);

      expect(mockUniqWith).toHaveBeenCalled();
    });
  });
});

describe('getLineageTableConfig', () => {
  it('should return empty arrays for empty CSV data', () => {
    const result = getLineageTableConfig([]);

    expect(result.columns).toEqual([]);
    expect(result.dataSource).toEqual([]);
  });

  it('should return empty arrays for null CSV data', () => {
    const result = getLineageTableConfig(null as any);

    expect(result.columns).toEqual([]);
    expect(result.dataSource).toEqual([]);
  });

  it('should return empty arrays for CSV data with only headers', () => {
    const result = getLineageTableConfig([['Name', 'Type']]);

    expect(result.columns).toEqual([]);
    expect(result.dataSource).toEqual([]);
  });

  it('should return empty arrays for CSV data with less than 1 rows', () => {
    const result = getLineageTableConfig([['Name']]);

    expect(result.columns).toEqual([]);
    expect(result.dataSource).toEqual([]);
  });

  it('should process valid CSV data correctly', () => {
    const csvData = [
      ['fromEntityFQN', 'toEntityFQN', 'pipelineName'],
      ['test.fqn.1', 'test.fqn.2', 'Test Pipeline'],
      ['test.fqn.3', 'test.fqn.4', 'Another Pipeline'],
    ];

    const result = getLineageTableConfig(csvData);

    expect(result.columns).toHaveLength(3);
    expect(result.dataSource).toHaveLength(2);

    // Check column structure with localization keys
    expect(result.columns[0]).toMatchObject({
      title: 'label.from-entity',
      dataIndex: 'fromCombined',
      key: 'fromCombined',
      width: 300,
      ellipsis: { showTitle: false },
    });

    expect(result.columns[1]).toMatchObject({
      dataIndex: 'toCombined',
      key: 'toCombined',
      title: 'label.to-entity',
      width: 300,
      ellipsis: { showTitle: false },
    });

    expect(result.columns[2]).toMatchObject({
      title: LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS['pipelineName'],
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      width: 200,
      ellipsis: { showTitle: false },
    });

    // Check data source
    expect(result.dataSource[0]).toEqual({
      fromEntityFQN: 'test.fqn.1',
      toEntityFQN: 'test.fqn.2',
      pipelineName: 'Test Pipeline',
      key: '0',
    });

    expect(result.dataSource[1]).toEqual({
      fromEntityFQN: 'test.fqn.3',
      toEntityFQN: 'test.fqn.4',
      pipelineName: 'Another Pipeline',
      key: '1',
    });
  });

  it('should handle CSV data with different column counts', () => {
    const csvData = [
      ['fromEntityFQN', 'toEntityFQN'],
      ['test.fqn.1', 'test.fqn.2', 'extra-column'],
      ['test.fqn.3'],
    ];

    const result = getLineageTableConfig(csvData);

    expect(result.columns).toHaveLength(2);
    expect(result.dataSource).toHaveLength(2);

    expect(result.dataSource[0]).toEqual({
      fromEntityFQN: 'test.fqn.1',
      toEntityFQN: 'test.fqn.2',
      key: '0',
    });

    expect(result.dataSource[1]).toEqual({
      fromEntityFQN: 'test.fqn.3',
      toEntityFQN: '',
      key: '1',
    });
  });

  it('should handle single row of data', () => {
    const csvData = [
      ['fromEntityFQN', 'toEntityFQN', 'pipelineName'],
      ['test.fqn.1', 'test.fqn.2', 'Test Pipeline'],
    ];

    const result = getLineageTableConfig(csvData);

    expect(result.columns).toHaveLength(3);
    expect(result.dataSource).toHaveLength(1);

    expect(result.dataSource[0]).toEqual({
      fromEntityFQN: 'test.fqn.1',
      toEntityFQN: 'test.fqn.2',
      pipelineName: 'Test Pipeline',
      key: '0',
    });
  });

  it('should handle empty rows in CSV data', () => {
    const csvData = [
      ['fromEntityFQN', 'toEntityFQN'],
      ['test.fqn.1', 'test.fqn.2'],
      ['', ''],
      ['test.fqn.3', 'test.fqn.4'],
    ];

    const result = getLineageTableConfig(csvData);

    expect(result.dataSource).toHaveLength(3);
    expect(result.dataSource[1]).toEqual({
      fromEntityFQN: '',
      toEntityFQN: '',
      key: '1',
    });
  });
});
