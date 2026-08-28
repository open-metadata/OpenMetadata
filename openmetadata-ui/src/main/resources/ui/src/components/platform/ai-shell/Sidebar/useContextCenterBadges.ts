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
import { useMemo } from 'react';
import { Include } from '../../../../generated/type/include';
import { listContextFiles } from '../../../../rest/assetAPI';
import { getListContextMemories } from '../../../../rest/contextMemoryAPI';
import { getListKnowledgePages } from '../../../../rest/knowledgeCenterAPI';
import {
  CONTEXT_CENTER_ARCHIVE_COUNT_QUERY_KEY,
  CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY,
  CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY,
  CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY,
} from '../../../../utils/ContextCenterQueryKeys';

const COUNT_LIMIT = 0;

// `type` (not `interface`) so it satisfies `Record<string, number | undefined>`
// when passed to `SubPanel`'s `badges` prop.
export type ContextCenterBadges = {
  articles: number | undefined;
  documents: number | undefined;
  memories: number | undefined;
  archive: number | undefined;
};

export function useContextCenterBadges(enabled: boolean): ContextCenterBadges {
  const { data: articles } = useQuery({
    queryKey: CONTEXT_CENTER_ARTICLES_COUNT_QUERY_KEY,
    queryFn: () =>
      getListKnowledgePages({ limit: COUNT_LIMIT }).then(
        (res) => res.paging.total
      ),
    enabled,
  });

  const { data: documents } = useQuery({
    queryKey: CONTEXT_CENTER_DOCUMENTS_COUNT_QUERY_KEY,
    queryFn: () =>
      listContextFiles({ limit: COUNT_LIMIT }).then((res) => res.paging.total),
    enabled,
  });

  const { data: archive } = useQuery({
    queryKey: CONTEXT_CENTER_ARCHIVE_COUNT_QUERY_KEY,
    queryFn: () =>
      listContextFiles({ limit: COUNT_LIMIT, include: Include.Deleted }).then(
        (res) => res.paging.total
      ),
    enabled,
  });

  const { data: memories } = useQuery({
    queryKey: CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY,
    queryFn: () =>
      getListContextMemories({ limit: COUNT_LIMIT }).then(
        (res) => res.paging.total
      ),
    enabled,
  });

  return useMemo(
    () => ({
      articles: enabled ? articles : undefined,
      documents: enabled ? documents : undefined,
      memories: enabled ? memories : undefined,
      archive: enabled ? archive : undefined,
    }),
    [enabled, articles, documents, memories, archive]
  );
}
