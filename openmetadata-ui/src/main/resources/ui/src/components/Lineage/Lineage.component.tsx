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
import { Card, RadioChangeEvent } from 'antd';
import Qs from 'qs';
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactFlow, { Background, MiniMap, Panel } from 'reactflow';
import {
  LINEAGE_TAB_VIEW,
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../constants/Lineage.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import {
  customEdges,
  dragHandle,
  nodeTypes,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
} from '../../utils/EntityLineageUtils';
import { getEntityBreadcrumbs } from '../../utils/EntityUtils';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import LineageControlButtons from '../Entity/EntityLineage/LineageControlButtons/LineageControlButtons';
import LineageLayers from '../Entity/EntityLineage/LineageLayers/LineageLayers';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { LineageProps } from './Lineage.interface';
import LineageTable from './LineageTable/LineageTable.component';

const Lineage = ({
  deleted,
  hasEditAccess,
  entity,
  entityType,
  isPlatformLineage,
}: LineageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeViewTab, setActiveViewTab] = useState<LINEAGE_TAB_VIEW>(
    LINEAGE_TAB_VIEW.DIAGRAM_VIEW
  );
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const location = useCustomLocation();
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
    onInitReactFlow,
    updateEntityData,
    onCloseDrawer,
  } = useLineageProvider();

  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get('fullscreen') === 'true';

  const onFullScreenClick = useCallback(() => {
    navigate({
      search: Qs.stringify({ fullscreen: true }),
    });
  }, []);

  const onExitFullScreenViewClick = useCallback(() => {
    navigate({
      search: '',
    });
  }, []);

  const handleActiveViewTabChange = useCallback((event: RadioChangeEvent) => {
    setActiveViewTab(event.target.value);
    onCloseDrawer();
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const breadcrumbs = useMemo(
    () =>
      entity
        ? [
            ...getEntityBreadcrumbs(entity, entityType),
            {
              name: t('label.lineage'),
              url: '',
              activeTitle: true,
            },
          ]
        : [],
    [entity]
  );

  useEffect(() => {
    updateEntityData(entityType, entity as SourceType, isPlatformLineage);
  }, [entity, entityType, isPlatformLineage]);

  // Memoize callback for onEdgeClick to prevent unnecessary re-renders
  const handleEdgeClick = useCallback(
    (_e: React.MouseEvent, data: any) => {
      onEdgeClick(data);
      _e.stopPropagation();
    },
    [onEdgeClick]
  );

  // Memoize callback for onNodeClick to prevent unnecessary re-renders
  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: any) => {
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

  // Loading the react flow component after the nodes and edges are initialised improves performance
  // considerably. So added an init state for showing loader.
  return (
    <Card
      className="lineage-card card-body-full w-auto border-none card-padding-0"
      data-testid="lineage-details">
      {isFullScreen && breadcrumbs.length > 0 && (
        <TitleBreadcrumb className="p-md" titleLinks={breadcrumbs} />
      )}

      {activeViewTab === LINEAGE_TAB_VIEW.DIAGRAM_VIEW ? (
        <div
          className="h-full relative lineage-container"
          data-testid="lineage-container"
          id="lineage-container" // ID is required for export PNG functionality
          ref={reactFlowWrapper}>
          {init ? (
            <>
              {isPlatformLineage ? null : (
                <CustomControlsComponent
                  activeViewTab={activeViewTab}
                  className="absolute top-1 right-1 p-xs"
                  handleActiveViewTabChange={handleActiveViewTabChange}
                />
              )}
              <LineageControlButtons
                deleted={deleted}
                entityType={entityType}
                handleFullScreenViewClick={
                  !isFullScreen ? onFullScreenClick : undefined
                }
                hasEditAccess={hasEditAccess}
                onExitFullScreenViewClick={
                  isFullScreen ? onExitFullScreenViewClick : undefined
                }
              />
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
                <MiniMap pannable zoomable position="bottom-right" />

                <Panel position="bottom-left">
                  <LineageLayers entity={entity} entityType={entityType} />
                </Panel>
              </ReactFlow>
            </>
          ) : (
            <div className="loading-card">
              <Loader />
            </div>
          )}
        </div>
      ) : (
        <div
          className="h-full relative lineage-container overflow-auto"
          data-testid="lineage-table-container">
          <CustomControlsComponent
            onlyShowTabSwitch
            activeViewTab={activeViewTab}
            className="absolute top-1 right-1 p-xs"
            handleActiveViewTabChange={handleActiveViewTabChange}
          />
          <LineageTable />
        </div>
      )}
    </Card>
  );
};

export default Lineage;
