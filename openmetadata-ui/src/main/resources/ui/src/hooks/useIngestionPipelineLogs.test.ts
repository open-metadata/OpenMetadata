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
import { act, renderHook, waitFor } from '@testing-library/react';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
} from '../rest/ingestionPipelineAPI';
import { downloadIngestionLog } from '../utils/IngestionLogs/LogsUtils';
import { useIngestionPipelineLogs } from './useIngestionPipelineLogs';

const mockReset = jest.fn();
const mockUpdateProgress = jest.fn();

jest.mock('./useDownloadProgressStore', () => ({
  useDownloadProgressStore: () => ({
    progress: 0,
    reset: mockReset,
    updateProgress: mockUpdateProgress,
  }),
}));

jest.mock('../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineByFqn: jest.fn(),
  getIngestionPipelineLogById: jest.fn(),
}));

jest.mock('../rest/applicationAPI', () => ({
  getApplicationByName: jest.fn(),
  getExternalApplicationRuns: jest.fn(),
  getLatestApplicationRuns: jest.fn(),
}));

jest.mock('../utils/IngestionLogs/LogsUtils', () => ({
  downloadAppLogs: jest.fn(),
  downloadIngestionLog: jest.fn().mockResolvedValue(new Blob(['x'])),
}));

jest.mock('../components/ServiceAgents/utils/agentsDataMapper', () => ({
  getLogTaskFieldForType: (log: { ingestion_task?: string }) =>
    log.ingestion_task ?? '',
}));

jest.mock('../utils/EntityNameUtils', () => ({
  getEntityName: (entity?: { name?: string }) => entity?.name ?? '',
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('useIngestionPipelineLogs', () => {
  beforeAll(() => {
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads ingestion pipeline logs and derives pagination', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1\nline2', after: '2', total: '4' },
    });

    const { result } = renderHook(() =>
      useIngestionPipelineLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1\nline2'));

    expect(result.current.title).toBe('My Pipeline');
    expect(result.current.totalLines).toBe(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page when loadMore is called', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock)
      .mockResolvedValueOnce({
        data: { ingestion_task: 'line1', after: '2', total: '4' },
      })
      .mockResolvedValueOnce({
        data: { ingestion_task: 'line2', after: '4', total: '4' },
      });

    const { result } = renderHook(() =>
      useIngestionPipelineLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1'));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.logs).toBe('line1line2'));

    expect(result.current.hasMore).toBe(false);
  });

  it('loads application logs without pagination', async () => {
    (getApplicationByName as jest.Mock).mockResolvedValue({ name: 'My App' });
    (getExternalApplicationRuns as jest.Mock).mockResolvedValue({ data: [] });
    (getLatestApplicationRuns as jest.Mock).mockResolvedValue({
      data_insight_task: '',
      application_task: 'app log line',
    });

    const { result } = renderHook(() =>
      useIngestionPipelineLogs({
        logEntityType: GlobalSettingOptions.APPLICATIONS,
        fqn: 'my-app',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('app log line'));

    expect(result.current.hasMore).toBe(false);
    expect(result.current.title).toBe('My App');
  });

  it('downloads ingestion logs and resets the progress store', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1', after: '4', total: '4' },
    });

    const { result } = renderHook(() =>
      useIngestionPipelineLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1'));

    await act(async () => {
      await result.current.download();
    });

    expect(downloadIngestionLog).toHaveBeenCalledWith('pid');
    expect(mockUpdateProgress).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
  });
});
