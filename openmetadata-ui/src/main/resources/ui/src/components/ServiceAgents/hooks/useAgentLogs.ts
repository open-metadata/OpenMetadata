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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionPipelineLogById } from '../../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
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
 * Streams the raw logs for a pipeline run via `getIngestionPipelineLogById`,
 * picking the task field for the pipeline type and paginating through the
 * `after`/`total` cursor. Parses the accumulated text into LogLine[].
 */
export const useAgentLogs = (
  id: string,
  pipelineType: PipelineType,
  enabled: boolean
): UseAgentLogsResult => {
  const [rawText, setRawText] = useState('');
  const [after, setAfter] = useState<string | undefined>();
  const [total, setTotal] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(
    (cursor?: string) => {
      setIsLoading(true);
      getIngestionPipelineLogById(id, cursor)
        .then((res) => {
          const chunk = getLogTaskFieldForType(res.data, pipelineType);
          setRawText((prev) => (cursor ? prev + chunk : chunk));
          setAfter(res.data.after);
          setTotal(res.data.total);
        })
        .catch((err) => showErrorToast(err as AxiosError))
        .finally(() => setIsLoading(false));
    },
    [id, pipelineType]
  );

  useEffect(() => {
    if (!enabled || !id) {
      return;
    }
    setRawText('');
    setAfter(undefined);
    setTotal(undefined);
    fetchLogs();
  }, [id, enabled, fetchLogs]);

  const lines = useMemo(() => parseLogLines(rawText), [rawText]);
  const hasMore =
    after !== undefined && total !== undefined && Number(after) < Number(total);
  const loadMore = useCallback(() => {
    if (hasMore) {
      fetchLogs(after);
    }
  }, [hasMore, after, fetchLogs]);

  return { lines, rawText, isLoading, hasMore, loadMore };
};
