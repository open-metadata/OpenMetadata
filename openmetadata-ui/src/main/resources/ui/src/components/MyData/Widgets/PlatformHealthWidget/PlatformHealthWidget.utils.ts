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

import type { TFunction } from 'i18next';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import type { FailingService } from './useIngestionPipelineStats';

// Short label for a pipeline type, as shown on a failing row's tag.
const PIPELINE_TYPE_LABEL_KEYS: Partial<Record<PipelineType, string>> = {
  [PipelineType.Application]: 'label.application',
  [PipelineType.AutoClassification]: 'label.auto-classification',
  [PipelineType.DataInsight]: 'label.data-insight',
  [PipelineType.Dbt]: 'label.dbt-lowercase',
  [PipelineType.Lineage]: 'label.lineage',
  [PipelineType.Metadata]: 'label.metadata',
  [PipelineType.Profiler]: 'label.profiler',
  [PipelineType.TestSuite]: 'label.test-suite',
  [PipelineType.Usage]: 'label.usage',
};

/** A type with no label of its own still reads as an ingestion pipeline. */
export const getPipelineTypeLabel = (
  pipelineType: PipelineType | undefined,
  t: TFunction
): string =>
  t(
    (pipelineType && PIPELINE_TYPE_LABEL_KEYS[pipelineType]) ??
      'label.ingestion'
  );

/**
 * The line under a failing service's name: the run's own error when it had a
 * usable one, otherwise a whole translated sentence naming the pipeline type.
 */
export const getFailingServiceReason = (
  service: Pick<FailingService, 'pipelineType' | 'reason' | 'state'>,
  t: TFunction
): string =>
  service.reason ||
  t(
    service.state === 'partialSuccess'
      ? 'message.pipeline-type-pipeline-partially-failed'
      : 'message.pipeline-type-pipeline-failed',
    { pipelineType: getPipelineTypeLabel(service.pipelineType, t) }
  );
