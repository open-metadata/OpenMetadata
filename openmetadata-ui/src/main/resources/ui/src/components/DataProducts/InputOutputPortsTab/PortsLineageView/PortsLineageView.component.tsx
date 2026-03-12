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

import {
  Button,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Maximize01, Minimize01 } from '@untitledui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/ic-no-records.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { getEntityName } from '../../../../utils/EntityUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import DataProductNode from './DataProductNode.component';
import PortNode from './PortNode.component';
import './PortsLineageView.style.less';
import { PortsLineageViewProps } from './PortsLineageView.types';

const getPortHandleId = (port: SourceType): string => {
  return port.fullyQualifiedName ?? port.id ?? '';
};

const nodeTypes = {
  portNode: PortNode,
  dataProductNode: DataProductNode,
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const VERTICAL_SPACING = 20;
const HORIZONTAL_SPACING = 200;

const PortsLineageView = ({
  dataProduct,
  inputPortsData,
  outputPortsData,
  assetCount,
  isFullScreen = false,
  height = 350,
  onToggleFullScreen,
}: PortsLineageViewProps) => {
  const { t } = useTranslation();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const reactFlowInstance = useReactFlow();

  const handleToggleFullScreen = useCallback(() => {
    if (onToggleFullScreen) {
      onToggleFullScreen();
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
        reactFlowInstance.zoomTo(0.4);
      }, 100);
    }
  }, [onToggleFullScreen, reactFlowInstance]);

  const hasAnyPorts =
    dataProduct && (inputPortsData.length > 0 || outputPortsData.length > 0);

  const buildNodesAndEdges = useCallback(() => {
    if (!dataProduct) {
      return;
    }
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const maxPortCount = Math.max(
      inputPortsData.length,
      outputPortsData.length,
      1
    );
    const totalHeight = maxPortCount * (NODE_HEIGHT + VERTICAL_SPACING);
    const centerY = totalHeight / 2;

    const dataProductNode: Node = {
      id: 'data-product-center',
      type: 'dataProductNode',
      position: { x: HORIZONTAL_SPACING + NODE_WIDTH, y: centerY - 50 },
      data: { dataProduct },
      draggable: false,
    };
    newNodes.push(dataProductNode);

    inputPortsData.forEach((portData, index) => {
      const port = portData._source;
      const handleId = getPortHandleId(port);
      const yPosition =
        index * (NODE_HEIGHT + VERTICAL_SPACING) +
        (totalHeight -
          inputPortsData.length * (NODE_HEIGHT + VERTICAL_SPACING)) /
          2;

      const nodeId = `input-${handleId}`;
      newNodes.push({
        id: nodeId,
        type: 'portNode',
        position: { x: 0, y: yPosition },
        data: {
          label: getEntityName(port),
          port,
          isInputPort: true,
          handleId,
        },
        draggable: false,
      });

      newEdges.push({
        id: `edge-${nodeId}-to-center`,
        source: nodeId,
        target: 'data-product-center',
        sourceHandle: handleId,
        targetHandle: `${dataProduct.id}-left`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#b1b1b7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#b1b1b7',
        },
      });
    });

    outputPortsData.forEach((portData, index) => {
      const port = portData._source;
      const handleId = getPortHandleId(port);
      const yPosition =
        index * (NODE_HEIGHT + VERTICAL_SPACING) +
        (totalHeight -
          outputPortsData.length * (NODE_HEIGHT + VERTICAL_SPACING)) /
          2;

      const nodeId = `output-${handleId}`;
      newNodes.push({
        id: nodeId,
        type: 'portNode',
        position: { x: 2 * (HORIZONTAL_SPACING + NODE_WIDTH), y: yPosition },
        data: {
          label: getEntityName(port),
          port,
          isInputPort: false,
          handleId,
        },
        draggable: false,
      });

      newEdges.push({
        id: `edge-center-to-${nodeId}`,
        source: 'data-product-center',
        target: nodeId,
        sourceHandle: `${dataProduct.id}-right`,
        targetHandle: handleId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#b1b1b7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#b1b1b7',
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [dataProduct, inputPortsData, outputPortsData, setNodes, setEdges]);

  useEffect(() => {
    if (hasAnyPorts) {
      buildNodesAndEdges();
    }
  }, [buildNodesAndEdges, hasAnyPorts]);

  useEffect(() => {
    if (nodes.length > 0 && !isInitialized && reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
        reactFlowInstance.zoomTo(0.4);
        setIsInitialized(true);
      }, 100);
    }
  }, [nodes, isInitialized, reactFlowInstance]);

  const containerHeight = useMemo(() => {
    if (isFullScreen) {
      return '100vh';
    }

    return `${height}px`;
  }, [isFullScreen, height]);

  if (!hasAnyPorts) {
    return (
      <div className="ports-lineage-view-empty tw:h-50 tw:flex tw:items-center tw:justify-center tw:bg-gray-50 tw:rounded-lg tw:border tw:border-gray-200">
        <ErrorPlaceHolder
          className="m-t-0"
          icon={
            <AddPlaceHolderIcon
              className="tw:w-12 tw:h-12"
              data-testid="no-ports-placeholder"
            />
          }
          size={SIZE.SMALL}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography as="p" className="text-center">
            {assetCount === 0
              ? t('message.no-assets-for-ports-lineage')
              : t('message.no-ports-to-display-lineage')}
          </Typography>
        </ErrorPlaceHolder>
      </div>
    );
  }

  return (
    <div
      className={`ports-lineage-view w-full bg-gray-50 ${
        isFullScreen
          ? 'tw:fixed tw:top-0 tw:left-0 tw:right-0 tw:bottom-0 tw:z-1300 tw:rounded-none tw:border-none'
          : 'tw:relative tw:rounded-lg tw:border tw:border-gray-200'
      }`}
      data-testid="ports-lineage-view"
      style={{ height: containerHeight }}>
      {onToggleFullScreen && (
        <div className="tw:absolute tw:top-2 tw:right-2 tw:z-10">
          <Tooltip
            title={
              isFullScreen
                ? t('label.exit-full-screen')
                : t('label.full-screen')
            }>
            <TooltipTrigger>
              <Button
                color="secondary"
                data-testid="toggle-fullscreen-btn"
                iconLeading={
                  isFullScreen ? (
                    <Minimize01 fill="#414651" height={18} width={18} />
                  ) : (
                    <Maximize01 fill="#414651" height={18} width={18} />
                  )
                }
                onClick={handleToggleFullScreen}
              />
            </TooltipTrigger>
          </Tooltip>
        </div>
      )}

      <ReactFlow
        panOnDrag
        zoomOnScroll
        edges={edges}
        fitViewOptions={{ padding: 0.2 }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}>
        <Background color="#e5e7eb" gap={16} size={1} />
        <Controls
          showFitView
          showZoom
          position="bottom-left"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
};

export default PortsLineageView;
