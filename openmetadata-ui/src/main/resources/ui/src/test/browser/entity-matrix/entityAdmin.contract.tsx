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
 * The header flows of playwright/e2e/Pages/Entity.spec.ts that the persona
 * contracts do not already cover: an admin sets the domain and data products,
 * certification and owners one at a time, runs announcements, copies the
 * page URL, then soft deletes, restores and hard deletes the asset; a Data
 * Consumer whose role denies EditDescription gets no description editor.
 * Real page, real widgets; only the network is mocked. Each step asserts the
 * request the page sent and what it shows after the round trip.
 *
 * The flows the spec shares with EntityDataSteward.spec.ts (owners, tier,
 * description, tags, glossary terms, votes, display name, child edits) are
 * tested once, in `entityDataSteward.contract.tsx`.
 *
 * One `EntityAdmin.<Type>.browser.test.tsx` per type calls
 * `describeAdminFlows`; the shared steps are in `entityMatrix.ts`.
 */
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Operation } from '../../../generated/entity/policies/policy';
import { serveAnnouncements } from '../fixtures/announcements';
import { makeApiEndpoint } from '../fixtures/dataAssets';
import {
  API_COLLECTION,
  serveEmptyLists,
  serveEntities,
} from '../fixtures/hierarchy';
import { ADMIN, DATA_CONSUMER } from '../fixtures/personas';
import {
  announcementLifecycle,
  DeleteTarget,
  domainWithDataProducts,
  entityConfig,
  EntityLabel,
  EntityPage,
  expectOwners,
  header,
  mountEntityPage,
  openOwnerPicker,
  scheduledAnnouncement,
  setReplaceClearCertification,
  setUserOwners,
  softDeleteRestoreHardDelete,
  USERS,
  usersPanel,
} from './entityMatrix';
import { landingOn } from './serviceEntity.contract';

/** Where each page goes after a hard delete (its `afterDeleteAction`). */
const DELETE_TARGETS: Record<EntityLabel, () => DeleteTarget> = {
  ApiEndpoint: () => ({
    path: `/apiCollection/${
      makeApiEndpoint().apiCollection?.fullyQualifiedName
    }`,
    serve: () => {
      serveEntities([['/api/v1/apiCollections', API_COLLECTION]]);
      serveEmptyLists(['/api/v1/apiEndpoints']);
    },
  }),
  Table: () =>
    landingOn('DatabaseSchema', '/databaseSchema/sample_data.ecommerce_db'),
  StoredProcedure: () =>
    landingOn('DatabaseSchema', '/databaseSchema/pw_db_service.pw_db'),
  Dashboard: () => landingOn('DashboardService'),
  DashboardDataModel: () => landingOn('DashboardService'),
  Chart: () => landingOn('DashboardService'),
  Pipeline: () => landingOn('PipelineService'),
  Topic: () => landingOn('MessagingService'),
  MlModel: () => landingOn('MlmodelService'),
  Container: () => landingOn('StorageService'),
  SearchIndex: () => landingOn('SearchIndexService'),
  Metric: () => ({
    path: '/metrics',
    serve: () => serveEmptyLists(['/api/v1/metrics']),
  }),
  Directory: () => landingOn('DriveService'),
  File: () => landingOn('DriveService'),
  Spreadsheet: () => landingOn('DriveService'),
  Worksheet: () => landingOn('DriveService'),
};

/** A deleted asset keeps its page but closes every edit (spec: deletedEntityCommonChecks). */
const expectEditsClosed = async () => {
  // Anchor on the sections first, so an absent control means closed, not unrendered.
  for (const section of [
    'asset-description-container',
    'KnowledgePanel.Tags',
    'KnowledgePanel.GlossaryTerms',
  ]) {
    await expect.element(page.getByTestId(section)).toBeVisible();
  }

  for (const vote of ['up-vote-btn', 'down-vote-btn']) {
    await expect.element(header().getByTestId(vote)).toBeDisabled();
  }

  for (const control of [
    'entity-follow-button',
    'add-domain',
    'edit-owner',
    'edit-tier',
    'edit-description',
  ]) {
    await expect.element(page.getByTestId(control)).not.toBeInTheDocument();
  }

  for (const panel of ['KnowledgePanel.Tags', 'KnowledgePanel.GlossaryTerms']) {
    await expect
      .element(page.getByTestId(panel).getByTestId('add-tag'))
      .not.toBeInTheDocument();
  }
};

export const describeAdminFlows = (label: EntityLabel) => {
  const config = entityConfig(label);

  describe(`Admin edits a ${label}`, { timeout: 60_000 }, () => {
    let entity: EntityPage;
    const server = () => entity.server;

    beforeEach(async () => {
      entity = await mountEntityPage(config, ADMIN);
    }, 90_000);

    test('domain and data products: add, update, remove', () =>
      domainWithDataProducts(server()));

    test('user owners: add one at a time, remove one, then the other', async () => {
      await setUserOwners([USERS[1]]);
      await expectOwners(server(), [USERS[1]]);

      await setUserOwners([USERS[0]], false);
      await expectOwners(server(), [USERS[1], USERS[0]]);

      await openOwnerPicker('Users');
      await userEvent.click(
        usersPanel()
          .getByTestId('owner-option')
          .filter({ hasText: USERS[0].displayName })
      );
      await userEvent.click(
        usersPanel().getByTestId('selectable-list-update-btn')
      );
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

      expect(server().patches).toHaveLength(4);
    });

    test('certification: add, replace, remove', () =>
      setReplaceClearCertification(server()));

    test('announcement: create, edit, delete', () =>
      announcementLifecycle(entity, serveAnnouncements()));

    test('scheduled announcement: create', () =>
      scheduledAnnouncement(entity, serveAnnouncements()));

    test('header copy button copies the page URL', async () => {
      const copy = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue(undefined);
      onTestFinished(() => copy.mockRestore());

      await userEvent.click(page.getByTestId('entity-header-copy-button'));

      await expect.poll(() => copy.mock.calls).toEqual([[location.href]]);
      expect(location.pathname).toBe(config.url);
    });

    test.runIf(['Dashboard', 'DashboardDataModel'].includes(label))(
      'header shows the project name',
      async () => {
        await expect.element(page.getByText('pw_project')).toBeVisible();
      }
    );

    test('delete: soft delete, restore, hard delete', () =>
      softDeleteRestoreHardDelete(
        entity,
        DELETE_TARGETS[label](),
        expectEditsClosed
      ));
  });

  describe(
    `Data Consumer denied EditDescription on a ${label}`,
    { timeout: 60_000 },
    () => {
      beforeEach(async () => {
        await mountEntityPage(config, {
          ...DATA_CONSUMER,
          denied: [Operation.EditDescription],
        });
      }, 90_000);

      test('no description editor; tags stay editable', async () => {
        const description = page.getByTestId('asset-description-container');

        await expect
          .element(
            page.getByTestId('KnowledgePanel.Tags').getByTestId('add-tag')
          )
          .toBeVisible();
        await expect.element(description).toBeVisible();
        await expect
          .element(description.getByTestId('edit-description'))
          .not.toBeInTheDocument();
      });
    }
  );
};
