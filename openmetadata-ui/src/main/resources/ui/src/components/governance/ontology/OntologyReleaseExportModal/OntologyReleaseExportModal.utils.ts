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

import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { ONTOLOGY_DRAFT_EXPORT_SCOPE } from '../../../../hooks/governance/ontology/useOntologyReleaseExport';
import type {
  OntologyReleaseExportContentState,
  OntologyReleaseExportScopeOption,
  OntologyReleaseExportSelection,
} from './OntologyReleaseExportModal.types';

interface OntologyReleasePreviewState {
  readonly error?: unknown;
  readonly content?: string;
  readonly isError: boolean;
  readonly isPreviewLoading: boolean;
  readonly isScopesLoading: boolean;
  readonly retry: () => void;
}

export const resolveContentOptions = (
  selection: OntologyReleaseExportSelection
) => ({
  includeBoundAssets:
    selection.options.includeBoundAssets && selection.card !== 'csv',
  includeInverses: selection.options.includeInverses,
});

/**
 * The export endpoint is requested as text, so axios leaves an error body
 * unparsed; the server's reason is the `message` of that JSON.
 */
export const resolveExportFailureReason = (error: unknown): string => {
  const data = (error as { response?: { data?: unknown } } | undefined)
    ?.response?.data;
  if (typeof data !== 'string') {
    return (data as { message?: string } | undefined)?.message ?? '';
  }
  try {
    const message = (JSON.parse(data) as { message?: unknown }).message;

    return typeof message === 'string' ? message : '';
  } catch {
    return data;
  }
};

export const resolveContentState = ({
  content,
  error,
  isError,
  isPreviewLoading,
  isScopesLoading,
  retry,
}: OntologyReleasePreviewState): OntologyReleaseExportContentState => {
  if (isScopesLoading) {
    return { kind: 'loading' };
  }

  return isError
    ? {
        kind: 'error',
        onRetry: retry,
        reason: resolveExportFailureReason(error) || undefined,
      }
    : { content, isPreviewLoading, kind: 'ready' };
};

interface ScopeLabels {
  readonly active: string;
  readonly draft: string;
  readonly draftHint: string;
  readonly releaseHint: string;
  readonly releaseName: (release: OntologyRelease) => string;
}

/** The draft first, then each captured release; the active one says so. */
export const resolveScopeOptions = (
  releases: readonly OntologyRelease[],
  activeReleaseId: string | undefined,
  labels: ScopeLabels
): readonly OntologyReleaseExportScopeOption[] => [
  {
    hint: labels.draftHint,
    key: ONTOLOGY_DRAFT_EXPORT_SCOPE,
    label: labels.draft,
  },
  ...releases.map((release) => ({
    hint: labels.releaseHint,
    key: release.id,
    label:
      release.id === activeReleaseId
        ? `${labels.releaseName(release)} · ${labels.active}`
        : labels.releaseName(release),
  })),
];

/** The draft and each release download under their own name, so one scope never overwrites another's file. */
export const resolveExportFileName = (
  ontologyName: string,
  extension: string,
  release?: Pick<OntologyRelease, 'releaseRevision'>
) => {
  const safeName = ontologyName.replaceAll(/[^a-zA-Z0-9-_]/g, '_');

  return release
    ? `${safeName}-release-${release.releaseRevision}.${extension}`
    : `${safeName}-draft.${extension}`;
};
