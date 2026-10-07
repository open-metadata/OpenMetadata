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
import { AxiosError } from 'axios';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Edge,
  MiniMap,
  Node,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../../constants/Lineage.constants';
import { SERVICE_TYPES } from '../../../constants/Services.constant';
import { EntityType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineagePlatformView } from '../../../hooks/lineage/types';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { EdgeFromToData } from '../../../interface/lineage.interface';
import {
  dragHandle,
  onNodeContextMenu,
} from '../../../utils/EntityLineagePureUtils';
import { nodeTypes } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  onEdgeClick,
  saveLineageEdge,
} from '../../../utils/Lineage/handlers/edgeMutations';
import { onPaneClick } from '../../../utils/Lineage/handlers/nodeMutations';
import { showErrorToast } from '../../../utils/ToastUtils';
import LineageControlButtons from '../../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import AddLineagePopover from '../AddLineagePopover/AddLineagePopover';
import {
  AddLineageSelection,
  LineageEditRequest,
} from '../AddLineagePopover/AddLineagePopover.interface';
import { CanvasLayerWrapper } from '../Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { useLineageHandlers } from '../Lineage/LineageHandlersContext';
import { getLineageEditColumnPair } from '../LineageMap/LineageMap.utils';
import LineageNodeDeleteModal from '../LineageNodeDeleteModal/LineageNodeDeleteModal';
import LineageSkeleton from '../LineageSkeleton.component';

interface EntityLineageCanvasProps {
  deleted?: boolean;
  entity?: SourceType;
  entityType: EntityType;
  hasEditAccess?: boolean;
}

const toEdgeEntity = (node?: Node): EdgeFromToData | undefined => {
  const entity = node?.data?.node;

  return entity?.id
    ? {
        id: entity.id,
        type: entity.entityType ?? entity.type,
        fullyQualifiedName: entity.fullyQualifiedName,
      }
    : undefined;
};

/**
 * The asset Lineage tab: the classic lineage graph (`getLineageDataByFQN`)
 * loaded by the `<Lineage />` provider and drawn with a canvas edge layer.
 * The hierarchical scene map is reserved for the main Lineage page.
 */
