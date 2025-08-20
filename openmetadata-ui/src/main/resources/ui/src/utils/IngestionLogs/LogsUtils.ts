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
import { IngestionPipelineLogByIdInterface } from '../../pages/LogsViewerPage/LogsViewerPage.interfaces';
import { getApplicationLogs } from '../../rest/applicationAPI';
import {
  downloadIngestionPipelineLogsById,
  getIngestionPipelineLogById,
} from '../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../ToastUtils';

export const getLogsFromResponse = (
  res: IngestionPipelineLogByIdInterface,
  pipelineType: string
) => {
  switch (pipelineType) {
    case PipelineType.Metadata:
      return res.ingestion_task || '';

    case PipelineType.Application:
      return res.application_task || '';

    case PipelineType.Profiler:
      return res.profiler_task || '';

    case PipelineType.Usage:
      return res.usage_task || '';

    case PipelineType.Lineage:
      return res.lineage_task || '';

    case PipelineType.Dbt:
      return res.dbt_task || '';

    case PipelineType.TestSuite:
      return res.test_suite_task || '';

    case PipelineType.DataInsight:
      return res.data_insight_task || '';

    case PipelineType.ElasticSearchReindex:
      return res.elasticsearch_reindex_task || '';

    default:
      return '';
  }
};

export const fetchLogsRecursively = async (
  ingestionId: string,
  pipelineType: string,
  after?: string
) => {
  let logs = '';

  const {
    data: { total, after: afterCursor, ...rest },
  } =
    pipelineType === PipelineType.Application
      ? await getApplicationLogs(ingestionId, after)
      : await getIngestionPipelineLogById(ingestionId, after);
  logs = logs.concat(getLogsFromResponse(rest, pipelineType));
  if (afterCursor && total) {
    const progress = round((Number(afterCursor) * 100) / Number(total));
    useDownloadProgressStore.getState().updateProgress(progress);

    logs = logs.concat(
      await fetchLogsRecursively(ingestionId, pipelineType, afterCursor)
    );
  }

  return logs;
};

export const downloadIngestionLog = async (
  ingestionId?: string,
  pipelineType?: PipelineType
) => {
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

export const downloadAppLogs = async (appName?: string) => {
  if (!appName) {
    return '';
  }

  try {
    return await fetchLogsRecursively(appName, PipelineType.Application);
  } catch (err) {
    showErrorToast(err as AxiosError);

    return '';
  }
};
