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
import { Tag } from '../../generated/entity/classification/tag';
import { getTagByFqn } from '../tagAPI';

export const TAG_DEFAULT_FIELDS: TabSpecificField[] = [
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
  TabSpecificField.REVIEWERS,
];

export const tagQueryKey = (fqn: string, fields: string[]) =>
  ['tag', fqn, fields.join(',')] as const;

export const tagQueryFn = (fqn: string, fields: string[]) => () =>
  getTagByFqn(fqn, { fields });

export const prefetchTagByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string[]
) =>
  queryClient
    .prefetchQuery({
      queryKey: tagQueryKey(fqn, fields),
      queryFn: tagQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type TagQueryData = Tag | undefined;

export const prefetchTag = (queryClient: QueryClient, fqn: string) =>
  prefetchTagByFqn(queryClient, fqn, TAG_DEFAULT_FIELDS);
