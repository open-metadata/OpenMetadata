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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { capitalize, startCase } from 'lodash';
import React, { useState } from 'react';
import {
  BaseEdge,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  ReactFlowState,
  useStore,
} from 'reactflow';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';

const PARALLEL_LABEL_GAP = 44;

const getSameDirectionEdges = (
  edges: Edge[],
  source: string,
  target: string
): Edge[] =>
  edges.filter((edge) => edge.source === source && edge.target === target);

const getCleanStraightPath = (
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position
) => {
  const adjustedSourceX =
    sourcePosition === Position.Right ? sourceX + 10 : sourceX - 10;
  const adjustedTargetX =
    targetPosition === Position.Left ? targetX - 10 : targetX + 10;

  if (Math.abs(sourceY - targetY) < 10) {
    const path = `M ${adjustedSourceX} ${sourceY} L ${adjustedTargetX} ${targetY}`;
    const labelX = adjustedSourceX + (adjustedTargetX - adjustedSourceX) / 2;
    const labelY = sourceY;

    return [path, labelX, labelY] as const;
  }

  const midX = adjustedSourceX + (adjustedTargetX - adjustedSourceX) / 2;
  const radius = 8;

  const corner1X = midX - radius;
  const corner2X = midX + radius;

  const direction = targetY > sourceY ? 1 : -1;
  const startCurveY = sourceY + direction * radius;
  const endCurveY = targetY - direction * radius;

  const path = [
    `M ${adjustedSourceX} ${sourceY}`,
    `L ${corner1X} ${sourceY}`,
    `Q ${midX} ${sourceY} ${midX} ${startCurveY}`,
    `L ${midX} ${endCurveY}`,
    `Q ${midX} ${targetY} ${corner2X} ${targetY}`,
    `L ${adjustedTargetX} ${targetY}`,
  ].join(' ');

  const labelX = midX;
  const labelY = sourceY + (targetY - sourceY) / 2;

  return [path, labelX, labelY] as const;
};

const formatEdgeLabel = (label: string): string =>
  startCase(label).split(' ').map(capitalize).join(' ');

export const StraightEdge = (props: EdgeProps) => {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    label,
    markerEnd,
    style,
    labelStyle,
    labelBgStyle,
  } = props;

  const [isHovered, setIsHovered] = useState(false);

  const { allowStructuralGraphEdits } = useWorkflowModeContext();
  const onEdgeDelete = props.data?.onEdgeDelete as
    | ((edgeId: string) => void)
    | undefined;
  const showDeleteButton =
    isHovered && allowStructuralGraphEdits && !!onEdgeDelete;

  const parallelCount = useStore(
    (state: ReactFlowState) =>
      getSameDirectionEdges(state.edges, source, target).length
  );
  const parallelIndex = useStore((state: ReactFlowState) => {
    const siblings = getSameDirectionEdges(state.edges, source, target);
    const index = siblings.findIndex((edge) => edge.id === id);

    return index === -1 ? 0 : index;
  });

  const isHorizontalEdge = Math.abs(sourceY - targetY) < 10;

  const [path, labelX, labelY] = getCleanStraightPath(
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  );

  const labelOffsetY =
    parallelCount > 1
      ? (parallelIndex - (parallelCount - 1) / 2) * PARALLEL_LABEL_GAP
      : 0;
  const stackedLabelY = labelY + labelOffsetY;

  const displayLabel =
    typeof label === 'string' && label.length > 0
      ? formatEdgeLabel(label)
      : label;
  const hasStyleOverrides = !!(labelBgStyle?.fill || labelStyle?.color);
  const labelClassName = classNames(
    'tw:flex tw:items-center tw:rounded tw:border tw:border-border-secondary tw:bg-primary tw:px-2 tw:py-1 tw:shadow-sm',
    { 'tw:cursor-pointer': hasStyleOverrides }
  );
  const labelStyleOverrides = hasStyleOverrides
    ? {
        backgroundColor: labelBgStyle?.fill,
        borderColor: labelBgStyle?.stroke,
        color: labelStyle?.color,
        ...labelStyle,
      }
    : undefined;

  return (
    <>
      <BaseEdge id={id} markerEnd={markerEnd} path={path} style={style} />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'all' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        {label && (
          <div
            className={labelClassName}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${stackedLabelY}px)`,
              pointerEvents: 'all',
              ...labelStyleOverrides,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <Typography size="text-xs" weight="semibold">
              {displayLabel}
            </Typography>
          </div>
        )}
        {showDeleteButton && (
          <div
            className="tw:absolute tw:pointer-events-auto"
            style={{
              transform: `translate(-50%, -50%) translate(${
                label && isHorizontalEdge ? labelX + 48 : labelX
              }px, ${
                label && !isHorizontalEdge ? stackedLabelY - 36 : stackedLabelY
              }px)`,
            }}>
            <Button
              className="tw:rounded-full tw:bg-primary tw:shadow-sm"
              color="tertiary-destructive"
              iconLeading={XClose}
              size="sm"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onEdgeDelete(id);
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
