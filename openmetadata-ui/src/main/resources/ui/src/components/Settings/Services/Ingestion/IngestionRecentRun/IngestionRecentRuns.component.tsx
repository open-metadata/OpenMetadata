/*
 *  Copyright 2022 Collate.
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

import { Popover, Skeleton, Space, Tag, Typography } from 'antd';
import classNamesFunc from 'classnames';
import { isEmpty, isNumber, isUndefined, upperFirst } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { App } from '../../../../../generated/entity/applications/app';
import { AppRunRecord } from '../../../../../generated/entity/applications/appRunRecord';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getRunHistoryForPipeline } from '../../../../../rest/ingestionPipelineAPI';
import {
  formatDateTimeLong,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../../utils/date-time/DateTimeUtils';
import IngestionRunDetailsModal from '../../../../Modals/IngestionRunDetailsModal/IngestionRunDetailsModal';
import './ingestion-recent-run.style.less';
import { IngestionRecentRunsProps } from './IngestionRecentRuns.interface';

export const IngestionRecentRuns = <
  T extends PipelineStatus | AppRunRecord,
  U extends IngestionPipeline | App
>({
  ingestion,
  classNames,
  appRuns,
  fetchStatus = true,
  pipelineIdToFetchStatus = '',
  handlePipelineIdToFetchStatus,
  isAppRunsLoading = false,
}: Readonly<IngestionRecentRunsProps<T, U>>) => {
  const { t } = useTranslation();
  const [recentRunStatus, setRecentRunStatus] = useState<T[]>([]);
  const [loading, setLoading] = useState(fetchStatus);
  const [selectedStatus, setSelectedStatus] = useState<T>();

  const fetchPipelineStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (!isUndefined(ingestion?.fullyQualifiedName)) {
        const ingestionPipeline = ingestion as IngestionPipeline;

        const queryParams = {
          startTs: getEpochMillisForPastDays(1),
          endTs: getCurrentMillis(),
        };
        const response = await getRunHistoryForPipeline(
          ingestionPipeline?.fullyQualifiedName ?? '',
          queryParams
        );

        const runs = response.data.splice(0, 5).reverse() ?? [];

        setRecentRunStatus(
          (runs.length === 0 && ingestionPipeline?.pipelineStatuses
            ? [ingestionPipeline.pipelineStatuses]
            : runs) as T[]
        );
      }
    } finally {
      setLoading(false);
    }
  }, [ingestion, ingestion?.fullyQualifiedName, appRuns]);

  useEffect(() => {
    if (fetchStatus) {
      fetchPipelineStatus();
    }
  }, [ingestion, ingestion?.fullyQualifiedName]);

  useEffect(() => {
    if (!isEmpty(appRuns)) {
      setRecentRunStatus(appRuns?.splice(0, 5).reverse() ?? []);
    }
  }, [appRuns]);

  useEffect(() => {
    // To fetch pipeline status on demand
    // If pipelineIdToFetchStatus is present and equal to current pipeline id
    if (pipelineIdToFetchStatus === ingestion?.id) {
      fetchPipelineStatus();
      handlePipelineIdToFetchStatus?.(); // Clear the id after fetching status
    }
  }, [pipelineIdToFetchStatus]);

  const handleRunStatusClick = (status: T) => {
    setSelectedStatus(status);
  };

  const handleModalCancel = () => setSelectedStatus(undefined);

  if (isAppRunsLoading || loading) {
    return <Skeleton.Input active size="small" />;
  }

  return (
    <Space className={classNames} size={5}>
      {isEmpty(recentRunStatus) ? (
        <Typography.Text data-testid="pipeline-status">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      ) : (
        recentRunStatus.map((r, i) => {
          const pipelineState =
            (r as PipelineStatus)?.pipelineState ?? (r as AppRunRecord)?.status;
          const runId =
            (r as PipelineStatus)?.runId ?? (r as AppRunRecord)?.appId;
          const startDate =
            (r as PipelineStatus)?.startDate ?? (r as AppRunRecord)?.startTime;
          const endDate =
            (r as PipelineStatus)?.endDate ?? (r as AppRunRecord)?.endTime;

          const status = (
            <Tag
              className={classNamesFunc(
                'ingestion-run-badge',
                pipelineState ?? '',
                {
                  latest: i === recentRunStatus.length - 1,
                }
              )}
              data-testid="pipeline-status"
              key={`${runId}-status`}
              onClick={() => handleRunStatusClick(r)}>
              {i === recentRunStatus.length - 1
                ? upperFirst(pipelineState)
                : ''}
            </Tag>
          );

          const showTooltip =
            isNumber(endDate) || isNumber(startDate) || isNumber(r?.timestamp);

          return showTooltip ? (
            <Popover
              content={
                <div className="text-left">
                  {r.timestamp && (
                    <p>
                      {`${t('label.execution-date')}:`}{' '}
                      {formatDateTimeLong(r.timestamp)}
                    </p>
                  )}
                  {startDate && (
                    <p>
                      {t('label.start-entity', { entity: t('label.date') })}:{' '}
                      {formatDateTimeLong(startDate)}
                    </p>
                  )}
                  {endDate && (
                    <p>
                      {`${t('label.end-date')}:`} {formatDateTimeLong(endDate)}
                    </p>
                  )}
                </div>
              }
              key={`${runId}-timestamp`}>
              {status}
            </Popover>
          ) : (
            status
          );
        })
      )}

      {!isUndefined(selectedStatus) && (
        <IngestionRunDetailsModal
          handleCancel={handleModalCancel}
          pipelineStatus={selectedStatus}
        />
      )}
    </Space>
  );
};
