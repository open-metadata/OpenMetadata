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

import { QueryClient } from '@tanstack/react-query';
import { TabSpecificField } from '../../enums/entity.enum';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { defaultFields } from '../../utils/PipelineDetailsUtils';
import { getPipelineByFqn } from '../pipelineAPI';

export const pipelineQueryKey = (fqn: string, fields: string) =>
  ['pipeline', fqn, fields] as const;

export const pipelineQueryFn = (fqn: string, fields: string) => () =>
  getPipelineByFqn(fqn, { fields });

export const prefetchPipelineByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: pipelineQueryKey(fqn, fields),
      queryFn: pipelineQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type PipelineQueryData = Pipeline | undefined;

const PREFETCH_PIPELINE_FIELDS = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;

export const prefetchPipeline = (queryClient: QueryClient, fqn: string) =>
  prefetchPipelineByFqn(queryClient, fqn, PREFETCH_PIPELINE_FIELDS);
