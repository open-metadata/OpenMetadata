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
import { RJSFSchema } from '@rjsf/utils';
import { cloneDeep, isEmpty } from 'lodash';
import { ServiceCategory } from '../enums/service.enum';
import {
  Pipeline,
  PipelineType as WorkflowType,
} from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionWorkflowData } from '../interface/service.interface';
import apiServiceMetadataPipeline from '../jsons/ingestionSchemas/apiServiceMetadataPipeline.json';
import dashboardMetadataPipeline from '../jsons/ingestionSchemas/dashboardServiceMetadataPipeline.json';
import databaseAutoClassificationPipeline from '../jsons/ingestionSchemas/databaseServiceAutoClassificationPipeline.json';
import databaseMetadataPipeline from '../jsons/ingestionSchemas/databaseServiceMetadataPipeline.json';
import databaseLineagePipeline from '../jsons/ingestionSchemas/databaseServiceQueryLineagePipeline.json';
import databaseUsagePipeline from '../jsons/ingestionSchemas/databaseServiceQueryUsagePipeline.json';
import dataInsightPipeline from '../jsons/ingestionSchemas/dataInsightPipeline.json';
import dbtPipeline from '../jsons/ingestionSchemas/dbtPipeline.json';
import messagingMetadataPipeline from '../jsons/ingestionSchemas/messagingServiceMetadataPipeline.json';
import metadataToElasticSearchPipeline from '../jsons/ingestionSchemas/metadataToElasticSearchPipeline.json';
import mlModelMetadataPipeline from '../jsons/ingestionSchemas/mlmodelServiceMetadataPipeline.json';
import pipelineMetadataPipeline from '../jsons/ingestionSchemas/pipelineServiceMetadataPipeline.json';
import searchMetadataPipeline from '../jsons/ingestionSchemas/searchServiceMetadataPipeline.json';
import storageMetadataPipeline from '../jsons/ingestionSchemas/storageServiceMetadataPipeline.json';
import testSuitePipeline from '../jsons/ingestionSchemas/testSuitePipeline.json';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getMetadataSchemaByServiceCategory = (
  serviceCategory: ServiceCategory
) => {
  switch (serviceCategory) {
    case ServiceCategory.METADATA_SERVICES:
    case ServiceCategory.DATABASE_SERVICES:
      return databaseMetadataPipeline;
    case ServiceCategory.API_SERVICES:
      return apiServiceMetadataPipeline;
    case ServiceCategory.DASHBOARD_SERVICES:
      return dashboardMetadataPipeline;
    case ServiceCategory.MESSAGING_SERVICES:
      return messagingMetadataPipeline;
    case ServiceCategory.ML_MODEL_SERVICES:
      return mlModelMetadataPipeline;
    case ServiceCategory.PIPELINE_SERVICES:
      return pipelineMetadataPipeline;
    case ServiceCategory.STORAGE_SERVICES:
      return storageMetadataPipeline;
    case ServiceCategory.SEARCH_SERVICES:
      return searchMetadataPipeline;

    default:
      return {};
  }
};

/**
 * @param workflowType ingestion workflow type
 * @returns schema
 */
export const getSchemaByWorkflowType = (
  workflowType: WorkflowType,
  serviceCategory: ServiceCategory
) => {
  const customProperties = {
    displayName: {
      description: 'Display Name of the workflow',
      type: 'string',
      title: 'Name',
    },
    name: {
      description: 'Name of the workflow',
      type: 'string',
    },
    enableDebugLog: {
      title: 'Enable Debug Log',
      type: 'boolean',
      default: false,
    },
  };
  let schema = {};

  switch (workflowType) {
    case WorkflowType.Metadata:
      schema = {
        ...getMetadataSchemaByServiceCategory(serviceCategory),
      };

      break;
    case WorkflowType.Profiler:
      {
        const profilerConfig = serviceUtilClassBase.getProfilerConfig();

        schema = profilerConfig.schema;
      }

      break;
    case WorkflowType.AutoClassification:
      schema = {
        ...databaseAutoClassificationPipeline,
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

    case WorkflowType.TestSuite:
      schema = {
        ...testSuitePipeline,
      };

      break;

    case WorkflowType.ElasticSearchReindex:
      schema = {
        ...metadataToElasticSearchPipeline,
      };

      break;
    case WorkflowType.DataInsight:
      schema = {
        ...dataInsightPipeline,
      };

      break;

    default:
  }

  const rjsfSchema = schema as RJSFSchema;

  return {
    ...rjsfSchema,
    properties: {
      ...rjsfSchema.properties,
      ...customProperties,
    },
    required: [...(rjsfSchema.required ?? []), 'name'],
  } as RJSFSchema;
};

/**
 *
 * @param workFlowData Pipeline
 * @returns cleaned workflow data
 */
export const cleanWorkFlowData = (workFlowData: Pipeline): Pipeline => {
  // clone the object to avoid mutation
  const cleanedWorkFlowData = cloneDeep(workFlowData);
  const keys = Object.keys(cleanedWorkFlowData);

  /**
   * Check if the object has includes and excludes and if they are empty
   * if they are empty, remove the object from the workflow data
   */
  keys.forEach((key) => {
    const value = cleanedWorkFlowData[key as keyof Pipeline];
    if (
      value &&
      typeof value === 'object' &&
      'excludes' in value &&
      'includes' in value
    ) {
      if (isEmpty(value.excludes) && isEmpty(value.includes)) {
        delete cleanedWorkFlowData[key as keyof Pipeline];
      }
    }
  });

  return cleanedWorkFlowData;
};

/**
 * Transforms profiler processing engine data to handle EntityReference format
 * @param formData - The form data containing processingEngine
 * @returns Transformed form data with properly formatted processingEngine
 */
export const transformProfilerProcessingEngine = (
  formData: IngestionWorkflowData
): IngestionWorkflowData => {
  // Force override processingEngine based on our hidden input (EntityReference format)
  const hiddenInput = document.querySelector(
    'input[name="processingEngine"]'
  ) as HTMLInputElement;
  if (hiddenInput && hiddenInput.value) {
    try {
      const engineConfig = JSON.parse(hiddenInput.value);
      // Set the EntityReference to root level processingEngine
      formData.processingEngine = engineConfig;

      // Remove processingEngine from any nested locations to ensure it only exists at root level
      // This follows the same pattern as the 'name' field
      if ((formData as any).sourceConfig?.config?.processingEngine) {
        delete (formData as any).sourceConfig.config.processingEngine;
      }

      // Also remove from any other potential nested locations
      if ((formData as any).config?.processingEngine) {
        delete (formData as any).config.processingEngine;
      }
    } catch (_error) {
      // Do nothing
    }
  }

  return formData;
};
