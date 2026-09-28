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
import { Button } from '@openmetadata/ui-core-components';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge, useReactFlow, useViewport } from 'reactflow';
import { ReactComponent as IconEditCircle } from '../../../assets/svg/ic-edit-circle.svg';
import { ReactComponent as IconTimesCircle } from '../../../assets/svg/ic-times-circle.svg';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { computePathDataForEdge } from '../../../utils/CanvasUtils';
import { getAbsolutePosition } from '../../../utils/ViewportUtils';

export interface EdgeInteractionOverlayProps {
  onPipelineClick?: () => void;
  onEdgeRemove?: () => void;
}

export const EdgeInteractionOverlay: React.FC<EdgeInteractionOverlayProps> = ({
  onPipelineClick,
  onEdgeRemove,
}) => {
  const { t } = useTranslation();
  const { isEditMode, selectedEdge, columnsInCurrentPages, isRepositioning } =
    useLineageStore();
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  const pathData = useMemo(() => {
    if (!selectedEdge) {
      return null;
    }

    return computePathDataForEdge(
      selectedEdge,
      getNode(selectedEdge.source),
      getNode(selectedEdge.target),
      columnsInCurrentPages
    );
  }, [selectedEdge, getNode, columnsInCurrentPages]);

  const buttonPosition = useMemo(() => {
    if (!pathData) {
      return null;
    }

    return getAbsolutePosition(
      pathData.edgeCenterX,
      pathData.edgeCenterY,
      viewport
    );
  }, [pathData, viewport]);

  const renderEditButton = (edge: Edge) => {
    const { isColumnLineage } = edge.data || {};

    if (isColumnLineage || !buttonPosition) {
      return null;
    }

    return (
      <div key={`edit-${edge.id}`} style={buttonPosition}>
        <Button
          boxed
          aria-label={t('label.edit-entity', { entity: t('label.pipeline') })}
          color="link-color"
          data-testid="add-pipeline"
          iconLeading={
            <IconEditCircle
              className="tw:size-4! tw:shrink-0"
              data-icon="leading"
            />
          }
          size="md"
          onClick={() => onPipelineClick?.()}
        />
      </div>
    );
  };

  const renderDeleteButton = (edge: Edge) => {
    const { isColumnLineage } = edge.data || {};

    if (!isColumnLineage || !buttonPosition) {
      return null;
    }

    return (
      <div key={`delete-${edge.id}`} style={buttonPosition}>
        <Button
          boxed
          aria-label={t('label.delete')}
          color="link-color"
          data-testid="delete-button"
          iconLeading={
            <IconTimesCircle
              className="tw:size-4! tw:shrink-0"
              data-icon="leading"
            />
          }
          size="md"
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
