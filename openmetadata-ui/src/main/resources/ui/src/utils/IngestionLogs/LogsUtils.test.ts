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
import { getIngestionPipelineLogById } from '../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../ToastUtils';

jest.mock('../../rest/ingestionPipelineAPI');
jest.mock('../ToastUtils');
jest.mock('../../hooks/useDownloadProgressStore');

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
    const ingestionId = '123';
    const pipelineType = PipelineType.Metadata;
    const after = '456';

    it('should fetch logs recursively and return the concatenated logs', async () => {
      const total = '100';
      const afterCursor = '50';
      const rest: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs_1',
      };

      getIngestionPipelineLogById.mockResolvedValueOnce({
        data: { total, after: afterCursor, ...rest },
      });

      getIngestionPipelineLogById.mockResolvedValueOnce({
        data: { total, after: null, ...rest },
      });

      const logs = await fetchLogsRecursively(ingestionId, pipelineType, after);

      expect(getIngestionPipelineLogById).toHaveBeenCalledTimes(2);
      expect(getIngestionPipelineLogById).toHaveBeenCalledWith(
        ingestionId,
        after
      );
      expect(getLogsFromResponse).toHaveBeenCalledWith(rest, pipelineType);
      expect(logs).toBe('metadata_logs_1metadata_logs_1');
    });

    it('should update the download progress when afterCursor and total are available', async () => {
      const total = '100';
      const afterCursor = '50';
      const rest: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs_1',
      };

      getIngestionPipelineLogById.mockResolvedValueOnce({
        data: { total, after: afterCursor, ...rest },
      });

      getIngestionPipelineLogById.mockResolvedValueOnce({
        data: { total, after: null, ...rest },
      });

      await fetchLogsRecursively(ingestionId, pipelineType, after);

      expect(
        useDownloadProgressStore.getState().updateProgress
      ).toHaveBeenCalledWith(50);
    });

    it('should return empty string if afterCursor is null', async () => {
      const total = '100';
      const afterCursor = null;
      const rest: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata_logs_1',
      };

      getIngestionPipelineLogById.mockResolvedValueOnce({
        data: { total, after: afterCursor, ...rest },
      });

      const logs = await fetchLogsRecursively(ingestionId, pipelineType, after);

      expect(logs).toBe('');
    });
  });

  describe('downloadIngestionLog', () => {
    const ingestionId = '123';
    const pipelineType = PipelineType.Metadata;

    it('should return the downloaded logs', async () => {
      const logs = 'metadata_logs';

      fetchLogsRecursively.mockResolvedValueOnce(logs);

      const result = await downloadIngestionLog(ingestionId, pipelineType);

      expect(fetchLogsRecursively).toHaveBeenCalledWith(
        ingestionId,
        pipelineType
      );
      expect(result).toBe(logs);
    });

    it('should show error toast and return empty string if an error occurs', async () => {
      const error = new Error('Failed to fetch logs');

      fetchLogsRecursively.mockRejectedValueOnce(error);

      const result = await downloadIngestionLog(ingestionId, pipelineType);

      expect(fetchLogsRecursively).toHaveBeenCalledWith(
        ingestionId,
        pipelineType
      );
      expect(showErrorToast).toHaveBeenCalledWith(error);
      expect(result).toBe('');
    });

    it('should return empty string if ingestionId or pipelineType is not provided', async () => {
      const result = await downloadIngestionLog(undefined, pipelineType);

      expect(fetchLogsRecursively).not.toHaveBeenCalled();
      expect(result).toBe('');

      const result2 = await downloadIngestionLog(ingestionId, undefined);

      expect(fetchLogsRecursively).not.toHaveBeenCalled();
      expect(result2).toBe('');
    });
  });
});

function getLogsFromResponse(
  res: IngestionPipelineLogByIdInterface,
  Metadata: PipelineType
): any {
  throw new Error('Function not implemented.');
}

function fetchLogsRecursively(
  ingestionId: string,
  pipelineType: PipelineType,
  after: string
) {
  throw new Error('Function not implemented.');
}

function downloadIngestionLog(ingestionId: string, pipelineType: PipelineType) {
  throw new Error('Function not implemented.');
}
