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
import { isEqual, uniqWith } from 'lodash';
import { getIncomers, getOutgoers, Node } from 'reactflow';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import {
  createEdgesAndEdgeMaps,
  createNodes,
  getClassifiedEdge,
  positionNodesUsingElk,
} from '../../../utils/EntityLineageUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { LineageEntityReference } from '../Lineage.interface';
import { useLineageStore } from './useLineageStore';

export const getPositionedNodesAndEdges = async ({
  entityFqn,
}: {
  entityFqn: string;
}) => {
  const {
    setNodes,
    setEdges,
    entityLineage,
    activeLayer,
    isEditMode,
    expandAllColumns,
    columnsHavingLineage,
  } = useLineageStore.getState();
  const allNodes: LineageEntityReference[] = uniqWith(
    [
      ...(entityLineage.nodes ?? []),
      ...(entityLineage.entity ? [entityLineage.entity] : []),
    ],
    isEqual
  );

  const {
    edges: updatedEdges,
    incomingMap,
    outgoingMap,
    // columnsHavingLineage,
  } = createEdgesAndEdgeMaps(
    allNodes,
    entityLineage.edges ?? [],
    entityFqn,
    activeLayer.includes(LineageLayer.ColumnLevelLineage),
    false
  );

  const initialNodes = createNodes(
    allNodes,
    entityLineage.edges ?? [],
    entityFqn,
    incomingMap,
    outgoingMap,
    activeLayer.includes(LineageLayer.ColumnLevelLineage),
    false
  );

  // Position nodes with actual dimensions
  const positionedNodesEdges = await positionNodesUsingElk(
    initialNodes,
    updatedEdges,
    activeLayer.includes(LineageLayer.ColumnLevelLineage),
    isEditMode || expandAllColumns,
    columnsHavingLineage
  );

  setNodes(positionedNodesEdges.nodes);
  setEdges(updatedEdges);
};

export const handleLineageTracing = (node: Node) => {
  const { nodes, edges, setTracingPath } = useLineageStore.getState();

  const { normalEdge } = getClassifiedEdge(edges);
  const connectedNodeIds = new Set<string>([node.id]);
  const nodesToProcess = [node];

  // Process upstream nodes (incomers)
  for (const node of nodesToProcess) {
    const incomers = getIncomers(node, nodes, normalEdge);
    for (const incomer of incomers) {
      if (!connectedNodeIds.has(incomer.id)) {
        connectedNodeIds.add(incomer.id);
        nodesToProcess.push(incomer);
      }
    }
  }

  // Reset and process downstream nodes (outgoers)
  nodesToProcess.length = 0;
  nodesToProcess.push(node);

  for (const node of nodesToProcess) {
    const outgoers = getOutgoers(node, nodes, normalEdge);
    for (const outgoer of outgoers) {
      if (!connectedNodeIds.has(outgoer.id)) {
        connectedNodeIds.add(outgoer.id);
        nodesToProcess.push(outgoer);
      }
    }
  }

  setTracingPath(Array.from(connectedNodeIds));
  //   setTracedColumns([]);
};

export const handleNodeClick = (node: Node) => {
  const { setIsDrawerOpen, setSelectedNode, setLoadModeNode } =
    useLineageStore.getState();

  if (!node) {
    return;
  }

  if (node.type === EntityLineageNodeType.LOAD_MORE) {
    setLoadModeNode(node);
  } else {
    // setSelectedEdge(undefined);
    // setActiveNode(node);
    setSelectedNode(node.data.node as SourceType);
    setIsDrawerOpen(true);
    handleLineageTracing(node);
  }
};
