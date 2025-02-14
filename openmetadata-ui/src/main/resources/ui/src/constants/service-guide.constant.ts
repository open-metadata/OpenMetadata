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

import i18n from '../utils/i18next/LocalUtil';

const schedulingIngestionGuide = {
  step: 4,
  title: i18n.t('label.schedule-for-entity', {
    entity: i18n.t('label.ingestion'),
  }),
  description: i18n.t('message.schedule-for-ingestion-description'),
};

export const addMetadataIngestionGuide = [
  {
    step: 1,
    title: i18n.t('label.add-entity', {
      entity: i18n.t('label.metadata-ingestion'),
    }),
    description: i18n.t('message.metadata-ingestion-description'),
  },
  {
    step: 2,
    title: i18n.t('label.configure-dbt-model'),
    description: i18n.t('message.configure-dbt-model-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18n.t('message.entity-ingestion-added-successfully', {
      entity: i18n.t('label.metadata'),
    }),
    description: i18n.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18n.t('label.metadata-lowercase'),
      }
    ),
  },
];

export const addUsageIngestionGuide = [
  {
    step: 1,
    title: i18n.t('label.add-entity', {
      entity: i18n.t('label.usage-ingestion'),
    }),
    description: i18n.t('message.usage-ingestion-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18n.t('message.entity-ingestion-added-successfully', {
      entity: i18n.t('label.usage'),
    }),
    description: i18n.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18n.t('label.usage-lowercase'),
      }
    ),
  },
];

export const addLineageIngestionGuide = [
  {
    step: 1,
    title: i18n.t('label.add-entity', {
      entity: i18n.t('label.lineage-ingestion'),
    }),
    description: i18n.t('message.lineage-ingestion-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18n.t('message.entity-ingestion-added-successfully', {
      entity: i18n.t('label.lineage'),
    }),
    description: i18n.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18n.t('label.lineage-lowercase'),
      }
    ),
  },
];

export const addProfilerIngestionGuide = [
  {
    step: 1,
    title: i18n.t('label.add-entity', {
      entity: i18n.t('label.profiler-ingestion'),
    }),
    description: i18n.t('message.profiler-ingestion-description'),
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: i18n.t('message.entity-ingestion-added-successfully', {
      entity: i18n.t('label.profiler'),
    }),
    description: i18n.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18n.t('label.profiler-lowercase'),
      }
    ),
  },
];

export const addDBTIngestionGuide = [
  {
    step: 2,
    title: i18n.t('label.add-entity', {
      entity: i18n.t('label.dbt-ingestion'),
    }),
    description: i18n.t('message.dbt-ingestion-description'),
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: i18n.t('message.entity-ingestion-added-successfully', {
      entity: i18n.t('label.dbt-lowercase'),
    }),
    description: i18n.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18n.t('label.profiler-lowercase'),
      }
    ),
  },
];

export const EMAIL_CONFIG_SERVICE_CATEGORY = 'EmailConfiguration';
export const CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY = 'CustomLoginConfiguration';
export const OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY =
  'OpenMetadataUrlConfiguration';
export const CUSTOM_PROPERTY_CATEGORY = 'CustomProperty';
export const OPEN_METADATA = 'OpenMetadata';
