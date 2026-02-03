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

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
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
      <Box
        className="ports-lineage-view-empty"
        sx={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'grey.200',
        }}>
        <ErrorPlaceHolder
          className="m-t-0"
          icon={
            <AddPlaceHolderIcon
              className="w-12 h-12"
              data-testid="no-ports-placeholder"
            />
          }
          size={SIZE.SMALL}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography className="text-center" variant="body2">
            {assetCount === 0
              ? t('message.no-assets-for-ports-lineage')
              : t('message.no-ports-to-display-lineage')}
          </Typography>
        </ErrorPlaceHolder>
      </Box>
    );
  }

  return (
    <Box
      className="ports-lineage-view"
      data-testid="ports-lineage-view"
      sx={{
        height: containerHeight,
        width: '100%',
        backgroundColor: 'grey.50',
        borderRadius: isFullScreen ? 0 : '8px',
        border: isFullScreen ? 'none' : '1px solid',
        borderColor: 'grey.200',
        position: isFullScreen ? 'fixed' : 'relative',
        top: isFullScreen ? 0 : 'auto',
        left: isFullScreen ? 0 : 'auto',
        right: isFullScreen ? 0 : 'auto',
        bottom: isFullScreen ? 0 : 'auto',
        zIndex: isFullScreen ? 1300 : 'auto',
      }}>
      {onToggleFullScreen && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
          }}>
          <Tooltip
            title={
              isFullScreen
                ? t('label.exit-full-screen')
                : t('label.full-screen')
            }>
            <IconButton
              data-testid="toggle-fullscreen-btn"
              size="small"
              sx={{
                backgroundColor: 'white',
                border: '1px solid',
                borderColor: '#414651',
                '&:hover': {
                  backgroundColor: 'grey.100',
                },
              }}
              onClick={handleToggleFullScreen}>
              {isFullScreen ? (
                <Minimize01 fill="#414651" height={18} width={18} />
              ) : (
                <Maximize01 fill="#414651" height={18} width={18} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
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
    </Box>
  );
};

export default PortsLineageView;
