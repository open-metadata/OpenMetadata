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
 * Replaces playwright/e2e/Pages/EntityDataSteward.spec.ts: a Data Steward edits
 * an entity's metadata from its details page. Real page, real widgets, real
 * permission-driven rendering; only the network is mocked. Each test asserts
 * the write the page sends and what it shows after the round trip.
 */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { EntityServer, serveEntity } from '../fixtures/entityPage';
import { DATA_STEWARD, servePersona } from '../fixtures/personas';
import { serveSearch } from '../fixtures/search';
import { ALL_COLUMNS, makeTable, pageOf, TABLE_FQN } from '../fixtures/table';
import { EMPTY_LIST, worker } from '../msw';
import { renderApp } from '../renderWithApp';

const person = (n: number) => ({
  id: `0a8f0c1e-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
  name: `pw_owner_${n}`,
  displayName: `PW Owner ${n}`,
  fullyQualifiedName: `pw_owner_${n}`,
  entityType: 'user',
  type: 'user',
  deleted: false,
});

const USERS = [person(1), person(2), person(3)];

const ENTITIES = [
  {
    label: 'Table',
    url: `/table/${TABLE_FQN}`,
    endpoint: 'tables',
    make: () =>
      makeTable({
        owners: [],
        tags: [],
        followers: [],
        votes: { upVotes: 0, downVotes: 0, upVoters: [], downVoters: [] },
      }),
    serveExtras: () =>
      worker.use(
        http.get('/api/v1/tables/name/:fqn/columns', () =>
          HttpResponse.json(pageOf(ALL_COLUMNS, { offset: 0, limit: 50 }))
        ),
        http.get('/api/v1/queries', () => HttpResponse.json(EMPTY_LIST))
      ),
  },
];

const header = () => page.getByTestId('data-assets-header');
const usersPanel = () => page.getByTestId('owner-select-users-panel');

const openOwnerPicker = async (tab: 'Users' | 'Teams') => {
  await userEvent.click(page.getByTestId('edit-owner'));
  await userEvent.click(
    page.getByTestId('select-owner-tabs').getByRole('tab', { name: tab })
  );
};

/** Replaces the owners with `users` through the picker, as a user would. */
const setUserOwners = async (users: typeof USERS) => {
  await openOwnerPicker('Users');
  await userEvent.click(usersPanel().getByTestId('clear-all-button'));
  for (const user of users) {
    await userEvent.fill(
      page.getByTestId('owner-select-users-search-bar'),
      user.displayName
    );
    await userEvent.click(
      page.getByTestId('owner-option').filter({ hasText: user.displayName })
    );
  }
  await userEvent.click(usersPanel().getByTestId('selectable-list-update-btn'));
};

const expectOwners = async (
  server: EntityServer<{ id: string; owners?: { id: string }[] }>,
  users: typeof USERS
) => {
  const want = users.map((u) => u.id).sort();

  await expect
    .poll(() => (server.current().owners ?? []).map((o) => o.id).sort())
    .toEqual(want);

  for (const user of users) {
    await expect.element(header().getByTestId(user.displayName)).toBeVisible();
  }
};

describe.each(ENTITIES)('Data Steward edits a $label', (config) => {
  let server: EntityServer<ReturnType<typeof config.make>>;

  beforeEach(async () => {
    servePersona(DATA_STEWARD);
    serveSearch({ user: USERS });
    config.serveExtras();
    server = serveEntity(config.endpoint, config.make());
    renderApp(config.url, DATA_STEWARD.user);

    await expect.element(header()).toBeVisible();
  });

  test('user owners: add two, replace with a third, remove', async () => {
    await setUserOwners([USERS[0], USERS[2]]);
    await expectOwners(server, [USERS[0], USERS[2]]);

    await setUserOwners([USERS[1]]);
    await expectOwners(server, [USERS[1]]);

    await expect
      .element(header().getByTestId(USERS[0].displayName))
      .not.toBeInTheDocument();

    await openOwnerPicker('Users');
    await userEvent.click(usersPanel().getByTestId('clear-all-button'));
    await userEvent.click(
      usersPanel().getByTestId('selectable-list-update-btn')
    );
    await expectOwners(server, []);

    await expect
      .element(header().getByTestId(USERS[1].displayName))
      .not.toBeInTheDocument();
    expect(server.patches).toHaveLength(3);
  });
});
