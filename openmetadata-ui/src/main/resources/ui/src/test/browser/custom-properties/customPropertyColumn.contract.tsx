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
 * The column flows of playwright/e2e/Pages/CustomProperties.spec.ts: a value
 * of each property type set on a table column from its detail panel, sent
 * with `PUT /columns/name/{fqn}`, and still shown after a reload. Real page,
 * real panel and editors; only the network is mocked.
 *
 * Two `CustomPropertyColumn.<Group>.browser.test.tsx` files split the types,
 * so Vitest runs them in parallel.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Column } from '../../../generated/entity/data/table';
import {
  ChildServer,
  entityConfig,
  mountEntityPage,
} from '../entity-matrix/entityMatrix';
import {
  FieldTypeName,
  ONE_OF_EACH,
  propertyOf,
  serveEntityType,
} from '../fixtures/customProperties';
import { ADMIN } from '../fixtures/personas';
import { ALL_COLUMNS } from '../fixtures/table';
import { EMPTY_LIST, worker } from '../msw';
import { setValue, VALUES } from './customPropertyEditors';

const COLUMN_FQN = ALL_COLUMNS[0].fullyQualifiedName ?? '';

/** What a panel row's summary holds once a value is saved; none = derived. */
const summaryOf = (type: FieldTypeName, input: string) => {
  switch (type) {
    case 'string':
    case 'integer':
    case 'number':
    case 'email':
    case 'duration':
    case 'enum':
    case 'markdown':
      return input;
    case 'hyperlink-cp': {
      const [url, displayText] = input.split(',');

      return displayText || url;
    }
    default:
      return undefined;
  }
};

const panel = () => page.getByCSS('.column-detail-panel-container');
const row = (name: string) =>
  panel()
    .getByTestId('custom-properties-list')
    .getByTestId(`custom-property-${name}-row`);

/** Opens the panel's Custom Properties tab and narrows it to `name`. */
const findRow = async (name: string) => {
  await userEvent.click(panel().getByTestId('custom-properties-tab'));
  await userEvent.fill(panel().getByTestId('searchbar'), name);

  await expect.element(row(name)).toBeVisible();
};

const expectSummary = async (
  name: string,
  type: FieldTypeName,
  input: string
) => {
  const summary = row(name).getByTestId('property-value');
  const expected = summaryOf(type, input);

  await expect.element(summary).not.toHaveTextContent('Not set');

  if (expected) {
    await expect.element(summary).toHaveTextContent(expected);
  }
};

export const describeColumnCustomProperties = (types: FieldTypeName[]) =>
  describe('Table column custom properties', { timeout: 60_000 }, () => {
    test.each(types.map((type) => ({ type })))(
      'set a $type value from the column panel; it persists',
      async ({ type }) => {
        const property = propertyOf(type);
        const { input, saved } = VALUES[type][0];
        serveEntityType('tableColumn', ONE_OF_EACH);
        // The panel's data quality summary: no tests.
        worker.use(
          http.get('/api/v1/dataQuality/testCases', () =>
            HttpResponse.json(EMPTY_LIST)
          )
        );
        const table = entityConfig('Table');
        // Opening a column's own URL opens its detail panel.
        const entity = await mountEntityPage(
          { ...table, url: `/table/${encodeURIComponent(COLUMN_FQN)}` },
          ADMIN
        );
        const column = () => (entity.child as ChildServer).current() as Column;

        await expect.element(panel()).toBeVisible();

        await findRow(property.name);
        await setValue(row(property.name), property, input);

        const writes = (entity.child as ChildServer).writes() as {
          fqn: string;
          body: { extension?: Record<string, unknown> };
        }[];

        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].fqn).toBe(COLUMN_FQN);

        const sent = column().extension?.[property.name];
        // References carry extra fields (e.g. `deleted`); the rest is exact.
        if (typeof saved === 'object') {
          expect(sent).toMatchObject(saved as object);
        } else {
          expect(sent).toEqual(saved);
        }

        await expectSummary(property.name, type, input);

        await entity.reload();

        await expect.element(panel()).toBeVisible();

        await findRow(property.name);
        await expectSummary(property.name, type, input);

        await userEvent.click(page.getByTestId('close-button'));

        await expect.element(panel()).not.toBeInTheDocument();
      }
    );
  });
