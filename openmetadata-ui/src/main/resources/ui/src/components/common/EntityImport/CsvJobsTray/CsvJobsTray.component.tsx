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
import { Badge, Button } from '@openmetadata/ui-core-components';
import { Clock, StopCircle, XClose } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS } from '../../../../constants/constants';
import { useWebSocketConnector } from '../../../../context/WebSocketProvider/WebSocketProvider';
import {
  cancelCsvAsyncJob,
  CsvAsyncJob,
  getCsvAsyncJobs,
} from '../../../../rest/csvAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './csv-jobs-tray.less';

const ACTIVE_STATUSES = ['QUEUED', 'RUNNING', 'CANCELLING'];

export const CsvJobsTray = () => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();
  const [jobs, setJobs] = useState<CsvAsyncJob[]>([]);
  const [open, setOpen] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string>();

  const fetchJobs = useCallback(async () => {
    try {
      const response = await getCsvAsyncJobs();
      setJobs(response);
    } catch (error) {
      if ((error as AxiosError).response?.status !== 404) {
        showErrorToast(error as AxiosError);
      }
    }
  }, []);

  const activeJobs = useMemo(
    () => jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)),
    [jobs]
  );

  const handleCancel = async (jobId: string) => {
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
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!socket || isEmpty(jobs)) {
      return;
    }

    socket.on(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, fetchJobs);
    socket.on(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, fetchJobs);

    return () => {
      socket.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, fetchJobs);
      socket.off(SOCKET_EVENTS.CSV_EXPORT_CHANNEL, fetchJobs);
    };
  }, [fetchJobs, jobs.length, socket]);

  if (isEmpty(jobs)) {
    return null;
  }

  return (
    <div className="csv-jobs-tray">
      {open && (
        <div className="csv-jobs-tray-popover">
          <div className="csv-jobs-tray-header">
            <div className="csv-jobs-tray-title-wrap">
              <h3>{t('label.csv-job-plural')}</h3>
              {activeJobs.length > 0 && (
                <span className="csv-jobs-tray-header-count">
                  {activeJobs.length} {t('label.running').toLowerCase()}
                </span>
              )}
            </div>
            <Button
              className="csv-jobs-tray-close"
              color="link-gray"
              iconLeading={XClose}
              onPress={() => setOpen(false)}
            />
          </div>
          {isEmpty(jobs) ? (
            <p className="csv-jobs-tray-empty">
              {t('message.no-active-csv-jobs')}
            </p>
          ) : (
            <div className="csv-jobs-tray-list">
              {jobs.slice(0, 6).map((job) => {
                const total = job.total ?? 0;
                const progress = job.progress ?? 0;
                const percent =
                  total > 0 ? Math.round((progress / total) * 100) : 0;
                const isActive = ACTIVE_STATUSES.includes(job.status);
                const statusClass = isActive
                  ? 'running'
                  : job.status === 'COMPLETED'
                  ? 'success'
                  : 'error';

                return (
                  <div
                    className={`csv-jobs-tray-item csv-jobs-tray-item-${statusClass}`}
                    key={job.jobId}>
                    <div className="csv-jobs-tray-item-header">
                      <span className="csv-jobs-tray-kind-icon">
                        <Clock size={16} />
                      </span>
                      <div className="csv-jobs-tray-meta">
                        <Badge color="blue" size="sm" type="color">
                          {job.operation}
                        </Badge>
                        <span className="csv-jobs-tray-entity">
                          {job.entityType}
                        </span>
                        <span className="csv-jobs-tray-status">
                          {job.status}
                        </span>
                      </div>
                      {isActive && (
                        <Button
                          color="secondary-destructive"
                          iconLeading={StopCircle}
                          isLoading={cancellingJobId === job.jobId}
                          size="xs"
                          onPress={() => handleCancel(job.jobId)}>
                          {t('label.cancel')}
                        </Button>
                      )}
                    </div>
                    <p className="csv-jobs-tray-message">
                      {total > 0
                        ? `${progress} / ${total} - ${percent}%`
                        : job.message ?? job.error ?? job.targetFqn}
                    </p>
                    {isActive && (
                      <div className="csv-jobs-tray-progress">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!open && (
        <div className="csv-jobs-tray-button-wrap">
          {activeJobs.length > 0 && (
            <span className="csv-jobs-tray-count">{activeJobs.length}</span>
          )}
          <Button
            className="csv-jobs-tray-button"
            color="secondary"
            iconLeading={Clock}
            onPress={() => setOpen(true)}>
            {t('label.csv-job-plural')}
          </Button>
        </div>
      )}
    </div>
  );
};
