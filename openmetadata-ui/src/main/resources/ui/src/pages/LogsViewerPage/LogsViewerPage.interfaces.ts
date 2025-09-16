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

export interface IngestionPipelineLogByIdInterface {
  application_task?: string;
  ingestion_task?: string;
  profiler_task?: string;
  usage_task?: string;
  lineage_task?: string;
  test_suite_task?: string;
  data_insight_task?: string;
  dbt_task?: string;
  elasticsearch_reindex_task?: string;
  auto_classification_task?: string;
  total?: string;
  after?: string;
}

export type LogViewerParams = {
  logEntityType: string;
  fqn: string;
};
