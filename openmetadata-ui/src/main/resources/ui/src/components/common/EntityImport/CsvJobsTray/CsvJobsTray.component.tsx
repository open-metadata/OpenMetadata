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
import { Button } from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Download01,
  Minus,
  RefreshCw01,
  StopCircle,
  Trash01,
  UploadCloud01,
  XClose,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty, kebabCase } from 'lodash';
import {
  FC,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS } from '../../../../constants/constants';
import { useWebSocketConnector } from '../../../../context/WebSocketProvider/WebSocketProvider';
import {
  cancelCsvAsyncJob,
  CsvAsyncJob,
  CsvAsyncJobOperation,
  CsvAsyncJobStatus,
  getCsvAsyncJobResult,
  getCsvAsyncJobs,
} from '../../../../rest/csvAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './csv-jobs-tray.less';
import {
  CSV_JOBS_POST_ACTION_REFRESH_MS,
  CSV_JOBS_REFRESH_EVENT,
  isCsvJobOwned,
} from './CsvJobsTray.constants';

const ACTIVE_STATUSES: CsvAsyncJobStatus[] = [
  'QUEUED',
  'RUNNING',
  'CANCELLING',
];

const TERMINAL_STATUSES: CsvAsyncJobStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

const ACTIVE_JOBS_POLL_INTERVAL_MS = 5000;

// Fetch well beyond the handful the tray renders so a just-finished job cannot
// fall outside the fetched window (which would silently skip its auto-open).
const CSV_JOBS_FETCH_LIMIT = 50;

type StatusVariant = 'running' | 'success' | 'error';

const getStatusVariant = (status: CsvAsyncJobStatus): StatusVariant => {
  if (ACTIVE_STATUSES.includes(status)) {
    return 'running';
  }

  if (status === 'COMPLETED') {
    return 'success';
  }

  return 'error';
};

type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number }>;

const getKindIcon = (operation: CsvAsyncJobOperation): IconComponent =>
  operation === 'IMPORT' ? UploadCloud01 : Download01;

const getJobPercent = (job: CsvAsyncJob) => {
  const total = job.total ?? 0;
  const progress = job.progress ?? 0;

  return total > 0 ? Math.round((progress / total) * 100) : 0;
};

