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
 * The card flows of playwright/e2e/Pages/CustomProperties.spec.ts on a
 * table's and a container's Custom Properties tab: how long SQL, reference
 * lists, table rows, markdown tables and hyperlinks render and edit, and how
 * an enum value is set and removed. Real page, real editors; only the network
 * is mocked.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  EntityLabel,
  entityConfig,
  EntityPage,
  mountEntityPage,
  TEAMS,
  USERS,
} from '../entity-matrix/entityMatrix';
import {
  FieldTypeName,
  propertyOf,
  serveEntityType,
} from '../fixtures/customProperties';
import { ADMIN } from '../fixtures/personas';
import { serveSearch } from '../fixtures/search';
import { EMPTY_LIST, worker } from '../msw';
import {
  blockEditor,
  closeListbox,
  editModal,
  enterValue,
  expectCardShows,
  openEditModal,
} from './customPropertyEditors';

const card = (type: FieldTypeName) =>
  page.getByTestId(`custom-property-${propertyOf(type).name}-card`);

const extension = (entity: EntityPage) =>
  (entity.server.current() as { extension?: Record<string, unknown> })
    .extension ?? {};

/** Opens `label`'s page with one property of each `types`, on its Custom Properties tab. */
const openTab = async (
  label: EntityLabel,
  types: FieldTypeName[],
  values: Record<string, unknown> = {}
) => {
  serveEntityType(
    label === 'Table' ? 'table' : 'container',
    types.map(propertyOf)
  );
  const config = entityConfig(label);
  const entity = await mountEntityPage(
    { ...config, make: () => ({ ...config.make(), extension: values }) },
    ADMIN
  );
  await userEvent.click(page.getByTestId('custom_properties'));

  await expect
    .element(page.getByTestId('custom-properties-card'))
    .toBeVisible();

  return entity;
};

const save = async () => {
  await userEvent.click(editModal().getByTestId('inline-save-btn'));

  await expect.element(editModal()).not.toBeInTheDocument();
};

const reference = (
  entity: (typeof USERS)[number] | (typeof TEAMS)[number]
) => ({
  id: entity.id,
  type: entity.type,
  name: entity.name,
  displayName: entity.displayName,
  fullyQualifiedName: entity.fullyQualifiedName,
});

/** More users, with names long enough that the list cannot show them all. */
const MORE_USERS = [1, 2, 3, 4, 5].map((n) => ({
  ...USERS[0],
  id: `0a8f0c1e-0000-4000-8000-0000000005${String(n).padStart(2, '0')}`,
  name: `pw_reference_list_user_${n}`,
  displayName: `PW Reference List User Number ${n}`,
  fullyQualifiedName: `pw_reference_list_user_${n}`,
}));

