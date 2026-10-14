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
  BulkOperationResult,
  Status,
} from '../../../../generated/type/bulkOperationResult';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  failureOf,
  isBulkAssetsJob,
  jobFailureOf,
  listenForBulkAssetsJobs,
  removeAndReportRefusals,
} from './AssetsTabs.utils';

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const refused: BulkOperationResult = {
  status: Status.PartialSuccess,
  numberOfRowsProcessed: 2,
  numberOfRowsPassed: 1,
  numberOfRowsFailed: 1,
  failedRequest: [{ message: 'not allowed to edit orders' }],
};

const passed: BulkOperationResult = {
  status: Status.Success,
  numberOfRowsProcessed: 1,
  numberOfRowsPassed: 1,
  numberOfRowsFailed: 0,
};

const fakeSocket = () => {
  let handler: ((message?: string) => void) | undefined;
  const socket = {
    connected: true,
    on: jest.fn((_channel: string, listener: (message?: string) => void) => {
      handler = listener;
    }),
    off: jest.fn(),
  };

  return {
    socket: socket as unknown as Socket,
    mock: socket,
    send: (message: object) => handler?.(JSON.stringify(message)),
  };
};

describe('AssetsTabs utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tells a job response from a bulk result', () => {
    expect(isBulkAssetsJob({ jobId: 'job-1', message: 'started' })).toBe(true);
    expect(isBulkAssetsJob(refused)).toBe(false);
    expect(isBulkAssetsJob(undefined)).toBe(false);
  });

  it('reads the reason of the first refused asset', () => {
    expect(failureOf(refused)).toBe('not allowed to edit orders');
    expect(failureOf(passed)).toBeUndefined();
    expect(failureOf(undefined)).toBeUndefined();
  });

  it('reads the reason of a refused asset or of a failed job', () => {
    expect(
      jobFailureOf({ jobId: 'job-1', status: 'COMPLETED', result: refused })
    ).toBe('not allowed to edit orders');
    expect(
      jobFailureOf({ jobId: 'job-1', status: 'FAILED', error: 'job crashed' })
    ).toBe('job crashed');
    expect(
      jobFailureOf({ jobId: 'job-1', status: 'COMPLETED', result: passed })
    ).toBeUndefined();
  });

  describe('listenForBulkAssetsJobs', () => {
    it('keeps an outcome that arrives before the job id is known', async () => {
      const { socket, send } = fakeSocket();
      const jobs = listenForBulkAssetsJobs(socket);

      send({ jobId: 'job-1', status: 'COMPLETED', result: refused });

      await expect(jobs.outcomeOf('job-1')).resolves.toEqual(
        expect.objectContaining({ jobId: 'job-1', result: refused })
      );
    });

    it('waits for the outcome of its job only', async () => {
      const { socket, send } = fakeSocket();
      const jobs = listenForBulkAssetsJobs(socket);
      const outcome = jobs.outcomeOf('job-1');

      send({ jobId: 'job-1', status: 'IN_PROGRESS' });
      send({ jobId: 'job-2', status: 'COMPLETED', result: passed });
      send({ jobId: 'job-1', status: 'FAILED', error: 'job crashed' });

      await expect(outcome).resolves.toEqual(
        expect.objectContaining({ jobId: 'job-1', status: 'FAILED' })
      );
    });

    it('gives up when no outcome arrives in time', async () => {
      jest.useFakeTimers();
      const { socket } = fakeSocket();
      const outcome = listenForBulkAssetsJobs(socket, 1000).outcomeOf('job-1');

      jest.advanceTimersByTime(1000);

      await expect(outcome).resolves.toBeUndefined();

      jest.useRealTimers();
    });

    it('does not wait on a socket that is not connected', async () => {
      const { socket, mock } = fakeSocket();
      mock.connected = false;

      await expect(
        listenForBulkAssetsJobs(socket).outcomeOf('job-1')
      ).resolves.toBeUndefined();
    });

    it('removes only its own listener when stopped', () => {
      const { socket, mock } = fakeSocket();
      const jobs = listenForBulkAssetsJobs(socket);

      jobs.stop();

      expect(mock.off).toHaveBeenCalledWith(
        'bulkAssetsChannel',
        mock.on.mock.calls[0][1]
      );
    });
  });

  describe('removeAndReportRefusals', () => {
    it('shows the reason when the server refuses an asset', async () => {
      await removeAndReportRefusals(() => Promise.resolve(refused));

      expect(showErrorToast).toHaveBeenCalledWith('not allowed to edit orders');
    });

    it('stays quiet when every asset is removed', async () => {
      await removeAndReportRefusals(() => Promise.resolve(passed));

      expect(showErrorToast).not.toHaveBeenCalled();
    });

    it('shows the reason a tag job gives for a refused asset', async () => {
      const { socket, mock, send } = fakeSocket();

      await removeAndReportRefusals(async () => {
        send({ jobId: 'job-1', status: 'COMPLETED', result: refused });

        return { jobId: 'job-1', message: 'started' };
      }, socket);

      expect(showErrorToast).toHaveBeenCalledWith('not allowed to edit orders');
      expect(mock.off).toHaveBeenCalled();
    });

    it('stops listening when the removal fails', async () => {
      const { socket, mock } = fakeSocket();

      await expect(
        removeAndReportRefusals(() => Promise.reject(new Error('down')), socket)
      ).rejects.toThrow('down');

      expect(mock.off).toHaveBeenCalled();
      expect(showErrorToast).not.toHaveBeenCalled();
    });
  });
});
