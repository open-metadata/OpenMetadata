/*
 *  Copyright 2023 Collate.
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
import { Card } from 'antd';
import classNames from 'classnames';
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from '../../constants/Lineage.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { useLineageStore } from '../../hooks/useLineageStore';
import {
  dragHandle,
  nodeTypes,
  onNodeContextMenu,
} from '../../utils/EntityLineageUtils';
import Loader from '../common/Loader/Loader';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import LineageControlButtons from '../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { CanvasLayerWrapper } from './Edges/CanvasLayerWrapper/CanvasLayerWrapper';
import { LineageProps } from './Lineage.interface';

const Lineage = ({
  deleted,
  entity,
  entityType,
  isPlatformLineage,
  hasEditAccess,
  platformHeader,
}: LineageProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);

  const {
    nodes,
    init,
    onNodeClick,
    onEdgeClick,
    onNodeDrop,
    onNodesChange,
    onPaneClick,
    onConnect,
    onInitReactFlow,
    updateEntityData,
    onAddPipelineClick,
    onColumnEdgeRemove,
    dqHighlightedEdges,
  } = useLineageProvider();
  const { isEditMode, setIsCreatingEdge } = useLineageStore();

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onConnectStart = useCallback(() => {
    setIsCreatingEdge(true);
  }, []);

  const onConnectEnd = useCallback(() => {
    setIsCreatingEdge(false);
  }, []);

  useEffect(() => {
    updateEntityData(entityType, entity as SourceType, isPlatformLineage);
  }, [entity, entityType, isPlatformLineage]);

  // Memoize callback for onNodeClick to prevent unnecessary re-renders
  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      onNodeClick(node);
      _e.stopPropagation();
    },
    [onNodeClick]
  );

  // Memoize callback for onNodeDrop to prevent unnecessary re-renders
  const handleNodeDrop = useCallback(
    (_e: DragEvent) => {
      onNodeDrop(
        _e,
        reactFlowWrapper.current?.getBoundingClientRect() as DOMRect
      );
    },
    [onNodeDrop, reactFlowWrapper]
  );

  const toggleMiniMapVisibility = useCallback(() => {
    setShowMiniMap((show) => !show);
  }, []);

  const handleCanvasEdgeClick = useCallback(
    (edge: Edge, event: MouseEvent) => {
      onEdgeClick(edge);
      event.stopPropagation();
    },
    [onEdgeClick]
  );

  const handleCanvasEdgeHover = useCallback((edge: Edge | null) => {
    setHoveredEdge(edge);
  }, []);

  // We don't want to pass edge or edgeType to reactflow as we are using a custom edge renderer
  // Canvas based edge rendering to prevent DOM to become heavy
  const memoizedEdgeTypes = useMemo(() => ({}), []);

  const memoizedEdges = useMemo(() => [], []);

  // Loading the react flow component after the nodes and edges are initialised improves performance
  // considerably. So added an init state for showing loader.
  return (
    <Card
      className="lineage-card card-padding-0"
      data-testid="lineage-details"
      title={
        isPlatformLineage ? (
          platformHeader
        ) : (
          <div
            className={classNames('lineage-header', {
              'lineage-header-edit-mode': isEditMode,
            })}>
            <CustomControlsComponent
              deleted={Boolean(deleted)}
              hasEditAccess={hasEditAccess}
            />
          </div>
        )
      }>
      {
        <div
          className="h-full relative lineage-container"
          data-testid="lineage-container"
          id="lineage-container" // ID is required for export PNG functionality
          ref={reactFlowWrapper}>
          {init ? (
            <ReactFlowProvider>
              <ReactFlow
                elevateEdgesOnSelect
                onlyRenderVisibleElements
                className="custom-react-flow"
                data-testid="react-flow-component"
                deleteKeyCode={null}
                edgeTypes={memoizedEdgeTypes}
                edges={memoizedEdges}
                fitViewOptions={{
                  padding: 48,
                }}
                maxZoom={MAX_ZOOM_VALUE}
                minZoom={MIN_ZOOM_VALUE}
                nodeDragThreshold={1}
                nodeTypes={nodeTypes}
                nodes={nodes}
                nodesConnectable={isEditMode}
                selectNodesOnDrag={false}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                onConnectStart={onConnectStart}
                onDragOver={onDragOver}
                onDrop={handleNodeDrop}
                onInit={onInitReactFlow}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onNodeDrag={dragHandle}
                onNodeDragStart={dragHandle}
                onNodeDragStop={dragHandle}
                onNodesChange={onNodesChange}
                onPaneClick={onPaneClick}>
                <Background gap={12} size={1} />
                {showMiniMap && (
                  <MiniMap pannable zoomable position="bottom-right" />
                )}

                {/* Canvas based edge rendering to prevent DOM from becoming heavy */}
                <CanvasLayerWrapper
                  dqHighlightedEdges={dqHighlightedEdges ?? new Set<string>()}
                  hoverEdge={hoveredEdge}
                  onEdgeClick={handleCanvasEdgeClick}
                  onEdgeHover={handleCanvasEdgeHover}
                  onEdgeRemove={onColumnEdgeRemove}
                  onPipelineClick={onAddPipelineClick}
                />

                {/* Render lineage layer to */}
                <Panel
                  className={classNames({ 'edit-mode': isEditMode })}
                  position="bottom-left">
                  <LineageLayers entity={entity} entityType={entityType} />
                </Panel>
                {/* Lineage control buttons */}
                <Panel position="bottom-right">
                  <LineageControlButtons
                    miniMapVisible={showMiniMap}
                    onToggleMiniMap={toggleMiniMapVisibility}
                  />
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="loading-card">
              <Loader />
            </div>
          )}
        </div>
      }
    </Card>
  );
};

export default Lineage;
