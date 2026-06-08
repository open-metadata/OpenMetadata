/*
 *  Copyright 2024 Collate.
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

import { DownloadOutlined } from '@ant-design/icons';
import { LazyLog } from '@melloware/react-logviewer';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined, toNumber } from 'lodash';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ReactComponent as TimeDateIcon } from '../../assets/svg/time-date.svg';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { IngestionRecentRuns } from '../../components/Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { PipelineType } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { App, AppScheduleClass } from '../../generated/entity/applications/app';
import {
  IngestionPipeline,
  PipelineState,
  PipelineStatus,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { useDownloadProgressStore } from '../../hooks/useDownloadProgressStore';
import { useFqn } from '../../hooks/useFqn';
import { useScheduleDescriptionTexts } from '../../hooks/useScheduleDescriptionTexts';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
  subscribeIngestionPipelineLogs,
} from '../../rest/ingestionPipelineAPI';
import { ExtraInfoLabel } from '../../utils/DataAssetsHeader.utils';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  downloadAppLogs,
  downloadIngestionLog,
  getLogsFromResponse,
} from '../../utils/IngestionLogs/LogsUtils';
import logsClassBase from '../../utils/LogsClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './logs-viewer-page.style.less';
import { LogViewerParams } from './LogsViewerPage.interfaces';

const ScheduleSummaryValue = ({
  cronExpression,
}: {
  cronExpression: string;
}) => {
  const theme = useTheme();
  const { descriptionFirstPart, descriptionSecondPart } =
    useScheduleDescriptionTexts(cronExpression);

  return (
    <Stack alignItems="center" direction="row" spacing={1}>
      <TimeDateIcon className="m-t-xss" height={20} width={20} />
      <Stack spacing={1}>
        <Typography
          data-testid="schedule-primary-details"
          sx={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: '16px',
            marginBottom: '0px !important',
          }}
          variant="body1">
          {descriptionFirstPart}
        </Typography>
        <Typography
          data-testid="schedule-secondary-details"
          sx={{
            fontSize: 12,
            lineHeight: '14px',
            marginBottom: '0px !important',
            color: theme.palette.grey[500],
          }}
          variant="body1">
          {descriptionSecondPart}
        </Typography>
      </Stack>
    </Stack>
  );
};

const LogsViewerPage = () => {
  const { logEntityType } = useRequiredParams<LogViewerParams>();
  const { fqn: ingestionName } = useFqn();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId') ?? undefined;

  const { t } = useTranslation();
  const { progress, reset, updateProgress } = useDownloadProgressStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string>('');
  const [ingestionDetails, setIngestionDetails] = useState<IngestionPipeline>();
  const [appData, setAppData] = useState<App>();
  const [appRuns, setAppRuns] = useState<PipelineStatus[]>([]);
  const [paging, setPaging] = useState<Paging>();
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState<boolean>(true);
  const lazyLogRef = useRef<LazyLog>(null);
  const sseRef = useRef<EventSource | null>(null);
  // Refs so the polling/SSE callbacks always see the latest cursor + run
  // state without re-creating the interval on every render.
  const tailCursorRef = useRef<string | undefined>(undefined);
  const isTailingRef = useRef<boolean>(false);

  const isApplicationType = useMemo(
    () => logEntityType === GlobalSettingOptions.APPLICATIONS,
    [logEntityType]
  );

  const fetchLogs = async (
    ingestionId?: string,
    pipelineType?: PipelineType
  ) => {
    setIsLogsLoading(true);
    try {
      if (isApplicationType) {
        const currentTime = Date.now();
        const oneDayAgo = getEpochMillisForPastDays(1);
        const { data } = await getExternalApplicationRuns(ingestionName, {
          startTs: oneDayAgo,
          endTs: currentTime,
        });

        const logs = await getLatestApplicationRuns(ingestionName, runId);
        setAppRuns(data);
        setLogs(logs.data_insight_task || logs.application_task);

        return;
      }
      const res = await getIngestionPipelineLogById(
        ingestionId || ingestionDetails?.id || '',
        paging?.total === paging?.after ? '' : paging?.after
      );

      setPaging({
        after: res.data.after,
        total: toNumber(res.data.total),
      });

      switch (pipelineType || ingestionDetails?.pipelineType) {
        case PipelineType.Metadata:
          setLogs(logs.concat(res.data?.ingestion_task ?? ''));

          break;
        case PipelineType.Application:
          setLogs(logs.concat(res.data?.application_task ?? ''));

          break;
        case PipelineType.Profiler:
          setLogs(logs.concat(res.data?.profiler_task ?? ''));

          break;
        case PipelineType.Usage:
          setLogs(logs.concat(res.data?.usage_task ?? ''));

          break;
        case PipelineType.Lineage:
          setLogs(logs.concat(res.data?.lineage_task ?? ''));

          break;
        case PipelineType.Dbt:
          setLogs(logs.concat(res.data?.dbt_task ?? ''));

          break;
        case PipelineType.TestSuite:
          setLogs(logs.concat(res.data?.test_suite_task ?? ''));

          break;
        case PipelineType.DataInsight:
          setLogs(logs.concat(res.data?.data_insight_task ?? ''));

          break;

        case PipelineType.ElasticSearchReindex:
          setLogs(logs.concat(res.data?.elasticsearch_reindex_task ?? ''));

          break;

        case PipelineType.AutoClassification:
          setLogs(logs.concat(res.data?.auto_classification_task ?? ''));

          break;

        default:
          setLogs('');

          break;
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchIngestionDetailsByName = async () => {
    try {
      setIsLoading(true);
      const res = await getIngestionPipelineByFqn(ingestionName, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.PIPELINE_STATUSES],
      });
      if (res) {
        setIngestionDetails(res);

        fetchLogs(res.id, res.pipelineType);
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getApplicationByName(ingestionName, {
        fields: TabSpecificField.OWNERS,
        include: Include.All,
      });
      setAppData(data);
      fetchLogs();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [ingestionName]);

  const fetchMoreLogs = useCallback(() => {
    fetchLogs(ingestionDetails?.id, ingestionDetails?.pipelineType);
  }, [ingestionDetails, fetchLogs]);

  const handleScroll = useCallback(
    (scrollValues: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      const scrollTop = scrollValues.scrollTop;
      const scrollHeight = scrollValues.scrollHeight;
      const clientHeight = scrollValues.clientHeight;
      // Fetch more logs when user is at the bottom of the log
      // with a margin of about 40px (approximate height of one line)
      const isBottom = Math.abs(clientHeight + scrollTop - scrollHeight) < 40;

      // Drive live-follow off scroll position: at-bottom = follow, scrolled-up
      // = paused. Cheap, no extra UI control needed for the common case.
      setIsFollowing(isBottom);

      if (
        !isLogsLoading &&
        isBottom &&
        !isNil(paging) &&
        !isUndefined(paging.after) &&
        toNumber(paging?.after) < toNumber(paging?.total)
      ) {
        fetchMoreLogs();
      }

      return;
    },
    [isLogsLoading, paging, fetchMoreLogs]
  );

  useLayoutEffect(() => {
    const lazyLogSearchBarInput = document.getElementsByClassName(
      'react-lazylog-searchbar-input'
    )[0] as HTMLInputElement;

    if (lazyLogSearchBarInput) {
      lazyLogSearchBarInput.placeholder = `${t('label.search-entity', {
        entity: t('label.log-plural'),
      })}...`;
    }
  });

  const handleJumpToEnd = useCallback(() => {
    if (lazyLogRef.current?.listRef.current) {
      // Get the total number of lines
      const totalLines = lazyLogRef.current.state.count;
      // Scroll to the last line
      lazyLogRef.current.listRef.current.scrollToIndex(totalLines - 1);
    }
  }, [lazyLogRef.current]);

  // ---------------------------------------------------------------------------
  // Live tail
  //
  // Two transports, picked based on whether the run uses streamable storage:
  //   - Streamable (log-server / S3): SSE — the server pushes each new line as
  //     soon as the connector emits it. Sub-second latency.
  //   - Airflow / non-streamable: 2 s polling against /logs/{id}/last with the
  //     existing cursor. Airflow buffers and flushes log lines server-side at
  //     similar cadence, so a tighter interval doesn't materially improve
  //     freshness and just multiplies load on the pipeline-service-client.
  //
  // A separate 10 s status poller refreshes pipelineStatuses so we notice when
  // the run terminates and stop tailing. Both effects depend on the latest
  // pipelineState; when it transitions to a terminal value the next render's
  // dependency change tears down the intervals/SSE.
  // ---------------------------------------------------------------------------
  const latestStatus = ingestionDetails?.pipelineStatuses;
  const activeRunId = runId ?? latestStatus?.runId;
  const isRunActive =
    !isApplicationType &&
    (latestStatus?.pipelineState === PipelineState.Running ||
      latestStatus?.pipelineState === PipelineState.Queued);
  const isStreamableRun = Boolean(ingestionDetails?.enableStreamableLogs);

  const recentRuns = useMemo(() => {
    if (!isUndefined(ingestionDetails) || appRuns) {
      return (
        <IngestionRecentRuns
          appRuns={appRuns}
          fetchStatus={!isApplicationType}
          ingestion={ingestionDetails}
        />
      );
    }

    return '--';
  }, [isApplicationType, appRuns, ingestionDetails]);

  const logSummaries = useMemo(() => {
    const scheduleClass = appData?.appSchedule as AppScheduleClass;

    return {
      Type:
        ingestionDetails?.pipelineType ??
        scheduleClass?.scheduleTimeline ??
        '--',
      Schedule:
        ingestionDetails?.airflowConfig.scheduleInterval ??
        scheduleClass?.cronExpression ??
        '--',
      ['Recent Runs']: recentRuns,
    };
  }, [ingestionDetails, appData, recentRuns]);

  const handleIngestionDownloadClick = useCallback(async () => {
    try {
      reset();
      updateProgress(1);
      let fileName = `${getEntityName(ingestionDetails)}-${
        ingestionDetails?.pipelineType
      }.log`;

      if (isApplicationType) {
        const logs = await downloadAppLogs(ingestionName, runId);
        fileName = `${ingestionName}.log`;
        const element = document.createElement('a');
        const file = new Blob([logs || ''], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = fileName;
        document.body.appendChild(element);
        element.click();
        element.remove();
      } else {
        const logsBlob = await downloadIngestionLog(ingestionDetails?.id);

        const element = document.createElement('a');
        element.href = URL.createObjectURL(logsBlob as Blob);
        element.download = fileName;
        document.body.appendChild(element);
        element.click();
        element.remove();
      }
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
      reset();
    }
  }, [
    ingestionDetails,
    ingestionName,
    isApplicationType,
    reset,
    runId,
    updateProgress,
  ]);

  const logsSkeleton = useMemo(
    () => (
      <Stack data-testid="skeleton-container" spacing={4}>
        <Skeleton variant="text" width="50%" />
        <Skeleton sx={{ fontSize: '28px' }} variant="text" width="30%" />
        <Skeleton height={80} variant="rounded" />
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="flex-end"
          spacing={4}>
          <Skeleton height={30} variant="rounded" width={120} />
          <Skeleton height={30} variant="circular" width={30} />
          <Skeleton height={30} variant="circular" width={30} />
        </Stack>
        <Skeleton height="80vh" variant="rounded" />
      </Stack>
    ),
    []
  );

  const logsContainer = useMemo(() => {
    if (isLoading) {
      return logsSkeleton;
    }

    return (
      <Stack spacing={4}>
        <TitleBreadcrumb
          titleLinks={logsClassBase.getLogBreadCrumbs(
            logEntityType,
            ingestionName,
            ingestionDetails
          )}
        />
        <Typography variant="h6">
          {getEntityName(ingestionDetails) || getEntityName(appData)}
        </Typography>

        <Stack
          className="logs-viewer-header-container"
          data-testid="summary-card"
          direction="row"
          divider={<Divider flexItem orientation="vertical" />}
          spacing={2}>
          {Object.entries(logSummaries).map(([key, value]) => {
            const valueText =
              key === 'Schedule' ? (
                <ScheduleSummaryValue
                  cronExpression={(value ?? '') as string}
                />
              ) : (
                value
              );

            return (
              <Fragment key={key}>
                <ExtraInfoLabel label={key} value={valueText} />
              </Fragment>
            );
          })}
        </Stack>

        {isEmpty(logs) && !isLogsLoading ? (
          <Stack alignItems="center" height="50vh" justifyContent="center">
            <ErrorPlaceHolder
              className="bg-white"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              {t('label.no-entity-available', {
                entity: t('label.log-lowercase-plural'),
              })}
            </ErrorPlaceHolder>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Stack
              alignItems="center"
              direction="row"
              justifyContent="flex-end"
              spacing={4}>
              {isRunActive && (
                <Stack
                  alignItems="center"
                  data-testid="live-tail-indicator"
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 1.5,
                    py: 0.25,
                    borderRadius: 999,
                    backgroundColor: isFollowing
                      ? 'rgba(46, 204, 113, 0.12)'
                      : 'rgba(149, 165, 166, 0.18)',
                    color: isFollowing
                      ? 'rgb(39, 174, 96)'
                      : theme.palette.grey[700],
                  }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isFollowing
                        ? 'rgb(39, 174, 96)'
                        : theme.palette.grey[500],
                      animation: isFollowing
                        ? 'pulse 1.4s ease-in-out infinite'
                        : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.35 },
                      },
                    }}
                  />
                  <Typography
                    sx={{ fontSize: 12, fontWeight: 600 }}
                    variant="body2">
                    {isFollowing ? 'LIVE' : 'PAUSED'}
                  </Typography>
                  {!isFollowing && (
                    <Button
                      data-testid="resume-tail-button"
                      size="small"
                      sx={{
                        minWidth: 'unset',
                        px: 1,
                        py: 0,
                        fontSize: 11,
                        textTransform: 'none',
                      }}
                      onClick={() => {
                        setIsFollowing(true);
                        handleJumpToEnd();
                      }}>
                      Resume
                    </Button>
                  )}
                </Stack>
              )}
              <Button
                color="primary"
                data-testid="jump-to-end-button"
                size="small"
                variant="outlined"
                onClick={handleJumpToEnd}>
                {t('label.jump-to-end')}
              </Button>

              <CopyToClipboardButton copyText={logs} position="top" />

              {progress ? (
                <Tooltip
                  placement="top"
                  title={t('label.downloading-log-plural')}>
                  <Loader size="x-small" />
                </Tooltip>
              ) : (
                <IconButton
                  data-testid="download"
                  sx={{ padding: 0 }}
                  onClick={handleIngestionDownloadClick}>
                  <DownloadOutlined data-testid="download-icon" width="16" />
                </IconButton>
              )}
            </Stack>

            <Box className="h-80vh lazy-log-container" data-testid="lazy-log">
              <LazyLog
                caseInsensitive
                enableSearch
                selectableLines
                extraLines={1} // 1 is to be add so that linux users can see last line of the log
                follow={isRunActive && isFollowing}
                loading={isLogsLoading}
                ref={lazyLogRef}
                text={logs}
                onScroll={handleScroll}
              />
            </Box>
          </Stack>
        )}
      </Stack>
    );
  }, [
    isLoading,
    isLogsLoading,
    logs,
    logsSkeleton,
    logEntityType,
    ingestionName,
    ingestionDetails,
    appData,
    logSummaries,
    progress,
    handleJumpToEnd,
    handleIngestionDownloadClick,
    handleScroll,
    isRunActive,
    isFollowing,
    theme,
  ]);

  useEffect(() => {
    if (isApplicationType) {
      fetchAppDetails();
    } else {
      fetchIngestionDetailsByName();
    }
  }, [runId]);

  // Keep the tail cursor ref in sync with paging so polling always uses the
  // freshest "after" without re-creating the interval.
  useEffect(() => {
    tailCursorRef.current = paging?.after ?? undefined;
  }, [paging?.after]);

  // ---------------------------------------------------------------------------
  // Append helper — rAF-coalesced.
  //
  // A streaming run can emit thousands of lines/sec. Doing one setLogs per
  // SSE event means one React render per event, which the reconciler will
  // happily attempt and the browser cannot keep up with — the tab freezes.
  //
  // Strategy: every appendLogChunk just shoves the chunk into a ref buffer
  // and schedules a single requestAnimationFrame flush. Whatever has piled up
  // by the time rAF fires is concatenated and committed with one setLogs.
  // This caps re-renders at the display refresh rate (~60Hz / 16.6ms), so
  // CPU work stays bounded regardless of producer rate.
  // ---------------------------------------------------------------------------
  const pendingAppendRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushPendingAppends = useCallback(() => {
    rafIdRef.current = null;
    const pending = pendingAppendRef.current;
    if (pending.length === 0) {
      return;
    }
    pendingAppendRef.current = [];
    // Join with newlines, ensure trailing newline for clean subsequent appends.
    let combined = pending.join('\n');
    if (!combined.endsWith('\n')) {
      combined += '\n';
    }
    setLogs((prev) => {
      if (!prev) {
        return combined;
      }
      const base = prev.endsWith('\n') ? prev : prev + '\n';

      return base + combined;
    });
  }, []);

  const appendLogChunk = useCallback(
    (chunk: string) => {
      if (!chunk) {
        return;
      }
      pendingAppendRef.current.push(
        chunk.endsWith('\n') ? chunk.slice(0, -1) : chunk
      );
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(flushPendingAppends);
      }
    },
    [flushPendingAppends]
  );

  // Make sure no orphan rAF survives unmount.
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingAppendRef.current = [];
    };
  }, []);

  // Effect A: SSE for streamable active runs.
  useEffect(() => {
    if (!isRunActive || !isStreamableRun) {
      return;
    }
    const fqn = ingestionDetails?.fullyQualifiedName;
    if (!fqn || !activeRunId) {
      return;
    }
    const es = subscribeIngestionPipelineLogs(fqn, activeRunId);
    if (!es) {
      return;
    }
    sseRef.current = es;
    isTailingRef.current = true;

    es.addEventListener('backfill', (e: MessageEvent) =>
      appendLogChunk((e as MessageEvent<string>).data)
    );
    es.onmessage = (e: MessageEvent) =>
      appendLogChunk((e as MessageEvent<string>).data);
    es.addEventListener('close', () => es.close());
    es.onerror = () => {
      // Fail open: SSE may be unavailable (no log-server, network blip). The
      // polling effect below will pick up the slack on the next cycle if it
      // applies; if not, cursor pagination on scroll still works.
      es.close();
    };

    return () => {
      es.close();
      sseRef.current = null;
      isTailingRef.current = false;
    };
  }, [
    isRunActive,
    isStreamableRun,
    ingestionDetails?.fullyQualifiedName,
    activeRunId,
    appendLogChunk,
  ]);

  // Effect B: 2 s polling for active non-streamable (Airflow) runs.
  //
  // Depend on the specific primitive fields we actually use (id, pipelineType)
  // rather than the whole `ingestionDetails` object. The status-refresh effect
  // below rewrites `ingestionDetails` every 10 s with a fresh object reference,
  // even when nothing relevant changed — having the full object in the dep
  // array would tear down and recreate the polling interval each time, leaking
  // a request boundary in the middle of every ack window.
  const tailPipelineId = ingestionDetails?.id;
  const tailPipelineType = ingestionDetails?.pipelineType;
  useEffect(() => {
    if (!isRunActive || isStreamableRun || !tailPipelineId) {
      return;
    }
    isTailingRef.current = true;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await getIngestionPipelineLogById(
          tailPipelineId,
          tailCursorRef.current
        );
        if (cancelled) {
          return;
        }
        const newChunk = getLogsFromResponse(res.data, tailPipelineType ?? '');
        appendLogChunk(newChunk);
        setPaging({
          after: res.data.after,
          total: toNumber(res.data.total),
        });
      } catch {
        // Swallow — Airflow / pipeline-service-client may be transiently
        // unavailable. Next tick retries; no toast spam.
      }
    };

    const interval = window.setInterval(tick, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      isTailingRef.current = false;
    };
  }, [
    isRunActive,
    isStreamableRun,
    tailPipelineId,
    tailPipelineType,
    appendLogChunk,
  ]);

  // Effect C: refresh pipelineStatuses every 10 s while we're actively
  // tailing, so we notice transitions to Success / Failed / Stopped and the
  // tail effects above auto-tear-down.
  useEffect(() => {
    if (!isRunActive || !ingestionName) {
      return;
    }
    const refresh = async () => {
      try {
        const fresh = await getIngestionPipelineByFqn(ingestionName, {
          fields: [TabSpecificField.PIPELINE_STATUSES],
        });
        setIngestionDetails((prev) =>
          prev ? { ...prev, pipelineStatuses: fresh.pipelineStatuses } : fresh
        );
      } catch {
        // ignore — we'll try again on the next tick
      }
    };
    const interval = window.setInterval(refresh, 10000);

    return () => window.clearInterval(interval);
  }, [isRunActive, ingestionName]);

  return (
    <PageLayoutV1 pageTitle={t('label.log-viewer')}>
      {logsContainer}
    </PageLayoutV1>
  );
};

export default LogsViewerPage;
