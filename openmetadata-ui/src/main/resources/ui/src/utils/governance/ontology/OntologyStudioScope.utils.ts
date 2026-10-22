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

/** URL-owned native and business-vocabulary scopes. */
export type OntologyStudioScope =
  | { readonly kind: 'allOntologies' }
  | { readonly kind: 'ontology'; readonly ontologyId: string }
  | { readonly kind: 'glossaries'; readonly glossaryId?: string };

export const ALL_GLOSSARIES_SCOPE: OntologyStudioScope = { kind: 'glossaries' };

const ONTOLOGY_PREFIX = 'ontology:';
const GLOSSARY_PREFIX = 'glossary:';

export const ALL_ONTOLOGIES_SCOPE_KEY = 'ontology:all';
export const ALL_ONTOLOGIES_SCOPE: OntologyStudioScope = {
  kind: 'allOntologies',
};

export const ALL_GLOSSARIES_SCOPE_KEY = `${GLOSSARY_PREFIX}all`;
export const NEW_ONTOLOGY_SCOPE_KEY = `${ONTOLOGY_PREFIX}new`;

export const getScopeKey = (scope: OntologyStudioScope): string => {
  if (scope.kind === 'allOntologies') {
    return ALL_ONTOLOGIES_SCOPE_KEY;
  }
  if (scope.kind === 'ontology') {
    return `${ONTOLOGY_PREFIX}${scope.ontologyId}`;
  }

  return scope.glossaryId
    ? `${GLOSSARY_PREFIX}${scope.glossaryId}`
    : ALL_GLOSSARIES_SCOPE_KEY;
};

/** The scope a menu key selects; undefined for actions such as creating an ontology. */
export const parseScopeKey = (key: string): OntologyStudioScope | undefined => {
  if (key === ALL_ONTOLOGIES_SCOPE_KEY) {
    return ALL_ONTOLOGIES_SCOPE;
  }
  if (key === ONTOLOGY_PREFIX || key === GLOSSARY_PREFIX) {
    return undefined;
  }
  if (key === ALL_GLOSSARIES_SCOPE_KEY) {
    return ALL_GLOSSARIES_SCOPE;
  }
  if (key.startsWith(GLOSSARY_PREFIX)) {
    return {
      glossaryId: key.slice(GLOSSARY_PREFIX.length),
      kind: 'glossaries',
    };
  }
  if (key.startsWith(ONTOLOGY_PREFIX) && key !== NEW_ONTOLOGY_SCOPE_KEY) {
    return { kind: 'ontology', ontologyId: key.slice(ONTOLOGY_PREFIX.length) };
  }

  return undefined;
};

export const isOntologyScope = (
  scope: OntologyStudioScope
): scope is Extract<OntologyStudioScope, { kind: 'ontology' }> =>
  scope.kind === 'ontology';

export const getStudioScope = (
  params: URLSearchParams
): OntologyStudioScope => {
  const ontologyId = params.get('ontology');
  if (ontologyId) {
    return { kind: 'ontology', ontologyId };
  }
  const explicitScope = parseScopeKey(params.get('scope') ?? '');
  if (explicitScope?.kind === 'glossaries') {
    return explicitScope;
  }
  if (params.get('scope')?.startsWith(GLOSSARY_PREFIX)) {
    return ALL_GLOSSARIES_SCOPE;
  }

  return params.has('draft') ? ALL_GLOSSARIES_SCOPE : ALL_ONTOLOGIES_SCOPE;
};

/** What the Studio knows about the native ontology list when it decides a scope. */
export interface NativeOntologyListState {
  readonly isCreatingOntology: boolean;
  readonly isOntologyError: boolean;
  /** A list request is in flight, including a background refresh of a cached list. */
  readonly isOntologyFetching: boolean;
  readonly isOntologyLoading: boolean;
  readonly ontologyCount: number;
}

const isBareAllOntologiesLink = (params: URLSearchParams): boolean =>
  !params.has('scope') && getStudioScope(params).kind === 'allOntologies';

const isListSettled = (list: NativeOntologyListState): boolean =>
  !list.isOntologyLoading && !list.isOntologyFetching && !list.isOntologyError;

// A cached empty list must not decide while a fresh request may still return ontologies.
const isSettledEmptyList = (list: NativeOntologyListState): boolean =>
  !list.isCreatingOntology && isListSettled(list) && list.ontologyCount === 0;

/**
 * Whether a bare Studio link should open glossary vocabulary instead: only once the
 * native list has loaded empty, never for an explicit scope, a failed list or while
 * creating (ADR:2026-10-19-ontology-studio-opens-native-models-by-default).
 */
export const shouldFallBackToGlossaryScope = (
  params: URLSearchParams,
  list: NativeOntologyListState
): boolean => isBareAllOntologiesLink(params) && isSettledEmptyList(list);
