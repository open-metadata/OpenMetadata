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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getIngestionPipelineByFqn } from '../rest/ingestionPipelineAPI';
import { downloadBlob } from '../utils/ContextCenterPureUtils';
import { getEpochMillisForPastDays } from '../utils/date-time/DateTimeUtils';
import { getEntityName } from '../utils/EntityNameUtils';
import { downloadFile } from '../utils/Export/ExportUtils';
import {
  downloadAppLogs,
  downloadIngestionLog,
} from '../utils/IngestionLogs/LogsUtils';
import { isPipelineRunActive } from '../utils/logsPolling';
import { StreamHealth } from '../utils/SseStreamUtils';
import { showErrorToast } from '../utils/ToastUtils';
import { useDownloadProgressStore } from './useDownloadProgressStore';
import { useIngestionLogSource } from './useIngestionLogSource';
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
  // modal's live indicator.
  isLive: boolean;
  // True while the log content is coming from the SSE tail rather than the
  // paginated REST endpoint.
  isStreaming: boolean;
  streamHealth: StreamHealth;
  // The stream could not replay the whole backlog; earlier history lives in the
  // paginated endpoint / download.
  streamTruncated: boolean;
  streamError: string | null;
  loadMore: () => void;
  download: () => void;
}

type IngestionLogSource = ReturnType<typeof useIngestionLogSource>;

const buildEntityLogsResult = ({
  isApplicationType,
  ingestion,
  appLoading,
  detailsLoading,
  logs,
  totalLines,
  title,
  progress,
  isLive,
  download,
}: {
  isApplicationType: boolean;
  ingestion: IngestionLogSource;
  appLoading: boolean;
  detailsLoading: boolean;
  logs: string;
  totalLines: number;
  title: string;
  progress?: number;
  isLive: boolean;
  download: () => void;
}): UseEntityLogsResult => ({
  logs,
  loading: isApplicationType ? appLoading : detailsLoading || ingestion.loading,
  loadingMore: isApplicationType ? false : ingestion.loadingMore,
  hasMore: isApplicationType ? false : ingestion.hasMore,
  totalLines,
  title,
  downloading: Boolean(progress),
  isLive,
  isStreaming: ingestion.isStreaming,
  streamHealth: ingestion.streamHealth,
  streamTruncated: ingestion.streamTruncated,
  streamError: ingestion.streamError,
  loadMore: isApplicationType ? noop : ingestion.loadMore,
  download,
});

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

  // Bumped whenever the app identity (fqn/runId) changes so a late-resolving
  // fetch from a previous run can't overwrite the current run's logs.
  const appRequestRef = useRef(0);

  const isApplicationType = useMemo(
    () => logEntityType === GlobalSettingOptions.APPLICATIONS,
    [logEntityType]
  );

  const appRunActive = isApplicationType && isPipelineRunActive(appRunState);

  // --- Ingestion logs: SSE tail while live, paginated REST otherwise ---
  // Fetch logs by fqn so the backend serves them without a prior id -> fqn lookup.
  const latestRun = ingestionDetails?.pipelineStatuses?.[0];
  const ingestion = useIngestionLogSource({
    enabled: !isApplicationType,
    ingestionFqn: ingestionDetails?.fullyQualifiedName ?? '',
    ingestionType: ingestionDetails?.pipelineType,
    runId: runId ?? latestRun?.runId,
    runActive:
      !isApplicationType && isPipelineRunActive(latestRun?.pipelineState),
  });

  const isLive = isApplicationType ? appRunActive : ingestion.isLive;

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

  // While the stream is up it reports the run's end itself, so the status poll
  // is redundant — one read once the stream says the run finished is enough to
  // refresh the footer badge.
  usePollingEffect(refreshIngestionStatus, {
    enabled: !isApplicationType && isLive && !ingestion.isStreaming,
  });

  useEffect(() => {
    if (ingestion.runFinishedOnStream) {
      refreshIngestionStatus();
    }
  }, [ingestion.runFinishedOnStream, refreshIngestionStatus]);

  // --- Application logs: one-shot snapshot (replace) ---
  const fetchAppLogs = useCallback(async () => {
    const reqId = appRequestRef.current;
    try {
      const currentTime = Date.now();
      const oneDayAgo = getEpochMillisForPastDays(1);
      await getExternalApplicationRuns(fqn, {
        startTs: oneDayAgo,
        endTs: currentTime,
      });
      const latest = await getLatestApplicationRuns(fqn, runId);
      if (reqId !== appRequestRef.current) {
        return;
      }
      setAppLogs(latest.data_insight_task || latest.application_task || '');
      setAppRunState(latest.pipelineStatus?.pipelineState);
    } catch (error) {
      if (reqId === appRequestRef.current) {
        showErrorToast(error as AxiosError);
      }
    }
  }, [fqn, runId]);

  usePollingEffect(fetchAppLogs, { enabled: isApplicationType && isLive });

  useEffect(() => {
    if (!fqn) {
      return;
    }
    const reqId = (appRequestRef.current += 1);
    if (isApplicationType) {
      setAppLoading(true);
      setAppLogs('');
      getApplicationByName(fqn, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      })
        .then((data) => {
          if (reqId !== appRequestRef.current) {
            return undefined;
          }
          setAppData(data);

          return fetchAppLogs();
        })
        .catch((error) => {
          if (reqId === appRequestRef.current) {
            showErrorToast(error as AxiosError);
          }
        })
        .finally(() => {
          if (reqId === appRequestRef.current) {
            setAppLoading(false);
          }
        });
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

      const blob = await downloadIngestionLog(
        ingestionDetails?.fullyQualifiedName
      );
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

  const logs = isApplicationType ? appLogs : ingestion.logs;
  const totalLines = useMemo(
    () => (logs ? logs.split('\n').length : 0),
    [logs]
  );

  return buildEntityLogsResult({
    appLoading,
    detailsLoading,
    download,
    ingestion,
    isApplicationType,
    isLive,
    logs,
    progress,
    title,
    totalLines,
  });
};
