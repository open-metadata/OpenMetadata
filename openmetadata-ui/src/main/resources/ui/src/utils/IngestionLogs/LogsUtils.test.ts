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
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useDownloadProgressStore } from '../../hooks/useDownloadProgressStore';
import { IngestionPipelineLogByIdInterface } from '../../pages/LogsViewerPage/LogsViewerPage.interfaces';
import {
  downloadIngestionPipelineLogsById,
  getIngestionPipelineLogById,
} from '../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../ToastUtils';
import {
  downloadIngestionLog,
  fetchLogsRecursively,
  getLogsFromResponse,
} from './LogsUtils';

const mockUpdateProgress = jest.fn();

jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineLogById: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        ingestion_task: 'metadata_logs_1',
        total: '100',
        after: '50',
      },
    })
  ),
  downloadIngestionPipelineLogsById: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: 'downloaded_logs',
    })
  ),
}));

jest.mock('../ToastUtils');
jest.mock('../../hooks/useDownloadProgressStore');
jest.mock('../../hooks/useDownloadProgressStore', () => ({
  useDownloadProgressStore: {
    getState: jest.fn().mockImplementation(() => ({
      updateProgress: mockUpdateProgress,
    })),
  },
}));

import * as utils from './LogsUtils';

describe('LogsUtils', () => {
  describe('getLogsFromResponse', () => {
    it('should return the correct logs based on the pipeline type', () => {
      const res: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs',
        application_task: 'application_logs',
        profiler_task: 'profiler_logs',
        usage_task: 'usage_logs',
        lineage_task: 'lineage_logs',
        dbt_task: 'dbt_logs',
        test_suite_task: 'test_suite_logs',
        data_insight_task: 'data_insight_logs',
        elasticsearch_reindex_task: 'elasticsearch_reindex_logs',
      };

      expect(getLogsFromResponse(res, PipelineType.Metadata)).toBe(
        'metadata_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.Application)).toBe(
        'application_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.Profiler)).toBe(
        'profiler_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.Usage)).toBe('usage_logs');
      expect(getLogsFromResponse(res, PipelineType.Lineage)).toBe(
        'lineage_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.Dbt)).toBe('dbt_logs');
      expect(getLogsFromResponse(res, PipelineType.TestSuite)).toBe(
        'test_suite_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.DataInsight)).toBe(
        'data_insight_logs'
      );
      expect(getLogsFromResponse(res, PipelineType.ElasticSearchReindex)).toBe(
        'elasticsearch_reindex_logs'
      );
      expect(getLogsFromResponse(res, 'unknown_pipeline')).toBe('');
    });
  });

  describe('fetchLogsRecursively', () => {
    let mockGetLogsFromResponse: jest.SpyInstance;

    beforeAll(() => {
      mockGetLogsFromResponse = jest.spyOn(utils, 'getLogsFromResponse');
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    const ingestionId = '123';
    const pipelineType = PipelineType.Metadata;
    const after = '456';

    it('should fetch logs recursively and return the concatenated logs', async () => {
      const total = '100';
      const afterCursor = '50';
      const rest: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs_1',
      };

      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: { total, after: afterCursor, ...rest },
      });

      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: { total, after: null, ...rest },
      });

      const logs = await fetchLogsRecursively(ingestionId, pipelineType, after);

      expect(getIngestionPipelineLogById).toHaveBeenCalledTimes(2);
      expect(getIngestionPipelineLogById).toHaveBeenCalledWith(
        ingestionId,
        after
      );
      expect(mockGetLogsFromResponse).toHaveBeenCalledWith(rest, pipelineType);
      expect(logs).toBe('metadata_logs_1metadata_logs_1');
    });

    it('should update the download progress when afterCursor and total are available', async () => {
      const total = '100';
      const afterCursor = '50';
      const rest: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs_1',
      };

      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: { total, after: afterCursor, ...rest },
      });

      (getIngestionPipelineLogById as jest.Mock).mockResolvedValueOnce({
        data: { total, after: null, ...rest },
      });

      await fetchLogsRecursively(ingestionId, pipelineType, after);

      expect(
        useDownloadProgressStore.getState().updateProgress
      ).toHaveBeenCalledWith(50);
    });
  });

  describe('downloadIngestionLog', () => {
    const ingestionId = '123';

    it('should return the downloaded logs', async () => {
      const result = await downloadIngestionLog(ingestionId);

      expect(downloadIngestionPipelineLogsById).toHaveBeenCalledWith(
        ingestionId
      );
      expect(result).toBe('downloaded_logs');
    });

    it('should show error toast and return empty string if an error occurs', async () => {
      const error = new Error('Failed to fetch logs');
      (downloadIngestionPipelineLogsById as jest.Mock).mockRejectedValueOnce(
        error
      );

      const result = await downloadIngestionLog(ingestionId);

      expect(downloadIngestionPipelineLogsById).toHaveBeenCalledWith(
        ingestionId
      );
      expect(showErrorToast).toHaveBeenCalledWith(error);
      expect(result).toBe('');
    });

    it('should return empty string if ingestionId or pipelineType is not provided', async () => {
      const result = await downloadIngestionLog(undefined);

      expect(downloadIngestionPipelineLogsById).not.toHaveBeenCalled();
      expect(result).toBe('');
    });
  });
});
