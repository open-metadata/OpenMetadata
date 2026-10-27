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
 * The child-row flows of playwright/e2e/Pages/Entity.spec.ts that go beyond
 * the row edits `entityDataSteward.contract.tsx` covers: the column detail
 * panel (tags, glossary terms and description edited from it, tag edits
 * keeping glossary terms, its tabs and previous/next navigation), the tag and
 * glossary pickers closing each other, and the Tags column filter. Real page,
 * real widgets; only the network is mocked. Each edit asserts the write the
 * page sent and what the panel and the row show after the round trip.
 *
 * One `EntityColumnPanel.<Type>.browser.test.tsx` per type with children
 * calls `describeColumnPanelFlows`; the shared steps are in `entityMatrix.ts`.
 */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import { Column, DataType } from '../../../generated/entity/data/table';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import {
  makeColumn,
  makeTable,
  serveColumns,
  TABLE_FQN,
} from '../fixtures/table';
import { ADMIN, DATA_CONSUMER } from '../fixtures/personas';
import { worker } from '../msw';
import { makeMlModel, UNTOUCHED } from '../fixtures/dataAssets';
import { GLOSSARY_TERMS } from '../fixtures/glossary';
import { PERSONAL_DATA_PERSONAL, PII_NONE } from '../fixtures/tags';
import {
  ChildServer,
  childRow,
  DESCRIPTION,
  entityConfig,
  EntityLabel,
  EntityPage,
  mountEntityPage,
  openChildrenTab,
  PageConfig,
  pickGlossaryTerm,
  pickTag,
  saveDescription,
  tagFqns,
  toggleTag,
} from './entityMatrix';

export const panel = () => page.getByCSS('.column-detail-panel');

const nested = (parent: Column, name: string, dataType: DataType): Column => ({
  name,
  fullyQualifiedName: `${parent.fullyQualifiedName}.${name}`,
  dataType,
  dataTypeDisplay: dataType.toLowerCase(),
  tags: [],
});

const ID: Column = {
  ...makeColumn(1, { name: 'id', fullyQualifiedName: `${TABLE_FQN}.id` }),
  profile: {
    name: 'id',
    timestamp: 1_700_000_000_000,
    uniqueProportion: 0.75,
    nullProportion: 0.1,
    distinctProportion: 0.5,
    valuesCount: 1200,
  },
};
const CUSTOMER = makeColumn(2, {
  name: 'customer',
  fullyQualifiedName: `${TABLE_FQN}.customer`,
  dataType: DataType.Struct,
  dataTypeDisplay: 'struct<name:varchar,orders:array<struct<order_id:bigint>>>',
});
const ORDERS: Column = {
  ...nested(CUSTOMER, 'orders', DataType.Array),
  children: [],
};
ORDERS.children = [nested(ORDERS, 'order_id', DataType.Bigint)];
CUSTOMER.children = [nested(CUSTOMER, 'name', DataType.Varchar), ORDERS];

/** A scalar column with a profile, and a struct holding a scalar and an array of structs. */
const NESTED_COLUMNS = [ID, CUSTOMER, makeColumn(3)];

/** The Table page over `columns`, served (and read by FQN) like the server does. */
const tableWith = (columns: Column[]): PageConfig => {
  const table = entityConfig('Table');

  return {
    ...table,
    make: () => makeTable({ ...UNTOUCHED, columns }),
    serveExtras: (server) => {
      table.serveExtras(server);
      const store = serveColumns('tables', columns);

      return {
        current: () => store.current()[0],
        writes: () => store.updates,
        reads: () => store.reads,
      };
    },
  };
};

const testCase = (name: string, status: TestCaseStatus): TestCase => ({
  id: `6b7c8d9e-0000-4000-8000-${String(name.length).padStart(12, '0')}`,
  name,
  fullyQualifiedName: `${ID.fullyQualifiedName}.${name}`,
  entityLink: `<#E::table::${TABLE_FQN}::columns::id>`,
  testDefinition: {
    id: '6b7c8d9e-0000-4000-8000-000000000100',
    type: 'testDefinition',
    name: 'columnValuesToBeBetween',
  },
  testCaseResult: { timestamp: Date.now(), testCaseStatus: status },
  testSuite: {
    id: '6b7c8d9e-0000-4000-8000-000000000101',
    type: 'testSuite',
    name: `${TABLE_FQN}.testSuite`,
  },
});

