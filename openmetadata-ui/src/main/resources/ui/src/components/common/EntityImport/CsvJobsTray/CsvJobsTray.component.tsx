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
import { isEmpty } from 'lodash';
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
import { CSV_JOBS_REFRESH_EVENT } from './CsvJobsTray.constants';

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
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
    () => new Set()
  );
  const hasLoadedInitialJobs = useRef(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await getCsvAsyncJobs();

      if (!hasLoadedInitialJobs.current) {
        const initialTerminalJobIds = response
          .filter((job) => TERMINAL_STATUSES.includes(job.status))
          .map((job) => job.jobId);

        if (!isEmpty(initialTerminalJobIds)) {
          setDismissedJobIds((current) => {
            const next = new Set(current);
            initialTerminalJobIds.forEach((jobId) => next.add(jobId));

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

  const handleDownload = useCallback(async (job: CsvAsyncJob) => {
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
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDownloadingJobId(undefined);
    }
  }, []);

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
    window.addEventListener(CSV_JOBS_REFRESH_EVENT, fetchJobs);

    return () => {
      window.removeEventListener(CSV_JOBS_REFRESH_EVENT, fetchJobs);
    };
  }, [fetchJobs]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    fetchJobs();
  }, [fetchJobs]);

  if (isEmpty(visibleJobs)) {
    return null;
  }

  const renderJobTitle = (job: CsvAsyncJob) => {
    const entityLabel = t(`label.${job.entityType}-plural`, {
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

    if (job.status === 'COMPLETED' && job.operation === 'EXPORT') {
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
        <div className="csv-jobs-tray-popover">
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
              className="csv-jobs-tray-close"
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

              return (
                <div
                  className={`csv-jobs-tray-item csv-jobs-tray-item-${variant}`}
                  key={job.jobId}>
                  <div className="csv-jobs-tray-item-row">
                    <span className="csv-jobs-tray-kind-icon">
                      {variant === 'running' ? (
                        renderStatusIcon(job)
                      ) : (
                        <KindIcon size={16} />
                      )}
                    </span>
                    <div className="csv-jobs-tray-body">
                      <span className="csv-jobs-tray-title">
                        {renderJobTitle(job)}
                      </span>
                      <span className="csv-jobs-tray-sub">
                        {renderJobSubLine(job)}
                      </span>
                    </div>
                    <div className="csv-jobs-tray-actions">
                      {variant !== 'running' && (
                        <span
                          aria-hidden="true"
                          className={`csv-jobs-tray-state csv-jobs-tray-state-${variant}`}>
                          {renderStatusIcon(job)}
                        </span>
                      )}
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
      {!open && (
        <div className="csv-jobs-tray-launcher-wrap">
          <button
            className="csv-jobs-tray-launcher"
            type="button"
            onClick={handleOpen}>
            <span className="csv-jobs-tray-launcher-count">
              {activeJobs.length || visibleJobs.length}
            </span>
            <span className="csv-jobs-tray-launcher-label">
              {activeJobs.length > 0
                ? t('label.count-jobs-running', { count: activeJobs.length })
                : t('label.background-job-plural')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
