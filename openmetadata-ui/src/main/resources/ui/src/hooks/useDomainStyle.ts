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
import { Style } from '../generated/entity/domains/domain';
import { queryClient } from '../queryClient';
import { getDomainByName } from '../rest/domainAPI';

export const DOMAIN_STYLE_QUERY_KEY = ['domain', 'style'] as const;

// A chip appears on every asset header and Explore card; a domain's colour and
// icon change rarely, and saving them invalidates this key.
const DOMAIN_STYLE_STALE_TIME = 5 * 60 * 1000;

/**
 * A domain's custom colour and icon. Assets carry their domains as plain
 * entity references, which hold no `style`, so it is read from the domain
 * itself — once per domain, shared by every chip on the page.
 *
 * Bound to the app's client rather than the nearest provider: the chip renders
 * deep inside shared components, many of them tested without one.
 */
export const useDomainStyle = (fqn?: string): Style | undefined => {
  const { data } = useQuery(
    {
      enabled: Boolean(fqn),
      queryFn: async () => (await getDomainByName(fqn ?? '')).style ?? null,
      queryKey: [...DOMAIN_STYLE_QUERY_KEY, fqn],
      // A domain the viewer cannot read keeps the default chip.
      retry: false,
      staleTime: DOMAIN_STYLE_STALE_TIME,
    },
    queryClient
  );

  return data ?? undefined;
};
