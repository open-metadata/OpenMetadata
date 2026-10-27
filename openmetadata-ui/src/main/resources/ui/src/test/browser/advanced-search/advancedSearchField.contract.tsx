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

/**
 * The per-field flows of playwright/e2e/Features/AdvancedSearch.spec.ts: every
 * condition of a field, and two conditions joined as rules or as groups with
 * AND or OR, built in Explore's advanced search modal. Real page, real query
 * builder; only the network is mocked. Each step asserts the Elasticsearch
 * query the page sends as `query_filter` and the applied-filter summary.
 * Which documents a query matches is the search server's concern.
 *
 * One `AdvancedSearch.<Field>.browser.test.tsx` per field calls
 * `describeAdvancedSearchField`, so Vitest runs the fields in parallel.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  applyAdvancedSearch,
  clearAdvancedSearch,
  Explore,
  fillRule,
  modal,
  openAdvancedSearch,
  openExplore,
  pickSelect,
  serveExplore,
} from './queryBuilder';

/** A field as the spec lists it: its label and the ES field it filters. */
export interface SearchField {
  id: string;
  name: string;
  /** Conditions the field does not offer. */
  skipNull?: boolean;
}

type Clause = Record<string, unknown>;

/** The clause each operator adds for field `f` and value `v`. */
const CLAUSES: Record<string, (f: string, v: string) => Clause> = {
  '==': (f, v) => ({ term: { [f]: v } }),
  '!=': (f, v) => ({ bool: { must_not: { term: { [f]: v } } } }),
  Contains: (f, v) => ({ wildcard: { [f]: { value: `*${v}*` } } }),
  'Not contains': (f, v) => ({
    bool: { must_not: { wildcard: { [f]: { value: `*${v}*` } } } },
  }),
  'Any in': (f, v) => ({ bool: { should: [{ term: { [f]: v } }] } }),
  'Not in': (f, v) => ({
    bool: { must: [{ bool: { must_not: { term: { [f]: v } } } }] },
  }),
  'Is null': (f) => ({ bool: { must_not: { exists: { field: f } } } }),
  'Is not null': (f) => ({ exists: { field: f } }),
};

/** One rule, as the builder wraps it. */
const oneRule = (clause: Clause) => ({
  query: { bool: { must: [{ bool: { must: [clause] } }] } },
});

/** The spec's condition pairs: a positive one and its negation. */
const PAIRS: [string, string][] = [
  ['==', '!='],
  ['Contains', 'Not contains'],
  ['Any in', 'Not in'],
];

const summary = () => page.getByTestId('advance-search-filter-container');

export const describeAdvancedSearchField = (field: SearchField) => {
  const slug = field.id.toLowerCase().replace(/\W+/g, '-');
  const [first, second] = [`pw-${slug}-one`, `pw-${slug}-two`];

  describe(`Advanced search on ${field.id}`, { timeout: 90_000 }, () => {
    let explore: Explore;

    beforeEach(async () => {
      explore = serveExplore({ values: [first, second] });
      await openExplore();
    });

    test('every condition sends its query and shows in the summary', async () => {
      const conditions = Object.keys(CLAUSES).filter(
        (operator) => !(field.skipNull && operator.startsWith('Is '))
      );

      for (const operator of conditions) {
        const takesValue = !operator.startsWith('Is ');
        await openAdvancedSearch();
        await fillRule(0, {
          field: field.id,
          operator,
          value: takesValue ? first : undefined,
        });

        expect(await applyAdvancedSearch(explore)).toEqual(
          oneRule(CLAUSES[operator](field.name, first))
        );
        await expect.element(summary()).toHaveTextContent(field.name);

        if (takesValue) {
          await expect.element(summary()).toHaveTextContent(first);
        }

        await clearAdvancedSearch();
      }
    });

    describe.each([
      { join: 'rule', conjunction: 'AND' },
      { join: 'rule', conjunction: 'OR' },
      { join: 'group', conjunction: 'AND' },
      { join: 'group', conjunction: 'OR' },
    ])(
      'two conditions as a $join with $conjunction',
      ({ join, conjunction }) => {
        const key = conjunction === 'AND' ? 'must' : 'should';

        test.each(PAIRS)('%s and %s', async (positive, negative) => {
          await openAdvancedSearch();
          await fillRule(0, {
            field: field.id,
            operator: positive,
            value: first,
          });
          if (join === 'group') {
            // Adding a group asks how it joins the others; take the default.
            await userEvent.click(
              page.getByTestId('advanced-search-add-group').first()
            );
            await userEvent.click(
              page.getByTestId('advanced-search-add-group-and')
            );
          } else {
            await userEvent.click(page.getByTestId('advanced-search-add-rule'));
          }
          await fillRule(1, {
            field: field.id,
            operator: negative,
            value: second,
          });
          if (conjunction === 'OR') {
            await (join === 'group'
              ? // Groups join by the connector between their cards.
                pickSelect(
                  page.getByTestId('advanced-search-group-conjunction'),
                  'OR'
                )
              : userEvent.click(
                  modal().getByTestId('advanced-search-conjunction-or')
                ));
          }
          const clauses = [
            CLAUSES[positive](field.name, first),
            CLAUSES[negative](field.name, second),
          ];

          expect(await applyAdvancedSearch(explore)).toEqual(
            join === 'group'
              ? {
                  query: {
                    bool: {
                      [key]: clauses.map((clause) => ({
                        bool: { must: [clause] },
                      })),
                    },
                  },
                }
              : { query: { bool: { must: [{ bool: { [key]: clauses } }] } } }
          );
          await expect.element(summary()).toHaveTextContent(conjunction);

          await clearAdvancedSearch();
        });
      }
    );
  });
};