describe('Custom property cards', { timeout: 60_000 }, () => {
  test('a long SQL query scrolls inside its editor', async () => {
    const entity = await openTab('Table', ['sqlQuery']);
    const sql =
      "SELECT id, name, email\nFROM users\nWHERE active = true\nAND department = 'engineering'\nORDER BY created_at DESC\nLIMIT 100";

    await openEditModal(card('sqlQuery'));
    await enterValue('sqlQuery', `${sql}\n${sql}`);
    await save();

    await expect
      .poll(() => extension(entity)[propertyOf('sqlQuery').name])
      .toBe(`${sql}\n${sql}`);

    const scroller = card('sqlQuery')
      .getByTestId('sql-query-value')
      .getByCSS('.cm-scroller');

    await expect.element(scroller).toBeVisible();
    await expect
      .poll(
        () => scroller.element().scrollHeight > scroller.element().clientHeight
      )
      .toBe(true);
  });

  test('a reference list counts its items and collapses behind "+N more"', async () => {
    const name = propertyOf('entityReferenceList').name;
    const entity = await openTab('Table', ['entityReferenceList'], {
      [name]: [reference(USERS[2]), reference(TEAMS[0])],
    });
    // The page's own search, now with users enough to overflow the card.
    serveSearch({ user: [...USERS, ...MORE_USERS], team: TEAMS });

    await openEditModal(card('entityReferenceList'));
    await enterValue(
      'entityReferenceList',
      [
        USERS[2].displayName,
        TEAMS[0].displayName,
        ...MORE_USERS.map((u) => u.displayName),
      ].join(',')
    );
    await save();

    await expect
      .poll(() => (extension(entity)[name] as unknown[]).length)
      .toBe(7);
    await expect
      .element(card('entityReferenceList').getByTestId('property-item-count'))
      .toHaveTextContent('7');

    const more = card('entityReferenceList').getByTestId(
      'toggle-collapsed-values'
    );
    await userEvent.click(more);

    for (const user of MORE_USERS) {
      await expect
        .element(card('entityReferenceList').getByTestId(user.displayName))
        .toBeVisible();
    }
  });

  test('a user in a reference list links to the user page', async () => {
    const user = USERS[0];
    // Set through the API with no display name, as the spec does.
    await openTab('Table', ['entityReferenceList'], {
      [propertyOf('entityReferenceList').name]: [
        {
          id: user.id,
          type: 'user',
          name: user.name,
          fullyQualifiedName: user.fullyQualifiedName,
        },
      ],
    });
    const users: string[] = [];
    worker.use(
      http.get('/api/v1/personas', () => HttpResponse.json(EMPTY_LIST)),
      http.get('/api/v1/users/name/:name', ({ params }) => {
        users.push(String(params.name));

        return HttpResponse.json({
          ...user,
          email: `${user.name}@example.com`,
        });
      })
    );
    const link = card('entityReferenceList').getByTestId(user.name);

    await expect.element(link).toHaveTextContent(user.name);

    await userEvent.click(link);

    await expect
      .element(page.getByTestId('__location'))
      .toHaveTextContent(new RegExp(`/users/(%22)?${user.name}(%22)?`));
    await expect
      .element(page.getByTestId('user-display-name'))
      .toHaveTextContent(user.displayName);
    expect(users[0]).toBe(user.name);
  });

  test('a table property counts its rows and renders each', async () => {
    const entity = await openTab('Table', ['table-cp']);

    await openEditModal(card('table-cp'));
    // The editor opens with one empty row; add the other four.
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await userEvent.click(editModal().getByTestId('add-new-row'));
      }
      await userEvent.fill(
        editModal().getByTestId(`pw-column1-${i}`),
        `row${i + 1}-col1`
      );
      await userEvent.fill(
        editModal().getByTestId(`pw-column2-${i}`),
        `row${i + 1}-col2`
      );
    }
    await save();

    await expect
      .poll(
        () =>
          (
            extension(entity)[propertyOf('table-cp').name] as {
              rows: unknown[];
            }
          )?.rows
      )
      .toHaveLength(5);
    await expect
      .element(card('table-cp').getByTestId('property-item-count'))
      .toHaveTextContent('5');

    for (let i = 1; i <= 5; i++) {
      await expectCardShows(
        card('table-cp'),
        'table-cp',
        `row${i}-col1,row${i}-col2`
      );
    }
  });

  test('a markdown value holding a table keeps its edit button usable (#32477)', async () => {
    const entity = await openTab('Table', ['markdown'], {
      [propertyOf('markdown').name]: '<p>Some markdown</p>',
    });

    await openEditModal(card('markdown'));
    await userEvent.click(blockEditor());
    await userEvent.keyboard(
      '{ControlOrMeta>}{End}{/ControlOrMeta}{Enter}/Table'
    );
    await userEvent.keyboard('{Enter}');

    await expect.element(blockEditor().getByRole('table')).toBeVisible();

    await save();

    await expect
      .poll(() => String(extension(entity)[propertyOf('markdown').name]))
      .toContain('<table');

    const edit = card('markdown').getByTestId('edit-icon');

    await expect.element(edit).toBeVisible();
    await expect.element(edit).toBeEnabled();

    await userEvent.click(edit);

    await expect.element(blockEditor()).toBeVisible();

    await userEvent.click(editModal().getByTestId('inline-cancel-btn'));
  });

  test('enum: set a value, then remove it', async () => {
    const name = propertyOf('enum').name;
    const entity = await openTab('Table', ['enum']);

    await openEditModal(card('enum'));
    await enterValue('enum', 'medium');
    await save();

    await expect.poll(() => extension(entity)[name]).toEqual(['medium']);
    await expect
      .element(card('enum').getByTestId('enum-value'))
      .toHaveTextContent('medium');

    await openEditModal(card('enum'));
    const select = editModal().getByTestId('enum-select');
    await userEvent.click(
      select
        .getByTestId('autocomplete-selected-item')
        .filter({ hasText: 'medium' })
        .getByRole('button', { name: 'Remove medium' })
    );

    await expect.element(select).not.toHaveTextContent('medium');

    // Removing a chip focuses the combobox, whose listbox covers Save.
    await closeListbox();
    await save();

    await expect.poll(() => entity.server.patches.length).toBe(2);
    expect(extension(entity)[name]).toBeUndefined();
    await expect
      .element(card('enum').getByTestId('property-value'))
      .not.toHaveTextContent('medium');
  });

  describe('hyperlink on a container', () => {
    test('shows a placeholder while it has no value', async () => {
      await openTab('Container', ['hyperlink-cp']);
      const empty = card('hyperlink-cp').getByTestId('no-data');

      await expect.element(empty).toBeVisible();
      await expect.element(empty).toHaveTextContent('No value yet');
    });

    test('rejects a javascript: URL', async () => {
      const entity = await openTab('Container', ['hyperlink-cp']);

      await openEditModal(card('hyperlink-cp'));
      await userEvent.fill(
        editModal().getByTestId('hyperlink-url-input'),
        'javascript:alert("XSS")'
      );
      await userEvent.click(editModal().getByTestId('inline-save-btn'));

      await expect
        .element(editModal())
        .toHaveTextContent('URL must use http or https protocol');

      await userEvent.click(editModal().getByTestId('inline-cancel-btn'));

      await expect.element(editModal()).not.toBeInTheDocument();
      expect(entity.server.patches).toEqual([]);
    });

    test('links a valid URL in a new tab, under its display text', async () => {
      const entity = await openTab('Container', ['hyperlink-cp']);

      await openEditModal(card('hyperlink-cp'));
      await enterValue(
        'hyperlink-cp',
        'https://openmetadata.io,OpenMetadata Docs'
      );
      await save();

      await expect
        .poll(() => extension(entity)[propertyOf('hyperlink-cp').name])
        .toEqual({
          url: 'https://openmetadata.io',
          displayText: 'OpenMetadata Docs',
        });

      const link = card('hyperlink-cp').getByTestId('hyperlink-value');

      await expectCardShows(
        card('hyperlink-cp'),
        'hyperlink-cp',
        'https://openmetadata.io,OpenMetadata Docs'
      );

      await expect.element(link).toHaveAttribute('target', '_blank');
      await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('shows the URL when there is no display text', async () => {
      const entity = await openTab('Container', ['hyperlink-cp']);

      await openEditModal(card('hyperlink-cp'));
      await enterValue('hyperlink-cp', 'https://example.com');
      await save();

      await expect
        .poll(() => extension(entity)[propertyOf('hyperlink-cp').name])
        .toEqual({ url: 'https://example.com' });

      await expectCardShows(
        card('hyperlink-cp'),
        'hyperlink-cp',
        'https://example.com'
      );
    });
  });
});
