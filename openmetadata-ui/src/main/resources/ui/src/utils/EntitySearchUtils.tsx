/*
 *  Copyright 2025 Collate.
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

import { escapeRegExp, isUndefined, lowerCase } from 'lodash';
import { ReactNode } from 'react';
import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import { Column } from '../generated/entity/data/table';
import { getEntityName } from './EntityNameUtils';
import { getDataTypeString } from './TablePureUtils';

/**
 * It searches for a given text in a given table and returns a new table with only the columns that
 * contain the given text
 * @param {Column[]} table - Column[] - the table to search in
 * @param {string} searchText - The text to search for.
 * @returns An array of columns that have been searched for a specific string.
 */
export const searchInColumns = <T extends Column | SearchIndexField>(
  table: T[],
  searchText: string
): T[] => {
  const searchedValue: T[] = table.reduce((searchedCols, column) => {
    const searchLowerCase = lowerCase(searchText);
    const isContainData =
      lowerCase(column.name).includes(searchLowerCase) ||
      lowerCase(column.displayName).includes(searchLowerCase) ||
      lowerCase(column.description).includes(searchLowerCase) ||
      lowerCase(getDataTypeString(column.dataType)).includes(searchLowerCase);

    if (isContainData) {
      return [...searchedCols, column];
    } else if (!isUndefined(column.children)) {
      const searchedChildren = searchInColumns<T>(
        column.children as T[],
        searchText
      );
      if (searchedChildren.length > 0) {
        return [
          ...searchedCols,
          {
            ...column,
            children: searchedChildren,
          },
        ];
      }
    }

    return searchedCols;
  }, [] as T[]);

  return searchedValue;
};

export const highlightEntityNameAndDescription = (
  entity: SearchedDataProps['data'][number]['_source'],
  highlight: SearchedDataProps['data'][number]['highlight']
): SearchedDataProps['data'][number]['_source'] => {
  let entityDescription = entity.description ?? '';
  const descHighlights = highlight?.description ?? [];

  if (descHighlights.length > 0) {
    const matchTextArr = descHighlights.map((val: string) =>
      val.replace(/<\/?span(.*?)>/g, '')
    );

    matchTextArr.forEach((text: string, i: number) => {
      entityDescription = entityDescription.replace(text, descHighlights[i]);
    });
  }

  let entityDisplayName = getEntityName(entity);
  if (!isUndefined(highlight)) {
    entityDisplayName =
      highlight?.displayName?.join(' ') ||
      highlight?.name?.join(' ') ||
      entityDisplayName;
  }

  return {
    ...entity,
    displayName: entityDisplayName,
    description: entityDescription,
  };
};

export const highlightSearchText = (
  text?: string,
  searchText?: string
): string => {
  if (!searchText || !text) {
    return text ?? '';
  }

  const regex = new RegExp(`(${escapeRegExp(searchText)})`, 'gi');

  return text.replace(
    regex,
    `<span data-highlight="true" class="text-highlighter">$1</span>`
  );
};

/**
 * It searches for a given text in a given string and returns an array that contains the string parts that have
 * highlighted element if match found.
 * @param text - The text to search in.
 * @param searchText - The text to search for.
 * @returns An Array of string or JSX.Element which contains highlighted element.
 */
export const highlightSearchArrayElement = (
  text?: string,
  searchText?: string
): string | (string | JSX.Element)[] => {
  if (!searchText || !text) {
    return text ?? '';
  }
  const stringParts = text.split(
    new RegExp(`(${escapeRegExp(searchText)})`, 'gi')
  );

  return stringParts.map((part, index) =>
    part.toLowerCase() === (searchText ?? '').toLowerCase() ? (
      // eslint-disable-next-line react/no-array-index-key -- tokenized string parts, fixed order, may repeat
      <span className="text-highlighter" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      part
    )
  );
};

// Matches ONLY the search-highlight wrapper the backend Elastic profile emits
// (EntityBuilderConstant.PRE_TAG) and that the client-side `highlightSearchText`
// helper injects. `[^>]*` inside the opening tag tolerates the client-side
// helper's extra `data-highlight="true"` attribute without accepting anything
// interesting from a security standpoint — the outer tag never reaches the DOM,
// only the captured inner text does.
const HIGHLIGHT_TAG_RE =
  /<span\b[^>]*\bclass="text-highlighter"[^>]*>([\s\S]*?)<\/span>/gi;

/**
 * Render a name/displayName that may carry search-highlight wrappers as a
 * ReactNode. ONLY `<span class="text-highlighter">…</span>` (the wrapper both
 * the backend Elastic profile and the client-side highlighter emit) is
 * recognized — its inner text becomes a real `<span class="text-highlighter">`
 * React node. **Every other character in the input renders as literal text**:
 * no HTML parsing, no DOMPurify allowlist, no `dangerouslySetInnerHTML`.
 *
 * Use this instead of `stringToHTML` when all a caller ever needs from the
 * input is the highlight wrapper (entity name, displayName, tag values, ...).
 * `stringToHTML` runs DOMPurify's default profile, which keeps a wide set of
 * benign tags (<a>, <b>, <i>, <img>, ...) — a broader surface than a name
 * ever needs, and the exact class of sink flagged by GHSA-59gm-6h39-397f.
 *
 * Fast path: if the input contains no highlight wrapper the plain string is
 * returned as-is (memo-friendly, avoids allocating an array).
 */
export const renderHighlightedText = (input?: string | null): ReactNode => {
  if (!input) {
    return input ?? '';
  }

  interface Segment {
    kind: 'text' | 'hl';
    value: string;
  }

  HIGHLIGHT_TAG_RE.lastIndex = 0;
  const segments: Segment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = HIGHLIGHT_TAG_RE.exec(input)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', value: input.slice(cursor, match.index) });
    }
    segments.push({ kind: 'hl', value: match[1] });
    cursor = match.index + match[0].length;
  }

  // No wrapper found — return the raw string so callers get a plain-string
  // type rather than a wrapped node.
  if (cursor === 0) {
    return input;
  }

  if (cursor < input.length) {
    segments.push({ kind: 'text', value: input.slice(cursor) });
  }

  // Whole input is a single wrapper — return the bare React element rather
  // than a length-1 array. This keeps `toEqual(<span ...>)` fixtures usable
  // without forcing every caller/test to add a key.
  if (segments.length === 1) {
    const only = segments[0];

    return only.kind === 'text' ? (
      only.value
    ) : (
      <span className="text-highlighter">{only.value}</span>
    );
  }

  return segments.map((segment, index) =>
    segment.kind === 'text' ? (
      segment.value
    ) : (
      // eslint-disable-next-line react/no-array-index-key -- deterministic single-render, no reordering
      <span className="text-highlighter" key={`hl-${index}`}>
        {segment.value}
      </span>
    )
  );
};
