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
import { Badge, HoverCard } from '@openmetadata/ui-core-components';
import type { Viewport } from 'reactflow';
import { PIPELINE_STATUS_BADGE_COLOR } from '../../../constants/Lineage.constants';
import { CanvasPipelinePreview } from '../../../utils/CanvasButtonUtils';
import { getPipelineStatusClass } from '../../../utils/PipelineStatusUtils';
import { getAbsolutePosition } from '../../../utils/ViewportUtils';
import { PopoverContent } from '../../common/PopOverCard/EntityPopOverCard';

export interface CanvasButtonPopoverProps {
  isHovered: boolean;
  preview: CanvasPipelinePreview;
  viewport: Viewport;
  onCloseComplete: () => void;
}

export const CanvasButtonPopover = ({
  isHovered,
  preview,
  viewport,
  onCloseComplete,
}: CanvasButtonPopoverProps) => {
  const { button, entityFQN, entityType, executionStatus } = preview;
  const position = getAbsolutePosition(button.x, button.y, viewport);
  const triggerSize = {
    width: button.width * viewport.zoom,
    height: button.height * viewport.zoom,
  };
  const pipelineStatusClass = getPipelineStatusClass(executionStatus);

  return (
    <span
      className="tw:pointer-events-none tw:-translate-x-1/2 tw:-translate-y-1/2"
      style={position}>
      <HoverCard
        className="entity-popover-card"
        content={
          <PopoverContent
            entityFQN={entityFQN}
            entityType={entityType}
            extraInfo={
              executionStatus && (
                <Badge
                  color={PIPELINE_STATUS_BADGE_COLOR[pipelineStatusClass]}
                  data-testid="pipeline-status-badge"
                  size="sm"
                  type="pill-color">
                  {executionStatus}
                </Badge>
              )
            }
          />
        }
        isExternalTriggerHovered={isHovered}
        onCloseComplete={onCloseComplete}>
        <span aria-hidden className="tw:block" style={triggerSize} />
      </HoverCard>
    </span>
  );
};
