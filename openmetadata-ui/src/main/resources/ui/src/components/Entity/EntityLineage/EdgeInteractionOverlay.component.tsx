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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button } from 'antd';
import React from 'react';
import { Edge, useReactFlow, useViewport } from 'reactflow';
import { ReactComponent as IconEditCircle } from '../../../assets/svg/ic-edit-circle.svg';
import { ReactComponent as IconTimesCircle } from '../../../assets/svg/ic-times-circle.svg';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { computePathDataForEdge } from '../../../utils/CanvasUtils';
import { getAbsolutePosition } from './PipelineEdgeButtons.component';

export interface EdgeInteractionOverlayProps {
  onPipelineClick?: () => void;
  onEdgeRemove?: () => void;
}

export const EdgeInteractionOverlay: React.FC<EdgeInteractionOverlayProps> = ({
  onPipelineClick,
  onEdgeRemove,
}) => {
  const { isEditMode, selectedEdge, columnsInCurrentPages, isRepositioning } =
    useLineageStore();
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  const renderEditButton = (edge: Edge) => {
    const { isColumnLineage } = edge.data || {};
    const pathData = computePathDataForEdge(
      edge,
      getNode(edge.source),
      getNode(edge.target),
      columnsInCurrentPages
    );

    if (isColumnLineage || !pathData) {
      return null;
    }

    return (
      <div
        key={`edit-${edge.id}`}
        style={getAbsolutePosition(
          pathData.edgeCenterX,
          pathData.edgeCenterY,
          viewport
        )}>
        <Button
          className="cursor-pointer d-flex"
          data-testid="add-pipeline"
          icon={
            <Icon
              alt="edit-circle"
              className="align-middle"
              component={IconEditCircle}
              style={{ fontSize: '16px' }}
            />
          }
          type="link"
          onClick={() => onPipelineClick?.()}
        />
      </div>
    );
  };

  const renderDeleteButton = (edge: Edge) => {
    const { isColumnLineage } = edge.data || {};
    const pathData = computePathDataForEdge(
      edge,
      getNode(edge.source),
      getNode(edge.target),
      columnsInCurrentPages
    );

    if (!isColumnLineage || !pathData) {
      return null;
    }

    return (
      <div
        key={`delete-${edge.id}`}
        style={getAbsolutePosition(
          pathData.edgeCenterX,
          pathData.edgeCenterY,
          viewport
        )}>
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
          onClick={() => onEdgeRemove?.()}
        />
      </div>
    );
  };

  if (isRepositioning) {
    return null;
  }

  return (
    <div className="edge-interaction-overlay">
      {selectedEdge && isEditMode && renderEditButton(selectedEdge)}
      {selectedEdge && isEditMode && renderDeleteButton(selectedEdge)}
    </div>
  );
};
