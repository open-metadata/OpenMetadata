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

import { Popover, Skeleton, Space, Tag } from 'antd';
import { PIPELINE_INGESTION_RUN_STATUS } from 'constants/pipeline.constants';
import { isEmpty, startCase } from 'lodash';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getRunHistoryForPipeline } from 'rest/ingestionPipelineAPI';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  getCurrentDateTimeMillis,
  getDateTimeFromMilliSeconds,
  getPastDaysDateTimeMillis,
} from '../../../utils/TimeUtils';
import './ingestion-recent-run.style.less';

interface Props {
  ingestion: IngestionPipeline;
  classNames?: string;
}
const queryParams = {
  startTs: getPastDaysDateTimeMillis(1),
  endTs: getCurrentDateTimeMillis(),
};

export const IngestionRecentRuns: FunctionComponent<Props> = ({
  ingestion,
  classNames,
}: Props) => {
  const { t } = useTranslation();
  const [recentRunStatus, setRecentRunStatus] = useState<PipelineStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipelineStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRunHistoryForPipeline(
        ingestion.fullyQualifiedName || '',
        queryParams
      );

      const runs = response.data.splice(0, 5).reverse() ?? [];

      setRecentRunStatus(
        runs.length === 0 && ingestion.pipelineStatuses
          ? [ingestion.pipelineStatuses]
          : runs
      );
    } finally {
      setLoading(false);
    }
  }, [ingestion, ingestion.fullyQualifiedName]);

  useEffect(() => {
    if (ingestion.fullyQualifiedName) {
      fetchPipelineStatus();
    }
  }, [ingestion, ingestion.fullyQualifiedName]);

  return (
    <Space className={classNames} size={2}>
      {loading ? (
        <Skeleton.Input size="small" />
      ) : isEmpty(recentRunStatus) ? (
        <p data-testid="pipeline-status">--</p>
      ) : (
        recentRunStatus.map((r, i) => {
          const status =
            i === recentRunStatus.length - 1 ? (
              <Tag
                className="ingestion-run-badge latest"
                color={
                  PIPELINE_INGESTION_RUN_STATUS[r?.pipelineState ?? 'success']
                }
                data-testid="pipeline-status"
                key={i}>
                {startCase(r?.pipelineState)}
              </Tag>
            ) : (
              <Tag
                className="ingestion-run-badge"
                color={
                  PIPELINE_INGESTION_RUN_STATUS[r?.pipelineState ?? 'success']
                }
                data-testid="pipeline-status"
                key={i}
              />
            );

          const showTooltip = r?.endDate || r?.startDate || r?.timestamp;

          return showTooltip ? (
            <Popover
              key={i}
              title={
                <div className="tw-text-left">
                  {r.timestamp && (
                    <p>
                      {`${t('label.execution-date')}:`}{' '}
                      {getDateTimeFromMilliSeconds(r.timestamp)}
                    </p>
                  )}
                  {r.startDate && (
                    <p>
                      {t('label.start-entity', { entity: t('label.date') })}:{' '}
                      {getDateTimeFromMilliSeconds(r.startDate)}
                    </p>
                  )}
                  {r.endDate && (
                    <p>
                      {`${t('label.end-date')}"`}{' '}
                      {getDateTimeFromMilliSeconds(r.endDate)}
                    </p>
                  )}
                </div>
              }>
              {status}
            </Popover>
          ) : (
            status
          );
        }) ?? '--'
      )}
    </Space>
  );
};
