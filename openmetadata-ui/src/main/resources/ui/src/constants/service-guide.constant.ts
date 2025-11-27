/*
 *  Copyright 2022 Collate.
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

const schedulingIngestionGuide = {
  step: 4,
  title: 'label.schedule-for-entity',
  titleData: { entity: 'label.ingestion' },
  description: 'message.schedule-for-ingestion-description',
};

export const addMetadataIngestionGuide = [
  {
    step: 1,
    title: 'label.add-entity',
    titleData: { entity: 'label.metadata-ingestion' },
    description: 'message.metadata-ingestion-description',
  },
  {
    step: 2,
    title: 'label.configure-dbt-model',
    description: 'message.configure-dbt-model-description',
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'message.entity-ingestion-added-successfully',
    titleData: { entity: 'label.metadata' },
    description: 'message.ingestion-pipeline-name-successfully-deployed-entity',
    descriptionData: { entity: 'label.metadata-lowercase' },
  },
];

export const addUsageIngestionGuide = [
  {
    step: 1,
    title: 'label.add-entity',
    titleData: { entity: 'label.usage-ingestion' },
    description: 'message.usage-ingestion-description',
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'message.entity-ingestion-added-successfully',
    titleData: { entity: 'label.usage' },
    description: 'message.ingestion-pipeline-name-successfully-deployed-entity',
    descriptionData: { entity: 'label.usage-lowercase' },
  },
];

export const addLineageIngestionGuide = [
  {
    step: 1,
    title: 'label.add-entity',
    titleData: { entity: 'label.lineage-ingestion' },
    description: 'message.lineage-ingestion-description',
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: 'message.entity-ingestion-added-successfully',
    titleData: { entity: 'label.lineage' },
    description: 'message.ingestion-pipeline-name-successfully-deployed-entity',
    descriptionData: { entity: 'label.lineage-lowercase' },
  },
];

export const addProfilerIngestionGuide = [
  {
    step: 1,
    title: 'label.add-entity',
    titleData: { entity: 'label.profiler-ingestion' },
    description: 'message.profiler-ingestion-description',
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: 'message.entity-ingestion-added-successfully',
    titleData: { entity: 'label.profiler' },
    description: 'message.ingestion-pipeline-name-successfully-deployed-entity',
    descriptionData: { entity: 'label.profiler-lowercase' },
  },
];

export const addDBTIngestionGuide = [
  {
    step: 2,
    title: 'label.add-entity',
    titleData: { entity: 'label.dbt-ingestion' },
    description: 'message.dbt-ingestion-description',
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: 'message.entity-ingestion-added-successfully',
    titleData: { entity: 'label.dbt-lowercase' },
    description: 'message.ingestion-pipeline-name-successfully-deployed-entity',
    descriptionData: { entity: 'label.profiler-lowercase' },
  },
];

export const EMAIL_CONFIG_SERVICE_CATEGORY = 'EmailConfiguration';
export const CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY = 'CustomLoginConfiguration';
export const OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY =
  'OpenMetadataUrlConfiguration';
export const CUSTOM_PROPERTY_CATEGORY = 'CustomProperty';
export const OPEN_METADATA = 'OpenMetadata';
export const TEST_CASE_FORM = 'TestCaseForm';
