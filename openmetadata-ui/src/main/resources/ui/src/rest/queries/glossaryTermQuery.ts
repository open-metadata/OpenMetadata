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
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { getGlossaryTermByFQN } from '../glossaryAPI';

/**
 * Field set the {@code GlossaryPage} reads when the active selection is a glossary term
 * (i.e. the URL FQN has more than one segment). Kept in sync with
 * {@code fetchGlossaryTermDetails} in {@code GlossaryPage.component.tsx}.
 */
export const GLOSSARY_TERM_DEFAULT_FIELDS = [
  TabSpecificField.CHILDREN,
  TabSpecificField.CHILDREN_COUNT,
  TabSpecificField.DERIVED_FROM,
  TabSpecificField.DOMAINS,
  TabSpecificField.EXTENSION,
  TabSpecificField.OWNERS,
  TabSpecificField.RELATED_TERMS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.TAGS,
  TabSpecificField.VOTES,
].join(',');

export const glossaryTermQueryKey = (fqn: string, fields: string) =>
  ['glossaryTerm', fqn, fields] as const;

export const glossaryTermQueryFn = (fqn: string, fields: string) => () =>
  getGlossaryTermByFQN(fqn, { fields });

export const prefetchGlossaryTermByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string
) =>
  queryClient
    .prefetchQuery({
      queryKey: glossaryTermQueryKey(fqn, fields),
      queryFn: glossaryTermQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type GlossaryTermQueryData = GlossaryTerm | undefined;

export const prefetchGlossaryTerm = (queryClient: QueryClient, fqn: string) =>
  prefetchGlossaryTermByFqn(queryClient, fqn, GLOSSARY_TERM_DEFAULT_FIELDS);
