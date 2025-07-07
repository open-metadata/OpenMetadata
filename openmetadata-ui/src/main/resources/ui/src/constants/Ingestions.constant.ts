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
import { StepperStepType } from 'Models';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';

const { t } = i18next;

export const STEPS_FOR_ADD_INGESTION: Array<StepperStepType> = [
  {
    name: t('label.configure-entity', {
      entity: t('label.ingestion'),
    }),
    step: 1,
  },
  { name: t('label.schedule-interval'), step: 2 },
];

export const INGESTION_ACTION_TYPE = {
  ADD: 'add',
  EDIT: 'edit',
};

export const PIPELINE_TYPE_LOCALIZATION = {
  [PipelineType.DataInsight]: 'data-insight',
  [PipelineType.AutoClassification]: 'auto-classification',
  [PipelineType.Dbt]: 'dbt-lowercase',
  [PipelineType.ElasticSearchReindex]: 'elastic-search-re-index',
  [PipelineType.Lineage]: 'lineage',
  [PipelineType.Metadata]: 'metadata',
  [PipelineType.Profiler]: 'profiler',
  [PipelineType.TestSuite]: 'test-suite',
  [PipelineType.Usage]: 'usage',
  [PipelineType.Application]: 'application',
};
