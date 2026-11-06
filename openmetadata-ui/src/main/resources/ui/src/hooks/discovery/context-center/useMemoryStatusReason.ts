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
import { useTranslation } from 'react-i18next';
import { RETIRED_QUERY_REASON } from '../../../constants/ContextCenter.constants';
import {
  ContextMemory,
  EntityReference,
} from '../../../generated/entity/context/contextMemory';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { getContextMemoryVersions } from '../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_RETIRED_QUERY_NAME_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../utils/EntityNameUtils';

/** The id of the deleted Query a status reason names, when the reason is that hold's. */
export const getRetiredQueryId = (reason = ''): string | undefined => {
  const { prefix, suffix } = RETIRED_QUERY_REASON;
  const isRetiredQueryReason =
    reason.startsWith(prefix) &&
    reason.endsWith(suffix) &&
    reason.length > prefix.length + suffix.length;

  return isRetiredQueryReason
    ? reason.slice(prefix.length, reason.length - suffix.length)
    : undefined;
};

const RETIRED_QUERY_NAME_STALE_TIME = 5 * 60 * 1000;

const relatedEntitiesOf = (version: unknown): EntityReference[] => {
  try {
    const memory = (
      typeof version === 'string' ? JSON.parse(version) : version
    ) as ContextMemory | undefined;

    return memory?.relatedEntities ?? [];
  } catch {
    return [];
  }
};

/**
 * The Query's name as the memory's history records it. The server lists in each version only the
 * Query references the caller may view in full; any other keeps just its id and type, so no name.
 */
export const findCitedQueryName = (
  history: EntityHistory,
  queryId: string
): string | undefined =>
  (history.versions ?? [])
    .flatMap(relatedEntitiesOf)
    .filter((reference) => reference.id === queryId)
    .map((reference) => getEntityName(reference))
    .find(Boolean);

/**
 * A memory's status reason as its viewer reads it. A hold for a deleted Query stores an English
 * reason with the Query's id; it is shown translated, naming the Query when the memory's history
 * shows this viewer its name
 * (ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review).
 * Pass no memory to skip the lookup.
 */
export const useMemoryStatusReason = (
  memory?: ContextMemory
): string | undefined => {
  const { t } = useTranslation();
  const reason = memory?.statusReason;
  const memoryId = memory?.id;
  const queryId = getRetiredQueryId(reason);
  // One cached lookup per memory and Query, shared by its list card and its panel.
  const { data: queryName } = useQuery({
    queryKey: [
      ...CONTEXT_CENTER_RETIRED_QUERY_NAME_QUERY_KEY,
      memoryId,
      queryId,
    ],
    queryFn: async () =>
      findCitedQueryName(
        await getContextMemoryVersions(memoryId ?? ''),
        queryId ?? ''
      ) ?? null,
    enabled: Boolean(memoryId && queryId),
    staleTime: RETIRED_QUERY_NAME_STALE_TIME,
    // A viewer who may not read the history keeps the id.
    retry: false,
  });

  return queryId
    ? t('message.memory-supporting-query-deleted', {
        query: queryName ?? queryId,
      })
    : reason;
};
