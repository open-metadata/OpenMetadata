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
import { getDomainStyles } from '../domainAPI';

// Its own namespace, so it can never prefix-match a ['domain', <fqn>] detail key.
export const DOMAIN_STYLES_QUERY_KEY = ['domain-styles'] as const;

// Every chip on every page reads this one cached list. A restyle in this tab
// invalidates it (invalidateDomainStyles); another tab refetches it when it
// regains focus with a list older than this.
export const DOMAIN_STYLES_STALE_TIME = 5 * 60 * 1000;

export const domainStylesQueryOptions = {
  queryKey: DOMAIN_STYLES_QUERY_KEY,
  queryFn: getDomainStyles,
  staleTime: DOMAIN_STYLES_STALE_TIME,
  refetchOnWindowFocus: true,
} as const;

/**
 * Call after a domain or data product is updated, so its chips redraw with the
 * saved colour and icon. ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
export const invalidateDomainStyles = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: DOMAIN_STYLES_QUERY_KEY });
