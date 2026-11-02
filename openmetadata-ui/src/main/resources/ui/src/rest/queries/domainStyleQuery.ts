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
import { Domain } from '../../generated/entity/domains/domain';
import { batchedDomainStyle, toChipStyle } from '../domainStyleBatcher';

// A restyle made in this tab is written straight into the cache (see
// cacheDomainStyle), so the stale time only delays restyles made elsewhere.
export const DOMAIN_STYLE_STALE_TIME = 5 * 60 * 1000;

// Its own namespace, so it can never prefix-match a ['domain', <fqn>] detail key.
export const domainStyleQueryKey = (id: string) =>
  ['domain-style', id] as const;

export const domainStyleQueryOptions = (id: string) => ({
  queryKey: domainStyleQueryKey(id),
  queryFn: () => batchedDomainStyle(id),
  staleTime: DOMAIN_STYLE_STALE_TIME,
});

/**
 * Called with the saved domain after every domain update, so its chips redraw
 * at once instead of after the stale time. Written from the response, not
 * refetched: the domain's search document may not show the new style yet.
 * ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
export const cacheDomainStyle = (
  queryClient: QueryClient,
  domain: Pick<Domain, 'id' | 'style'>
) => {
  queryClient.setQueryData(
    domainStyleQueryKey(domain.id),
    toChipStyle(domain.style)
  );
};
