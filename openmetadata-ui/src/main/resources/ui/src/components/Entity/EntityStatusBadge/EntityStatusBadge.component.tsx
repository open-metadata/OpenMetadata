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
import { Box, Divider } from '@openmetadata/ui-core-components';
import { lazy } from 'react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import HoverPopover from '../../common/HoverPopover/HoverPopover';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

const EntityStatusDecision = withSuspenseFallback(
  lazy(() => import('./EntityStatusDecision'))
);

export interface EntityStatusBadgeProps {
  status: EntityStatus;
  showDivider?: boolean;
  /** With {@link entityId} and {@link fqn}, hovering the badge shows who set the status. */
  entityType?: string;
  entityId?: string;
  fqn?: string;
}

export const EntityStatusBadge = ({
  status,
  showDivider = true,
  entityType,
  entityId,
  fqn,
}: EntityStatusBadgeProps) => {
  // Do not show badge for 'Unprocessed' status
  if (status === EntityStatus.Unprocessed) {
    return null;
  }

  const badge = (
    <StatusBadge label={status} status={getEntityStatusClass(status)} />
  );

  return (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      {showDivider && <Divider className="m-x-xs h-6" orientation="vertical" />}
      {entityType && entityId && fqn ? (
        <HoverPopover
          contentClassName="tw:p-3"
          data-testid="entity-status-badge-trigger"
          placement="bottom start"
          trigger={badge}>
          <EntityStatusDecision
            entityId={entityId}
            entityLink={getEntityFeedLink(entityType, fqn)}
            entityType={entityType}
            status={status}
          />
        </HoverPopover>
      ) : (
        badge
      )}
    </Box>
  );
};
