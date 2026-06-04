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
import { Glossary } from '../../generated/entity/data/glossary';
import { getGlossariesByName } from '../glossaryAPI';

/**
 * Field set used when a single root {@code Glossary} entity is fetched by FQN. The
 * {@code GlossaryPage} list view pulls glossaries through {@code getGlossariesList} (because
 * the left panel needs the full set), but consumers that want a single-glossary cache slot
 * — hover prefetch, deep links, the upcoming {@code GlossaryDetails} mount path — should go
 * through this helper so they land on the canonical key shape.
 */
export const GLOSSARY_DEFAULT_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.VOTES,
  TabSpecificField.DOMAINS,
  TabSpecificField.TERM_COUNT,
].join(',');

export const glossaryQueryKey = (fqn: string, fields: string) =>
  ['glossary', fqn, fields] as const;

export const glossaryQueryFn = (fqn: string, fields: string) => () =>
  getGlossariesByName(fqn, { fields });

export const prefetchGlossaryByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: glossaryQueryKey(fqn, fields),
      queryFn: glossaryQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type GlossaryQueryData = Glossary | undefined;

export const prefetchGlossary = (queryClient: QueryClient, fqn: string) =>
  prefetchGlossaryByFqn(queryClient, fqn, GLOSSARY_DEFAULT_FIELDS);
