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
import { getPipelineByFqn } from '../pipelineAPI';

// Inlined here (not imported from {@code PipelineDetailsUtils}) to avoid the kind of
// circular import that broke production bundles for Dashboard (see {@code dashboardQuery.ts}
// for the detailed write-up). Keep this list in sync with
// {@code PipelineDetailsUtils.defaultFields}. The sync is enforced by
// {@code pipelineQuery.test.ts}.
const PIPELINE_DEFAULT_FIELDS = [
  TabSpecificField.FOLLOWERS,
  TabSpecificField.TAGS,
  TabSpecificField.OWNERS,
  TabSpecificField.TASKS,
  TabSpecificField.PIPELINE_STATUS,
  TabSpecificField.DOMAINS,
  TabSpecificField.DATA_PRODUCTS,
  TabSpecificField.VOTES,
  TabSpecificField.EXTENSION,
].join(',');

/**
 * Strip all whitespace from a {@code fields} parameter so logically-equivalent field lists —
 * e.g. {@code "followers,tags"} and {@code "followers, tags"} — collapse to the same React
 * Query cache slot. The detail page and the hover-prefetch build their {@code fields} strings
 * in different files with inconsistent spacing; normalizing at this key boundary (rather than
 * forcing every caller to agree on a canonical string) keeps the prefetch slot reusable
 * regardless of how a caller formats the list. The backend tolerates either form
 * ({@code EntityUtil.Fields} strips spaces server-side), so only the cache key needs this.
 */
export const normalizeFields = (fields: string) => fields.replace(/\s+/g, '');

export const pipelineQueryKey = (fqn: string, fields: string) =>
  ['pipeline', fqn, normalizeFields(fields)] as const;

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

export const PREFETCH_PIPELINE_FIELDS = `${PIPELINE_DEFAULT_FIELDS},${TabSpecificField.USAGE_SUMMARY}`;

export const prefetchPipeline = (queryClient: QueryClient, fqn: string) =>
  prefetchPipelineByFqn(queryClient, fqn, PREFETCH_PIPELINE_FIELDS);