const PASSED = testCase('pw_col_dq_success', TestCaseStatus.Success);
const FAILED = testCase('pw_col_dq_failed', TestCaseStatus.Failed);

const INCIDENT: TestCaseResolutionStatus = {
  id: '6b7c8d9e-0000-4000-8000-000000000200',
  stateId: '6b7c8d9e-0000-4000-8000-000000000201',
  timestamp: Date.now(),
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  testCaseReference: {
    id: FAILED.id ?? '',
    type: 'testCase',
    name: FAILED.name,
    fullyQualifiedName: FAILED.fullyQualifiedName,
  },
};

/** The column's tests (listed and searched alike) and the table's open incidents. */
const serveColumnTests = (
  tests: TestCase[],
  incidents: TestCaseResolutionStatus[]
) =>
  worker.use(
    http.get('/api/v1/dataQuality/testCases', () =>
      HttpResponse.json({ data: tests, paging: { total: tests.length } })
    ),
    http.get('/api/v1/dataQuality/testCases/search/list', () =>
      HttpResponse.json({ data: tests, paging: { total: tests.length } })
    ),
    http.get('/api/v1/dataQuality/testCases/testCaseIncidentStatus', () =>
      HttpResponse.json({
        data: incidents,
        paging: { total: incidents.length },
      })
    )
  );

/**
 * Opens the detail panel of `row`'s child by clicking its name, as a user
 * would: the name inside the row's name cell, or the cell itself.
 */
export const openPanel = async (row: () => Locator, nameTestId: string) => {
  const cell = row().getByTestId('column-name-cell');
  const name = cell.getByTestId(nameTestId);
  // MlModel feature cards have no name cell; their name is clicked directly.
  const target = cell.query() ? cell : row().getByTestId(nameTestId);
  await userEvent.click(name.query() ? name : target);

  await expect.element(panel().getByTestId('entity-link')).toBeVisible();
};

export const closePanel = async () => {
  await userEvent.click(panel().getByTestId('close-button'));

  await expect.element(panel()).not.toBeInTheDocument();
};

