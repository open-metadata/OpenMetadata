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

import { RDFTerm } from '../../generated/api/rdf/sparqlResponse';
import { getRelativeTime } from '../../utils/date-time/DateTimeUtils';
import { getTermDisplayText } from '../../utils/Sparql/SparqlTerm.utils';

type ResultRow = { [variable: string]: RDFTerm };

const CSV_SPECIAL = /[",\r\n]/;

function toCsvCell(text: string): string {
  return CSV_SPECIAL.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toTsvCell(text: string): string {
  return text.replace(/[\t\r\n]+/g, ' ');
}

function buildDelimited(
  variables: string[],
  rows: ResultRow[],
  toCell: (text: string) => string,
  separator: string
): string {
  const lines = [
    variables.map(toCell).join(separator),
    ...rows.map((row) =>
      variables
        .map((variable) => toCell(getTermDisplayText(row[variable])))
        .join(separator)
    ),
  ];

  return lines.join('\n');
}

/** The table as it is shown: the cell text is the same display text the table renders. */
export const buildCsv = (variables: string[], rows: ResultRow[]): string =>
  buildDelimited(variables, rows, toCsvCell, ',');

export const buildTsv = (variables: string[], rows: ResultRow[]): string =>
  buildDelimited(variables, rows, toTsvCell, '\t');

/** "All concepts" becomes "All-concepts.csv"; a query with no usable name falls back to "query-results". */
export const toCsvFileName = (name?: string): string => {
  const slug = (name ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'query-results'}.csv`;
};

const JUST_NOW_MS = 60_000;

/** "just now" for the first minute (Luxon would say "0 seconds ago"), then Luxon's relative time. */
export const describeTimeAgo = (
  timestamp: number,
  justNow: string,
  now = Date.now()
): string =>
  now - timestamp < JUST_NOW_MS ? justNow : getRelativeTime(timestamp);
