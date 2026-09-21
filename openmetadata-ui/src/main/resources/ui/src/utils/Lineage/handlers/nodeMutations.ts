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
import { AxiosError } from 'axios';
import { isEqual, uniqueId, uniqWith } from 'lodash';
import { DragEvent } from 'react';
import { getConnectedEdges, Node, NodeProps } from 'reactflow';
import {
  EdgeDetails,
  EntityLineageResponse,
  LineageData,
  LineageNodeType,
  NodeData,
} from '../../../components/Lineage/Lineage.interface';
import { SourceType } from '../../../components/SearchedData/SearchedData.interface';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import { getEdgeDataFromEdge } from '../../EntityLineageEdgeUtils';
import { getConnectedNodesEdges } from '../../EntityLineageNodeUtils';
import {
  parseLineageData,
  removeLineageHandler,
} from '../../EntityLineagePureUtils';
import { getQuickFilterQuery } from '../../ExplorePureUtils';
import { t } from '../../i18next/LocalUtil';
import { showErrorToast } from '../../ToastUtils';
import { addBaseNodeDepthToNodes } from '../LineageUtils';

// Only the depth in the requested direction is fetched; the opposite
// direction is capped at 0 so the API returns a single level of children.
// Mirrors the private helper of the same name in LineageProvider.tsx
// (not exported there, so duplicated here until that file is retired).
const getDirectionalDepthConfig = (
  direction: LineageDirection,
  depth: number
): { upstreamDepth: number; downstreamDepth: number } => ({
  upstreamDepth: direction === LineageDirection.Upstream ? depth : 0,
  downstreamDepth: direction === LineageDirection.Downstream ? depth : 0,
});

const mapNodesByFqn = (
  nodesList: LineageNodeType[]
): Record<string, NodeData> => {
  const result: Record<string, NodeData> = {};
  for (const node of nodesList) {
    result[node.fullyQualifiedName ?? ''] = {
      entity: node,
      paging: node.paging ?? {
        entityDownstreamCount: 0,
        entityUpstreamCount: 0,
      },
    };
  }

  return result;
};

const computeUniqueNodes = (
  existingNodes: LineageNodeType[] | undefined,
  newNodes: LineageNodeType[] | undefined
): LineageNodeType[] => {
  const existingFqnSet = new Set(
    (existingNodes ?? []).map((n) => n.fullyQualifiedName)
  );

  return [
    ...(existingNodes ?? []),
    ...(newNodes ?? []).filter(
      (nNode) => !existingFqnSet.has(nNode.fullyQualifiedName)
    ),
  ];
};

const markExpandPerformed = (
  currentNode: LineageNodeType | undefined,
  direction: LineageDirection
): void => {
  if (!currentNode) {
    return;
  }
  if (direction === LineageDirection.Upstream) {
    currentNode.upstreamExpandPerformed = true;
  } else {
    currentNode.downstreamExpandPerformed = true;
  }
};

export const onNodeCollapse = (
  node: Node | NodeProps,
  direction: LineageDirection
): void => {
  const {
    nodes,
    edges,
    entityLineage,
    setActiveNode,
    setNodes,
    setEdges,
    setLineageData,
    bumpLineageMutationTick,
  } = useLineageStore.getState();

  const {
    nodeFqn,
    nodes: collapsedNodes,
    edges: connectedEdges,
  } = getConnectedNodesEdges(node as Node, nodes, edges, direction);

  setActiveNode(node as Node);

  const updatedNodes = (entityLineage.nodes ?? []).filter(
    (item) => !nodeFqn.includes(item.fullyQualifiedName ?? '')
  );
  const updatedEdges = (entityLineage.edges ?? []).filter(
    (val) =>
      !connectedEdges.some((connectedEdge) =>
        isEqual(connectedEdge.data.edge, val)
      )
  );

  // Find the node in updatedNodes by ID and set expandPerformed: false
  const currentNodeId = (node as Node).id;
  const nodeToUpdate = updatedNodes.find((n) => n.id === currentNodeId);
  if (nodeToUpdate) {
    if (direction === LineageDirection.Upstream) {
      nodeToUpdate.upstreamExpandPerformed = false;
    } else {
      nodeToUpdate.downstreamExpandPerformed = false;
    }
  }

  setLineageData({
    ...entityLineage,
    nodes: updatedNodes,
    edges: updatedEdges,
  });

  const collapsedNodeIds = new Set(collapsedNodes.map((n) => n.id));
  setNodes(nodes.filter((n) => !collapsedNodeIds.has(n.id)));
  setEdges(
    edges.filter(
      (edge) =>
        !connectedEdges.some((connectedEdge) => connectedEdge.id === edge.id)
    )
  );

  bumpLineageMutationTick();
};

