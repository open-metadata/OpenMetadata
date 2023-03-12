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

import {
  CustomEdgeData,
  EdgeTypeEnum,
  SelectedEdge,
} from 'components/EntityLineage/EntityLineage.interface';
import { Edge } from 'reactflow';
import { LineageDetails } from '../generated/api/lineage/addLineage';
import { EntityLineage } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityReference';
import {
  COLUMN_LINEAGE_DETAILS,
  EDGE_TO_BE_REMOVED,
  MOCK_COLUMN_LINEAGE_EDGE,
  MOCK_LINEAGE_DATA,
  MOCK_NODES_AND_EDGES,
  MOCK_NORMAL_LINEAGE_EDGE,
  MOCK_PARAMS_FOR_DOWN_STREAM,
  MOCK_PARAMS_FOR_UP_STREAM,
  MOCK_PIPELINE,
  MOCK_REMOVED_NODE,
  SELECTED_EDGE,
  UPDATED_COLUMN_LINEAGE,
  UPDATED_EDGE_PARAM,
  UPDATED_LINEAGE_EDGE,
  UPDATED_NORMAL_LINEAGE,
  UP_STREAM_EDGE,
} from '../mocks/Lineage.mock';
import {
  createNewEdge,
  findUpstreamDownStreamEdge,
  getAllTracedColumnEdge,
  getAllTracedEdges,
  getAllTracedNodes,
  getClassifiedEdge,
  getEdgeType,
  getRemovedNodeData,
  getUpdatedEdge,
  getUpdatedEdgeWithPipeline,
  getUpdatedUpstreamDownStreamEdgeArr,
  getUpStreamDownStreamColumnLineageArr,
  isColumnLineageTraced,
  isTracedEdge,
} from './EntityLineageUtils';

