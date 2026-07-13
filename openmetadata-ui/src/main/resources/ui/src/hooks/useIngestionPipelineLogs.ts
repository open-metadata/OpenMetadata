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

import { AxiosError } from 'axios';
import { isNil, isUndefined, toNumber } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLogTaskFieldForType } from '../components/ServiceAgents/utils/agentsDataMapper';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { TabSpecificField } from '../enums/entity.enum';
import { App } from '../generated/entity/applications/app';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
} from '../rest/ingestionPipelineAPI';
import { getEpochMillisForPastDays } from '../utils/date-time/DateTimeUtils';
import { getEntityName } from '../utils/EntityNameUtils';
import {
  downloadAppLogs,
  downloadIngestionLog,
} from '../utils/IngestionLogs/LogsUtils';
import { showErrorToast } from '../utils/ToastUtils';
import { useDownloadProgressStore } from './useDownloadProgressStore';

export interface UseIngestionPipelineLogsParams {
  logEntityType: string;
  fqn: string;
  runId?: string;
}

export interface UseIngestionPipelineLogsResult {
  logs: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalLines: number;
  title: string;
  downloading: boolean;
  loadMore: () => void;
  download: () => void;
}

export const useIngestionPipelineLogs = ({
  logEntityType,
  fqn,
  runId,
}: UseIngestionPipelineLogsParams): UseIngestionPipelineLogsResult => {
  const { progress, reset, updateProgress } = useDownloadProgressStore();
  const [logs, setLogs] = useState<string>('');
  const [ingestionDetails, setIngestionDetails] = useState<IngestionPipeline>();
  const [appData, setAppData] = useState<App>();
  const [paging, setPaging] = useState<Paging>();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const isApplicationType = useMemo(
    () => logEntityType === GlobalSettingOptions.APPLICATIONS,
    [logEntityType]
  );

  const fetchLogs = useCallback(
    async (ingestion?: IngestionPipeline) => {
      setLoadingMore(true);
      try {
        if (isApplicationType) {
          const currentTime = Date.now();
          const oneDayAgo = getEpochMillisForPastDays(1);
          await getExternalApplicationRuns(fqn, {
            startTs: oneDayAgo,
            endTs: currentTime,
          });
          const appLogs = await getLatestApplicationRuns(fqn, runId);
          setLogs(appLogs.data_insight_task || appLogs.application_task);

          return;
        }

        const pipeline = ingestion ?? ingestionDetails;
        const response = await getIngestionPipelineLogById(
          pipeline?.id ?? '',
          paging?.total === paging?.after ? '' : paging?.after
        );

        setPaging({
          after: response.data.after,
          total: toNumber(response.data.total),
        });

        if (pipeline?.pipelineType) {
          const chunk = getLogTaskFieldForType(
            response.data,
            pipeline.pipelineType
          );
          setLogs((previous) => previous.concat(chunk));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoadingMore(false);
      }
    },
    [isApplicationType, fqn, runId, ingestionDetails, paging]
  );

  const fetchIngestionDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getIngestionPipelineByFqn(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINE_STATUSES],
      });
      setIngestionDetails(response);
      await fetchLogs(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [fqn, fetchLogs]);

  const fetchAppDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApplicationByName(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      });
      setAppData(data);
      await fetchLogs();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [fqn, fetchLogs]);

  const loadMore = useCallback(() => {
    fetchLogs(ingestionDetails);
  }, [fetchLogs, ingestionDetails]);

  const download = useCallback(async () => {
    try {
      reset();
      updateProgress(1);
      if (isApplicationType) {
        const appLogs = await downloadAppLogs(fqn, runId);
        const element = document.createElement('a');
        const file = new Blob([appLogs || ''], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `${fqn}.log`;
        document.body.appendChild(element);
        element.click();
        element.remove();

        return;
      }

      const logsBlob = await downloadIngestionLog(ingestionDetails?.id);
      const element = document.createElement('a');
      element.href = URL.createObjectURL(logsBlob as Blob);
      element.download = `${getEntityName(ingestionDetails)}-${
        ingestionDetails?.pipelineType
      }.log`;
      document.body.appendChild(element);
      element.click();
      element.remove();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      reset();
    }
  }, [isApplicationType, fqn, runId, ingestionDetails, reset, updateProgress]);

  useEffect(() => {
    if (!fqn) {
      return;
    }
    setLogs('');
    setPaging(undefined);
    if (isApplicationType) {
      fetchAppDetails();
    } else {
      fetchIngestionDetails();
    }
  }, [fqn, runId, isApplicationType]);

  const hasMore = useMemo(
    () =>
      !isApplicationType &&
      !isNil(paging) &&
      !isUndefined(paging.after) &&
      toNumber(paging.after) < toNumber(paging.total),
    [isApplicationType, paging]
  );

  const title = useMemo(
    () => getEntityName(ingestionDetails) || getEntityName(appData),
    [ingestionDetails, appData]
  );

  const totalLines = useMemo(
    () => (logs ? logs.split('\n').length : 0),
    [logs]
  );

  return {
    logs,
    loading,
    loadingMore,
    hasMore,
    totalLines,
    title,
    downloading: Boolean(progress),
    loadMore,
    download,
  };
};
