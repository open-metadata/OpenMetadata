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

/** What the Studio shows: one native ontology, or the glossaries' business vocabulary. */
export type OntologyStudioScope =
  | { readonly kind: 'ontology'; readonly ontologyId: string }
  | { readonly kind: 'glossaries'; readonly glossaryId?: string };

export const ALL_GLOSSARIES_SCOPE: OntologyStudioScope = { kind: 'glossaries' };

const ONTOLOGY_PREFIX = 'ontology:';
const GLOSSARY_PREFIX = 'glossary:';

export const ALL_GLOSSARIES_SCOPE_KEY = `${GLOSSARY_PREFIX}all`;
export const NEW_ONTOLOGY_SCOPE_KEY = `${ONTOLOGY_PREFIX}new`;

export const getScopeKey = (scope: OntologyStudioScope): string => {
  if (scope.kind === 'ontology') {
    return `${ONTOLOGY_PREFIX}${scope.ontologyId}`;
  }

  return scope.glossaryId
    ? `${GLOSSARY_PREFIX}${scope.glossaryId}`
    : ALL_GLOSSARIES_SCOPE_KEY;
};

/** The scope a menu key selects; undefined for actions such as creating an ontology. */
export const parseScopeKey = (key: string): OntologyStudioScope | undefined => {
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
