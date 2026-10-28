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

import { useQuery } from '@tanstack/react-query';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Style } from '../generated/entity/domains/domain';
import { queryClient } from '../queryClient';
import { searchQuery } from '../rest/searchAPI';

/**
 * Every domain's style in one entry, shaped `[EntityType, ...]` like the
 * entity detail keys. Every writer of a domain's `style` must invalidate it.
 * ADR:2026-10-28-domain-chips-read-styles-from-one-shared-query
 */
export const DOMAIN_STYLES_QUERY_KEY = [EntityType.DOMAIN, 'styles'] as const;

/**
 * Domains are a small, admin-curated set. One page this size covers them; a
 * domain past it keeps the default chip rather than costing a request of its
 * own.
 */
export const DOMAIN_STYLES_LIMIT = 1000;

// A chip appears on every asset header and Explore card; a domain's colour and
// icon change rarely, and saving them invalidates the key.
const DOMAIN_STYLES_STALE_TIME = 5 * 60 * 1000;

type DomainStyles = Map<string, Style>;

const fetchDomainStyles = async (): Promise<DomainStyles> => {
  const response = await searchQuery({
    fetchSource: true,
    includeFields: ['fullyQualifiedName', 'style'],
    pageNumber: 1,
    pageSize: DOMAIN_STYLES_LIMIT,
    query: '',
    searchIndex: SearchIndex.DOMAIN,
    // A chip names whatever domain the asset is in, not only the one the
    // viewer has scoped the app to.
    skipDomainFilter: true,
  });

  const styles: DomainStyles = new Map();
  response.hits.hits.forEach(({ _source: source }) => {
    if (source.fullyQualifiedName && source.style) {
      styles.set(source.fullyQualifiedName, source.style);
    }
  });

  return styles;
};

/**
 * A domain's custom colour and icon. Assets carry their domains as plain
 * entity references, which hold no `style`, so the styles of all domains are
 * read once and shared: one request however many chips or domains a page
 * shows.
 *
 * Bound to the app's client rather than the nearest provider: the chip renders
 * deep inside shared components, many of them tested without one.
 */
export const useDomainStyle = (fqn?: string): Style | undefined => {
  const { data } = useQuery(
    {
      enabled: Boolean(fqn),
      queryFn: fetchDomainStyles,
      queryKey: DOMAIN_STYLES_QUERY_KEY,
      // A failed read keeps the default chip.
      retry: false,
      staleTime: DOMAIN_STYLES_STALE_TIME,
    },
    queryClient
  );

  return fqn ? data?.get(fqn) : undefined;
};