describe('Test EntityLineageUtils utility', () => {
  it('findUpstreamDownStreamEdge function should work properly', () => {
    const upstreamData = findUpstreamDownStreamEdge(
      MOCK_LINEAGE_DATA.upstreamEdges,
      SELECTED_EDGE as SelectedEdge
    );
    const nodata = findUpstreamDownStreamEdge(
      undefined,
      SELECTED_EDGE as SelectedEdge
    );

    expect(upstreamData).toStrictEqual(UP_STREAM_EDGE);
    expect(nodata).toBeUndefined();
  });

  it('getUpStreamDownStreamColumnLineageArr function should work properly', () => {
    const columnLineageData = getUpStreamDownStreamColumnLineageArr(
      MOCK_LINEAGE_DATA.upstreamEdges[0].lineageDetails as LineageDetails,
      SELECTED_EDGE as SelectedEdge
    );
    const nodata = getUpStreamDownStreamColumnLineageArr(
      MOCK_LINEAGE_DATA.upstreamEdges[1].lineageDetails as LineageDetails,
      SELECTED_EDGE as SelectedEdge
    );

    expect(columnLineageData).toStrictEqual(COLUMN_LINEAGE_DETAILS);
    expect(nodata).toStrictEqual({ sqlQuery: '', columnsLineage: [] });
  });

  it('getUpdatedUpstreamDownStreamEdgeArr function should work properly', () => {
    const columnLineageData = getUpdatedUpstreamDownStreamEdgeArr(
      MOCK_LINEAGE_DATA.upstreamEdges,
      SELECTED_EDGE as SelectedEdge,
      COLUMN_LINEAGE_DETAILS
    );
    const nodata = getUpdatedUpstreamDownStreamEdgeArr(
      [],
      SELECTED_EDGE as SelectedEdge,
      COLUMN_LINEAGE_DETAILS
    );

    expect(columnLineageData).toStrictEqual(UPDATED_LINEAGE_EDGE);
    expect(nodata).toStrictEqual([]);
  });

  it('getRemovedNodeData function should work properly', () => {
    const data = getRemovedNodeData(
      MOCK_LINEAGE_DATA.nodes,
      EDGE_TO_BE_REMOVED as Edge,
      MOCK_LINEAGE_DATA.entity,
      MOCK_LINEAGE_DATA.nodes[0]
    );
    const nodata = getRemovedNodeData(
      [],
      SELECTED_EDGE.data,
      MOCK_LINEAGE_DATA.entity,
      {} as EntityReference
    );

    expect(data).toStrictEqual(MOCK_REMOVED_NODE);
    expect(nodata).toStrictEqual({
      id: SELECTED_EDGE.data.id,
      source: MOCK_LINEAGE_DATA.entity,
      target: MOCK_LINEAGE_DATA.entity,
    });
  });

  it('getEdgeType function should work properly', () => {
    const upStreamData = getEdgeType(
      MOCK_LINEAGE_DATA,
      MOCK_PARAMS_FOR_UP_STREAM
    );
    const downStreamData = getEdgeType(
      MOCK_LINEAGE_DATA,
      MOCK_PARAMS_FOR_DOWN_STREAM
    );

    expect(upStreamData).toStrictEqual(EdgeTypeEnum.UP_STREAM);
    expect(downStreamData).toStrictEqual(EdgeTypeEnum.DOWN_STREAM);
  });

  it('getUpdatedEdge function should work properly', () => {
    const node = MOCK_LINEAGE_DATA.upstreamEdges[1];
    const data = getUpdatedEdge(
      [node],
      UPDATED_EDGE_PARAM,
      UPDATED_COLUMN_LINEAGE
    );

    expect(data).toStrictEqual([
      {
        ...node,
        lineageDetails: UPDATED_COLUMN_LINEAGE,
      },
    ]);
  });

  it('createNewEdge function should work properly', () => {
    const columnLineageEdge = createNewEdge(
      UPDATED_EDGE_PARAM,
      true,
      'table',
      'table',
      true,
      jest.fn,
      jest.fn
    );
    const normalLineageEdge = createNewEdge(
      UPDATED_EDGE_PARAM,
      true,
      'table',
      'table',
      false,
      jest.fn,
      jest.fn
    );

    const updatedColLineageEdge = MOCK_COLUMN_LINEAGE_EDGE as Edge;
    updatedColLineageEdge.data.onEdgeClick = jest.fn;

    const updatedNormalLineageEdge = MOCK_NORMAL_LINEAGE_EDGE as Edge;
    updatedNormalLineageEdge.data.onEdgeClick = jest.fn;
    updatedNormalLineageEdge.data.addPipelineClick = jest.fn;

    expect(columnLineageEdge).toMatchObject(updatedColLineageEdge);
    expect(normalLineageEdge).toMatchObject(updatedNormalLineageEdge);
  });

  it('getUpdatedEdgeWithPipeline function should work properly', () => {
    const lineageEdge = getUpdatedEdgeWithPipeline(
      MOCK_LINEAGE_DATA.upstreamEdges,
      UPDATED_NORMAL_LINEAGE,
      MOCK_NORMAL_LINEAGE_EDGE.data as CustomEdgeData,
      MOCK_PIPELINE
    );

    const noData = getUpdatedEdgeWithPipeline(
      undefined,
      UPDATED_NORMAL_LINEAGE,
      MOCK_NORMAL_LINEAGE_EDGE.data as CustomEdgeData,
      MOCK_PIPELINE
    );

    const updatedData: EntityLineage['upstreamEdges'] = [
      ...MOCK_LINEAGE_DATA.upstreamEdges,
    ];
    updatedData[1].lineageDetails = {
      ...UPDATED_NORMAL_LINEAGE,
      pipeline: {
        ...UPDATED_NORMAL_LINEAGE.pipeline,
        name: MOCK_PIPELINE.name,
        displayName: MOCK_PIPELINE.displayName,
      },
    };

    expect(lineageEdge).toMatchObject(updatedData);
    expect(noData).toMatchObject([]);
  });

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
});
