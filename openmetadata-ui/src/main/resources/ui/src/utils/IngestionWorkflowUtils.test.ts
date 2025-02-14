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
import { ServiceCategory } from '../enums/service.enum';
import {
  Pipeline,
  PipelineType as WorkflowType,
} from '../generated/api/services/ingestionPipelines/createIngestionPipeline';

import {
  cleanWorkFlowData,
  getMetadataSchemaByServiceCategory,
  getSchemaByWorkflowType,
} from './IngestionWorkflowUtils';

const MOCK_WORKFLOW_DATA = {
  type: 'DashboardMetadata',
  dashboardFilterPattern: {
    includes: [],
    excludes: [],
  },
  chartFilterPattern: {
    includes: [],
    excludes: [],
  },
  dataModelFilterPattern: {
    includes: [],
    excludes: [],
  },
  projectFilterPattern: {
    includes: [],
    excludes: [],
  },
  lineageInformation: {
    dbServiceNames: [],
  },
  includeOwners: false,
  markDeletedDashboards: true,
  markDeletedDataModels: true,
  includeTags: true,
  includeDataModels: true,
} as Pipeline;

const MOCK_CLEANED_WORKFLOW_DATA = {
  lineageInformation: {
    dbServiceNames: [],
  },
  includeDataModels: true,
  includeOwners: false,
  includeTags: true,
  markDeletedDashboards: true,
  markDeletedDataModels: true,
  type: 'DashboardMetadata',
};

describe('Ingestion Workflow tests', () => {
  it('should getMetadataSchemaByServiceCategory return the correct schema for each service category', () => {
    const databaseSchema = getMetadataSchemaByServiceCategory(
      ServiceCategory.DATABASE_SERVICES
    );
    const metadataSchema = getMetadataSchemaByServiceCategory(
      ServiceCategory.METADATA_SERVICES
    );
    const dashboardSchema = getMetadataSchemaByServiceCategory(
      ServiceCategory.DASHBOARD_SERVICES
    );
    const messagingSchema = getMetadataSchemaByServiceCategory(
      ServiceCategory.MESSAGING_SERVICES
    );

    expect(databaseSchema).toBeDefined();
    expect(metadataSchema).toBeDefined();
    expect(dashboardSchema).toBeDefined();
    expect(messagingSchema).toBeDefined();
  });

  it('should getMetadataSchemaByServiceCategory return an empty object for an unknown service category', () => {
    const unknownSchema = getMetadataSchemaByServiceCategory(
      'unknown-category' as ServiceCategory
    );

    expect(unknownSchema).toEqual({});
  });

  it('should getSchemaByWorkflowType return the correct schema for each workflow type', () => {
    const metadataSchema = getSchemaByWorkflowType(
      WorkflowType.Metadata,
      ServiceCategory.PIPELINE_SERVICES
    );
    const profilerSchema = getSchemaByWorkflowType(
      WorkflowType.Profiler,
      ServiceCategory.PIPELINE_SERVICES
    );
    const usageSchema = getSchemaByWorkflowType(
      WorkflowType.Usage,
      ServiceCategory.PIPELINE_SERVICES
    );
    const autoClassificationSchema = getSchemaByWorkflowType(
      WorkflowType.AutoClassification,
      ServiceCategory.DATABASE_SERVICES
    );

    expect(metadataSchema).toBeDefined();
    expect(profilerSchema).toBeDefined();
    expect(usageSchema).toBeDefined();
    expect(autoClassificationSchema).toBeDefined();
  });

  it('should getSchemaByWorkflowType return a default object with for an unknown workflow type', () => {
    const unknownSchema = getSchemaByWorkflowType(
      'unknown-type' as WorkflowType,
      ServiceCategory.PIPELINE_SERVICES
    );

    expect(unknownSchema).toHaveProperty('properties.displayName');
  });

  it('should getSchemaByWorkflowType include display Name for each schema', () => {
    const metadataSchema = getSchemaByWorkflowType(
      WorkflowType.Metadata,
      ServiceCategory.PIPELINE_SERVICES
    );

    expect(metadataSchema).toBeDefined();
    expect(metadataSchema).toHaveProperty('properties.displayName');
  });

  it('cleanWorkFlowData should remove the filter patterns if the includes and excludes are empty', () => {
    const cleanedData = cleanWorkFlowData(MOCK_WORKFLOW_DATA);

    expect(cleanedData).toStrictEqual(MOCK_CLEANED_WORKFLOW_DATA);
  });
});