const EntityLineageCanvas = ({
  deleted,
  entity,
  entityType,
  hasEditAccess,
}: EntityLineageCanvasProps) => {
  const {
    onNodeClick,
    onInitReactFlow,
    onNodesChange,
    updateEntityData,
    removeNodeHandler,
    refetchLineage,
  } = useLineageHandlers();
  const {
    nodes,
    init,
    isDQEnabled,
    dqHighlightedEdges,
    platformView,
    setCanEditLineage,
    setIsCreatingEdge,
  } = useLineageStore();
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [editRequest, setEditRequest] = useState<LineageEditRequest>();
  const [nodePendingDelete, setNodePendingDelete] = useState<Node>();
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  const canEdit =
    Boolean(hasEditAccess) &&
    !deleted &&
    platformView === LineagePlatformView.None &&
    !SERVICE_TYPES.includes(entityType);

  useEffect(() => {
    updateEntityData(entityType, entity, false);
  }, [entity, entityType]);

  useEffect(() => {
    setCanEditLineage(canEdit);
  }, [canEdit, setCanEditLineage]);

  const requestNodeDelete = useCallback(
    (node: { id: string }) =>
      setNodePendingDelete(nodes.find((item) => item.id === node.id)),
    [nodes]
  );

  // The node ⋮ menu and column menu read their edit callbacks from node data.
  const flowNodes = useMemo(
    () =>
      canEdit
        ? nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              isNodeEditable: true,
              onSceneLineageEdit: setEditRequest,
              onSceneNodeRemove: requestNodeDelete,
            },
          }))
        : nodes,
    [canEdit, nodes, requestNodeDelete]
  );

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: Node) => {
      onNodeClick(node);
      event.stopPropagation();
    },
    [onNodeClick]
  );

  const handleCanvasEdgeClick = useCallback(
    (edge: Edge, event: globalThis.MouseEvent) => {
      onEdgeClick(edge);
      event.stopPropagation();
    },
    []
  );

  const handleAddLineageSubmit = useCallback(
    async ({ entity: picked, columnFqn }: AddLineageSelection) => {
      const current = toEdgeEntity(
        nodes.find((node) => node.id === editRequest?.nodeId)
      );
      if (!editRequest || !current) {
        return false;
      }
      const isUpstream = editRequest.direction === LineageDirection.Upstream;
      const columnPair = getLineageEditColumnPair(
        isUpstream,
        editRequest.columnFqn,
        columnFqn
      );
      setIsCreatingEdge(true);
      try {
        const saved = isUpstream
          ? await saveLineageEdge(picked, current, columnPair)
          : await saveLineageEdge(current, picked, columnPair);
        if (saved) {
          refetchLineage();
        }

        return saved;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      } finally {
        setIsCreatingEdge(false);
      }
    },
    [editRequest, nodes, refetchLineage, setIsCreatingEdge]
  );

  const confirmNodeDelete = useCallback(async () => {
    if (!nodePendingDelete) {
      return;
    }
    setIsDeletingNode(true);
    try {
      await removeNodeHandler(nodePendingDelete);
    } finally {
      setIsDeletingNode(false);
      setNodePendingDelete(undefined);
    }
  }, [nodePendingDelete, removeNodeHandler]);

  // Edges are drawn by CanvasLayerWrapper, not as ReactFlow DOM edges.
  const memoizedEdgeTypes = useMemo(() => ({}), []);
  const memoizedEdges = useMemo(() => [], []);
  const highlightedDqEdges = useMemo(
    () => (isDQEnabled ? dqHighlightedEdges : new Set<string>()),
    [dqHighlightedEdges, isDQEnabled]
  );

  if (!init) {
    return <LineageSkeleton />;
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        elevateEdgesOnSelect
        className="custom-react-flow"
        data-testid="react-flow-component"
        deleteKeyCode={null}
        edgeTypes={memoizedEdgeTypes}
        edges={memoizedEdges}
        fitViewOptions={{ padding: 48 }}
        maxZoom={MAX_ZOOM_VALUE}
        minZoom={MIN_ZOOM_VALUE}
        nodeDragThreshold={1}
        nodeTypes={nodeTypes}
        nodes={flowNodes}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        onInit={onInitReactFlow}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDrag={dragHandle}
        onNodeDragStart={dragHandle}
        onNodeDragStop={dragHandle}
        onNodesChange={onNodesChange}
        onPaneClick={onPaneClick}>
        <Background gap={12} size={1} />
        {showMiniMap && <MiniMap pannable zoomable position="bottom-right" />}
        <CanvasLayerWrapper
          dqHighlightedEdges={highlightedDqEdges}
          hoverEdge={hoveredEdge}
          onEdgeClick={handleCanvasEdgeClick}
          onEdgeHover={setHoveredEdge}
        />
        <Panel position="bottom-left">
          <LineageLayers entity={entity} entityType={entityType} />
        </Panel>
        <Panel position="bottom-right">
          <LineageControlButtons
            miniMapVisible={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap((show) => !show)}
          />
        </Panel>
      </ReactFlow>
      <LineageNodeDeleteModal
        isDeleting={isDeletingNode}
        isOpen={Boolean(nodePendingDelete)}
        nodeName={getEntityName(nodePendingDelete?.data?.node)}
        onCancel={() => setNodePendingDelete(undefined)}
        onConfirm={confirmNodeDelete}
      />
      <AddLineagePopover
        excludeEntityId={
          toEdgeEntity(nodes.find((node) => node.id === editRequest?.nodeId))
            ?.id
        }
        request={editRequest}
        onClose={() => setEditRequest(undefined)}
        onSubmit={handleAddLineageSubmit}
      />
    </ReactFlowProvider>
  );
};

export default EntityLineageCanvas;
