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
import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Edge, MiniMap, Node, Panel } from 'reactflow';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import {
  customEdges,
  dragHandle,
  nodeTypes,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
} from '../../utils/EntityLineageUtils';
import Loader from '../common/Loader/Loader';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import LineageControlButtons from '../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../SearchedData/SearchedData.interface';
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

  const {
    nodes,
    edges,
    isEditMode,
    init,
    onNodeClick,
    onEdgeClick,
    onNodeDrop,
    onNodesChange,
    onEdgesChange,
    onPaneClick,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onInitReactFlow,
    updateEntityData,
  } = useLineageProvider();

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  useEffect(() => {
    updateEntityData(entityType, entity as SourceType, isPlatformLineage);
  }, [entity, entityType, isPlatformLineage]);

  // Memoize callback for onEdgeClick to prevent unnecessary re-renders
  const handleEdgeClick = useCallback(
    (_e: React.MouseEvent, data: Edge) => {
      onEdgeClick(data);
      _e.stopPropagation();
    },
    [onEdgeClick]
  );

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
            <ReactFlow
              elevateEdgesOnSelect
              className="custom-react-flow"
              data-testid="react-flow-component"
              deleteKeyCode={null}
              edgeTypes={customEdges}
              edges={edges}
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
              onEdgeClick={handleEdgeClick}
              onEdgesChange={onEdgesChange}
              onInit={onInitReactFlow}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDrag={dragHandle}
              onNodeDragStart={dragHandle}
              onNodeDragStop={dragHandle}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onNodeMouseMove={onNodeMouseMove}
              onNodesChange={onNodesChange}
              onPaneClick={onPaneClick}>
              <Background gap={12} size={1} />
              {showMiniMap && (
                <MiniMap pannable zoomable position="bottom-right" />
              )}

              <Panel
                className={classNames({ 'edit-mode': isEditMode })}
                position="bottom-left">
                <LineageLayers entity={entity} entityType={entityType} />
              </Panel>
              <Panel position="bottom-right">
                <LineageControlButtons
                  miniMapVisible={showMiniMap}
                  onToggleMiniMap={toggleMiniMapVisibility}
                />
              </Panel>
            </ReactFlow>
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
