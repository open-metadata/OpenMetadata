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
 * The flows of playwright/e2e/Pages/EntityDataConsumer.spec.ts: a Data Consumer
 * (who does not own the entity) edits what that role allows on an entity's
 * details page, and finds the rest closed. Real page, real widgets, real
 * permission-driven rendering; only the network is mocked. Each edit asserts
 * the write the page sent and what it shows after the round trip.
 *
 * Owners follow OrganizationPolicy's `noOwner()` rule: the consumer may set
 * the owners of an unowned entity, and loses the control once it has some.
 *
 * One `EntityDataConsumer.<Type>.browser.test.tsx` per entity type calls
 * `describeDataConsumerFlows`; the shared configs and steps are in
 * `entityMatrix.ts`.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { DATA_CONSUMER } from '../fixtures/personas';
import {
  addUpdateRemoveChildDescription,
  addUpdateRemoveGlossaryTerms,
  addUpdateRemoveTags,
  ChildServer,
  childRow,
  entityConfig,
  EntityLabel,
  EntityPage,
  expectOwners,
  followThenUnfollow,
  mountEntityPage,
  openChildrenTab,
  setReplaceClearTier,
  setUserOwners,
  tagFqns,
  updateDescription,
  upVoteThenDownVote,
  USERS,
} from './entityMatrix';

export const describeDataConsumerFlows = (label: EntityLabel) => {
  const config = entityConfig(label);

  describe(`Data Consumer edits a ${label}`, { timeout: 60_000 }, () => {
    let entity: EntityPage;
    const server = () => entity.server;
    const editOwner = () => page.getByTestId('edit-owner');

    beforeEach(async () => {
      entity = await mountEntityPage(config, DATA_CONSUMER);
    });

    test('user owners: add two to an unowned entity', async () => {
      await setUserOwners([USERS[0], USERS[2]]);

      await expectOwners(server(), [USERS[0], USERS[2]]);

      expect(server().patches).toHaveLength(1);
    });

    test('owned entity: no edit-owner control', async () => {
      await setUserOwners([USERS[0]]);
      await expectOwners(server(), [USERS[0]]);

      await entity.reload();

      await expect.element(editOwner()).not.toBeInTheDocument();
    });

    test('tier: add, replace, remove', () =>
      setReplaceClearTier(server(), ['Tier1', 'Tier4']));

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
      followThenUnfollow(server(), DATA_CONSUMER.user.id));

    describe.runIf(config.children)('children', () => {
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

      test.runIf(config.children?.displayName)(
        'child display name: no edit control',
        async () => {
          await expect
            .element(row().getByTestId('edit-displayName-button'))
            .not.toBeInTheDocument();
        }
      );

      test('child description: add, update, remove', () =>
        addUpdateRemoveChildDescription(row, child()));
    });
  });
};
