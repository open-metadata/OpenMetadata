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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { Clock } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PLACEHOLDER_TASK_ID, ROUTES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import { getEntityTasksPath } from '../../../utils/TaskNavigationUtils';
import { INBOX_TASK_ID_PARAM } from '../../discovery/personal-space/personalSpace.constants';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import {
  STAGE_REQUESTED,
  STAGE_TRIGGER_CLASS,
} from './EntityStageBadge.constants';
import { StagePill } from './StagePill';

interface PendingRequestMenuProps {
  status: EntityStatus;
  requestedStage: EntityStatus;
  entityType?: string;
  fqn?: string;
  requestTaskId?: string;
  onWithdraw?: () => void | Promise<void>;
}

/** The pending request's badge: opens the request, or withdraws it once confirmed. */
export const PendingRequestMenu = ({
  status,
  requestedStage,
  entityType,
  fqn,
  requestTaskId,
  onWithdraw,
}: PendingRequestMenuProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // The request opens where the asset's other tasks are, already selected there.
  const getRequestTaskPath = (taskId: string) =>
    entityType && fqn
      ? `${getEntityTasksPath(
          entityType as EntityType,
          fqn
        )}?${INBOX_TASK_ID_PARAM}=${encodeURIComponent(taskId)}`
      : ROUTES.TASK_DETAIL.replace(PLACEHOLDER_TASK_ID, taskId);

  const confirmWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      await onWithdraw?.();
    } finally {
      setIsWithdrawing(false);
      setIsConfirmingWithdraw(false);
    }
  };

  return (
    <>
      <Dropdown.Root>
        <Button
          noTextPadding
          aria-label={t('label.view-entity', { entity: t('label.request') })}
          className={STAGE_TRIGGER_CLASS}
          color="tertiary"
          data-testid="lifecycle-request-trigger"
          size="sm">
          {/* The target stage's own colour, with a clock for "not there yet". */}
          <StagePill
            dataTestId="lifecycle-request-badge"
            icon={Clock}
            status={getEntityStatusClass(requestedStage)}>
            {STAGE_REQUESTED[requestedStage]
              ? t(STAGE_REQUESTED[requestedStage])
              : t('label.stage-requested', { stage: requestedStage })}
          </StagePill>
        </Button>
        <Dropdown.Popover placement="bottom start">
          <Dropdown.Menu data-testid="lifecycle-request-menu">
            {requestTaskId ? (
              <Dropdown.Item
                data-testid="view-lifecycle-request"
                id="view"
                label={t('label.view-entity', { entity: t('label.request') })}
                onAction={() => navigate(getRequestTaskPath(requestTaskId))}
              />
            ) : null}
            {onWithdraw ? (
              <Dropdown.Item
                data-testid="withdraw-lifecycle-request"
                id="withdraw"
                label={t('label.withdraw-request')}
                onAction={() => setIsConfirmingWithdraw(true)}
              />
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      {onWithdraw && (
        <ConfirmationModal
          isDestructive
          bodyText={t('message.withdraw-stage-request-confirm', {
            stage: requestedStage,
            current: status,
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.withdraw-request')}
          header={t('label.withdraw-request-question')}
          isLoading={isWithdrawing}
          visible={isConfirmingWithdraw}
          width={400}
          onCancel={() => setIsConfirmingWithdraw(false)}
          onConfirm={confirmWithdraw}
        />
      )}
    </>
  );
};