export const describeColumnPanelFlows = (label: EntityLabel) => {
  const config = entityConfig(label);
  const row = childRow(config);
  const nameTestId = label === 'Pipeline' ? 'task-name' : 'column-name';

  describe(`Admin edits a ${label}'s children`, { timeout: 60_000 }, () => {
    let entity: EntityPage;
    const child = () => entity.child as ChildServer;

    beforeEach(async () => {
      // A table column's panel counts the column's tests; it has none.
      serveColumnTests([], []);
      entity = await mountEntityPage(config, ADMIN);
      await openChildrenTab(config);
    }, 90_000);

    const tagChip = (scope: Locator, fqn: string) =>
      scope.getByTestId(`tag-${fqn}`);
    const childTags = () => tagFqns(child().current());

    test('panel: tag add, then remove', async () => {
      const fqn = PERSONAL_DATA_PERSONAL.fullyQualifiedName ?? '';
      const panelTags = () => panel().getByTestId('tags-section-container');

      await openPanel(row, nameTestId);
      await pickTag(panel().getByTestId('edit-icon-tags'), fqn);

      await expect.poll(childTags).toEqual([fqn]);
      await expect.element(tagChip(panelTags(), fqn)).toBeVisible();

      await closePanel();

      await expect.element(tagChip(row(), fqn)).toBeVisible();

      await openPanel(row, nameTestId);
      await pickTag(panel().getByTestId('edit-icon-tags'), fqn);

      await expect.poll(childTags).toEqual([]);
      await expect.element(tagChip(panelTags(), fqn)).not.toBeInTheDocument();

      await closePanel();

      await expect.element(tagChip(row(), fqn)).not.toBeInTheDocument();
      expect(child().writes()).toHaveLength(2);
    });

    test('panel: glossary term add', async () => {
      const [term] = GLOSSARY_TERMS;
      const fqn = term.fullyQualifiedName ?? '';

      await openPanel(row, nameTestId);
      await pickGlossaryTerm(panel().getByTestId('edit-glossary-terms'), term);

      await expect.poll(childTags).toEqual([fqn]);
      await expect.element(tagChip(panel(), fqn)).toBeVisible();

      await closePanel();

      await expect.element(tagChip(row(), fqn)).toBeVisible();
      expect(child().writes()).toHaveLength(1);
    });

    test('panel: a tag edit keeps the glossary term', async () => {
      const [term] = GLOSSARY_TERMS;
      const both = [
        term.fullyQualifiedName ?? '',
        PII_NONE.fullyQualifiedName ?? '',
      ];

      await openPanel(row, nameTestId);
      await pickGlossaryTerm(panel().getByTestId('edit-glossary-terms'), term);

      await expect.poll(childTags).toEqual([both[0]]);

      await pickTag(panel().getByTestId('edit-icon-tags'), both[1]);

      await expect.poll(() => childTags().sort()).toEqual([...both].sort());

      for (const fqn of both) {
        await expect.element(tagChip(panel(), fqn)).toBeVisible();
      }

      await closePanel();

      for (const fqn of both) {
        await expect.element(tagChip(row(), fqn)).toBeVisible();
      }

      expect(child().writes()).toHaveLength(2);
    });

    test('panel: description, tabs, previous and next', async () => {
      const position = () => panel().getByCSS('.pagination-header-text');
      const [previous, next] = [0, 1].map((n) =>
        panel().getByCSS('.navigation-container button').nth(n)
      );
      const overview = panel().getByTestId('overview-tab');

      await openPanel(row, nameTestId);

      await expect.element(overview).toHaveAttribute('aria-selected', 'true');
      await expect.element(position()).toHaveTextContent(/^1 of \d+/);

      if (label !== 'Pipeline') {
        await expect.element(panel().getByCSS('.data-type-chip')).toBeVisible();
      }

      await saveDescription(
        panel().getByTestId('edit-description'),
        DESCRIPTION
      );

      await expect
        .poll(() => child().current().description)
        .toBe(`<p>${DESCRIPTION}</p>`);
      await expect
        .element(panel().getByTestId('viewer-container'))
        .toHaveTextContent(DESCRIPTION);

      if (label === 'Table') {
        const quality = panel().getByTestId('data-quality-tab');
        await userEvent.click(quality);

        await expect.element(quality).toHaveAttribute('aria-selected', 'true');

        await userEvent.click(overview);

        await expect.element(overview).toHaveAttribute('aria-selected', 'true');
      }

      const title = () =>
        panel().getByCSS('.title-section').element().textContent;
      const first = title();
      await userEvent.click(next);

      await expect.element(position()).toHaveTextContent(/^2 of \d+/);
      await expect.poll(title).not.toBe(first);

      await userEvent.click(previous);

      await expect.element(position()).toHaveTextContent(/^1 of \d+/);
      await expect.poll(title).toBe(first);

      await closePanel();

      expect(child().writes()).toHaveLength(1);
    });

    test('tag and glossary pickers close each other', async () => {
      const tagPicker = page.getByTestId('classification-tag-picker-popover');
      const glossaryPicker = page.getByTestId('glossary-term-picker-popover');
      // MlModel feature cards: the spec opens the glossary picker on the second.
      const glossaryRow =
        label === 'MlModel'
          ? page.getByCSS(
              `[data-testid="feature-card-${
                makeMlModel().mlFeatures?.[1].name
              }"]`
            )
          : row();
      const openTags = () =>
        userEvent.click(
          row().getByTestId('tags-container').getByTestId('add-tag')
        );

      await openTags();

      await expect.element(tagPicker).toBeVisible();
      await expect.element(glossaryPicker).not.toBeInTheDocument();

      await userEvent.click(
        glossaryRow.getByTestId('glossary-container').getByTestId('add-tag')
      );

      await expect.element(glossaryPicker).toBeVisible();
      await expect.element(tagPicker).not.toBeInTheDocument();

      await openTags();

      await expect.element(tagPicker).toBeVisible();
      await expect.element(glossaryPicker).not.toBeInTheDocument();
    });

    test.runIf(label === 'DashboardDataModel')(
      'panel takes the column from the page, not GET /columns/name',
      async () => {
        await openPanel(row, nameTestId);

        await expect
          .element(panel().getByTestId('edit-description'))
          .toBeVisible();
        expect(child().reads?.()).toEqual([]);
      }
    );

    test.runIf(label !== 'MlModel')(
      'Tags column filter hides rows without the tag',
      async () => {
        const fqn = PERSONAL_DATA_PERSONAL.fullyQualifiedName ?? '';
        const rowId = config.children?.rowId ?? '';
        const keys = [...document.querySelectorAll('[data-row-key]')].map(
          (el) => el.getAttribute('data-row-key') ?? ''
        );
        const other = keys.find(
          (key) =>
            key !== rowId &&
            !key.startsWith(`${rowId}.`) &&
            !rowId.startsWith(`${key}.`)
        );
        const otherRow = page.getByCSS(`[data-row-key="${other}"]`);
        const toggleFilter = async () => {
          await userEvent.click(
            page
              .getByRole('columnheader', { name: /^Tags\b/ })
              .getByTestId('filter-icon')
          );
          const dropdown = page.getByTestId('filter-dropdown');
          await userEvent.click(
            dropdown.getByText('Personal Data Personal', { exact: true })
          );

          await expect.element(dropdown).not.toBeInTheDocument();
        };

        expect(other).toBeTruthy();

        await toggleTag(row(), fqn);

        await expect.poll(childTags).toEqual([fqn]);

        await toggleFilter();

        await expect.element(row()).toBeVisible();
        await expect.element(otherRow).not.toBeInTheDocument();

        // A table filters on the server (TableRepository's column search).
        if (label === 'Table') {
          expect(child().searches?.().at(-1)?.get('tags')).toBe(fqn);
        }

        await toggleFilter();

        await expect.element(otherRow).toBeVisible();
      }
    );
  });

  describe.runIf(label === 'Table')(
    'Admin opens nested, profiled and tested Table columns',
    { timeout: 60_000 },
    () => {
      let entity: EntityPage;
      const reads = () => (entity.child as ChildServer).reads?.() ?? [];
      const rowOf = (column: Column) => () =>
        page.getByCSS(`[data-row-key="${column.fullyQualifiedName}"]`);
      const links = () => panel().getByCSS('.nested-column-name');
      const indent = (name: string) =>
        getComputedStyle(
          links()
            .filter({ hasText: new RegExp(`^${name}$`) })
            .element().parentElement as Element
        ).paddingLeft;

      beforeEach(async () => {
        serveColumnTests([PASSED, FAILED], [INCIDENT]);
        entity = await mountEntityPage(tableWith(NESTED_COLUMNS), ADMIN);

        await expect.element(rowOf(ID)()).toBeVisible();
      }, 90_000);

      test('nested columns: expand icons, nested section, navigation', async () => {
        await expect
          .element(rowOf(CUSTOMER)().getByTestId('expand-icon'))
          .toBeVisible();
        await expect
          .element(rowOf(ID)().getByTestId('expand-icon'))
          .not.toBeInTheDocument();

        await openPanel(rowOf(CUSTOMER), 'column-name');

        await expect
          .poll(() =>
            links()
              .elements()
              .map((link) => link.textContent)
          )
          .toEqual(['name', 'orders', 'order_id']);
        // Mixed siblings (a scalar and an array) sit level; the array's child is indented.
        expect(indent('name')).toBe(indent('orders'));
        expect(indent('order_id')).not.toBe(indent('orders'));

        await userEvent.click(links().filter({ hasText: /^orders$/ }));

        await expect
          .element(panel().getByCSS('.title-section'))
          .toHaveTextContent('orders');
        await expect
          .poll(() =>
            links()
              .elements()
              .map((link) => link.textContent)
          )
          .toEqual(['order_id']);
        expect(reads()).toContain(ORDERS.fullyQualifiedName);
      });

      test('array column: lists its nested children', async () => {
        await openPanel(rowOf(ORDERS), 'column-name');

        await expect
          .poll(() =>
            links()
              .elements()
              .map((link) => link.textContent)
          )
          .toEqual(['order_id']);
      });

      test('key profile metrics', async () => {
        await openPanel(rowOf(ID), 'column-name');

        for (const [metric, value] of [
          ['Uniqueness', '75%'],
          ['Nullness', '10%'],
          ['Distinct', '50%'],
          ['Value Count', '1,200'],
        ]) {
          await expect
            .element(panel().getByTestId(`key-profile-metric-${metric}`))
            .toHaveTextContent(`${metric}${value}`);
        }

        expect(reads()).toEqual([ID.fullyQualifiedName]);
      });

      test('data quality tab: stat cards filter the test cases', async () => {
        const card = (status: string) =>
          panel().getByTestId(`data-quality-stat-card-${status}`);
        const names = () =>
          panel()
            .getByCSS('.test-case-cards-section .test-case-name')
            .elements()
            .map((name) => name.textContent);

        await openPanel(rowOf(ID), 'column-name');
        await userEvent.click(panel().getByTestId('data-quality-tab'));

        await expect.element(card('success')).toHaveTextContent('1Passed');
        await expect.element(card('failed')).toHaveTextContent('1Failed');

        await userEvent.click(card('failed'));

        await expect.poll(names).toEqual([FAILED.name]);

        await userEvent.click(card('success'));

        await expect.poll(names).toEqual([PASSED.name]);
      });

      test('data quality tab: incidents', async () => {
        await openPanel(rowOf(ID), 'column-name');
        await userEvent.click(panel().getByTestId('data-quality-tab'));
        await userEvent.click(
          panel()
            .getByCSS('.data-quality-tabs')
            .getByRole('tab', { name: /incidents/i })
        );
        const incidents = panel().getByCSS('.incidents-tab-content');

        for (const stat of [
          '.incident-stat-card.new-card',
          '.incident-stat-card.ack-card',
          '.incident-stat-card.assigned-card',
          '.resolved-section',
        ]) {
          await expect.element(incidents.getByCSS(stat)).toBeVisible();
        }

        await expect
          .element(incidents.getByCSS('.incident-stat-card.new-card'))
          .toHaveTextContent('1New');

        const card = incidents.getByCSS(
          '.incident-cards-section .test-case-card'
        );

        await expect.element(card).toHaveTextContent(FAILED.name);
        await expect
          .element(
            card
              .getByCSS('.test-case-detail-item')
              .filter({ hasText: /assignee/i })
          )
          .toBeVisible();
      });
    }
  );

  describe.runIf(label === 'Table')(
    'Data Consumer denied tag, glossary and description edits on a Table',
    { timeout: 60_000 },
    () => {
      beforeEach(async () => {
        serveColumnTests([], []);
        await mountEntityPage(config, {
          ...DATA_CONSUMER,
          denied: [
            Operation.EditTags,
            Operation.EditGlossaryTerms,
            Operation.EditDescription,
          ],
        });
        await openChildrenTab(config);
      }, 90_000);

      test('column panel: no tag, glossary or description editor', async () => {
        await openPanel(row, nameTestId);

        // Anchor on the sections, so an absent control means denied, not unrendered.
        for (const section of ['Description', 'Glossary Terms', 'Tags']) {
          await expect
            .element(panel().getByText(section, { exact: true }))
            .toBeVisible();
        }
        for (const control of [
          'edit-icon-tags',
          'edit-glossary-terms',
          'edit-description',
        ]) {
          await expect
            .element(panel().getByTestId(control))
            .not.toBeInTheDocument();
        }
      });
    }
  );
};
