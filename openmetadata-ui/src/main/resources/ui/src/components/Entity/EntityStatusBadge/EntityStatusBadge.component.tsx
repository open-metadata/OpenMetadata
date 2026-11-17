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
import {
  Box,
  Button,
  Divider,
  Dropdown,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PLACEHOLDER_TASK_ID, ROUTES } from '../../../constants/constants';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { EntityStageBadge } from './EntityStageBadge';
import {
  STAGE_REQUESTED,
  STAGE_TRIGGER_CLASS,
} from './EntityStageBadge.constants';

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
  onRequest?: (stage: EntityStatus, reason: string) => Promise<boolean>;
  /** The pending request's task, opened from its badge. */
  requestTaskId?: string;
  /** Withdraws the pending request; offered to the user who raised it. */
  onWithdraw?: () => void;
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
  requestTaskId,
  onWithdraw,
}: EntityStatusBadgeProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        <Dropdown.Root>
          <Button
            noTextPadding
            aria-label={t('label.view-entity', { entity: t('label.request') })}
            className={STAGE_TRIGGER_CLASS}
            color="tertiary"
            data-testid="lifecycle-request-trigger"
            size="sm">
            <StatusBadge
              dataTestId="lifecycle-request-badge"
              label={
                STAGE_REQUESTED[requestedStage]
                  ? t(STAGE_REQUESTED[requestedStage])
                  : t('label.stage-requested', { stage: requestedStage })
              }
              status={StatusType.Pending}
            />
          </Button>
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu data-testid="lifecycle-request-menu">
              {requestTaskId ? (
                <Dropdown.Item
                  data-testid="view-lifecycle-request"
                  id="view"
                  label={t('label.view-entity', { entity: t('label.request') })}
                  onAction={() =>
                    navigate(
                      ROUTES.TASK_DETAIL.replace(
                        PLACEHOLDER_TASK_ID,
                        requestTaskId
                      )
                    )
                  }
                />
              ) : null}
              {onWithdraw ? (
                <Dropdown.Item
                  data-testid="withdraw-lifecycle-request"
                  id="withdraw"
                  label={t('label.withdraw-request')}
                  onAction={onWithdraw}
                />
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </Box>
  ) : null;
};