export const CsvJobsTray = () => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();
  const [jobs, setJobs] = useState<CsvAsyncJob[]>([]);
  const [open, setOpen] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string>();
  const [downloadingJobId, setDownloadingJobId] = useState<string>();
  const [downloadedJobIds, setDownloadedJobIds] = useState<Set<string>>(
    () => new Set()
  );
  // Jobs whose result the server no longer holds — released by retention, or
  // produced before results moved into the shared job row.
  const [expiredJobIds, setExpiredJobIds] = useState<Set<string>>(
    () => new Set()
  );
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
    () => new Set()
  );
  const hasLoadedInitialJobs = useRef(false);
  const autoOpenedJobIds = useRef<Set<string>>(new Set());
  const postActionTimeoutIds = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set()
  );
  const latestFetchId = useRef(0);

  const fetchJobs = useCallback(async () => {
    const fetchId = (latestFetchId.current += 1);
    try {
      const response = await getCsvAsyncJobs(CSV_JOBS_FETCH_LIMIT);

      // Many sources trigger fetches (mount, refresh event, both socket
      // channels, the poll, the launcher). If a newer fetch was issued while
      // this one was in flight, drop this result: a slow response must not
      // overwrite fresher state and, e.g., flip a completed job back to running
      // and restart the poll.
      if (fetchId !== latestFetchId.current) {
        return;
      }

      if (!hasLoadedInitialJobs.current) {
        // Jobs already terminal on the very first fetch are stale (e.g. leftovers
        // shown after a page refresh) and must not pop the tray. The exception is
        // a job the user just started this session: a fast export can finish
        // before this first fetch resolves, so it would look "stale" here even
        // though it is exactly what the user is waiting to download. Owned jobs
        // are therefore never pre-dismissed.
        const staleTerminalJobIds = response
          .filter(
            (job) =>
              TERMINAL_STATUSES.includes(job.status) &&
              !isCsvJobOwned(job.jobId)
          )
          .map((job) => job.jobId);

        if (!isEmpty(staleTerminalJobIds)) {
          setDismissedJobIds((current) => {
            const next = new Set(current);
            staleTerminalJobIds.forEach((jobId) => next.add(jobId));

            return next;
          });
        }

        hasLoadedInitialJobs.current = true;
      }

      setJobs(response);
    } catch (error) {
      if ((error as AxiosError).response?.status !== 404) {
        showErrorToast(error as AxiosError);
      }
    }
  }, []);

  const visibleJobs = useMemo(
    () => jobs.filter((job) => !dismissedJobIds.has(job.jobId)),
    [jobs, dismissedJobIds]
  );

  const activeJobs = useMemo(
    () => visibleJobs.filter((job) => ACTIVE_STATUSES.includes(job.status)),
    [visibleJobs]
  );

  const completedJobs = useMemo(
    () => visibleJobs.filter((job) => TERMINAL_STATUSES.includes(job.status)),
    [visibleJobs]
  );

  const hasActiveJobs = !isEmpty(activeJobs);

  useEffect(() => {
    // Nothing left to show (e.g. right after Clear completed): collapse the tray
    // so it does not carry a stale open state into the next job. Otherwise a job
    // started next would reuse open=true and pop the popover while still merely
    // running — the tray must only open on its own when a job actually finishes.
    if (isEmpty(visibleJobs)) {
      setOpen(false);

      return;
    }

    // A job reaching a terminal state (ready to download, failed, or cancelled)
    // opens the tray even if the user had minimised it, so completion is never
    // left hidden behind the launcher. Each job triggers this only once, so the
    // user can still close the tray and it stays closed.
    const newlyFinished = visibleJobs.filter(
      (job) =>
        TERMINAL_STATUSES.includes(job.status) &&
        !autoOpenedJobIds.current.has(job.jobId)
    );

    if (!isEmpty(newlyFinished)) {
      newlyFinished.forEach((job) => autoOpenedJobIds.current.add(job.jobId));
      setOpen(true);
    }
  }, [visibleJobs]);

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      setCancellingJobId(jobId);
      const updatedJob = await cancelCsvAsyncJob(jobId);
      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job.jobId === updatedJob.jobId ? updatedJob : job
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setCancellingJobId(undefined);
    }
  }, []);

  const handleDownload = useCallback(
    async (job: CsvAsyncJob) => {
      try {
        setDownloadingJobId(job.jobId);
        const csvData = await getCsvAsyncJobResult(job.jobId);
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${job.entityType}-${job.jobId}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadedJobIds((current) => {
          const next = new Set(current);
          next.add(job.jobId);

          return next;
        });
      } catch (error) {
        // A 404 means the payload was released to reclaim storage, or the job
        // predates result sharing. The row stays Completed but is not downloadable,
        // so say that instead of surfacing the raw server message.
        if ((error as AxiosError).response?.status === 404) {
          setExpiredJobIds((current) => {
            const next = new Set(current);
            next.add(job.jobId);

            return next;
          });
          showErrorToast(t('message.export-result-no-longer-available'));
        } else {
          showErrorToast(error as AxiosError);
        }
      } finally {
        setDownloadingJobId(undefined);
      }
    },
    [t]
  );

  const handleDismiss = useCallback((jobId: string) => {
    setDismissedJobIds((current) => {
      const next = new Set(current);
      next.add(jobId);

      return next;
    });
  }, []);

  const handleClearCompleted = useCallback(() => {
    setDismissedJobIds((current) => {
      const next = new Set(current);
      completedJobs.forEach((job) => next.add(job.jobId));

      return next;
    });
  }, [completedJobs]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, fetchJobs);
    socket.on(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, fetchJobs);

    return () => {
      socket.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, fetchJobs);
      socket.off(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, fetchJobs);
    };
  }, [fetchJobs, socket]);

  useEffect(() => {
    fetchJobs();

    // A refresh event means the user just started an export/import. Fetch now,
    // then once more shortly after: some actions (notably import) fire the event
    // before their job exists, so the immediate fetch can miss it and — with no
    // active job yet — polling never starts. The follow-up fetch picks the job
    // up so the active-jobs poll can take over.
    const handleRefreshEvent = () => {
      fetchJobs();
      const timeoutId = setTimeout(() => {
        postActionTimeoutIds.current.delete(timeoutId);
        fetchJobs();
      }, CSV_JOBS_POST_ACTION_REFRESH_MS);
      postActionTimeoutIds.current.add(timeoutId);
    };

    window.addEventListener(CSV_JOBS_REFRESH_EVENT, handleRefreshEvent);

    const timeoutIds = postActionTimeoutIds.current;

    return () => {
      window.removeEventListener(CSV_JOBS_REFRESH_EVENT, handleRefreshEvent);
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds.clear();
    };
  }, [fetchJobs]);

  // The websocket only reaches sockets held by the server that ran the job, so in
  // a multi-server deployment the completion event is often delivered to a peer.
  // Polling while work is outstanding is what actually keeps the tray truthful;
  // the socket subscription above is just the fast path.
  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    // Self-scheduling rather than setInterval: the next poll is queued only once
    // the previous one settles, so a slow response cannot stack up concurrent
    // requests racing to set the same state.
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextPoll = () => {
      timeoutId = setTimeout(async () => {
        await fetchJobs();

        if (!cancelled) {
          scheduleNextPoll();
        }
      }, ACTIVE_JOBS_POLL_INTERVAL_MS);
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [hasActiveJobs, fetchJobs]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    fetchJobs();
  }, [fetchJobs]);

  if (isEmpty(visibleJobs)) {
    return null;
  }

  const renderJobTitle = (job: CsvAsyncJob) => {
    // Job entity types are camelCase (dataAsset, databaseSchema) while the label
    // keys are kebab-case, so look up the kebab form or every multi-word entity
    // falls through to the raw type — "Exported dataAsset".
    const entityLabel = t(`label.${kebabCase(job.entityType)}-plural`, {
      defaultValue: job.entityType,
    });

    if (job.operation === 'IMPORT') {
      return job.status === 'COMPLETED'
        ? t('label.imported-entity-plural', { entity: entityLabel })
        : t('label.importing-entity-plural', { entity: entityLabel });
    }

    return job.status === 'COMPLETED'
      ? t('label.exported-entity-plural', { entity: entityLabel })
      : t('label.exporting-entity-plural', { entity: entityLabel });
  };

  const renderJobSubLine = (job: CsvAsyncJob) => {
    const total = job.total ?? 0;
    const progress = job.progress ?? 0;
    const percent = getJobPercent(job);

    if (ACTIVE_STATUSES.includes(job.status)) {
      return total > 0
        ? `${progress} ${t('label.of-lowercase')} ${total} · ${percent}%`
        : job.message ?? t('message.import-data-in-progress');
    }

    if (job.status === 'COMPLETED') {
      return total > 0
        ? t('label.completed-with-count', { count: total })
        : t('label.completed');
    }

    if (job.status === 'CANCELLED') {
      return t('label.cancelled');
    }

    return job.error ?? job.message ?? t('label.failed');
  };

  const renderStatusIcon = (job: CsvAsyncJob) => {
    const variant = getStatusVariant(job.status);

    if (variant === 'running') {
      return <RefreshCw01 className="csv-jobs-tray-status-spin" size={16} />;
    }

    if (variant === 'success') {
      return <CheckCircle size={16} />;
    }

    return <AlertCircle size={16} />;
  };

  const renderJobRowActions = (job: CsvAsyncJob) => {
    const isActive = ACTIVE_STATUSES.includes(job.status);

    if (isActive) {
      return (
        <Button
          className="csv-jobs-tray-action"
          color="secondary-destructive"
          iconLeading={StopCircle}
          isLoading={cancellingJobId === job.jobId}
          size="xs"
          onPress={() => handleCancel(job.jobId)}>
          {t('label.cancel')}
        </Button>
      );
    }

    if (
      job.status === 'COMPLETED' &&
      job.operation === 'EXPORT' &&
      !expiredJobIds.has(job.jobId)
    ) {
      return (
        <Button
          className="csv-jobs-tray-action"
          color="secondary"
          iconLeading={Download01}
          isLoading={downloadingJobId === job.jobId}
          size="xs"
          onPress={() => handleDownload(job)}>
          {t('label.download')}
        </Button>
      );
    }

    return (
      <Button
        className="csv-jobs-tray-dismiss"
        color="link-gray"
        iconLeading={XClose}
        size="xs"
        onPress={() => handleDismiss(job.jobId)}
      />
    );
  };

  return (
    <div className="csv-jobs-tray">
      {open && (
        <div className="csv-jobs-tray-popover tw:w-100!">
          <div className="csv-jobs-tray-header">
            <div className="csv-jobs-tray-title-wrap">
              <h3>{t('label.background-job-plural')}</h3>
              {activeJobs.length > 0 && (
                <span className="csv-jobs-tray-header-count">
                  {t('label.count-running', { count: activeJobs.length })}
                </span>
              )}
            </div>
            {completedJobs.length > 0 && (
              <Button
                className="csv-jobs-tray-clear"
                color="link-gray"
                iconLeading={Trash01}
                size="xs"
                onPress={handleClearCompleted}>
                {t('label.clear-completed')}
              </Button>
            )}
            <Button
              className="csv-jobs-tray-close tw:-mr-1.5"
              color="link-gray"
              iconLeading={Minus}
              onPress={() => setOpen(false)}
            />
          </div>
          <div className="csv-jobs-tray-list">
            {visibleJobs.slice(0, 8).map((job) => {
              const percent = getJobPercent(job);
              const variant = getStatusVariant(job.status);
              const KindIcon = getKindIcon(job.operation);
              const nonRunningIcon = downloadedJobIds.has(job.jobId) ? (
                <Check size={16} />
              ) : (
                <KindIcon size={16} />
              );

              return (
                <div
                  className={`csv-jobs-tray-item csv-jobs-tray-item-${variant}`}
                  data-testid={`csv-job-${job.jobId}`}
                  key={job.jobId}>
                  <div className="csv-jobs-tray-item-row">
                    <span className="csv-jobs-tray-kind-icon">
                      {variant === 'running'
                        ? renderStatusIcon(job)
                        : nonRunningIcon}
                    </span>
                    <div className="csv-jobs-tray-body">
                      <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
                        <span className="csv-jobs-tray-title tw:min-w-0">
                          {renderJobTitle(job)}
                        </span>
                        {variant !== 'running' && (
                          <span
                            aria-hidden="true"
                            className={`csv-jobs-tray-state csv-jobs-tray-state-${variant} tw:shrink-0`}>
                            {renderStatusIcon(job)}
                          </span>
                        )}
                      </span>
                      <span className="csv-jobs-tray-sub">
                        {renderJobSubLine(job)}
                      </span>
                    </div>
                    <div className="csv-jobs-tray-actions">
                      {renderJobRowActions(job)}
                    </div>
                  </div>
                  <div
                    className={`csv-jobs-tray-progress csv-jobs-tray-progress-${variant}`}>
                    <span
                      style={{
                        width: variant === 'running' ? `${percent}%` : '100%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!open && !isEmpty(visibleJobs) && (
        <div className="csv-jobs-tray-launcher-wrap">
          <button
            className="csv-jobs-tray-launcher"
            type="button"
            onClick={handleOpen}>
            {activeJobs.length > 0 ? (
              <>
                <span className="csv-jobs-tray-launcher-count">
                  {activeJobs.length}
                </span>
                <span className="csv-jobs-tray-launcher-label">
                  {t('label.count-jobs-running', { count: activeJobs.length })}
                  <span
                    aria-hidden
                    className="tw:ml-1 tw:inline-flex tw:items-end tw:gap-0.5 tw:align-text-bottom">
                    <span className="tw:size-1 tw:animate-bounce tw:rounded-full tw:bg-current" />
                    <span className="tw:size-1 tw:animate-bounce tw:rounded-full tw:bg-current tw:[animation-delay:150ms]" />
                    <span className="tw:size-1 tw:animate-bounce tw:rounded-full tw:bg-current tw:[animation-delay:300ms]" />
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="csv-jobs-tray-launcher-count">
                  {visibleJobs.length}
                </span>
                <span className="csv-jobs-tray-launcher-label">
                  {t('label.background-job-plural')}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
