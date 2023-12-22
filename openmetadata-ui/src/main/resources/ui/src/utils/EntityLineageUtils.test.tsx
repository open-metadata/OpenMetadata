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
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { MOCK_NODES_AND_EDGES } from '../mocks/Lineage.mock';
import {
  getAllTracedColumnEdge,
  getAllTracedEdges,
  getAllTracedNodes,
  getClassifiedEdge,
  getColumnLineageData,
  getEdgeStyle,
  getLineageDetailsObject,
  getLineageEdge,
  getLineageEdgeForAPI,
  isColumnLineageTraced,
  isTracedEdge,
} from './EntityLineageUtils';

describe('Test EntityLineageUtils utility', () => {
  it('getAllTracedNodes & isTracedEdge function should work properly', () => {
    const { nodes, edges } = MOCK_NODES_AND_EDGES;
    const incomerNode = getAllTracedNodes(nodes[1], nodes, edges, [], true);
    const outGoverNode = getAllTracedNodes(nodes[1], nodes, edges, [], false);
    const noData = getAllTracedNodes(nodes[0], [], [], [], true);

    const incomerNodeId = incomerNode.map((node) => node.id);
    const outGoverNodeId = outGoverNode.map((node) => node.id);
    const isTracedTruthy = isTracedEdge(
      nodes[1],
      edges[1],
      incomerNodeId,
      outGoverNodeId
    );
    const isTracedFalsy = isTracedEdge(
      nodes[1],
      edges[0],
      incomerNodeId,
      outGoverNodeId
    );

    expect(incomerNode).toStrictEqual([nodes[0]]);
    expect(outGoverNode).toStrictEqual([]);
    expect(isTracedTruthy).toBeTruthy();
    expect(isTracedFalsy).toBeFalsy();
    expect(noData).toMatchObject([]);
  });

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

  it('getClassifiedEdge & getAllTracedColumnEdge function should work properly', () => {
    const { edges } = MOCK_NODES_AND_EDGES;
    const selectedColumn =
      'sample_data.ecommerce_db.shopify.dim_location.location_id';
    const classifiedEdges = getClassifiedEdge(edges);
    const allTracedEdges = getAllTracedColumnEdge(
      selectedColumn,
      classifiedEdges.columnEdge
    );
    const isColumnTracedTruthy = isColumnLineageTraced(
      selectedColumn,
      edges[0],
      allTracedEdges.incomingColumnEdges,
      allTracedEdges.outGoingColumnEdges
    );
    const isColumnTracedFalsy = isColumnLineageTraced(
      selectedColumn,
      edges[1],
      allTracedEdges.incomingColumnEdges,
      allTracedEdges.outGoingColumnEdges
    );

    expect(classifiedEdges).toStrictEqual({
      normalEdge: [edges[1]],
      columnEdge: [edges[0]],
    });
    expect(allTracedEdges).toStrictEqual({
      incomingColumnEdges: [
        'sample_data.ecommerce_db.shopify.raw_product_catalog.comments',
      ],
      outGoingColumnEdges: [],
      connectedColumnEdges: [
        'sample_data.ecommerce_db.shopify.dim_location.location_id',
        'sample_data.ecommerce_db.shopify.raw_product_catalog.comments',
      ],
    });
    expect(isColumnTracedTruthy).toBeTruthy();
    expect(isColumnTracedFalsy).toBeFalsy();
  });

  it('getEdgeStyle should returns the expected edge style for a value', () => {
    const expectedStyle = {
      opacity: 1,
      strokeWidth: 2,
      stroke: '#2196f3',
    };

    expect(getEdgeStyle(true)).toEqual(expectedStyle);

    const expectedFalseStyle = {
      opacity: 0.25,
      strokeWidth: 1,
      stroke: undefined,
    };

    expect(getEdgeStyle(false)).toEqual(expectedFalseStyle);
  });

  it('getLineageDetailsObject should return correct object', () => {
    const edgeWithData = {
      data: {
        edge: {
          sqlQuery: 'SELECT * FROM table',
          columns: ['column1', 'column2'],
          description: 'This is a test',
          pipeline: 'Test Pipeline',
          source: 'Test Source',
        },
      },
    } as Edge;

    const resultWithData = getLineageDetailsObject(edgeWithData);

    expect(resultWithData).toEqual({
      sqlQuery: 'SELECT * FROM table',
      columnsLineage: ['column1', 'column2'],
      description: 'This is a test',
      pipeline: 'Test Pipeline',
      source: 'Test Source',
    });

    const edgeWithoutData = {} as Edge;
    const resultWithoutData = getLineageDetailsObject(edgeWithoutData);

    expect(resultWithoutData).toEqual({
      sqlQuery: '',
      columnsLineage: [],
      description: '',
      pipeline: undefined,
      source: '',
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
});
