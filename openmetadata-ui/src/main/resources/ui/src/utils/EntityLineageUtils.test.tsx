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

import { MOCK_NODES_AND_EDGES } from '../mocks/Lineage.mock';
import {
  getAllTracedColumnEdge,
  getAllTracedEdges,
  getAllTracedNodes,
  getClassifiedEdge,
  getEdgeStyle,
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
});
