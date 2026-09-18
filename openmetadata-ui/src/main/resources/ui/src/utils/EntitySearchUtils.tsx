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

// Scans every `<span ...>` opening tag; the caller decides which ones are
// recognized wrappers (see `getRecognizedSpanProps`). Anything that isn't a
// recognized wrapper stays literal text — the outer tag never reaches the
// DOM, only the captured inner text.
const SPAN_TAG_RE = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;

const CLASS_ATTR_RE = /\bclass="([^"]*)"/;
const DATA_TESTID_ATTR_RE = /\bdata-testid="([^"]*)"/;

interface RecognizedSpan {
  className: string;
  dataTestId?: string;
}

// Recognize:
//   - `<span class="text-highlighter" ...>...</span>` — the search-highlight
//     wrapper the backend Elastic profile (EntityBuilderConstant.PRE_TAG) and
//     the client-side `highlightSearchText` helper both emit.
//   - `<span data-diff="true" class="..." data-testid="diff-added|diff-removed">…</span>`
//     — the version-diff wrapper `getDiffValue`/`getEntityVersionByField` emit
//     around old/new values on version pages (EntityDiffUtils).
// Only the whitelisted `class` and `data-testid` attributes carry through to
// the DOM; any other attribute on the outer tag is silently dropped.
const getRecognizedSpanProps = (attrs: string): RecognizedSpan | null => {
  const isHighlight = /\bclass="[^"]*\btext-highlighter\b[^"]*"/.test(attrs);
  const isDiff = /\bdata-diff="true"/.test(attrs);

  if (!isHighlight && !isDiff) {
    return null;
  }

  const className = attrs.match(CLASS_ATTR_RE)?.[1] ?? '';
  const dataTestId = attrs.match(DATA_TESTID_ATTR_RE)?.[1];

  return { className, dataTestId };
};

/**
 * Render a name/displayName that may carry a search-highlight wrapper (from
 * Elastic or the client-side highlighter) or a version-diff wrapper (from
 * `getDiffValue`/`getEntityVersionByField`) as a ReactNode. ONLY these two
 * wrappers are recognized:
 *
 *   - `<span class="text-highlighter">…</span>`
 *   - `<span data-diff="true" class="…" data-testid="…">…</span>`
 *
 * Each becomes a real `<span>` React node with **only** the wrapper's
 * whitelisted `class` and `data-testid` attributes carried through — any other
 * attribute on the outer tag is dropped. **Every other character in the input
 * renders as literal text**: no HTML parsing, no DOMPurify allowlist, no
 * `dangerouslySetInnerHTML`. Inner text is always a plain React child (safe
 * against nested `<script>`/`<img>`/`javascript:`-URL injection).
 *
 * Use this instead of `stringToHTML` when all a caller ever needs is those
 * two wrappers (entity name, displayName, tag values, ...). `stringToHTML`
 * runs DOMPurify's default profile, which keeps a wide set of benign tags
 * (`<a>`, `<b>`, `<i>`, `<img>`, ...) — a broader surface than a name ever
 * needs, and the exact class of sink flagged by GHSA-59gm-6h39-397f.
 *
 * Fast path: if the input contains no recognized wrapper the plain string is
 * returned as-is (memo-friendly, avoids allocating an array).
 */
export const renderHighlightedText = (input?: string | null): ReactNode => {
  if (!input) {
    return input ?? '';
  }

  interface Segment {
    kind: 'text' | 'span';
    value: string;
    className?: string;
    dataTestId?: string;
  }

  SPAN_TAG_RE.lastIndex = 0;
  const segments: Segment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = SPAN_TAG_RE.exec(input)) !== null) {
    const props = getRecognizedSpanProps(match[1]);
    if (!props) {
      // Not a recognized wrapper — keep scanning; the unrecognized span stays
      // in the input and will be emitted as literal text.
      continue;
    }
    if (match.index > cursor) {
      segments.push({ kind: 'text', value: input.slice(cursor, match.index) });
    }
    segments.push({
      kind: 'span',
      value: match[2],
      className: props.className,
      dataTestId: props.dataTestId,
    });
    cursor = match.index + match[0].length;
  }

  // No recognized wrapper found — return the raw string so callers get a
  // plain-string type rather than a wrapped node.
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
      <span className={only.className} data-testid={only.dataTestId}>
        {only.value}
      </span>
    );
  }

  return segments.map((segment, index) =>
    segment.kind === 'text' ? (
      segment.value
    ) : (
      <span
        className={segment.className}
        data-testid={segment.dataTestId}
        // eslint-disable-next-line react/no-array-index-key -- deterministic single-render, no reordering
        key={`hl-${index}`}>
        {segment.value}
      </span>
    )
  );
};