export const loadChildNodesHandler = async (
  node: LineageNodeType,
  direction: LineageDirection,
  depth = 1
): Promise<void> => {
  const {
    entityLineage,
    lineageConfig,
    entityFqn,
    timeFilter,
    selectedQuickFilters,
    setLineageData,
    bumpLineageMutationTick,
  } = useLineageStore.getState();

  try {
    const queryFilter =
      JSON.stringify(getQuickFilterQuery(selectedQuickFilters)) ?? '';

    const res = await getLineageDataByFQN({
      fqn: node.fullyQualifiedName ?? '',
      entityType: node.entityType ?? '',
      config: {
        ...getDirectionalDepthConfig(direction, depth),
        nodesPerLayer: lineageConfig.nodesPerLayer,
        pipelineViewMode: lineageConfig.pipelineViewMode,
      },
      queryFilter,
      direction,
      startTime: timeFilter.startTime,
      endTime: timeFilter.endTime,
    });

    const currentNodes = mapNodesByFqn(entityLineage.nodes ?? []);
    const updatedNodes = addBaseNodeDepthToNodes(
      node.nodeDepth ?? 0,
      res.nodes
    );

    // The provider keeps a raw dict-form `lineageData` cache (nodes +
    // downstream/upstream edge dicts) across fetches to feed parseLineageData.
    // That cache is component-local state, not part of useLineageStore, so it
    // is reconstructed here from the store's entityLineage.edges (the
    // persisted, already-deduped array form) instead of being accumulated
    // incrementally like the provider does.
    const historicalEdges: Record<string, EdgeDetails> = Object.fromEntries(
      (entityLineage.edges ?? []).map((edge, index) => [
        `history-${index}`,
        edge,
      ])
    );

    const concatenatedLineageData: LineageData = {
      nodes: { ...currentNodes, ...updatedNodes },
      downstreamEdges: { ...historicalEdges, ...res.downstreamEdges },
      upstreamEdges: res.upstreamEdges,
    };

    const { nodes: newNodes, edges: newEdges } = parseLineageData(
      concatenatedLineageData,
      node.fullyQualifiedName ?? '',
      entityFqn
    );

    const uniqueNodes = computeUniqueNodes(entityLineage.nodes, newNodes);

    const updatedEntityLineage: EntityLineageResponse = {
      entity: entityLineage.entity,
      nodes: uniqueNodes,
      edges: uniqWith([...(entityLineage.edges ?? []), ...newEdges], isEqual),
    };

    const currentNode = updatedEntityLineage.nodes?.find(
      (n) => n.fullyQualifiedName === node.fullyQualifiedName
    );

    markExpandPerformed(currentNode, direction);

    setLineageData(updatedEntityLineage);
    bumpLineageMutationTick();
  } catch (err) {
    showErrorToast(
      err as AxiosError,
      t('server.entity-fetch-error', {
        entity: t('label.lineage-data-lowercase'),
      })
    );
  }
};

export const removeNodeHandler = (node: Node | NodeProps): void => {
  const {
    nodes,
    edges,
    entityLineage,
    setNodes,
    setEdges,
    setUpdatedEntityLineage,
    setNewAddedNode,
    bumpLineageMutationTick,
  } = useLineageStore.getState();

  if (!entityLineage) {
    return;
  }

  // Filter column edges, as main edge will automatically remove column
  // edge on delete
  const nodeEdges = edges.filter(
    (item) => item?.data?.isColumnLineage === false
  );
  const edgesToRemove = getConnectedEdges([node as Node], nodeEdges);
  const edgeDataToRemove = edgesToRemove.map(getEdgeDataFromEdge);

  const filteredEdges = (entityLineage.edges ?? []).filter(
    (item) =>
      !edgeDataToRemove.some(
        (edgeData) =>
          item.fromEntity.id === edgeData.fromId &&
          item.toEntity.id === edgeData.toId
      )
  );

  const updatedNodes = (entityLineage.nodes ?? []).filter(
    (previousNode) => previousNode.id !== node.id
  );

  setNodes(nodes.filter((n) => n.id !== node.id));
  setEdges(
    edges.filter(
      (edge) => !edgesToRemove.some((removed) => removed.id === edge.id)
    )
  );
  setUpdatedEntityLineage({
    ...entityLineage,
    edges: filteredEdges,
    nodes: updatedNodes,
  });
  setNewAddedNode(undefined);
  bumpLineageMutationTick();

  // Fire-and-forget backend cleanup of the edges connected to the removed
  // node — mirrors the REST calls LineageProvider.tsx previously awaited
  // inline; kept non-blocking here since this handler's signature is void.
  edgeDataToRemove.forEach((edgeData) => {
    removeLineageHandler(edgeData).catch(() => undefined);
  });
};

export const onNodeClick = (node: Node): void => {
  const { setSelectedEdge, setActiveNode, setSelectedNode, openDrawer } =
    useLineageStore.getState();

  if (!node || node.data?.node?.isTempTable) {
    return;
  }

  if (node.type === EntityLineageNodeType.LOAD_MORE) {
    return;
  }

  setSelectedEdge(undefined);
  setActiveNode(node);
  setSelectedNode(node.data.node as SourceType);
  openDrawer();
};

export const onPaneClick = (): void => {
  const {
    setTracedNodes,
    setTracedColumns,
    setSelectedColumn,
    setActiveNode,
    setSelectedNode,
    setSelectedEdge,
    closeDrawer,
  } = useLineageStore.getState();

  setTracedNodes(new Set());
  setTracedColumns(new Set());
  setSelectedColumn('');
  setActiveNode(undefined);
  setSelectedNode(undefined);
  setSelectedEdge(undefined);
  closeDrawer();
};

export const onNodeDrop = (
  event: DragEvent,
  reactFlowBounds: DOMRect
): void => {
  event.preventDefault();
  const entityType = event.dataTransfer.getData('application/reactflow');

  if (!entityType) {
    return;
  }

  const { nodes, reactFlowInstance, isEditMode, setNodes, setNewAddedNode } =
    useLineageStore.getState();

  const position = reactFlowInstance?.project({
    x: event.clientX - (reactFlowBounds?.left ?? 0),
    y: event.clientY - (reactFlowBounds?.top ?? 0),
  });

  const nodeId = uniqueId();
  const newNode = {
    id: nodeId,
    nodeType: EntityLineageNodeType.DEFAULT,
    position: position ?? { x: 0, y: 0 },
    className: '',
    connectable: false,
    selectable: false,
    type: EntityLineageNodeType.DEFAULT,
    data: {
      entityType,
      isEditMode,
      isNewNode: true,
    },
  };

  setNodes([...nodes, newNode as Node]);
  setNewAddedNode(newNode as Node);
};
