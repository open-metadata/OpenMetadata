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

const MIN_NAME_WORD_LENGTH = 3;
// Abbreviations such as "Rx" are what synonyms are for.
const MIN_SYNONYM_LENGTH = 2;
const MAX_TERMS = 6;

export interface SuggestionTerm {
  text: string;
  kind: 'name' | 'synonym';
}

export type SuggestionReason =
  | { kind: 'name'; term: string }
  | { kind: 'synonym'; term: string }
  | { kind: 'column'; term: string; column: string };

export interface SuggestionCandidate {
  name?: string;
  displayName?: string;
  columns?: ReadonlyArray<{ name?: string }>;
}

/** The words of the concept name, then its synonyms, that a catalog asset can be matched on. */
export const getSuggestionTerms = (
  conceptName: string,
  synonyms: readonly string[] = []
): SuggestionTerm[] => {
  const seen = new Set<string>();
  const terms: SuggestionTerm[] = [];
  const add = (text: string, kind: SuggestionTerm['kind']) => {
    const key = text.toLocaleLowerCase();
    const minLength =
      kind === 'name' ? MIN_NAME_WORD_LENGTH : MIN_SYNONYM_LENGTH;
    if (text.length >= minLength && !seen.has(key)) {
      seen.add(key);
      terms.push({ text, kind });
    }
  };
  conceptName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .forEach((word) => add(word, 'name'));
  synonyms.forEach((synonym) => add(synonym.trim(), 'synonym'));

  return terms.slice(0, MAX_TERMS);
};

const includes = (value: string | undefined, term: string) =>
  Boolean(value?.toLocaleLowerCase().includes(term.toLocaleLowerCase()));

/** Why an asset is suggested for the concept: its name, then one of its columns, matches a term. */
export const getSuggestionReason = (
  candidate: SuggestionCandidate,
  terms: readonly SuggestionTerm[]
): SuggestionReason | undefined => {
  const named = terms.find(
    ({ text }) =>
      includes(candidate.name, text) || includes(candidate.displayName, text)
  );
  if (named) {
    return { kind: named.kind, term: named.text };
  }
  for (const { text } of terms) {
    const column = candidate.columns?.find((item) => includes(item.name, text));
    if (column?.name) {
      return { kind: 'column', term: text, column: column.name };
    }
  }

  return undefined;
};
