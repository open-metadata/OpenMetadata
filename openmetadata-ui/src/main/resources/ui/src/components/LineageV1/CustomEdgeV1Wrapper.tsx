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

import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from 'reactflow';
import { useLineageUI } from '../../context/LineageV1/hooks/useLineageUI';
import { useLineageActions } from '../../context/LineageV1/hooks/useLineageActions';
import '../Entity/EntityLineage/entity-lineage.style.less';

const CustomEdgeV1Wrapper = (props: EdgeProps) => {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    style,
  } = props;

  const { selectedEdge, isEditMode } = useLineageUI();
  const { onColumnEdgeRemove } = useLineageActions();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isSelected = selectedEdge?.id === props.id;

  return (
    <>
      <BaseEdge
        id={props.id}
        markerEnd={markerEnd}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: isSelected ? 3 : 1,
          stroke: isSelected ? '#1890ff' : style?.stroke,
        }}
      />
      {isEditMode && isSelected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan edge-button-wrapper"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}>
            <button
              className="edge-remove-button"
              onClick={(e) => {
                e.stopPropagation();
                onColumnEdgeRemove();
              }}>
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(CustomEdgeV1Wrapper);