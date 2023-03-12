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

import i18n from 'utils/i18next/LocalUtil';

export const addServiceGuide = [
  {
    step: 1,
    title: i18n.t('label.add-a-new-service'),
    description: i18n.t('message.add-new-service-description'),
  },
  {
    step: 2,
    title: i18n.t('label.configure-a-service'),
    description: i18n.t('message.configure-a-service-description'),
  },
  {
    step: 3,
    title: i18n.t('label.connection-details'),
    description: i18n.t('message.connection-details-description'),
  },
  {
    step: 5,
    title: i18n.t('label.service-created-successfully'),
    description: i18n.t('message.service-created-entity-description', {
      entity: i18n.t('message.you-can-also-set-up-the-metadata-ingestion'),
    }),
  },
];

export const addServiceGuideWOAirflow = {
  title: i18n.t('label.service-created-successfully'),
  description: i18n.t('message.service-created-entity-description', {
    entity: i18n.t(
      'message.ensure-airflow-set-up-correctly-before-heading-to-ingest-metadata'
    ),
  }),
};

const schedulingIngestionGuide = {
  step: 4,
  title: i18n.t('label.schedule-for-ingestion'),
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
