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

import i18next from 'i18next';

export const addServiceGuide = [
  {
    step: 1,
    title: i18next.t('label.add-a-new-service'),
    description: i18next.t('message.add-new-service-description'),
  },
  {
    step: 2,
    title: i18next.t('label.configure-a-service'),
    description: i18next.t('message.configure-a-service-description'),
  },
  {
    step: 3,
    title: i18next.t('label.connection-details'),
    description: i18next.t('message.connection-details-description'),
  },
  {
    step: 5,
    title: i18next.t('label.service-created-successfully'),
    description: i18next.t('message.service-created-entity-description', {
      entity: i18next.t('message.you-can-also-set-up-the-metadata-ingestion'),
    }),
  },
];

export const addServiceGuideWOAirflow = {
  title: i18next.t('label.service-created-successfully'),
  description: i18next.t('message.service-created-entity-description', {
    entity: i18next.t(
      'message.ensure-airflow-set-up-correctly-before-heading-to-ingest-metadata'
    ),
  }),
};

const schedulingIngestionGuide = {
  step: 4,
  title: i18next.t('label.schedule-for-ingestion'),
  description: i18next.t('message.schedule-for-ingestion-description'),
};

export const addMetadataIngestionGuide = [
  {
    step: 1,
    title: i18next.t('label.add-entity', {
      entity: i18next.t('label.metadata-ingestion'),
    }),
    description: i18next.t('message.metadata-ingestion-description'),
  },
  {
    step: 2,
    title: i18next.t('label.configure-dbt-model'),
    description: i18next.t('message.configure-dbt-model-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18next.t('label.entity-ingestion-added-successfully', {
      entity: i18next.t('label.metadata'),
    }),
    description: i18next.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18next.t('label.metadata-lowercase'),
      }
    ),
  },
];

export const addUsageIngestionGuide = [
  {
    step: 1,
    title: i18next.t('label.add-entity', {
      entity: i18next.t('label.usage-ingestion'),
    }),
    description: i18next.t('message.usage-ingestion-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18next.t('label.entity-ingestion-added-successfully', {
      entity: i18next.t('label.usage'),
    }),
    description: i18next.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18next.t('label.usage-lowercase'),
      }
    ),
  },
];

export const addLineageIngestionGuide = [
  {
    step: 1,
    title: i18next.t('label.add-entity', {
      entity: i18next.t('label.lineage-ingestion'),
    }),
    description: i18next.t('message.lineage-ingestion-description'),
  },
  {
    ...schedulingIngestionGuide,
  },
  {
    step: 5,
    title: i18next.t('label.entity-ingestion-added-successfully', {
      entity: i18next.t('label.lineage'),
    }),
    description: i18next.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18next.t('label.lineage-lowercase'),
      }
    ),
  },
];

export const addProfilerIngestionGuide = [
  {
    step: 1,
    title: i18next.t('label.add-entity', {
      entity: i18next.t('label.profiler-ingestion'),
    }),
    description: i18next.t('message.profiler-ingestion-description'),
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: i18next.t('label.entity-ingestion-added-successfully', {
      entity: i18next.t('label.profiler'),
    }),
    description: i18next.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18next.t('label.profiler-lowercase'),
      }
    ),
  },
];

export const addDBTIngestionGuide = [
  {
    step: 2,
    title: i18next.t('label.add-entity', {
      entity: i18next.t('label.dbt-ingestion'),
    }),
    description: i18next.t('message.dbt-ingestion-description'),
  },
  { ...schedulingIngestionGuide },
  {
    step: 5,
    title: i18next.t('label.entity-ingestion-added-successfully', {
      entity: i18next.t('label.dbt-uppercase'),
    }),
    description: i18next.t(
      'message.ingestion-pipeline-name-successfully-deployed-entity',
      {
        entity: i18next.t('label.profiler-lowercase'),
      }
    ),
  },
];
