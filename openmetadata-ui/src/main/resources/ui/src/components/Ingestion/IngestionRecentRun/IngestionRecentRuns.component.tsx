/*
 *  Copyright 2022 Collate
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

import { capitalize } from 'lodash';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getRunHistoryForPipeline } from '../../../axiosAPIs/ingestionPipelineAPI';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  getCurrentDateTimeStamp,
  getPastDatesTimeStampFromCurrentDate,
} from '../../../utils/TimeUtils';
import PopOver from '../../common/popover/PopOver';
import Loader from '../../Loader/Loader';

interface Props {
  ingestion: IngestionPipeline;
}
const queryParams = {
  startTs: getPastDatesTimeStampFromCurrentDate(1),
  endTs: getCurrentDateTimeStamp(),
};

export const IngestionRecentRuns: FunctionComponent<Props> = ({
  ingestion,
}: Props) => {
  const { t } = useTranslation();
  const [recentRunStatus, setRecentRunStatus] = useState<PipelineStatus[]>();
  const [loading, setLoading] = useState(false);

  const fetchPipelineStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRunHistoryForPipeline(
        ingestion.fullyQualifiedName || '',
        queryParams
      );

      const runs = [
        ingestion.pipelineStatuses as PipelineStatus,
        ...(response.data.splice(0, 4) ?? []),
      ];

      setRecentRunStatus(runs);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [ingestion.fullyQualifiedName]);

  useEffect(() => {
    if (ingestion.fullyQualifiedName) {
      fetchPipelineStatus();
    }
  }, [ingestion.fullyQualifiedName]);

  return loading ? (
    <Loader />
  ) : (
    <>
      {recentRunStatus?.map((r, i) => {
        const status =
          i === recentRunStatus.length - 1 ? (
            <p
              className={`tw-h-5 tw-w-16 tw-rounded-sm tw-bg-status-${r?.pipelineState} tw-mr-1 tw-px-1 tw-text-white tw-text-center`}
              data-testid="pipeline-status"
              key={i}>
              {capitalize(r?.pipelineState)}
            </p>
          ) : (
            <p
              className={`tw-w-4 tw-h-5 tw-rounded-sm tw-bg-status-${r?.pipelineState} tw-mr-1`}
              data-testid="pipeline-status"
              key={i}
            />
          );

        return r?.endDate || r?.startDate || r?.timestamp ? (
          <PopOver
            html={
              <div className="tw-text-left">
                {r.timestamp && (
                  <p>
                    {t('label.execution-date')} :{' '}
                    {new Date(r.timestamp).toUTCString()}
                  </p>
                )}
                {r.startDate && (
                  <p>
                    {t('label.start-date')}:{' '}
                    {new Date(r.startDate).toUTCString()}
                  </p>
                )}
                {r.endDate && (
                  <p>
                    {t('label.end-date')} : {new Date(r.endDate).toUTCString()}
                  </p>
                )}
              </div>
            }
            key={i}
            position="left"
            theme="light"
            trigger="mouseenter">
            {status}
          </PopOver>
        ) : (
          status
        );
      })}
    </>
  );
};
