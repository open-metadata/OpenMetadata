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
import { OntologyReleaseExportOptions } from '../../../generated/api/data/ontologyReleaseExportOptions';
import { OntologyRelease } from '../../../generated/entity/data/ontologyRelease';
import {
  exportOntologyDraft,
  exportOntologyRelease,
  getOntologyRelease,
  getOntologyState,
  listOntologyReleaseHistory,
} from '../../../rest/ontologyAPI';
import { OntologyReleaseExportFormat } from '../../../rest/ontologyExport.constants';

export const ONTOLOGY_DRAFT_EXPORT_SCOPE = 'draft';
const RELEASE_HISTORY_LIMIT = 50;

interface OntologyExportScopes {
  readonly activeRelease: OntologyRelease | null;
  readonly releases: readonly OntologyRelease[];
}

/**
 * What an ontology can export: its draft always, and every release it has
 * captured, newest first. The active release is listed even when the history
 * page does not reach it.
 */
const loadScopes = async (
  ontologyId: string,
  signal: AbortSignal
): Promise<OntologyExportScopes> => {
  const [state, history] = await Promise.all([
    getOntologyState(ontologyId, signal),
    listOntologyReleaseHistory(
      ontologyId,
      { limit: RELEASE_HISTORY_LIMIT },
      signal
    ),
  ]);
  const releases = history.data.filter(
    (release) => release.ontology.id === ontologyId
  );
  if (!state.activeReleaseId) {
    return { activeRelease: null, releases };
  }
  const listed = releases.find(({ id }) => id === state.activeReleaseId);
  // The release ID comes from the state response, so this request is necessarily dependent.

  const activeRelease =
    listed ?? (await getOntologyRelease(state.activeReleaseId, signal));
  if (activeRelease.ontology.id !== ontologyId) {
    throw new Error('Ontology release identity does not match the scope');
  }

  return {
    activeRelease,
    releases: listed ? releases : [activeRelease, ...releases],
  };
};

const firstError = (...errors: unknown[]) =>
  errors.find((error) => error !== null && error !== undefined);

/**
 * `scopeKey` is `draft` or a release id. Left out, the active release is
 * chosen, and the draft when nothing is published yet.
 */
export const useOntologyReleaseExport = (
  ontologyId: string,
  format: OntologyReleaseExportFormat,
  options: OntologyReleaseExportOptions,
  scopeKey?: string
) => {
  const scopes = useQuery<OntologyExportScopes>({
    gcTime: 0,
    queryKey: ['ontology-export-scopes', ontologyId],
    retry: false,
    queryFn: ({ signal }) => loadScopes(ontologyId, signal),
  });
  const chosen =
    scopeKey ?? scopes.data?.activeRelease?.id ?? ONTOLOGY_DRAFT_EXPORT_SCOPE;
  const release = scopes.data?.releases.find(({ id }) => id === chosen);
  const isDraft = chosen === ONTOLOGY_DRAFT_EXPORT_SCOPE || !release;
  const content = useQuery({
    enabled: Boolean(scopes.data),
    gcTime: 0,
    queryKey: [
      'ontology-export-content',
      ontologyId,
      isDraft ? ONTOLOGY_DRAFT_EXPORT_SCOPE : release?.id,
      format,
      options,
    ],
    retry: false,
    queryFn: ({ signal }) =>
      isDraft || !release
        ? exportOntologyDraft(
            ontologyId,
            format,
            { includeInverses: options.includeInverses },
            signal
          )
        : exportOntologyRelease(release.id, format, options, signal),
  });

  const retry = () => {
    if (scopes.isError) {
      void scopes.refetch();

      return;
    }
    void content.refetch();
  };

  return {
    activeRelease: scopes.data?.activeRelease ?? undefined,
    content: content.data,
    isDraft,
    error: firstError(scopes.error, content.error),
    isError: scopes.isError || content.isError,
    isPreviewLoading: content.isLoading,
    isScopesLoading: scopes.isLoading,
    release: isDraft ? undefined : release,
    releases: scopes.data?.releases ?? [],
    retry,
    scopeKey: isDraft ? ONTOLOGY_DRAFT_EXPORT_SCOPE : chosen,
  };
};
