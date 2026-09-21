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

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  GraphData,
  GraphNode,
  KnowledgeGraphFilters,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
} from '../../../interface/discovery/knowledge-graph.interface';
import { getGlossaryTermsByIds } from '../../../rest/glossaryAPI';
import { graphLevelToDepth } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  getOntologyScope,
  graphEntityId,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphOntology.utils';
import { isConceptNode } from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import { useKnowledgeGraphData } from './useKnowledgeGraphData';

export const useKnowledgeGraphOntology = (
  assetGraph: GraphData | null,
  mode: KnowledgeGraphMode,
  level: KnowledgeGraphLevel,
  filters: KnowledgeGraphFilters,
  refresh: number
) => {
  const concepts = useMemo(
    () =>
      (assetGraph?.nodes ?? [])
        .filter(isConceptNode)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [assetGraph]
  );
  const [chosen, setChosen] = useState<string>();
  const concept = concepts.find((node) => node.id === chosen) ?? concepts[0];
  const query = useMemo(
    () => ({
      entityId: mode === 'ontology' && concept ? graphEntityId(concept.id) : '',
      entityType: 'glossaryTerm',
      depth: graphLevelToDepth(level),
      entityTypes: filters.entityTypes,
      relationshipTypes: filters.relationshipTypes,
    }),
    [mode, concept, level, filters]
  );
  const result = useKnowledgeGraphData(query, refresh);
  const data = useMemo(
    () => getOntologyScope(result.data, concept?.id ?? ''),
    [result.data, concept?.id]
  );
  const unfiltered = useMemo(
    () => getOntologyScope(result.unfiltered, concept?.id ?? ''),
    [result.unfiltered, concept?.id]
  );

  return {
    ...result,
    data,
    unfiltered,
    concepts,
    concept,
    onConceptChange: setChosen,
  };
};

const EMPTY_TERMS: GlossaryTerm[] = [];
const CONCEPT_DETAILS_CHUNK = 100;
const CONCEPT_DETAILS_FIELDS = 'attributes,effectiveAttributes';
const CONCEPT_DETAILS_QUERY_KEY = [
  'knowledge-graph',
  'concept-details',
] as const;

const toChunks = (ids: string[]): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += CONCEPT_DETAILS_CHUNK) {
    chunks.push(ids.slice(index, index + CONCEPT_DETAILS_CHUNK));
  }

  return chunks;
};

/**
 * Fetches glossary-term metadata for every concept currently on the canvas.
 * Ids are chunked at the backend batch limit (100) and each chunk becomes
 * one React Query — parallel fetch, and a single-term change only busts the
 * chunk it belongs to.
 */
export const useKnowledgeGraphConceptDetails = (
  nodes: GraphNode[],
  enabled: boolean,
  refresh: number
) => {
  const ids = useMemo(
    () =>
      enabled
        ? nodes
            .filter(isConceptNode)
            .map((node) => graphEntityId(node.id))
            .sort()
        : [],
    [nodes, enabled]
  );
  const chunks = useMemo(() => toChunks(ids), [ids]);
  const queryClient = useQueryClient();

  // Refresh means "user asked for fresh data" — invalidate the chunk cache
  // rather than baking `refresh` into the key. Invalidation refetches while
  // leaving the previous terms on screen (React Query's built-in
  // keep-previous-data-on-refetch semantics), which useQueries can't provide
  // on a key change because it treats a new key as a brand-new observer.
  const previousRefresh = useRef(refresh);
  useEffect(() => {
    if (previousRefresh.current === refresh) {
      return;
    }
    previousRefresh.current = refresh;
    void queryClient.invalidateQueries({
      queryKey: CONCEPT_DETAILS_QUERY_KEY,
    });
  }, [refresh, queryClient]);

  const queries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: [...CONCEPT_DETAILS_QUERY_KEY, chunk],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        getGlossaryTermsByIds(
          chunk,
          { fields: CONCEPT_DETAILS_FIELDS },
          signal
        ),
      enabled,
    })),
  });

  if (!enabled || ids.length === 0) {
    return {
      terms: EMPTY_TERMS,
      loading: false,
      partial: false,
      error: null,
    };
  }

  const loading = queries.some((query) => query.isFetching);
  const error = queries.find((query) => query.error)?.error ?? null;
  const terms = queries.flatMap((query) => query.data ?? []);
  const partial = !loading && !error && terms.length !== ids.length;

  return { terms, loading, partial, error };
};
