/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Tag } from 'antd';
import classNames from 'classnames';
import React, { Fragment, useMemo } from 'react';
import { EdgeProps } from 'reactflow';
import { ReactComponent as IconEditCircle } from '../../../assets/svg/ic-edit-circle.svg';
import { ReactComponent as FunctionIcon } from '../../../assets/svg/ic-function.svg';
import { ReactComponent as IconTimesCircle } from '../../../assets/svg/ic-times-circle.svg';
import { ReactComponent as PipelineIcon } from '../../../assets/svg/pipeline-grey.svg';
import { RED_3 } from '../../../constants/Color.constants';
import { FOREIGN_OBJECT_SIZE } from '../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../../enums/entity.enum';
import { StatusType } from '../../../generated/entity/data/pipeline';
import { LineageLayer } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getColumnSourceTargetHandles,
  getEdgePathData,
} from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';

interface LineageEdgeIconProps {
  children: React.ReactNode;
  x: number;
  y: number;
  offset: number;
}

export const LineageEdgeIcon = ({
  children,
  x,
  y,
  offset,
}: LineageEdgeIconProps) => {
  return (
    <foreignObject
      height={FOREIGN_OBJECT_SIZE}
      requiredExtensions="http://www.w3.org/1999/xhtml"
      width={FOREIGN_OBJECT_SIZE}
      x={x - FOREIGN_OBJECT_SIZE / offset}
      y={y - FOREIGN_OBJECT_SIZE / offset}>
      {children}
    </foreignObject>
  );
};

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
  source,
  target,
}: EdgeProps) => {
  const {
    edge,
    isColumnLineage,
    sourceHandle,
    targetHandle,
    isPipelineRootNode,
    dataTestId,
  } = data || {};

  const offset = 4;

  const { fromEntity, toEntity, pipeline, pipelineEntityType } = edge;

  const {
    tracedNodes,
    tracedColumns,
    isEditMode,
    activeLayer,
    onAddPipelineClick,
    onColumnEdgeRemove,
    dataQualityLineage,
    dqHighlightedEdges,
  } = useLineageProvider();

  const { theme } = useApplicationStore();

  // Get edge path data once
  const { edgePath, edgeCenterX, edgeCenterY } = useMemo(
    () =>
      getEdgePathData(source, target, {
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      }),
    [
      source,
      target,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    ]
  );

  // Compute if should show DQ tracing
  const showDqTracing = useMemo(() => {
    if (
      !activeLayer.includes(LineageLayer.DataObservability) ||
      !dataQualityLineage?.nodes
    ) {
      return false;
    }

    return dqHighlightedEdges?.has(id);
  }, [activeLayer, dataQualityLineage?.nodes, id, dqHighlightedEdges]);

  // Determine if column is highlighted based on traced columns
  const isColumnHighlighted = useMemo(() => {
    if (!isColumnLineage) {
      return false;
    }

    const decodedHandles = getColumnSourceTargetHandles({
      sourceHandle,
      targetHandle,
    });

    return (
      tracedColumns.includes(decodedHandles.sourceHandle ?? '') &&
      tracedColumns.includes(decodedHandles.targetHandle ?? '')
    );
  }, [isColumnLineage, tracedColumns, sourceHandle, targetHandle]);

  // Calculate edge style with memoization
  const updatedStyle = useMemo(() => {
    const isNodeTraced =
      tracedNodes.includes(edge.fromEntity.id) &&
      tracedNodes.includes(edge.toEntity.id);

    const isStrokeNeeded = isColumnLineage ? isColumnHighlighted : isNodeTraced;
    let opacity = 1;
    if (isColumnLineage) {
      opacity =
        tracedNodes.length === 0 &&
        (tracedColumns.length === 0 || isColumnHighlighted)
          ? 1
          : 0.25;
    } else {
      opacity = tracedNodes.length === 0 || isStrokeNeeded ? 1 : 0.25;
    }

    let stroke = isStrokeNeeded ? theme.primaryColor : undefined;

    if (showDqTracing) {
      stroke = RED_3;
    }

    return {
      ...style,
      stroke,
      opacity,
    };
  }, [
    style,
    tracedNodes,
    edge.fromEntity.id,
    edge.toEntity.id,
    isColumnHighlighted,
    isColumnLineage,
    tracedColumns.length,
    showDqTracing,
    theme.primaryColor,
  ]);

  // Calculate conditions for various component displays
  const isPipelineEdgeAllowed = useMemo(() => {
    return (
      fromEntity?.type !== EntityType.PIPELINE &&
      toEntity?.type !== EntityType.PIPELINE
    );
  }, [fromEntity?.type, toEntity?.type]);

  const isColumnLineageAllowed = useMemo(
    () => !isColumnLineage && isPipelineEdgeAllowed,
    [isColumnLineage, isPipelineEdgeAllowed]
  );

  const hasLabel = useMemo(() => {
    if (isColumnLineage) {
      return false;
    }

    return pipeline ? getEntityName(pipeline) : false;
  }, [isColumnLineage, pipeline]);

  const isSelectedEditMode = selected && isEditMode;
  const isSelected = selected;

  // Calculate pipeline status for styling
  const currentPipelineStatus = useMemo(() => {
    const isPipelineActiveNow = activeLayer.includes(
      LineageLayer.DataObservability
    );
    const pipelineData = pipeline?.pipelineStatus;

    if (pipelineData && isPipelineActiveNow) {
      switch (pipelineData.executionStatus) {
        case StatusType.Failed:
          return 'red';
        case StatusType.Skipped:
        case StatusType.Pending:
          return 'amber';
        case StatusType.Successful:
          return 'green';
        default:
          return '';
      }
    }

    return '';
  }, [pipeline?.pipelineStatus, activeLayer]);

  // Calculate blinking class for pipeline nodes
  const blinkingClass = useMemo(() => {
    if (!isPipelineRootNode) {
      return '';
    }

    return currentPipelineStatus
      ? `blinking-${currentPipelineStatus}-border`
      : 'blinking-border';
  }, [currentPipelineStatus, isPipelineRootNode]);

  const renderIcons = useMemo(() => {
    const icons = [];

    // Pipeline lineage edge icon
    if (isColumnLineageAllowed && hasLabel) {
      const pipelineData = pipeline?.pipelineStatus;
      const dataTestIdValue = `pipeline-label-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`;

      icons.push(
        <LineageEdgeIcon
          key="pipeline-icon"
          offset={3}
          x={edgeCenterX}
          y={edgeCenterY}>
          {isEditMode ? (
            <Button
              className={classNames(
                'flex-center custom-edge-pipeline-button',
                currentPipelineStatus,
                blinkingClass
              )}
              data-testid={dataTestIdValue}
              icon={<PipelineIcon />}
              onClick={() => isEditMode && onAddPipelineClick()}
            />
          ) : (
            <EntityPopOverCard
              entityFQN={pipeline?.fullyQualifiedName}
              entityType={pipelineEntityType}
              extraInfo={
                pipelineData && (
                  <Tag className={currentPipelineStatus}>
                    {pipelineData?.executionStatus}
                  </Tag>
                )
              }>
              <Button
                className={classNames(
                  'flex-center custom-edge-pipeline-button',
                  currentPipelineStatus,
                  blinkingClass
                )}
                data-testid={dataTestIdValue}
                icon={<PipelineIcon />}
                onClick={() => isEditMode && onAddPipelineClick()}
              />
            </EntityPopOverCard>
          )}
        </LineageEdgeIcon>
      );
    }

    // Edit pipeline icon
    if (isColumnLineageAllowed && isSelectedEditMode) {
      icons.push(
        <LineageEdgeIcon
          key="edit-icon"
          offset={offset}
          x={edgeCenterX}
          y={edgeCenterY}>
          <Button
            className="cursor-pointer d-flex"
            data-testid="add-pipeline"
            icon={
              <Icon
                alt="times-circle"
                className="align-middle"
                component={IconEditCircle}
                style={{ fontSize: '16px' }}
              />
            }
            type="link"
            onClick={() => onAddPipelineClick?.()}
          />
        </LineageEdgeIcon>
      );
    }

    // Delete column edge icon
    if (!isColumnLineageAllowed && isSelectedEditMode) {
      icons.push(
        <LineageEdgeIcon
          key="delete-icon"
          offset={offset}
          x={edgeCenterX}
          y={edgeCenterY}>
          <Button
            className="cursor-pointer d-flex"
            data-testid="delete-button"
            icon={
              <Icon
                alt="times-circle"
                className="align-middle"
                component={IconTimesCircle}
                style={{ fontSize: '16px' }}
              />
            }
            type="link"
            onClick={() => onColumnEdgeRemove?.()}
          />
        </LineageEdgeIcon>
      );
    }

    // Function icon
    if (
      !isColumnLineageAllowed &&
      data.columnFunctionValue &&
      data.isExpanded
    ) {
      const dataTestIdValue = `function-icon-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`;

      icons.push(
        <LineageEdgeIcon
          key="function-icon"
          offset={3}
          x={edgeCenterX}
          y={edgeCenterY}>
          {isEditMode ? (
            <Button
              className={classNames(
                'flex-center custom-edge-pipeline-button',
                blinkingClass
              )}
              data-testid={dataTestIdValue}
              icon={<FunctionIcon />}
              onClick={() => isEditMode && onAddPipelineClick()}
            />
          ) : (
            <EntityPopOverCard
              entityFQN={pipeline?.fullyQualifiedName}
              entityType={pipelineEntityType}
              extraInfo={
                pipeline?.pipelineStatus && (
                  <Tag className={currentPipelineStatus}>
                    {pipeline?.pipelineStatus?.executionStatus}
                  </Tag>
                )
              }>
              <Button
                className={classNames(
                  'flex-center custom-edge-pipeline-button',
                  blinkingClass
                )}
                data-testid={dataTestIdValue}
                icon={<FunctionIcon />}
                onClick={() => isEditMode && onAddPipelineClick()}
              />
            </EntityPopOverCard>
          )}
        </LineageEdgeIcon>
      );
    }

    return icons;
  }, [
    selected,
    tracedNodes.length,
    tracedColumns.length,
    isColumnLineageAllowed,
    hasLabel,
    isSelectedEditMode,
    isSelected,
    data?.columnFunctionValue,
    data?.isExpanded,
    edge.fromEntity.fullyQualifiedName,
    edge.toEntity.fullyQualifiedName,
    edgeCenterX,
    edgeCenterY,
    isEditMode,
    currentPipelineStatus,
    blinkingClass,
    pipeline,
    pipelineEntityType,
    onAddPipelineClick,
    onColumnEdgeRemove,
  ]);

  return (
    <Fragment>
      <path
        className="react-flow__edge-path"
        d={edgePath}
        data-testid={dataTestId}
        id={id}
        markerEnd={markerEnd}
        style={updatedStyle}
      />
      {renderIcons}
    </Fragment>
  );
};
