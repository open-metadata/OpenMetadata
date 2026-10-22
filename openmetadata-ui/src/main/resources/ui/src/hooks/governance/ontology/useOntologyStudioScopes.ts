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
import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { Glossary } from '../../../generated/entity/data/glossary';
import { Ontology } from '../../../generated/entity/data/ontology';
import { getGlossariesList } from '../../../rest/glossaryAPI';
import {
  listOntologies,
  listOntologyConcepts,
} from '../../../rest/ontologyAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { listAllPages } from '../../../utils/governance/ontology/OntologyPaging.utils';

export const ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY =
  'ontology-studio-ontologies';
const SCOPE_PAGE_SIZE = 100;
// shortcut: scope lists above 10,000 fail visibly; add server-side search before increasing this cap.
const MAX_SCOPE_PAGES = 100;

const byName = <T extends { name: string; displayName?: string }>(
  left: T,
  right: T
) => getEntityName(left).localeCompare(getEntityName(right));

interface UseOntologyStudioScopesOptions {
  enabled: boolean;
  loadGlossaries?: boolean;
  knownGlossaries: Glossary[];
}

/** Native ontologies and glossaries the Studio scope menu offers. */
export const useOntologyStudioScopes = ({
  enabled,
  knownGlossaries,
  loadGlossaries = enabled,
}: UseOntologyStudioScopesOptions) => {
  const shouldLoadGlossaries = loadGlossaries && knownGlossaries.length === 0;
  const ontologies = useQuery({
    queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
    enabled,
    gcTime: 30_000,
    queryFn: ({ signal }) =>
      listAllPages(
        (after) => listOntologies({ after, limit: SCOPE_PAGE_SIZE }, signal),
        MAX_SCOPE_PAGES
      ),
    retry: false,
  });
  const glossaries = useQuery({
    queryKey: ['ontology-studio-glossaries'],
    enabled: shouldLoadGlossaries,
    gcTime: 30_000,
    queryFn: ({ signal }) =>
      listAllPages(
        (after) =>
          getGlossariesList(
            { after, fields: 'termCount', limit: SCOPE_PAGE_SIZE },
            signal
          ),
        MAX_SCOPE_PAGES
      ),
    retry: false,
  });
  const refetch = useCallback(async () => {
    await Promise.all([
      ontologies.refetch(),
      ...(knownGlossaries.length === 0 ? [glossaries.refetch()] : []),
    ]);
  }, [glossaries, knownGlossaries.length, ontologies]);

  return {
    glossaries: useMemo(
      () =>
        [
          ...(knownGlossaries.length > 0
            ? knownGlossaries
            : glossaries.data ?? []),
        ].sort(byName),
      [glossaries.data, knownGlossaries]
    ),
    isOntologyError: ontologies.isError,
    isOntologyLoading: enabled && ontologies.isPending,
    refetchOntologies: ontologies.refetch,
    isError: ontologies.isError || glossaries.isError,
    isLoading:
      enabled &&
      (ontologies.isPending || (shouldLoadGlossaries && glossaries.isPending)),
    ontologies: useMemo(
      () => [...(ontologies.data ?? [])].sort(byName),
      [ontologies.data]
    ),
    refetch,
  };
};

/** Concept totals per ontology, fetched only while the scope menu is open. */
export const useOntologyConceptCounts = (
  ontologies: Ontology[],
  isEnabled: boolean
): Record<string, number> => {
  const counts = useQueries({
    queries: ontologies.map((ontology) => ({
      enabled: isEnabled,
      queryKey: ['ontology-studio-concept-count', ontology.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listOntologyConcepts(
          { limit: 1, ontology: ontology.fullyQualifiedName },
          signal
        ).then((page) => page.paging.total),
      retry: false,
      gcTime: 30_000,
      staleTime: 30_000,
    })),
  });

  return useMemo(
    () =>
      Object.fromEntries(
        ontologies.flatMap((ontology, index) => {
          const total = counts[index]?.data;

          return total === undefined ? [] : [[ontology.id, total]];
        })
      ),
    [counts, ontologies]
  );
};
