/*
 *  Copyright 2025 Collate.
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

import { useCallback, useMemo } from 'react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { usePaginatedLiveLog } from '../../../hooks/usePaginatedLiveLog';
import { getIngestionPipelineLogById } from '../../../rest/ingestionPipelineAPI';
import { LogLine } from '../AgentsPage.interface';
import {
  getLogTaskFieldForType,
  parseLogLines,
} from '../utils/agentsDataMapper';

interface UseAgentLogsResult {
  lines: LogLine[];
  rawText: string;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Reads the raw logs for a pipeline run via `getIngestionPipelineLogById`,
 * picking the task field for the pipeline type. Delegates cursor pagination
 * (infinite scroll) + tail polling to `usePaginatedLiveLog`; polls the tail
 * only while `isActive`. Parses the accumulated text into LogLine[].
 */
export const useAgentLogs = (
  id: string,
  pipelineType: PipelineType,
  enabled: boolean,
  isActive = false
): UseAgentLogsResult => {
  const fetchPage = useCallback(
    (cursor?: string) =>
      getIngestionPipelineLogById(id, cursor).then((res) => ({
        content: getLogTaskFieldForType(res.data, pipelineType),
        after: res.data.after,
        total: res.data.total,
      })),
    [id, pipelineType]
  );

  const { logs, hasMore, loading, loadMore } = usePaginatedLiveLog({
    fetchPage,
    resetKey: id,
    enabled: Boolean(enabled && id),
    isLive: isActive,
  });

  const lines = useMemo(() => parseLogLines(logs), [logs]);

  return { lines, rawText: logs, isLoading: loading, hasMore, loadMore };
};
