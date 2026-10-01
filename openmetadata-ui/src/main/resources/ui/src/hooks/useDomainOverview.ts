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

import { useQueries } from '@tanstack/react-query';
import { SearchIndex } from '../enums/search.enum';
import { Domain } from '../generated/entity/domains/domain';
import { getAllDomainsWithAssetsCount } from '../rest/domainAPI';
import { searchQuery } from '../rest/searchAPI';
import { getEntityName } from '../utils/EntityNameUtils';

export const DOMAIN_OVERVIEW_QUERY_KEY = ['landingPage', 'widgets', 'domains'];
const TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 10;

export interface DomainSummary {
  id: string;
  name: string;
  fullyQualifiedName: string;
  ownerName?: string;
  assetCount: number;
}

export interface DomainOverview {
  domains: DomainSummary[];
  /** Every domain, not just the page rendered. */
  totalCount: number;
  unownedCount: number;
  emptyCount: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Domains with their asset counts.
 *
 * The counts come from `/domains/assets/counts`, which returns the whole map in
 * one call — the same source the OSS Domains widget uses, so the numbers agree
 * between the two surfaces.
 */
export const useDomainOverview = (): DomainOverview => {
  const [domainsQuery, countsQuery] = useQueries({
    queries: [
      {
        queryFn: () =>
          searchQuery({
            pageNumber: 1,
            pageSize: PAGE_SIZE,
            query: '',
            searchIndex: SearchIndex.DOMAIN,
          }),
        queryKey: [...DOMAIN_OVERVIEW_QUERY_KEY, 'list'],
        staleTime: TTL_MS,
      },
      {
        queryFn: getAllDomainsWithAssetsCount,
        queryKey: [...DOMAIN_OVERVIEW_QUERY_KEY, 'counts'],
        staleTime: TTL_MS,
      },
    ],
  });

  const hits = domainsQuery.data?.hits?.hits ?? [];
  const counts = countsQuery.data ?? {};

  const domains: DomainSummary[] = hits.map((hit) => {
    const source = hit._source as unknown as Domain;

    return {
      assetCount: counts[source.fullyQualifiedName ?? ''] ?? 0,
      fullyQualifiedName: source.fullyQualifiedName ?? '',
      id: source.id,
      name: getEntityName(source),
      ownerName: source.owners?.length
        ? getEntityName(source.owners[0])
        : undefined,
    };
  });

  return {
    domains,
    emptyCount: domains.filter((domain) => domain.assetCount === 0).length,
    isError: domainsQuery.isError || countsQuery.isError,
    isLoading: domainsQuery.isPending || countsQuery.isPending,
    // Counted across the page in hand, not the estate — the search response
    // carries no aggregate for either, so the chips describe what is listed.
    totalCount: domainsQuery.data?.hits?.total?.value ?? 0,
    unownedCount: domains.filter((domain) => !domain.ownerName).length,
  };
};
