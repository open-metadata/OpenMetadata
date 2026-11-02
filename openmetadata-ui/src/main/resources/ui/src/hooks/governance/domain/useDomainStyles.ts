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
import { QueryObserverResult, useQueries } from '@tanstack/react-query';
import { compact, uniq } from 'lodash';
import { useCallback, useMemo } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { Style } from '../../../generated/type/tagLabel';
import { domainStyleQueryOptions } from '../../../rest/queries/domainStyleQuery';

/**
 * The colour and icon of each domain in `domains`, keyed by domain id. Domain
 * references carry no style, so chips look it up by the id they already have;
 * a domain whose style is unknown or unset has no entry and keeps the default
 * chip. ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
export const useDomainStyles = (
  domains?: EntityReference[]
): Map<string, Style> => {
  const ids = useMemo(
    () => uniq(compact(domains?.map((domain) => domain.id))),
    [domains]
  );

  // Stable per id list, so React Query hands back the same Map until a style
  // arrives or changes, and memoized consumers keep their identity.
  const combine = useCallback(
    (results: QueryObserverResult<Style | null>[]) =>
      new Map(
        results.flatMap(({ data }, index) =>
          data ? [[ids[index], data] as const] : []
        )
      ),
    [ids]
  );

  return useQueries({
    queries: ids.map(domainStyleQueryOptions),
    combine,
  });
};
