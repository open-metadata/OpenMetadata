/*
 *  Copyright 2024 Collate.
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
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import ReactFlow, { Background, MiniMap, Panel, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  LINEAGE_TAB_VIEW,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { useLineageActions } from '../../context/LineageV1/hooks/useLineageActions';
import { useLineageData } from '../../context/LineageV1/hooks/useLineageData';
import { useLineageUI } from '../../context/LineageV1/hooks/useLineageUI';
import { EntityLineageNodeType } from '../../enums/entity.enum';
import LoadMoreNode from '../Entity/EntityLineage/LoadMoreNode/LoadMoreNode';
import Loader from '../common/Loader/Loader';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import EdgeInfoDrawer from '../Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import EntityInfoDrawer from '../Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import CustomEdgeV1Wrapper from './CustomEdgeV1Wrapper';
import CustomNodeV1Wrapper from './CustomNodeV1Wrapper';
import LineageLayersV1 from './LineageLayers/LineageLayersV1';
import { LineageV1Props } from './LineageV1.interface';
import './LineageV1.less';

// Define node types using our wrapper
const nodeTypes = {
  [EntityLineageNodeType.OUTPUT]: CustomNodeV1Wrapper,
  [EntityLineageNodeType.INPUT]: CustomNodeV1Wrapper,
  [EntityLineageNodeType.DEFAULT]: CustomNodeV1Wrapper,
  [EntityLineageNodeType.LOAD_MORE]: LoadMoreNode,
};

// Define edge types using our wrapper
const edgeTypes = {
  buttonedge: CustomEdgeV1Wrapper,
};

const LineageV1 = memo<LineageV1Props>(
  ({ entity, entityType, isPlatformLineage, hasEditAccess }) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    // Use split contexts for optimized re-renders
    const { nodes, edges } = useLineageData();
    const { isEditMode, init, isDrawerOpen, selectedNode, selectedEdge } =
      useLineageUI();

    const {
      onInitReactFlow,
      onNodeClick,
      onEdgeClick,
      onPaneClick,
      onConnect,
      onNodesChange,
      onEdgesChange,
      onNodeDrop,
      onCloseDrawer,
      updateEntityData,
      fetchLineageData,
    } = useLineageActions();

    // Initialize entity data - only run when entity changes
    useEffect(() => {
      if (entity && entityType && entity.fullyQualifiedName) {
        updateEntityData(entityType, entity, isPlatformLineage);

        // Fetch lineage data directly without transition for initial load
        fetchLineageData(entity.fullyQualifiedName, entityType, {
          upstreamDepth: 3,
          downstreamDepth: 3,
          nodesPerLayer: 50,
        });
      }
      // Only depend on the actual entity data, not the functions
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entity?.fullyQualifiedName, entityType, isPlatformLineage]);

    // Memoized callbacks for better performance
    const handleDragOver = useCallback((event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }, []);

    const handleNodeDrop = useCallback(
      (event: DragEvent) => {
        const bounds = reactFlowWrapper.current?.getBoundingClientRect();
        if (bounds) {
          onNodeDrop(event, bounds);
        }
      },
      [onNodeDrop]
    );

    const handleNodeClick = useCallback(
      (_e: React.MouseEvent, node: Node) => {
        _e.stopPropagation();
        onNodeClick(node);
      },
      [onNodeClick]
    );

    const handleEdgeClick = useCallback(
      (_e: React.MouseEvent, edge: Edge) => {
        _e.stopPropagation();
        onEdgeClick(edge);
      },
      [onEdgeClick]
    );

    // Memoize class names
    const containerClasses = useMemo(
      () =>
        classNames('lineage-container-v1', {
          'edit-mode': isEditMode,
        }),
      [isEditMode]
    );

    return (
      <Card
        className="lineage-card-v1 border-none card-padding-0"
        data-testid="lineage-v1"
        title={
          !isPlatformLineage && (
            <div className="lineage-header-v1">
              <CustomControlsComponent
                activeViewTab={LINEAGE_TAB_VIEW.DIAGRAM_VIEW}
                handleActiveViewTabChange={() => {
                  // Handle tab change if needed
                }}
                onlyShowTabSwitch={false}
              />
            </div>
          )
        }>
        <div
          className={containerClasses}
          data-testid="lineage-container-v1"
          ref={reactFlowWrapper}>
          {init ? (
            <ReactFlow
              elevateEdgesOnSelect
              className="custom-react-flow-v1"
              data-testid="react-flow-v1"
              deleteKeyCode={null}
              edgeTypes={edgeTypes}
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
              onDragOver={handleDragOver}
              onDrop={handleNodeDrop}
              onEdgeClick={handleEdgeClick}
              onEdgesChange={onEdgesChange}
              onInit={(instance) => {
                onInitReactFlow(instance);
                // Try to fit view after initialization
                setTimeout(() => {
                  instance.fitView({ padding: 0.2 });
                }, 100);
              }}
              onNodeClick={handleNodeClick}
              onNodesChange={onNodesChange}
              onPaneClick={onPaneClick}>
              <Background gap={12} size={1} />
              <MiniMap pannable zoomable position="bottom-right" />

              <Panel position="bottom-left">
                <LineageLayersV1 entity={entity} entityType={entityType} />
              </Panel>
            </ReactFlow>
          ) : (
            <div className="loading-card">
              <Loader />
            </div>
          )}
        </div>

        {/* Entity Info Drawer */}
        {selectedNode && !selectedEdge && (
          <EntityInfoDrawer
            selectedNode={selectedNode}
            show={isDrawerOpen}
            onCancel={onCloseDrawer}
          />
        )}

        {/* Edge Info Drawer */}
        {selectedEdge && (
          <EdgeInfoDrawer
            edge={selectedEdge}
            hasEditAccess={hasEditAccess || false}
            nodes={nodes}
            visible={isDrawerOpen}
            onClose={onCloseDrawer}
          />
        )}
      </Card>
    );
  }
);

LineageV1.displayName = 'LineageV1';

export default LineageV1;
