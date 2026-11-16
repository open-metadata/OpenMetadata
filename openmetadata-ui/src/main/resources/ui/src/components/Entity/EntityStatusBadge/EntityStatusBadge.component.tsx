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
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { EntityStageBadge } from './EntityStageBadge';
import { STAGE_REQUESTED } from './EntityStageBadge.constants';

export interface EntityStatusBadgeProps {
  status: EntityStatus;
  showDivider?: boolean;
  /** With {@link entityId} and {@link fqn}, hovering the badge shows who set the status. */
  entityType?: string;
  entityId?: string;
  fqn?: string;
  /** Stage a user asked the asset's lifecycle to move it to, shown until the lifecycle decides. */
  requestedStage?: EntityStatus;
  /** Stages the user can ask the asset's lifecycle for, offered from the stage badge. */
  requestStages?: EntityStatus[];
  onRequest?: (stage: EntityStatus) => void;
}

export const EntityStatusBadge = ({
  status,
  showDivider = true,
  entityType,
  entityId,
  fqn,
  requestedStage,
  requestStages = [],
  onRequest,
}: EntityStatusBadgeProps) => {
  const { t } = useTranslation();
  // An Unprocessed asset shows no stage badge unless its lifecycle takes a request from it.
  const showStage =
    status !== EntityStatus.Unprocessed || requestStages.length > 0;

  return showStage || requestedStage ? (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      {showDivider && <Divider className="m-x-xs h-6" orientation="vertical" />}
      {showStage && (
        <EntityStageBadge
          entityId={entityId}
          entityType={entityType}
          fqn={fqn}
          requestStages={requestStages}
          status={status}
          onRequest={onRequest}
        />
      )}
      {requestedStage && (
        <StatusBadge
          dataTestId="lifecycle-request-badge"
          label={
            STAGE_REQUESTED[requestedStage]
              ? t(STAGE_REQUESTED[requestedStage])
              : t('label.stage-requested', { stage: requestedStage })
          }
          status={StatusType.Pending}
        />
      )}
    </Box>
  ) : null;
};
