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

import { Table, TableCard, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import { StatusType } from '../../../components/common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../components/common/StatusBadge/StatusBadgeV2.component';
import { getStatusMapping } from '../../../constants/WorkflowBuilder.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../../generated/governance/workflows/workflowInstance';
import { useFqn } from '../../../hooks/useFqn';
import { getWorkflowInstancesByFQN } from '../../../rest/workflowDefinitionsAPI';
import {
  convertMillisecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export const WorkflowExecutionHistory: React.FC = () => {
  const { t } = useTranslation();
  const { fqn: workflowFqn } = useFqn();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const statusMapping = useMemo(() => getStatusMapping(t), [t]);

  const getStatusInfo = useCallback(
    (status?: WorkflowStatus) => {
      if (status && status in statusMapping) {
        return statusMapping[status as keyof typeof statusMapping];
      }

      return {
        displayLabel: status ? capitalize(status) : 'Unknown',
        statusType: StatusType.Warning,
      };
    },
    [statusMapping]
  );

  const fetchExecutionHistory = useCallback(async () => {
    if (!workflowFqn) {
      return;
    }

    try {
      setLoading(true);
      const response = await getWorkflowInstancesByFQN(workflowFqn);
      setInstances(response.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [workflowFqn]);

  useEffect(() => {
    fetchExecutionHistory();
  }, [fetchExecutionHistory]);

  if (loading) {
    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <Loader />
      </div>
    );
  }

  if (!workflowFqn) {
    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <Typography as="p" className="tw:m-0 tw:text-secondary">
          {t('message.workflow-fqn-required')}
        </Typography>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
      </div>
    );
  }

  return (
    <TableCard.Root>
      <Table
        aria-label={t('label.execution-history')}
        data-testid="workflow-execution-history-table">
        <Table.Header>
          <Table.Row>
            <Table.Head
              isRowHeader
              id="executionDate"
              label={t('label.execution-date')}
            />
            <Table.Head id="status" label={t('label.status')} />
            <Table.Head id="duration" label={t('label.duration')} />
          </Table.Row>
        </Table.Header>
        <Table.Body
          data-testid="workflow-execution-history-table-body"
          items={instances}>
          {(instance) => {
            const { displayLabel, statusType } = getStatusInfo(instance.status);
            const duration =
              instance.startedAt && instance.endedAt
                ? instance.endedAt - instance.startedAt
                : undefined;

            return (
              <Table.Row id={instance.id ?? ''}>
                <Table.Cell>
                  {instance.startedAt
                    ? formatDateTime(instance.startedAt)
                    : '-'}
                </Table.Cell>
                <Table.Cell>
                  <StatusBadgeV2
                    dataTestId={`workflow-status-badge-${instance.id}`}
                    label={displayLabel}
                    showIcon={false}
                    status={statusType}
                  />
                </Table.Cell>
                <Table.Cell>
                  {duration
                    ? convertMillisecondsToHumanReadableFormat(duration)
                    : instance.startedAt && !instance.endedAt
                    ? t('label.running-ellipsis')
                    : '-'}
                </Table.Cell>
              </Table.Row>
            );
          }}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
};
