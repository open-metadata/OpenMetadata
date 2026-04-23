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

import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import { StatusType } from '../../../components/common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../components/common/StatusBadge/StatusBadgeV2.component';
import TableV2 from '../../../components/common/Table/TableV2';
import { PAGE_SIZE_BASE } from '../../../constants/constants';
import { getStatusMapping } from '../../../constants/WorkflowBuilder.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { CursorType } from '../../../enums/pagination.enum';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../../generated/governance/workflows/workflowInstance';
import { Paging } from '../../../generated/type/paging';
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
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(PAGE_SIZE_BASE);
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

  const columns = useMemo(
    () => [
      {
        title: t('label.execution-date'),
        dataIndex: 'startedAt',
        key: 'executionDate',
        render: (startedAt: number | undefined) => (
          <div className="tw:text-center">
            {startedAt ? formatDateTime(startedAt) : '-'}
          </div>
        ),
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        render: (
          status: WorkflowStatus | undefined,
          record: WorkflowInstance
        ) => {
          const { displayLabel, statusType } = getStatusInfo(status);

          return (
            <div className="tw:flex tw:justify-center">
              <StatusBadgeV2
                dataTestId={`workflow-status-badge-${record.id}`}
                label={displayLabel}
                showIcon={false}
                status={statusType}
              />
            </div>
          );
        },
      },
      {
        title: t('label.duration'),
        dataIndex: 'endedAt',
        key: 'duration',
        render: (_: unknown, record: WorkflowInstance) => {
          let value: string;
          if (record.startedAt && record.endedAt) {
            value = convertMillisecondsToHumanReadableFormat(
              record.endedAt - record.startedAt
            );
          } else if (record.startedAt && !record.endedAt) {
            value = t('label.running-ellipsis');
          } else {
            value = '-';
          }

          return <div className="tw:text-center">{value}</div>;
        },
      },
    ],
    [t, getStatusInfo]
  );

  const fetchExecutionHistory = useCallback(
    async (offsetCursor?: string) => {
      if (!workflowFqn) {
        return;
      }

      try {
        setLoading(true);
        const response = await getWorkflowInstancesByFQN(workflowFqn, {
          limit: pageSize,
          ...(offsetCursor ? { offset: offsetCursor } : {}),
        });
        setInstances(response.data ?? []);
        setPaging(response.paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setInstances([]);
      } finally {
        setLoading(false);
      }
    },
    [workflowFqn, pageSize]
  );

  const handlePageNavigation = useCallback(
    ({ currentPage: page, cursorType }: PagingHandlerParams) => {
      setCurrentPage(page);
      const cursor =
        cursorType === CursorType.BEFORE ? paging.before : paging.after;
      fetchExecutionHistory(cursor ?? undefined);
    },
    [paging, fetchExecutionHistory]
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchExecutionHistory();
  }, [workflowFqn, pageSize, fetchExecutionHistory]);

  if (!workflowFqn) {
    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
      </div>
    );
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:overflow-hidden"
      data-testid="workflow-execution-history">
      <div className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto">
        <TableV2
          columns={columns}
          data-testid="workflow-execution-history-table"
          dataSource={instances}
          loading={loading}
          locale={{
            emptyText: (
              <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
            ),
          }}
          pagination={false}
          rowKey={(record) => record.id ?? ''}
          size="small"
        />
      </div>
      {paging.total > pageSize && (
        <div className="tw:shrink-0">
          <NextPrevious
            currentPage={currentPage}
            isLoading={loading}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={handlePageNavigation}
          />
        </div>
      )}
    </div>
  );
};
