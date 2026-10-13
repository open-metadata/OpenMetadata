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

// Reading a pipeline's log text is needed by the log-streaming hooks as well as
// the agents UI, so it lives in utils rather than under components.
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionPipelineLogByIdInterface } from '../interface/IngestionPipelineLogs.interface';

const PIPELINE_TYPE_TO_LOG_TASK_FIELD: Record<
  PipelineType,
  keyof IngestionPipelineLogByIdInterface
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
  [PipelineType.AutoClassification]: 'auto_classification_task',
  [PipelineType.PolicyAgent]: 'ingestion_task',
};

export const getLogTaskFieldForType = (
  log: IngestionPipelineLogByIdInterface,
  pipelineType: PipelineType
): string => {
  // A by-fqn fetch returns the logs under a generic `logs` key; prefer it, else the *_task field.
  if (log.logs) {
    return log.logs;
  }
  const fieldKey =
    PIPELINE_TYPE_TO_LOG_TASK_FIELD[pipelineType] ?? 'ingestion_task';

  return log[fieldKey] ?? '';
};
