/*
 *  Copyright 2023 Collate.
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
import { PipelineType as WorkflowType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import databaseMetadataPipeline from 'jsons/ingestionSchemas/databaseServiceMetadataPipeline.json';
import databaseProfilerPipeline from 'jsons/ingestionSchemas/databaseServiceProfilerPipeline.json';
import databaseLineagePipeline from 'jsons/ingestionSchemas/databaseServiceQueryLineagePipeline.json';
import databaseUsagePipeline from 'jsons/ingestionSchemas/databaseServiceQueryUsagePipeline.json';
import dbtPipeline from 'jsons/ingestionSchemas/dbtPipeline.json';

/**
 * @todo add logic to return schema for metadata type for different service
 * @param workflowType ingestion workflow type
 * @returns schema
 */
export const getSchemaByWorkflowType = (workflowType: WorkflowType) => {
  let schema = {};

  switch (workflowType) {
    case WorkflowType.Metadata:
      schema = {
        ...databaseMetadataPipeline,
      };

      break;
    case WorkflowType.Profiler:
      schema = {
        ...databaseProfilerPipeline,
      };

      break;
    case WorkflowType.Usage:
      schema = {
        ...databaseUsagePipeline,
      };

      break;
    case WorkflowType.Lineage:
      schema = {
        ...databaseLineagePipeline,
      };

      break;
    case WorkflowType.Dbt:
      schema = {
        ...dbtPipeline,
      };

      break;

    default:
      schema = {};

      break;
  }

  return schema;
};
