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
import { debounce } from 'lodash';
import Qs from 'qs';
import React, { DragEvent, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../constants/Lineage.constants';
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
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import { useLineageProvider } from '../LineageProvider/LineageProvider';
import { LineageProps } from './Lineage.interface';

const Lineage = ({
  deleted,
  hasEditAccess,
  entity,
  entityType,
}: LineageProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const {
    nodes,
    edges,
    isEditMode,
    onNodeClick,
    onEdgeClick,
    onNodeDrop,
    onNodesChange,
    onEdgesChange,
    entityLineage,
    onPaneClick,
    onConnect,
    onZoomUpdate,
    onInitReactFlow,
  } = useLineageProvider();
  const { fqn: entityFQN } = useParams<{ fqn: string }>();
  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get('fullscreen') === 'true';

  const onFullScreenClick = useCallback(() => {
    history.push({
      search: Qs.stringify({ fullscreen: true }),
    });
  }, [entityFQN]);

  const onExitFullScreenViewClick = useCallback(() => {
    history.push({
      search: '',
    });
  }, [entityFQN]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleZoomLevel = debounce((value: number) => {
    onZoomUpdate(value);
  }, 150);

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

  return (
    <Card
      className={classNames('lineage-card card-body-full w-auto border-none', {
        'full-screen-lineage': isFullScreen,
      })}
      data-testid="lineage-details">
      <div
        className="h-full"
        data-testid="lineage-container"
        ref={reactFlowWrapper}>
        {isFullScreen && (
          <TitleBreadcrumb className="p-md" titleLinks={breadcrumbs} />
        )}
        <ReactFlowProvider>
          <ReactFlow
            className="custom-react-flow"
            data-testid="react-flow-component"
            edgeTypes={customEdges}
            edges={edges}
            maxZoom={MAX_ZOOM_VALUE}
            minZoom={MIN_ZOOM_VALUE}
            nodeTypes={nodeTypes}
            nodes={nodes}
            nodesConnectable={isEditMode}
            selectNodesOnDrag={false}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={(_e) =>
              onNodeDrop(
                _e,
                reactFlowWrapper.current?.getBoundingClientRect() as DOMRect
              )
            }
            onEdgeClick={(_e, data) => {
              onEdgeClick(data);
              _e.stopPropagation();
            }}
            onEdgesChange={onEdgesChange}
            onInit={onInitReactFlow}
            onMove={(_e, viewPort) => handleZoomLevel(viewPort.zoom)}
            onNodeClick={(_e, node) => {
              onNodeClick(node);
              _e.stopPropagation();
            }}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDrag={dragHandle}
            onNodeDragStart={dragHandle}
            onNodeDragStop={dragHandle}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeMouseMove={onNodeMouseMove}
            onNodesChange={onNodesChange}
            onPaneClick={onPaneClick}>
            {entityLineage && (
              <CustomControlsComponent
                className="absolute top-1 right-1 p-xs"
                deleted={deleted}
                handleFullScreenViewClick={
                  !isFullScreen ? onFullScreenClick : undefined
                }
                hasEditAccess={hasEditAccess}
                onExitFullScreenViewClick={
                  isFullScreen ? onExitFullScreenViewClick : undefined
                }
              />
            )}
            <Background gap={12} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </Card>
  );
};

export default Lineage;
