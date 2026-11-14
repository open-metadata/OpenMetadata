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
import { Box, Divider, Tooltip } from '@openmetadata/ui-core-components';
import { lazy } from 'react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

// The tooltip mounts these only while it is open, so the lookup and its chunk load on hover.
const EntityStatusDecisionTitle = withSuspenseFallback(
  lazy(() =>
    import('./EntityStatusDecision').then((module) => ({
      default: module.EntityStatusDecisionTitle,
    }))
  )
);
const EntityStatusDecisionDescription = withSuspenseFallback(
  lazy(() =>
    import('./EntityStatusDecision').then((module) => ({
      default: module.EntityStatusDecisionDescription,
    }))
  )
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
  const decision =
    entityType && entityId && fqn
      ? {
          entityType,
          entityId,
          entityLink: getEntityFeedLink(entityType, fqn),
          status,
        }
      : undefined;

  return (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      {showDivider && <Divider className="m-x-xs h-6" orientation="vertical" />}
      {decision ? (
        <Tooltip
          description={<EntityStatusDecisionDescription {...decision} />}
          placement="bottom start"
          title={<EntityStatusDecisionTitle {...decision} />}
          triggerClassName="tw:cursor-default tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2">
          <span data-testid="entity-status-badge-trigger">{badge}</span>
        </Tooltip>
      ) : (
        badge
      )}
    </Box>
  );
};
