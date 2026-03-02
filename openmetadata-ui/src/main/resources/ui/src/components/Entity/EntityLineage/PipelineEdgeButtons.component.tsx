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
import { Button, Tag } from 'antd';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import {
  Position,
  useNodes,
  useReactFlow,
  useViewport,
  Viewport,
} from 'reactflow';
import { ReactComponent as FunctionIcon } from '../../../assets/svg/ic-function.svg';
import { ReactComponent as PipelineIcon } from '../../../assets/svg/pipeline-grey.svg';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { StatusType } from '../../../generated/entity/data/pipeline';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getEdgeCoordinates, transformPoint } from '../../../utils/CanvasUtils';
import { getEdgePathData } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';

export function getAbsolutePosition(
  canvasX: number,
  canvasY: number,
  viewport: Viewport
): React.CSSProperties {
  const transformed = transformPoint(canvasX, canvasY, viewport);

  return {
    position: 'absolute',
    left: `${transformed.x}px`,
    top: `${transformed.y}px`,
    transform: `translate(-50%, -50%) scale(${viewport.zoom})`,
    pointerEvents: 'all',
  };
}

function getPipelineStatusClass(executionStatus?: StatusType): string {
  if (!executionStatus) {
    return '';
  }

  switch (executionStatus) {
    case StatusType.Successful:
      return 'green';
    case StatusType.Failed:
      return 'red';
    case StatusType.Pending:
    case StatusType.Skipped:
      return 'amber';
    default:
      return '';
  }
}

function getBlinkingClass(
  isPipelineRootNode: boolean,
  executionStatus?: StatusType
): string {
  if (!isPipelineRootNode) {
    return '';
  }

  const statusClass = getPipelineStatusClass(executionStatus);

  return statusClass ? `blinking-${statusClass}-border` : 'blinking-border';
}

interface EdgePathData {
  edgePath: string;
  edgeCenterX: number;
  edgeCenterY: number;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}

export const PipelineEdgeButtons: React.FC = () => {
  const { edges } = useLineageProvider();
  const {
    columnsInCurrentPages,
    isEditMode,
    isDQEnabled,
    setSelectedEdge,
    isRepositioning,
    isCanvasReady,
  } = useLineageStore();
  const { onAddPipelineClick } = useLineageProvider();
  const { getNode } = useReactFlow();
  const nodes = useNodes();
  const viewport = useViewport();

  const edgesWithButtons = useMemo(() => {
    return edges.filter((edge) => {
      const {
        isColumnLineage,
        edge: edgeDetails,
        columnFunctionValue,
        isExpanded,
      } = edge.data || {};

      const hasPipeline =
        !isColumnLineage &&
        edgeDetails?.pipeline &&
        getEntityName(edgeDetails.pipeline);
      const hasFunction = !isColumnLineage && columnFunctionValue && isExpanded;

      return hasPipeline || hasFunction;
    });
  }, [edges]);

  const edgePathDataMap = useMemo(() => {
    const map = new Map<string, EdgePathData>();

    edgesWithButtons.forEach((edge) => {
      if (edge.data?.computedPath) {
        map.set(edge.id, edge.data.computedPath);

        return;
      }

      const coords = getEdgeCoordinates(
        edge,
        getNode(edge.source),
        getNode(edge.target),
        columnsInCurrentPages
      );

      if (!coords) {
        return;
      }

      const pathData = getEdgePathData(edge.source, edge.target, {
        sourceX: coords.sourceX,
        sourceY: coords.sourceY,
        targetX: coords.targetX,
        targetY: coords.targetY,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      map.set(edge.id, pathData);
    });

    return map;
  }, [edgesWithButtons, nodes, columnsInCurrentPages, getNode]);

  if (isRepositioning || !isCanvasReady) {
    return null;
  }

  return (
    <div className="pipeline-edge-buttons-overlay">
      {edgesWithButtons.map((edge) => {
        const {
          edge: edgeDetails,
          isColumnLineage,
          columnFunctionValue,
          isExpanded,
          isPipelineRootNode,
        } = edge.data || {};

        const pathData = edgePathDataMap.get(edge.id);
        if (!pathData) {
          return null;
        }

        const hasPipeline =
          !isColumnLineage &&
          edgeDetails?.pipeline &&
          getEntityName(edgeDetails.pipeline);
        const hasFunction =
          !isColumnLineage && columnFunctionValue && isExpanded;

        if (!hasPipeline && !hasFunction) {
          return null;
        }

        const pipelineData = edgeDetails?.pipeline?.pipelineStatus;
        const currentPipelineStatus = isDQEnabled
          ? getPipelineStatusClass(pipelineData?.executionStatus)
          : '';
        const blinkingClass = getBlinkingClass(
          isPipelineRootNode,
          pipelineData?.executionStatus
        );

        if (hasPipeline) {
          const dataTestId = `pipeline-label-${edgeDetails.fromEntity.fullyQualifiedName}-${edgeDetails.toEntity.fullyQualifiedName}`;

          const buttonElement = (
            <Button
              className={classNames(
                'flex-center custom-edge-pipeline-button',
                currentPipelineStatus,
                blinkingClass
              )}
              data-testid={dataTestId}
              icon={<PipelineIcon />}
              size="small"
              onClick={() =>
                isEditMode ? onAddPipelineClick() : setSelectedEdge(edge)
              }
            />
          );

          return (
            <div
              key={`pipeline-btn-${edge.id}`}
              style={getAbsolutePosition(
                pathData.edgeCenterX,
                pathData.edgeCenterY,
                viewport
              )}>
              {isEditMode ? (
                buttonElement
              ) : (
                <EntityPopOverCard
                  entityFQN={edgeDetails.pipeline.fullyQualifiedName}
                  entityType={edgeDetails.pipelineEntityType}
                  extraInfo={
                    pipelineData && (
                      <Tag className={currentPipelineStatus}>
                        {pipelineData.executionStatus}
                      </Tag>
                    )
                  }>
                  {buttonElement}
                </EntityPopOverCard>
              )}
            </div>
          );
        }

        if (hasFunction) {
          const dataTestId = `function-icon-${edgeDetails?.fromEntity.fullyQualifiedName}-${edgeDetails?.toEntity.fullyQualifiedName}`;

          const buttonElement = (
            <Button
              className={classNames(
                'flex-center custom-edge-pipeline-button',
                blinkingClass
              )}
              data-testid={dataTestId}
              icon={<FunctionIcon />}
              size="small"
              onClick={() =>
                isEditMode ? onAddPipelineClick() : setSelectedEdge(edge)
              }
            />
          );

          return (
            <div
              key={`function-btn-${edge.id}`}
              style={getAbsolutePosition(
                pathData.edgeCenterX,
                pathData.edgeCenterY,
                viewport
              )}>
              {isEditMode ? (
                buttonElement
              ) : (
                <EntityPopOverCard
                  entityFQN={edgeDetails?.pipeline?.fullyQualifiedName}
                  entityType={edge.data.pipelineEntityType}
                  extraInfo={
                    pipelineData && (
                      <Tag className={currentPipelineStatus}>
                        {pipelineData.executionStatus}
                      </Tag>
                    )
                  }>
                  {buttonElement}
                </EntityPopOverCard>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
