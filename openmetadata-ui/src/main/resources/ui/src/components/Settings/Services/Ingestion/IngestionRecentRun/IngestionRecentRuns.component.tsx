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
import { isEmpty, isUndefined, upperFirst } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { PipelineStatus } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getRunHistoryForPipeline } from '../../../../../rest/ingestionPipelineAPI';
import {
  formatDateTimeLong,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../../utils/date-time/DateTimeUtils';
import IngestionRunDetailsModal from '../../../../Modals/IngestionRunDetailsModal/IngestionRunDetailsModal';
import './ingestion-recent-run.style.less';
import { IngestionRecentRunsProps } from './IngestionRecentRuns.interface';

const queryParams = {
  startTs: getEpochMillisForPastDays(1),
  endTs: getCurrentMillis(),
};

export const IngestionRecentRuns = ({
  ingestion,
  classNames,
  appRuns,
  fetchStatus = true,
  pipelineIdToFetchStatus = '',
  handlePipelineIdToFetchStatus,
  isAppRunsLoading = false,
}: Readonly<IngestionRecentRunsProps>) => {
  const { t } = useTranslation();
  const [recentRunStatus, setRecentRunStatus] = useState<PipelineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<PipelineStatus>();

  const fetchPipelineStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (fetchStatus && !isUndefined(ingestion?.fullyQualifiedName)) {
        const response = await getRunHistoryForPipeline(
          ingestion?.fullyQualifiedName ?? '',
          queryParams
        );

        const runs = response.data.splice(0, 5).reverse() ?? [];

        setRecentRunStatus(
          runs.length === 0 && ingestion?.pipelineStatuses
            ? [ingestion.pipelineStatuses]
            : runs
        );
      } else {
        setRecentRunStatus(appRuns?.splice(0, 5).reverse() ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [ingestion, ingestion?.fullyQualifiedName, appRuns]);

  useEffect(() => {
    fetchPipelineStatus();
  }, [ingestion, ingestion?.fullyQualifiedName, appRuns]);

  useEffect(() => {
    // To fetch pipeline status on demand
    // If pipelineIdToFetchStatus is present and equal to current pipeline id
    if (pipelineIdToFetchStatus === ingestion?.id) {
      fetchPipelineStatus();
      handlePipelineIdToFetchStatus?.(); // Clear the id after fetching status
    }
  }, [pipelineIdToFetchStatus]);

  const handleRunStatusClick = (status: PipelineStatus) => {
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
          const status = (
            <Tag
              className={classNamesFunc(
                'ingestion-run-badge',
                r?.pipelineState ?? '',
                {
                  latest: i === recentRunStatus.length - 1,
                }
              )}
              data-testid="pipeline-status"
              key={`${r.runId}-status`}
              onClick={() => handleRunStatusClick(r)}>
              {i === recentRunStatus.length - 1
                ? upperFirst(r?.pipelineState)
                : ''}
            </Tag>
          );

          const showTooltip = r?.endDate ?? r?.startDate ?? r?.timestamp;

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
                  {r.startDate && (
                    <p>
                      {t('label.start-entity', { entity: t('label.date') })}:{' '}
                      {formatDateTimeLong(r.startDate)}
                    </p>
                  )}
                  {r.endDate && (
                    <p>
                      {`${t('label.end-date')}:`}{' '}
                      {formatDateTimeLong(r.endDate)}
                    </p>
                  )}
                </div>
              }
              key={`${r.runId}-timestamp`}>
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
