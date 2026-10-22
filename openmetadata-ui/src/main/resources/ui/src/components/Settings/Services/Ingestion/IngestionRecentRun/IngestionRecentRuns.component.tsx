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

import {
  Box,
  HoverCard,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
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
import { formatDateTimeLong } from '../../../../../utils/date-time/DateTimeUtils';
import IngestionRunDetailsModal from '../../../../Modals/IngestionRunDetailsModal/IngestionRunDetailsModal';
import {
  RECENT_RUN_DOT_CLASS,
  RECENT_RUN_DOT_FALLBACK_CLASS,
} from './IngestionRecentRuns.constants';
import { IngestionRecentRunsProps } from './IngestionRecentRuns.interface';

type TFunc = ReturnType<typeof useTranslation>['t'];

const getRunFieldValues = <T extends PipelineStatus | AppRunRecord>(
  run: T
) => ({
  pipelineState:
    (run as PipelineStatus)?.pipelineState ?? (run as AppRunRecord)?.status,
  runId: (run as PipelineStatus)?.runId ?? (run as AppRunRecord)?.appId,
  startDate:
    (run as PipelineStatus)?.startDate ?? (run as AppRunRecord)?.startTime,
  endDate: (run as PipelineStatus)?.endDate ?? (run as AppRunRecord)?.endTime,
});

const getRunTooltipContent = (
  timestamp: number | undefined,
  startDate: number | undefined,
  endDate: number | undefined,
  t: TFunc
): JSX.Element => (
  <div className="text-left">
    {timestamp && (
      <p>
        {`${t('label.execution-date')}:`} {formatDateTimeLong(timestamp)}
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
);

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
        const response = await getRunHistoryForPipeline(
          ingestionPipeline?.fullyQualifiedName ?? '',
          { limit: 5 }
        );

        const runs =
          response.data
            .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
            .slice(-5) ?? [];

        setRecentRunStatus(
          (runs.length === 0 && ingestionPipeline?.pipelineStatuses?.length
            ? ingestionPipeline.pipelineStatuses
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
      setRecentRunStatus(
        appRuns
          ?.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
          .slice(-5) ?? []
      );
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
    return <Skeleton height={24} variant="rounded" width={120} />;
  }

  return (
    <Box
      inline
      align="center"
      className={classNamesFunc('tw:gap-1', classNames)}>
      {isEmpty(recentRunStatus) ? (
        <Typography data-testid="pipeline-status">
          {NO_DATA_PLACEHOLDER}
        </Typography>
      ) : (
        recentRunStatus.map((r, i) => {
          const { pipelineState, runId, startDate, endDate } =
            getRunFieldValues(r);

          const isLatest = i === recentRunStatus.length - 1;
          const label = upperFirst(pipelineState);
          const status = (
            <button
              aria-label={label}
              className={classNamesFunc(
                'tw:size-[13px] tw:shrink-0 tw:cursor-pointer tw:rounded tw:border-0 tw:p-0',
                RECENT_RUN_DOT_CLASS[pipelineState ?? ''] ??
                  RECENT_RUN_DOT_FALLBACK_CLASS,
                { 'tw:opacity-[0.55]': !isLatest }
              )}
              data-run-status={pipelineState}
              data-testid="pipeline-status"
              key={`${runId}-status`}
              type="button"
              onClick={() => handleRunStatusClick(r)}>
              {/* The latest run's state stays in the text for readers of the row. */}
              {isLatest && <span className="tw:sr-only">{label}</span>}
            </button>
          );

          const showTooltip =
            isNumber(endDate) || isNumber(startDate) || isNumber(r?.timestamp);

          return showTooltip ? (
            <HoverCard
              content={getRunTooltipContent(r.timestamp, startDate, endDate, t)}
              key={`${runId}-timestamp`}>
              {status}
            </HoverCard>
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
    </Box>
  );
};
