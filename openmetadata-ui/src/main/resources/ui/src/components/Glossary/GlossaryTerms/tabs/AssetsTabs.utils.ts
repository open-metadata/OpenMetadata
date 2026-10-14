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
import { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  TWO_MINUTE_IN_MILLISECOND,
} from '../../../../constants/constants';
import {
  BulkOperationResult,
  Status,
} from '../../../../generated/type/bulkOperationResult';
import { t } from '../../../../utils/i18next/LocalUtil';
import { showErrorToast, showInfoToast } from '../../../../utils/ToastUtils';
import { CSVExportWebsocketResponse } from '../../../Entity/EntityExportModalProvider/EntityExportModalProvider.interface';

export type BulkAssetsJobOutcome = Pick<
  CSVExportWebsocketResponse,
  'jobId' | 'status'
> & {
  error?: string | null;
  result?: BulkOperationResult;
};

/** The tag Assets tab runs as a background job: its response carries the job id. */
export const isBulkAssetsJob = (
  response: unknown
): response is { jobId: string } =>
  typeof (response as { jobId?: unknown } | undefined)?.jobId === 'string';

/** The reason the first refused asset gives, or undefined when every asset went through. */
export const failureOf = (result?: BulkOperationResult): string | undefined =>
  result === undefined || result.status === Status.Success
    ? undefined
    : result.failedRequest?.[0]?.message;

/** The reason a finished job gives for an asset it left as it was, or undefined. */
export const jobFailureOf = (
  outcome?: BulkAssetsJobOutcome
): string | undefined =>
  outcome?.status === 'FAILED'
    ? outcome.error ?? undefined
    : failureOf(outcome?.result);

/**
 * Collects the outcomes of bulk assets jobs from the moment it is created, so a job that finishes
 * before its id is known is not missed. Stop it once the outcome is in.
 */
export const listenForBulkAssetsJobs = (
  socket?: Socket,
  waitMs = TWO_MINUTE_IN_MILLISECOND
) => {
  const finished = new Map<string, BulkAssetsJobOutcome>();
  const waiting = new Map<string, (outcome: BulkAssetsJobOutcome) => void>();
  const onActivity = (message?: string) => {
    if (!message) {
      return;
    }
    const outcome = JSON.parse(message) as BulkAssetsJobOutcome;
    if (outcome.status !== 'COMPLETED' && outcome.status !== 'FAILED') {
      return;
    }
    const resolve = waiting.get(outcome.jobId);
    if (resolve) {
      waiting.delete(outcome.jobId);
      resolve(outcome);
    } else {
      finished.set(outcome.jobId, outcome);
    }
  };
  socket?.on(SOCKET_EVENTS.BULK_ASSETS_CHANNEL, onActivity);

  return {
    outcomeOf: (jobId: string) =>
      new Promise<BulkAssetsJobOutcome | undefined>((resolve) => {
        const early = finished.get(jobId);
        if (early || !socket?.connected) {
          resolve(early);

          return;
        }
        const timer = setTimeout(() => {
          waiting.delete(jobId);
          resolve(undefined);
        }, waitMs);
        waiting.set(jobId, (outcome) => {
          clearTimeout(timer);
          resolve(outcome);
        });
      }),
    stop: () => {
      socket?.off(SOCKET_EVENTS.BULK_ASSETS_CHANNEL, onActivity);
    },
  };
};

const showFailure = (failure?: string) => {
  if (failure) {
    showErrorToast(failure);
  }
};

/**
 * Runs an Assets tab removal and tells the user about any asset the server refused. A refused
 * asset comes back as a failed row, or on the tag tab in the job's outcome, not as an error, so
 * without this the removal looks done while the asset stays. When a job's outcome does not
 * arrive, the user is asked to refresh, since the tab cannot tell whether an asset was refused.
 */
export const removeAndReportRefusals = async (
  remove: () => Promise<unknown>,
  socket?: Socket
) => {
  const jobs = listenForBulkAssetsJobs(socket);
  try {
    const response = await remove();
    if (isBulkAssetsJob(response)) {
      const outcome = await jobs.outcomeOf(response.jobId);
      if (outcome) {
        showFailure(jobFailureOf(outcome));
      } else {
        showInfoToast(t('message.please-refresh-the-page'));
      }
    } else {
      showFailure(failureOf(response as BulkOperationResult));
    }
  } finally {
    jobs.stop();
  }
};
