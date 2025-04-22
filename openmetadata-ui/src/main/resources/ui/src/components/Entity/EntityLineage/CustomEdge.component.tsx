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
import React, { Fragment, useCallback, useMemo } from 'react';
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
import { CustomEdgeData } from './EntityLineage.interface';

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
    ...rest
  } = data;

  const offset = 4;

  const { fromEntity, toEntity, pipeline, pipelineEntityType } =
    data?.edge ?? {};

  const {
    tracedNodes,
    tracedColumns,
    isEditMode,
    activeLayer,
    onAddPipelineClick,
    onColumnEdgeRemove,
    dataQualityLineage,
  } = useLineageProvider();

  const { theme } = useApplicationStore();

  const {
    edgePath,
    edgeCenterX,
    edgeCenterY,
    invisibleEdgePath,
    invisibleEdgePath1,
  } = getEdgePathData(source, target, offset, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const showDqTracing = useMemo(() => {
    return (
      (activeLayer.includes(LineageLayer.DataObservability) &&
        dataQualityLineage?.edges?.some(
          (dqEdge) => dqEdge?.docId === edge?.docId
        )) ??
      false
    );
  }, [activeLayer, dataQualityLineage, edge]);

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
      ...{
        stroke,
        opacity,
      },
    };
  }, [
    style,
    tracedNodes,
    edge,
    isColumnHighlighted,
    isColumnLineage,
    tracedColumns,
    showDqTracing,
  ]);

  const isPipelineEdgeAllowed = (
    sourceType: EntityType,
    targetType: EntityType
  ) => {
    return (
      sourceType !== EntityType.PIPELINE && targetType !== EntityType.PIPELINE
    );
  };

  const isColumnLineageAllowed =
    !isColumnLineage && isPipelineEdgeAllowed(fromEntity.type, toEntity.type);

  const hasLabel = useMemo(() => {
    if (isColumnLineage) {
      return false;
    }
    if (pipeline) {
      return getEntityName(pipeline);
    }

    return false;
  }, [isColumnLineage, pipeline]);

  const isSelectedEditMode = selected && isEditMode;
  const isSelected = selected;

  const getInvisiblePath = (path: string) => {
    return (
      <path
        className="react-flow__edge-path"
        d={path}
        data-testid="react-flow-edge-path"
        id={id}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: '6px', opacity: 0 }}
      />
    );
  };

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
  }, [pipeline, activeLayer]);

  const blinkingClass = useMemo(() => {
    if (isPipelineRootNode && currentPipelineStatus) {
      return `blinking-${currentPipelineStatus}-border`;
    } else if (isPipelineRootNode) {
      return 'blinking-border';
    } else {
      return '';
    }
  }, [currentPipelineStatus, isPipelineRootNode]);

  const getLineageEdgeIcon = useCallback(
    (icon: React.ReactNode, dataTestId: string, pipelineClass?: string) => {
      const pipelineData = pipeline?.pipelineStatus;

      return (
        <LineageEdgeIcon offset={3} x={edgeCenterX} y={edgeCenterY}>
          {isEditMode ? (
            <Button
              className={classNames(
                'flex-center custom-edge-pipeline-button',
                pipelineClass,
                blinkingClass
              )}
              data-testid={dataTestId}
              icon={icon}
              onClick={() => isEditMode && onAddPipelineClick()}
            />
          ) : (
            <EntityPopOverCard
              entityFQN={pipeline?.fullyQualifiedName}
              entityType={pipelineEntityType}
              extraInfo={
                pipelineData && (
                  <Tag className={pipelineClass}>
                    {pipelineData?.executionStatus}
                  </Tag>
                )
              }>
              <Button
                className={classNames(
                  'flex-center custom-edge-pipeline-button',
                  pipelineClass,
                  blinkingClass
                )}
                data-testid={dataTestId}
                icon={icon}
                onClick={() => isEditMode && onAddPipelineClick()}
              />
            </EntityPopOverCard>
          )}
        </LineageEdgeIcon>
      );
    },
    [
      edgeCenterX,
      edgeCenterY,
      rest,
      pipeline,
      blinkingClass,
      isEditMode,
      isPipelineRootNode,
    ]
  );

  const getEditLineageIcon = useCallback(
    (
      dataTestId: string,
      onClick:
        | ((
            event: React.MouseEvent<HTMLElement, MouseEvent>,
            data: CustomEdgeData
          ) => void)
        | undefined,
      isPipeline?: boolean
    ) => {
      return (
        <LineageEdgeIcon offset={offset} x={edgeCenterX} y={edgeCenterY}>
          <Button
            className="cursor-pointer d-flex"
            data-testid={dataTestId}
            icon={
              <Icon
                alt="times-circle"
                className="align-middle"
                component={isPipeline ? IconEditCircle : IconTimesCircle}
                style={{ fontSize: '16px' }}
              />
            }
            type="link"
            onClick={(event) => onClick?.(event, rest as CustomEdgeData)}
          />
        </LineageEdgeIcon>
      );
    },
    [offset, edgeCenterX, edgeCenterY, rest, data]
  );

  const dataTestId = useMemo(() => {
    if (!isColumnLineage) {
      return `edge-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`;
    } else {
      return `column-edge-${sourceHandle}-${targetHandle}`;
    }
  }, [edge, isColumnLineage, sourceHandle, targetHandle]);

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
      {getInvisiblePath(invisibleEdgePath)}
      {getInvisiblePath(invisibleEdgePath1)}

      {isColumnLineageAllowed &&
        hasLabel &&
        getLineageEdgeIcon(
          <PipelineIcon />,
          `pipeline-label-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`,
          currentPipelineStatus
        )}
      {isColumnLineageAllowed &&
        isSelectedEditMode &&
        getEditLineageIcon('add-pipeline', onAddPipelineClick, true)}
      {!isColumnLineageAllowed &&
        isSelectedEditMode &&
        isSelected &&
        getEditLineageIcon('delete-button', onColumnEdgeRemove)}
      {!isColumnLineageAllowed &&
        data.columnFunctionValue &&
        data.isExpanded &&
        getLineageEdgeIcon(
          <FunctionIcon />,
          `function-icon-${edge.fromEntity.fullyQualifiedName}-${edge.toEntity.fullyQualifiedName}`
        )}
    </Fragment>
  );
};
