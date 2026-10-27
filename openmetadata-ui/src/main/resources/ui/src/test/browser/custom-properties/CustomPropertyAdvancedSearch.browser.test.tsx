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
 * Custom properties in Explore's advanced search, from
 * playwright/e2e/Pages/CustomProperties.spec.ts and
 * playwright/e2e/Features/AdvancedSearch.spec.ts: the sub-fields a property
 * adds, the range and text conditions on its value, and an enum's lazily
 * loaded values. Real page, real query builder; only the network is mocked.
 * Each step asserts the `query_filter` the page sends; which documents match
 * it is the search server's concern.
 */
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  customProperty,
  FieldTypeName,
  SPEC_CONFIG,
  summaryOf,
} from '../fixtures/customProperties';
import {
  applyAdvancedSearch,
  clearAdvancedSearch,
  modal,
  openAdvancedSearch,
  openExplore,
  pickField,
  pickOperator,
  rule,
  serveExplore,
} from '../advanced-search/queryBuilder';

/** As long as the spec's generated names, so the labels overflow the select. */
const LONG_NAME = 'cp-a-long-custom-property-name-that-overflows-the-select';

const serveProperty = (type: FieldTypeName, name: string, config?: unknown) =>
  serveExplore({
    customProperties: {
      table: [
        summaryOf(
          customProperty(
            type,
            name,
            (config ?? SPEC_CONFIG[type]) as typeof SPEC_CONFIG.enum
          )
        ),
      ],
    },
  });

/** Opens the modal on rule 0's `Custom Properties › Table › <label>`. */
const openOnProperty = async (label: string) => {
  await openExplore();
  await openAdvancedSearch();
  await pickField(0, ['Custom Properties', 'Table', label]);
};

const valueInputs = () =>
  rule(0).getByTestId('advanced-search-value').getByTestId('qb-number-input');

/** Typed custom property values are indexed as `customPropertiesTyped` entries. */
const typed = (name: string, clause: Record<string, unknown>) => ({
  nested: {
    path: 'customPropertiesTyped',
    ignore_unmapped: true,
    query: {
      bool: {
        must: [{ term: { 'customPropertiesTyped.name': name } }, clause],
      },
    },
  },
});

describe('Custom properties in advanced search', { timeout: 60_000 }, () => {
  test.each([
    { type: 'timeInterval', suffixes: [' (Start)', ' (End)'] },
    { type: 'hyperlink-cp', suffixes: [' URL', ' Display Text'] },
    { type: 'table-cp', suffixes: [' - pw-column1', ' - pw-column2'] },
  ] as const)(
    'selects each long $type sub-field in turn',
    async ({ type, suffixes }) => {
      serveProperty(type, LONG_NAME);
      await openExplore();
      await openAdvancedSearch();
      await pickField(0, ['Custom Properties', 'Table']);

      // pickField confirms the select shows each label once picked.
      for (const suffix of suffixes) {
        await pickField(0, [`${LONG_NAME}${suffix}`], 2);
      }

      await userEvent.click(page.getByTestId('cancel-btn'));

      await expect.element(modal()).not.toBeInTheDocument();
    }
  );

  test('a number between two bounds sends both (#27482)', async () => {
    const name = 'pwNumberBetweenTest';
    const explore = serveProperty('number', name);

    for (const [operator, [start, end]] of [
      ['Between', [50, 60]],
      ['Not between', [1, 5]],
    ] as const) {
      await openOnProperty(name);
      await pickOperator(0, operator);
      const [from, to] = valueInputs().all();
      await userEvent.fill(from, String(start));
      await userEvent.fill(to, String(end));
      const filter = JSON.stringify(await applyAdvancedSearch(explore));

      expect(filter).toContain(`"customPropertiesTyped.name":"${name}"`);
      expect(filter).toContain(`"gte":${start}`);
      expect(filter).toContain(`"lte":${end}`);

      if (operator === 'Not between') {
        expect(filter).toContain('"must_not"');
      }

      await clearAdvancedSearch();
    }
  });

  test('a duration matches exactly with == and partially with Contains', async () => {
    const name = 'cp-duration';
    const explore = serveProperty('duration', name);

    for (const [operator, text, clause] of [
      [
        '==',
        'PT1H30M',
        typed(name, {
          term: { 'customPropertiesTyped.stringValue': 'PT1H30M' },
        }),
      ],
      [
        'Contains',
        'PT1',
        typed(name, {
          wildcard: { 'customPropertiesTyped.stringValue': { value: '*PT1*' } },
        }),
      ],
    ] as const) {
      await openOnProperty(name);
      await pickOperator(0, operator);
      await userEvent.fill(
        rule(0).getByTestId('advanced-search-value-text'),
        text
      );

      expect(JSON.stringify(await applyAdvancedSearch(explore))).toContain(
        JSON.stringify(clause)
      );

      await clearAdvancedSearch();
    }
  });

  test('an enum finds values past the first page by searching, without Load more', async () => {
    // The first fetch returns 100 values; the rest load on scroll.
    const values = Array.from(
      { length: 150 },
      (_, i) => `enum_val_${String(i).padStart(3, '0')}`
    );
    serveProperty('enum', 'enum-lazy', { values, multiSelect: true });
    await openOnProperty('enum-lazy');
    await pickOperator(0, 'Equals');
    const input = rule(0)
      .getByTestId('advanced-search-value')
      .getByRole('combobox');
    await userEvent.fill(input, '');

    await expect
      .element(page.getByRole('option', { name: 'enum_val_000' }))
      .toBeVisible();
    await expect
      .element(page.getByRole('option', { name: 'enum_val_100' }))
      .not.toBeInTheDocument();

    await userEvent.fill(input, 'enum_val_100');

    await expect
      .element(page.getByRole('option', { name: 'enum_val_100' }))
      .toBeVisible();
  });
});
