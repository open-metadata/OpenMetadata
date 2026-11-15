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
import { isAxiosError } from 'axios';
import { useCallback, useMemo } from 'react';
import { Glossary } from '../../../generated/entity/data/glossary';
import { Ontology } from '../../../generated/entity/data/ontology';
import { MemberKind } from '../../../generated/type/ontologyReleaseMember';
import { getGlossariesList } from '../../../rest/glossaryAPI';
import {
  listOntologies,
  listOntologyConcepts,
  listOntologyProperties,
  listOntologyReleaseMembers,
} from '../../../rest/ontologyAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { listAllPages } from '../../../utils/governance/ontology/OntologyPaging.utils';
import { useApplicationStore } from '../../useApplicationStore';

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
  const userId = useApplicationStore((store) => store.currentUser?.id);
  const ontologies = useQuery({
    queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY, userId],
    enabled,
    gcTime: 30_000,
    queryFn: ({ signal }) =>
      listAllPages(
        (after) =>
          listOntologies(
            { after, limit: SCOPE_PAGE_SIZE, fields: 'publicationStatus' },
            signal
          ),
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

const isForbidden = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 403;

type CountKind = 'concept' | 'property';

/**
 * The working draft is readable only with edit rights
 * (ADR:2026-11-03-ontology-working-draft-reads-require-edit-rights),
 * so a refused read falls back to what the active release froze. Null means
 * no count is known, which the caller leaves blank rather than showing 0.
 */
const loadDefinitionCount = async (
  kind: CountKind,
  ontology: Ontology,
  signal: AbortSignal
): Promise<number | null> => {
  const list =
    kind === 'concept' ? listOntologyConcepts : listOntologyProperties;
  try {
    const page = await list(
      { limit: 1, ontology: ontology.fullyQualifiedName },
      signal
    );

    return page.paging.total;
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }
    const releaseId = ontology.publicationStatus?.active?.releaseId;
    if (!releaseId) {
      return null;
    }
    const members = await listOntologyReleaseMembers(
      releaseId,
      kind === 'concept' ? MemberKind.Concept : MemberKind.Property,
      { limit: 1 },
      signal
    );

    return members.paging.total;
  }
};

const useOntologyDefinitionCounts = (
  kind: CountKind,
  ontologies: Ontology[],
  isEnabled: boolean
): Record<string, number> => {
  const counts = useQueries({
    queries: ontologies.map((ontology) => ({
      enabled: isEnabled,
      queryKey: [
        `ontology-studio-${kind}-count`,
        ontology.id,
        ontology.publicationStatus?.active?.releaseId,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadDefinitionCount(kind, ontology, signal),
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

          return typeof total === 'number' ? [[ontology.id, total]] : [];
        })
      ),
    [counts, ontologies]
  );
};

/** Concept totals per ontology, fetched only for the rows the caller passes and only while enabled. */
export const useOntologyConceptCounts = (
  ontologies: Ontology[],
  isEnabled: boolean
) => useOntologyDefinitionCounts('concept', ontologies, isEnabled);

/** Property totals per ontology id. An ontology whose count is refused or fails is left out, never shown as 0. */
export const useOntologyPropertyCounts = (
  ontologies: Ontology[],
  isEnabled: boolean
) => useOntologyDefinitionCounts('property', ontologies, isEnabled);
