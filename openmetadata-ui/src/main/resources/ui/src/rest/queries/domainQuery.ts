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
import { Domain } from '../../generated/entity/domains/domain';
import { getDomainByName } from '../domainAPI';

export const DOMAIN_DEFAULT_FIELDS: TabSpecificField[] = [
  TabSpecificField.CHILDREN,
  TabSpecificField.OWNERS,
  TabSpecificField.PARENT,
  TabSpecificField.EXPERTS,
  TabSpecificField.TAGS,
  TabSpecificField.FOLLOWERS,
  TabSpecificField.EXTENSION,
  TabSpecificField.VOTES,
  TabSpecificField.CERTIFICATION,
];

export const domainQueryKey = (fqn: string, fields: string[]) =>
  ['domain', fqn, fields.join(',')] as const;

export const domainQueryFn = (fqn: string, fields: string[]) => () =>
  getDomainByName(fqn, { fields });

export const prefetchDomainByFqn = (
  queryClient: QueryClient,
  fqn: string,
  fields: string[]
) =>
  queryClient
    .prefetchQuery({
      queryKey: domainQueryKey(fqn, fields),
      queryFn: domainQueryFn(fqn, fields),
    })
    .catch(() => undefined);

export type DomainQueryData = Domain | undefined;

export const prefetchDomain = (queryClient: QueryClient, fqn: string) =>
  prefetchDomainByFqn(queryClient, fqn, DOMAIN_DEFAULT_FIELDS);

// The domains landing-page widget fires on every mount (including the post-login MyData page).
// Cache its list + asset-count reads for a few minutes so navigating back within a session
// serves from cache instead of re-hitting the (DB-backed) asset-count endpoint each time.
export const DOMAIN_WIDGET_STALE_TIME = 5 * 60 * 1000;

export const domainAssetsCountQueryKey = ['domain', 'assets-count'] as const;

export const domainWidgetSearchQueryKey = (sortBy: string) =>
  ['domain', 'widget-search', sortBy] as const;
