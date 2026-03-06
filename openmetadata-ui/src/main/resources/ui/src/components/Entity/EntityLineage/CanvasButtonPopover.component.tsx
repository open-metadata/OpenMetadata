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
import { Tag } from 'antd';
import React, { MutableRefObject, useCallback } from 'react';
import { Edge, Viewport } from 'reactflow';
import { CanvasButton } from '../../../utils/CanvasButtonUtils';
import { getPipelineStatusClass } from '../../../utils/PipelineStatusUtils';
import { getAbsolutePosition } from '../../../utils/ViewportUtils';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';

export interface CanvasButtonPopoverProps {
  hoveredButton: CanvasButton;
  hoveredEdge: Edge;
  viewport: Viewport;
  isOverPopoverRef: MutableRefObject<boolean>;
  hoverTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  onMouseLeave: () => void;
}

export const CanvasButtonPopover: React.FC<CanvasButtonPopoverProps> = ({
  hoveredButton,
  hoveredEdge,
  viewport,
  isOverPopoverRef,
  hoverTimeoutRef,
  onMouseLeave,
}) => {
  const position = getAbsolutePosition(
    hoveredButton.x - hoveredButton.width / 2,
    hoveredButton.y - hoveredButton.height / 2,
    viewport
  );

  const handleMouseEnter = useCallback(() => {
    isOverPopoverRef.current = true;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const pipelineData = hoveredEdge.data?.edge?.pipeline;
  const pipelineStatus = pipelineData?.pipelineStatus;

  return (
    <button
      key={`popover-${hoveredButton.edgeId}`}
      style={{
        ...position,
        pointerEvents: 'all',
        zIndex: 1000,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <EntityPopOverCard
        defaultOpen
        entityFQN={pipelineData?.fullyQualifiedName ?? ''}
        entityType={hoveredEdge.data?.edge?.pipelineEntityType ?? ''}
        extraInfo={
          pipelineStatus && (
            <Tag
              className={getPipelineStatusClass(pipelineStatus.executionStatus)}
            >
              {pipelineStatus.executionStatus}
            </Tag>
          )
        }
      >
        <div style={{ width: '36px', height: '36px' }} />
      </EntityPopOverCard>
    </button>
  );
};
