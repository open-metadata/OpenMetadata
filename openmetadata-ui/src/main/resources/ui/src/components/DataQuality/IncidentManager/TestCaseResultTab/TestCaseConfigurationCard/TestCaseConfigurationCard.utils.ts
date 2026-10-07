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
import startCase from 'lodash/startCase';
import { TestDefinition } from '../../../../../generated/tests/testDefinition';
import { getColumnNameFromEntityLink } from '../../../../../utils/EntityPureUtils';
import { TestCaseConfigurationCardProps } from './TestCaseConfigurationCard.types';

export interface ConfigurationShapes {
  hasVersionDiff: boolean;
  hasParameterRows: boolean;
  hasSql: boolean;
  isDynamicAssertion: boolean;
  isEmpty: boolean;
}

/**
 * Which of the card's sections have something to render.
 *
 * The prototype's shapes are independent, not a switch — a custom-SQL test
 * shows parameters *and* SQL — so each flag stands on its own and `isEmpty` is
 * the "nothing at all" fallback.
 */
export const getConfigurationShapes = ({
  testCaseData,
  parameterRows,
  withSqlParams,
  isVersionPage,
  versionParameterDiff,
}: Pick<
  TestCaseConfigurationCardProps,
  | 'testCaseData'
  | 'parameterRows'
  | 'withSqlParams'
  | 'isVersionPage'
  | 'versionParameterDiff'
>): ConfigurationShapes => {
  const hasVersionDiff = Boolean(versionParameterDiff);
  const hasParameterRows = parameterRows.length > 0;
  // The assertion SQL has no diff rendering, so the version page omits it
  // rather than showing a stale current value beside diffed parameters.
  const hasSql = !isVersionPage && withSqlParams.length > 0;
  const isDynamicAssertion = Boolean(testCaseData?.useDynamicAssertion);

  return {
    hasVersionDiff,
    hasParameterRows,
    hasSql,
    isDynamicAssertion,
    isEmpty:
      !hasVersionDiff && !hasParameterRows && !hasSql && !isDynamicAssertion,
  };
};

/** The card's heading line: the test definition, not the test case. */
export const getDefinitionDisplayName = (
  testDefinition: TestDefinition | undefined
): string =>
  testDefinition?.displayName ?? startCase(testDefinition?.name ?? '');

/**
 * `Table test` or `Column test · <column>`. A column test's entity link
 * carries the column; a table test's does not.
 */
export const getCategoryTranslation = (
  entityLink: string | undefined
): { key: string; options?: { column: string } } => {
  const column = entityLink
    ? getColumnNameFromEntityLink(entityLink)
    : undefined;

  return column
    ? { key: 'label.column-test-with-column', options: { column } }
    : { key: 'label.table-test' };
};

/**
 * The prototype highlights the assertion SQL as keyword-vs-plain only — it is
 * not a parser, and this deliberately isn't one either. Anything richer belongs
 * in the SQL Query tab's editor, not a 320px rail card.
 */
const SQL_KEYWORDS = new Set([
  'AND',
  'AS',
  'ASC',
  'BETWEEN',
  'BY',
  'CASE',
  'COUNT',
  'DESC',
  'DISTINCT',
  'ELSE',
  'END',
  'EXISTS',
  'FROM',
  'FULL',
  'GROUP',
  'HAVING',
  'IN',
  'INNER',
  'IS',
  'JOIN',
  'LEFT',
  'LIKE',
  'LIMIT',
  'NOT',
  'NULL',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'RIGHT',
  'SELECT',
  'SUM',
  'THEN',
  'UNION',
  'WHEN',
  'WHERE',
  'WITH',
]);

export interface SqlToken {
  text: string;
  isKeyword: boolean;
  /** Column offset within the line — a stable render key. */
  offset: number;
}

export interface SqlLine {
  number: number;
  tokens: SqlToken[];
}

/**
 * Split into tokens while *keeping* the separators, so the rendered text is
 * byte-for-byte the original and `white-space: pre-wrap` can preserve the
 * author's indentation.
 */
export const tokenizeSqlLine = (line: string): SqlToken[] => {
  let offset = 0;

  return line
    .split(/(\s+|[(),;])/)
    .filter((part) => part !== '')
    .map((text) => {
      const token = {
        text,
        isKeyword: SQL_KEYWORDS.has(text.toUpperCase()),
        offset,
      };
      offset += text.length;

      return token;
    });
};

export const toSqlLines = (value: string): SqlLine[] =>
  value.split('\n').map((line, index) => ({
    number: index + 1,
    tokens: tokenizeSqlLine(line),
  }));
