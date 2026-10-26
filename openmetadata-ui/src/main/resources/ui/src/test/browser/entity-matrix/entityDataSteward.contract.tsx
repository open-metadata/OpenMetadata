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
 * The flows of playwright/e2e/Pages/EntityDataSteward.spec.ts: a Data Steward edits
 * an entity's metadata from its details page. Real page, real widgets, real
 * permission-driven rendering; only the network is mocked. Each test asserts
 * the write the page sends and what it shows after the round trip.
 *
 * One `EntityDataSteward.<Type>.browser.test.tsx` per entity type calls
 * `describeDataStewardFlows`, so Vitest runs the types in parallel workers.
 * The entity configs and shared steps live in `entityMatrix.ts`.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DATA_STEWARD } from '../fixtures/personas';
import {
  addUpdateRemoveChildDescription,
  addUpdateRemoveGlossaryTerms,
  addUpdateRemoveTags,
  ChildServer,
  childRow,
  EntityConfig,
  entityConfig,
  EntityLabel,
  EntityPage,
  expectOwners,
  followThenUnfollow,
  header,
  mountEntityPage,
  openChildrenTab,
  openOwnerPicker,
  setReplaceClearTier,
  setUserOwners,
  tagFqns,
  TEAMS,
  updateDescription,
  upVoteThenDownVote,
  USERS,
  usersPanel,
} from './entityMatrix';

export const describeDataStewardFlows = (label: EntityLabel) => {
  const config: EntityConfig = entityConfig(label);

  describe(`Data Steward edits a ${label}`, { timeout: 60_000 }, () => {
    let entity: EntityPage;
    const server = () => entity.server;

    beforeEach(async () => {
      entity = await mountEntityPage(config, DATA_STEWARD);
    });

    test('user owners: add two, replace with a third, remove', async () => {
      await setUserOwners([USERS[0], USERS[2]]);
      await expectOwners(server(), [USERS[0], USERS[2]]);

      await setUserOwners([USERS[1]]);
      await expectOwners(server(), [USERS[1]]);

      await expect
        .element(header().getByTestId(USERS[0].displayName))
        .not.toBeInTheDocument();

      await openOwnerPicker('Users');
      await userEvent.click(usersPanel().getByTestId('clear-all-button'));
      await userEvent.click(
        usersPanel().getByTestId('selectable-list-update-btn')
      );
      await expectOwners(server(), []);

      await expect
        .element(header().getByTestId(USERS[1].displayName))
        .not.toBeInTheDocument();
      expect(server().patches).toHaveLength(3);
    });

    test('team owner: add, replace, remove', async () => {
      for (const owner of TEAMS) {
        await openOwnerPicker('Teams');
        await userEvent.fill(
          page.getByTestId('owner-select-teams-search-bar'),
          owner.displayName
        );
        await userEvent.click(
          page
            .getByTestId('owner-option')
            .filter({ hasText: owner.displayName })
        );
        await expectOwners(server(), [owner]);
      }

      await expect
        .element(header().getByTestId(TEAMS[0].displayName))
        .not.toBeInTheDocument();

      await userEvent.click(page.getByTestId('edit-owner'));
      await userEvent.click(page.getByTestId('remove-owner'));
      await expectOwners(server(), []);

      await expect
        .element(header().getByTestId(TEAMS[1].displayName))
        .not.toBeInTheDocument();
      expect(server().patches).toHaveLength(3);
    });

    test('tier: add, replace, remove', () =>
      setReplaceClearTier(server(), ['Tier1', 'Tier2']));

    test('description: update', () => updateDescription(server()));

    test('tags: add, update, remove', async () => {
      await addUpdateRemoveTags(
        () => page.getByTestId('KnowledgePanel.Tags'),
        () => tagFqns(server().current())
      );

      expect(server().patches).toHaveLength(4);
    });

    test('glossary terms: add, update, remove', async () => {
      await addUpdateRemoveGlossaryTerms(
        () => page.getByTestId('KnowledgePanel.GlossaryTerms'),
        () => tagFqns(server().current())
      );

      expect(server().patches).toHaveLength(4);
    });

    test('votes: up-vote, then down-vote', () => upVoteThenDownVote(server()));

    test('follow, then un-follow', () =>
      followThenUnfollow(server(), DATA_STEWARD.user.id));

    test('display name: update', async () => {
      const displayName = `Cypress ${server().current().name} updated`;

      await userEvent.click(page.getByTestId('manage-button'));
      await userEvent.click(page.getByTestId('rename-button'));

      await expect
        .element(page.getByRole('textbox', { name: /^Name/ }))
        .toBeDisabled();

      await userEvent.fill(
        page.getByRole('textbox', { name: /Display Name/ }),
        displayName
      );
      await userEvent.click(page.getByTestId('save-button'));

      await expect
        .element(page.getByTestId('entity-header-display-name'))
        .toHaveTextContent(displayName);
      expect(server().patches).toEqual([
        [{ op: 'add', path: '/displayName', value: displayName }],
      ]);
    });

    describe.runIf(config.children)('children', () => {
      const { rowId = '', displayName } = config.children ?? {};
      const row = childRow(config);
      const child = () => entity.child as ChildServer;

      beforeEach(() => openChildrenTab(config));

      test('child tags: add, update, remove', async () => {
        await addUpdateRemoveTags(row, () => tagFqns(child().current()));

        expect(child().writes()).toHaveLength(4);
      });

      test('child glossary terms: add, update, remove', async () => {
        await addUpdateRemoveGlossaryTerms(row, () =>
          tagFqns(child().current())
        );

        expect(child().writes()).toHaveLength(4);
      });

      test.runIf(displayName)(
        'child display name: add, update, remove',
        async () => {
          const names = [
            `Playwright ${rowId} updated`,
            `Playwright ${rowId} updated again`,
            '',
          ];
          let previous = '';

          for (const name of names) {
            await userEvent.click(row().getByTestId('edit-displayName-button'));

            await expect
              .element(page.getByRole('textbox', { name: /^Name/ }))
              .toBeDisabled();

            const input = page.getByRole('textbox', { name: /Display Name/ });

            await expect.element(input).toHaveValue(previous);

            await userEvent.fill(input, name);
            await userEvent.click(page.getByTestId('save-button'));

            await expect
              .poll(() => child().current().displayName)
              .toBe(name || undefined);

            const shown = row().getByTestId('column-display-name');
            await (name
              ? expect.element(shown).toHaveTextContent(name)
              : expect.element(shown).not.toBeInTheDocument());
            previous = name;
          }

          expect(child().writes()).toHaveLength(3);
        }
      );

      test('child description: add, update, remove', () =>
        addUpdateRemoveChildDescription(row, child()));
    });
  });
};
