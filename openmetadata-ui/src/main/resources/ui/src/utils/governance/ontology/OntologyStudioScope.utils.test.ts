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
import {
  getScopeKey,
  getStudioScope,
  NativeOntologyListState,
  OntologyStudioScope,
  parseScopeKey,
  shouldFallBackToGlossaryScope,
} from './OntologyStudioScope.utils';

describe('Studio URL scope', () => {
  it.each<[string, OntologyStudioScope]>([
    ['', { kind: 'allOntologies' }],
    ['scope=glossary:all', { kind: 'glossaries' }],
    ['scope=glossary:business', { kind: 'glossaries', glossaryId: 'business' }],
    ['draft=proposal', { kind: 'glossaries' }],
    [
      'ontology=native&draft=proposal&scope=glossary:all',
      { kind: 'ontology', ontologyId: 'native' },
    ],
  ])('resolves %s without crossing data domains', (query, expected) => {
    expect(getStudioScope(new URLSearchParams(query))).toEqual(expected);
    expect(parseScopeKey(getScopeKey(expected))).toEqual(expected);
  });

  it('rejects empty selection keys', () => {
    expect(parseScopeKey('ontology:')).toBeUndefined();
    expect(parseScopeKey('glossary:')).toBeUndefined();
  });
});

describe('shouldFallBackToGlossaryScope', () => {
  const loadedEmpty: NativeOntologyListState = {
    isCreatingOntology: false,
    isOntologyError: false,
    isOntologyFetching: false,
    isOntologyLoading: false,
    ontologyCount: 0,
  };

  it('falls back when a bare link finds no native ontology', () => {
    expect(
      shouldFallBackToGlossaryScope(new URLSearchParams(), loadedEmpty)
    ).toBe(true);
  });

  it.each<[string, string, Partial<NativeOntologyListState>]>([
    ['the list is loading', '', { isOntologyLoading: true }],
    ['a cached list is refreshing', '', { isOntologyFetching: true }],
    ['the list failed', '', { isOntologyError: true }],
    ['an ontology is being created', '', { isCreatingOntology: true }],
    ['native ontologies exist', '', { ontologyCount: 1 }],
    ['All ontologies was chosen explicitly', 'scope=ontology:all', {}],
    ['a glossary scope is set', 'scope=glossary:all', {}],
    ['an ontology is linked', 'ontology=native', {}],
    ['a draft is linked', 'draft=proposal', {}],
  ])('stays put when %s', (_case, query, overrides) => {
    expect(
      shouldFallBackToGlossaryScope(new URLSearchParams(query), {
        ...loadedEmpty,
        ...overrides,
      })
    ).toBe(false);
  });
});
