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
import { noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLogTaskFieldForType } from '../components/ServiceAgents/utils/agentsDataMapper';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { TabSpecificField } from '../enums/entity.enum';
import { App } from '../generated/entity/applications/app';
import {
  IngestionPipeline,
  PipelineState,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Include } from '../generated/type/include';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
} from '../rest/ingestionPipelineAPI';
import { downloadBlob } from '../utils/ContextCenterPureUtils';
import { getEpochMillisForPastDays } from '../utils/date-time/DateTimeUtils';
import { getEntityName } from '../utils/EntityNameUtils';
import { downloadFile } from '../utils/Export/ExportUtils';
import {
  downloadAppLogs,
  downloadIngestionLog,
} from '../utils/IngestionLogs/LogsUtils';
import { isPipelineRunActive } from '../utils/logsPolling';
import { showErrorToast } from '../utils/ToastUtils';
import { useDownloadProgressStore } from './useDownloadProgressStore';
import { usePaginatedLiveLog } from './usePaginatedLiveLog';
import { usePollingEffect } from './usePollingEffect';

export interface UseEntityLogsParams {
  logEntityType: string;
  fqn: string;
  runId?: string;
}

export interface UseEntityLogsResult {
  logs: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalLines: number;
  title: string;
  downloading: boolean;
  // True while the underlying run is still active (running/queued) — drives the
  // modal's live indicator + tail polling.
  isLive: boolean;
  loadMore: () => void;
  download: () => void;
}

export const useEntityLogs = ({
  logEntityType,
  fqn,
  runId,
}: UseEntityLogsParams): UseEntityLogsResult => {
  const { progress, reset, updateProgress } = useDownloadProgressStore();
  const [ingestionDetails, setIngestionDetails] = useState<IngestionPipeline>();
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [appData, setAppData] = useState<App>();
  const [appLogs, setAppLogs] = useState<string>('');
  const [appLoading, setAppLoading] = useState<boolean>(false);
  const [appRunState, setAppRunState] = useState<PipelineState>();

  const isApplicationType = useMemo(
    () => logEntityType === GlobalSettingOptions.APPLICATIONS,
    [logEntityType]
  );

  const isLive = useMemo(() => {
    const state = isApplicationType
      ? appRunState
      : ingestionDetails?.pipelineStatuses?.[0]?.pipelineState;

    return isPipelineRunActive(state);
  }, [isApplicationType, appRunState, ingestionDetails]);

  // --- Ingestion logs: paginated (infinite scroll) + tail polling ---
  const ingestionId = ingestionDetails?.id ?? '';
  const ingestionType = ingestionDetails?.pipelineType;

  const fetchIngestionPage = useCallback(
    (cursor?: string) =>
      getIngestionPipelineLogById(ingestionId, cursor).then((res) => ({
        content: ingestionType
          ? getLogTaskFieldForType(res.data, ingestionType)
          : '',
        after: res.data.after,
        total: res.data.total,
      })),
    [ingestionId, ingestionType]
  );

  const paginated = usePaginatedLiveLog({
    fetchPage: fetchIngestionPage,
    resetKey: ingestionId,
    enabled: !isApplicationType && Boolean(ingestionId),
    isLive: !isApplicationType && isLive,
  });

  // Ingestion logs don't carry run status, so poll it separately to stop.
  const refreshIngestionStatus = useCallback(async () => {
    try {
      const res = await getIngestionPipelineByFqn(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINE_STATUSES],
      });
      setIngestionDetails(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fqn]);

  usePollingEffect(refreshIngestionStatus, {
    enabled: !isApplicationType && isLive,
  });

  // --- Application logs: one-shot snapshot (replace) ---
  const fetchAppLogs = useCallback(async () => {
    try {
      const currentTime = Date.now();
      const oneDayAgo = getEpochMillisForPastDays(1);
      await getExternalApplicationRuns(fqn, {
        startTs: oneDayAgo,
        endTs: currentTime,
      });
      const latest = await getLatestApplicationRuns(fqn, runId);
      setAppLogs(latest.data_insight_task || latest.application_task || '');
      setAppRunState(latest.pipelineStatus?.pipelineState);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fqn, runId]);

  usePollingEffect(fetchAppLogs, { enabled: isApplicationType && isLive });

  useEffect(() => {
    if (!fqn) {
      return;
    }
    if (isApplicationType) {
      setAppLoading(true);
      setAppLogs('');
      getApplicationByName(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      })
        .then((data) => {
          setAppData(data);

          return fetchAppLogs();
        })
        .catch((error) => showErrorToast(error as AxiosError))
        .finally(() => setAppLoading(false));
    } else {
      setDetailsLoading(true);
      getIngestionPipelineByFqn(fqn, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINE_STATUSES],
      })
        .then((res) => setIngestionDetails(res))
        .catch((error) => showErrorToast(error as AxiosError))
        .finally(() => setDetailsLoading(false));
    }
  }, [fqn, runId, isApplicationType, fetchAppLogs]);

  const download = useCallback(async () => {
    try {
      reset();
      updateProgress(1);
      if (isApplicationType) {
        const logs = await downloadAppLogs(fqn, runId);
        downloadFile(logs, `${fqn}.log`);

        return;
      }

      const blob = await downloadIngestionLog(ingestionDetails?.id);
      if (blob) {
        downloadBlob(
          blob as Blob,
          `${getEntityName(ingestionDetails)}-${
            ingestionDetails?.pipelineType
          }.log`
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      reset();
    }
  }, [isApplicationType, fqn, runId, ingestionDetails, reset, updateProgress]);

  const title = useMemo(
    () => getEntityName(ingestionDetails) || getEntityName(appData),
    [ingestionDetails, appData]
  );

  const logs = isApplicationType ? appLogs : paginated.logs;
  const totalLines = useMemo(
    () => (logs ? logs.split('\n').length : 0),
    [logs]
  );

  return {
    logs,
    loading: isApplicationType
      ? appLoading
      : detailsLoading || paginated.loading,
    loadingMore: isApplicationType ? false : paginated.loadingMore,
    hasMore: isApplicationType ? false : paginated.hasMore,
    totalLines,
    title,
    downloading: Boolean(progress),
    isLive,
    loadMore: isApplicationType ? noop : paginated.loadMore,
    download,
  };
};
