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
import { AxiosError } from 'axios';
import { round } from 'lodash';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useDownloadProgressStore } from '../../hooks/useDownloadProgressStore';
import { IngestionPipelineLogByIdInterface } from '../../interface/IngestionPipelineLogs.interface';
import { getApplicationLogs } from '../../rest/applicationAPI';
import {
  downloadIngestionPipelineLogsById,
  getIngestionPipelineLogById,
} from '../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../ToastUtils';

const PIPELINE_LOG_FIELD: Partial<
  Record<string, keyof IngestionPipelineLogByIdInterface>
> = {
  [PipelineType.Metadata]: 'ingestion_task',
  [PipelineType.Application]: 'application_task',
  [PipelineType.Profiler]: 'profiler_task',
  [PipelineType.Usage]: 'usage_task',
  [PipelineType.Lineage]: 'lineage_task',
  [PipelineType.Dbt]: 'dbt_task',
  [PipelineType.TestSuite]: 'test_suite_task',
  [PipelineType.DataInsight]: 'data_insight_task',
  [PipelineType.ElasticSearchReindex]: 'elasticsearch_reindex_task',
};

export const getLogsFromResponse = (
  res: IngestionPipelineLogByIdInterface,
  pipelineType: string
) => {
  // A by-fqn fetch returns the logs under a generic `logs` key (no pipeline type to select a
  // *_task field); prefer it, falling back to the type-specific field for by-id responses.
  if (res.logs) {
    return res.logs;
  }

  const field = PIPELINE_LOG_FIELD[pipelineType];

  return (field && res[field]) || '';
};

export const fetchLogsRecursively = async (
  ingestionId: string,
  pipelineType: string,
  after?: string,
  runId?: string
) => {
  let logs = '';

  const {
    data: { total, after: afterCursor, ...rest },
  } =
    pipelineType === PipelineType.Application
      ? await getApplicationLogs(ingestionId, after, runId)
      : await getIngestionPipelineLogById(ingestionId, after);
  logs = logs.concat(getLogsFromResponse(rest, pipelineType));
  if (afterCursor && total) {
    const progress = round((Number(afterCursor) * 100) / Number(total));
    useDownloadProgressStore.getState().updateProgress(progress);

    logs = logs.concat(
      await fetchLogsRecursively(ingestionId, pipelineType, afterCursor, runId)
    );
  }

  return logs;
};

export const downloadIngestionLog = async (ingestionId?: string) => {
  if (!ingestionId) {
    return '';
  }

  try {
    const response = await downloadIngestionPipelineLogsById(ingestionId);

    return response.data;
  } catch (err) {
    showErrorToast(err as AxiosError);

    return '';
  }
};

export const downloadAppLogs = async (appName?: string, runId?: string) => {
  if (!appName) {
    return '';
  }

  try {
    return await fetchLogsRecursively(
      appName,
      PipelineType.Application,
      undefined,
      runId
    );
  } catch (err) {
    showErrorToast(err as AxiosError);

    return '';
  }
};
