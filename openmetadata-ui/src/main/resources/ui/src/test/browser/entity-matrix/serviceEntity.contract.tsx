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
 * The flows of playwright/e2e/Pages/ServiceEntity.spec.ts: an admin edits a
 * service (and a database / schema) from its details page — domain and data
 * products, owners, tier, certification, description, tags, glossary terms,
 * announcements, follow, display name — then soft deletes, restores and hard
 * deletes it. Real page, real widgets; only the network is mocked. Each step
 * asserts the request the page sent and what it shows after the round trip.
 *
 * Deleting is asserted up to the DELETE the page sends (`hardDelete`,
 * `recursive`) and where it navigates; that the server cascades to the
 * children is the server's job and is not claimed here.
 *
 * One `ServiceEntity.<Type>.browser.test.tsx` per type calls
 * `describeServiceEntityFlows`; the shared steps are in `entityMatrix.ts`.
 */
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { serveAnnouncements } from '../fixtures/announcements';
import { serveEmptyLists } from '../fixtures/hierarchy';
import { ADMIN } from '../fixtures/personas';
import {
  makeApiService,
  makeDashboardService,
  makeDatabase,
  makeDatabaseSchema,
  makeDatabaseService,
  makeDriveService,
  makeMessagingService,
  makeMlmodelService,
  makePipelineService,
  makeSearchService,
  makeStorageService,
} from '../fixtures/services';
import { worker } from '../msw';
import {
  addReplaceRemoveTeamOwner,
  announcementLifecycle,
  addReplaceRemoveUserOwners,
  addUpdateRemoveGlossaryTerms,
  addUpdateRemoveTags,
  domainWithDataProducts,
  EntityLike,
  EntityPage,
  followThenUnfollow,
  mountEntityPage,
  PageConfig,
  scheduledAnnouncement,
  setReplaceClearCertification,
  setReplaceClearTier,
  tagFqns,
  updateDescription,
  updateDisplayName,
} from './entityMatrix';

export type ServiceLabel =
  | 'ApiService'
  | 'DatabaseService'
  | 'DashboardService'
  | 'MessagingService'
  | 'MlmodelService'
  | 'PipelineService'
  | 'SearchIndexService'
  | 'StorageService'
  | 'DriveService'
  | 'Database'
  | 'DatabaseSchema';

interface ServiceConfig extends PageConfig {
  label: ServiceLabel;
  /** FollowSupportedServices in the spec. */
  followable?: boolean;
  /** CertificationSupportedServices in the spec. */
  certifiable?: boolean;
  /** The children tab's search placeholder (services only). */
  searchPlaceholder?: string;
  /** Where the page goes after a hard delete. */
  parentPath: string;
  /** Mocks what that page loads. */
  serveParent: () => void;
}

/** The page lists the entity's children; the flows need none of them. */
const withChildren =
  (...lists: string[]) =>
  () =>
    serveEmptyLists(lists.map((list) => `/api/v1/${list}`));

/** The parent page's own entity, read by name. */
const serveByName = (endpoint: string, entity: EntityLike) =>
  worker.use(
    http.get(`/api/v1/${endpoint}/name/:fqn`, () => HttpResponse.json(entity))
  );

/** A service page: its children plus the insight charts on its first tab. */
const serviceConfig = (
  label: ServiceLabel,
  category: string,
  make: () => EntityLike & { fullyQualifiedName?: string },
  {
    children,
    searchPlaceholder,
    settingsRoute,
  }: { children: string[]; searchPlaceholder: string; settingsRoute: string }
): ServiceConfig => ({
  label,
  searchPlaceholder,
  url: `/service/${category}/${make().fullyQualifiedName}`,
  endpoint: `services/${category}`,
  make,
  // The spec opens the children tab (e.g. Databases): its side panel holds
  // the description, tags and glossary terms.
  afterMount: () => userEvent.click(page.getByRole('tab').nth(1)),
  serveExtras: () => {
    withChildren(...children)();
    worker.use(
      http.get(
        '/api/v1/analytics/dataInsights/system/charts/listChartData',
        () => HttpResponse.json({})
      )
    );
  },
  // A hard-deleted service leaves for its category's list in Settings.
  parentPath: `/settings/services/${settingsRoute}`,
  serveParent: withChildren(`services/${category}`),
});

const SERVICES: ServiceConfig[] = [
  serviceConfig('ApiService', 'apiServices', makeApiService, {
    children: ['apiCollections'],
    searchPlaceholder: 'Search for Collections',
    settingsRoute: 'apiServices',
  }),
  {
    ...serviceConfig(
      'DatabaseService',
      'databaseServices',
      makeDatabaseService,
      {
        children: ['databases'],
        searchPlaceholder: 'Search for Databases',
        settingsRoute: 'databases',
      }
    ),
    followable: true,
  },
  serviceConfig('DashboardService', 'dashboardServices', makeDashboardService, {
    children: ['dashboards', 'dashboard/datamodels'],
    searchPlaceholder: 'Search for Dashboards',
    settingsRoute: 'dashboards',
  }),
  serviceConfig('MessagingService', 'messagingServices', makeMessagingService, {
    children: ['topics'],
    searchPlaceholder: 'Search for Topics',
    settingsRoute: 'messaging',
  }),
  serviceConfig('MlmodelService', 'mlmodelServices', makeMlmodelService, {
    children: ['mlmodels'],
    searchPlaceholder: 'Search for ML Models',
    settingsRoute: 'mlmodels',
  }),
  serviceConfig('PipelineService', 'pipelineServices', makePipelineService, {
    children: ['pipelines'],
    searchPlaceholder: 'Search for Pipelines',
    settingsRoute: 'pipelines',
  }),
  serviceConfig('SearchIndexService', 'searchServices', makeSearchService, {
    children: ['searchIndexes'],
    searchPlaceholder: 'Search for Search Indexes',
    settingsRoute: 'search',
  }),
  serviceConfig('StorageService', 'storageServices', makeStorageService, {
    children: ['containers'],
    searchPlaceholder: 'Search for Containers',
    settingsRoute: 'storages',
  }),
  serviceConfig('DriveService', 'driveServices', makeDriveService, {
    children: ['drives/directories', 'drives/files', 'drives/spreadsheets'],
    searchPlaceholder: 'Search for Directories',
    settingsRoute: 'drives',
  }),
  {
    label: 'Database',
    followable: true,
    certifiable: true,
    url: `/database/${makeDatabase().fullyQualifiedName}`,
    endpoint: 'databases',
    make: makeDatabase,
    serveExtras: withChildren('databaseSchemas'),
    // A hard-deleted database leaves for its service's Databases tab.
    parentPath: `/service/databaseServices/${
      makeDatabaseService().name
    }/databases`,
    serveParent: () => {
      serveByName('services/databaseServices', makeDatabaseService());
      withChildren('databases')();
    },
  },
  {
    label: 'DatabaseSchema',
    followable: true,
    certifiable: true,
    url: `/databaseSchema/${makeDatabaseSchema().fullyQualifiedName}`,
    endpoint: 'databaseSchemas',
    make: makeDatabaseSchema,
    serveExtras: withChildren('tables', 'storedProcedures'),
    // A hard-deleted schema leaves for its database.
    parentPath: `/database/${makeDatabase().fullyQualifiedName}`,
    serveParent: () => {
      serveByName('databases', makeDatabase());
      withChildren('databaseSchemas')();
    },
  },
];

export const describeServiceEntityFlows = (label: ServiceLabel) => {
  const config = SERVICES.find((s) => s.label === label) as ServiceConfig;

  describe(`Admin edits a ${label}`, { timeout: 60_000 }, () => {
    let entity: EntityPage;
    const server = () => entity.server;

    beforeEach(async () => {
      entity = await mountEntityPage(config, ADMIN);
    }, 90_000);

    test('domain and data products: add, update, remove', () =>
      domainWithDataProducts(server()));

    test('user owners: add two, replace with a third, remove', () =>
      addReplaceRemoveUserOwners(server()));

    test('team owner: add, replace, remove', () =>
      addReplaceRemoveTeamOwner(server()));

    test('tier: add, replace, remove', () =>
      setReplaceClearTier(server(), ['Tier1', 'Tier5']));

    test.runIf(config.certifiable)('certification: add, replace, remove', () =>
      setReplaceClearCertification(server())
    );

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

    test.runIf(config.followable)('follow, then un-follow', () =>
      followThenUnfollow(server(), ADMIN.user.id)
    );

    test('announcement: create, edit, delete', () =>
      announcementLifecycle(entity, serveAnnouncements()));

    test('scheduled announcement: create', () =>
      scheduledAnnouncement(entity, serveAnnouncements()));

    test('display name: update', () => updateDisplayName(server()));

    test('delete: soft delete, restore, hard delete', async () => {
      const menu = () => page.getByTestId('manage-dropdown-list-container');
      const openDelete = async () => {
        await userEvent.click(page.getByTestId('manage-button'));
        await userEvent.click(menu().getByTestId('delete-button'));

        await expect.element(page.getByTestId('delete-modal')).toBeVisible();
      };

      await openDelete();
      await userEvent.click(page.getByTestId('confirm-button'));

      await expect
        .poll(() => server().deletes)
        .toEqual(['?hardDelete=false&recursive=true']);

      await entity.reload();

      await expect
        .element(page.getByTestId('deleted-badge'))
        .toHaveTextContent('Deleted');

      await userEvent.click(page.getByTestId('manage-button'));

      await expect
        .element(menu().getByTestId('announcement-button'))
        .not.toBeInTheDocument();
      await expect
        .element(menu().getByTestId('rename-button'))
        .not.toBeInTheDocument();
      await expect.element(menu().getByTestId('delete-button')).toBeVisible();

      await userEvent.click(menu().getByTestId('restore-button'));
      await userEvent.click(page.getByRole('button', { name: 'Restore' }));

      await expect.poll(() => server().current().deleted).toBe(false);
      await expect
        .element(page.getByTestId('deleted-badge'))
        .not.toBeInTheDocument();

      config.serveParent();
      await openDelete();
      await userEvent.click(page.getByTestId('hard-delete'));
      await userEvent.click(page.getByTestId('confirm-button'));

      await expect
        .poll(() => server().deletes)
        .toEqual([
          '?hardDelete=false&recursive=true',
          '?hardDelete=true&recursive=true',
        ]);
      await expect
        .element(page.getByTestId('__location'))
        .toHaveTextContent(config.parentPath);
    });

    test.runIf(config.searchPlaceholder)(
      'children search placeholder',
      async () => {
        await expect
          .element(page.getByTestId('searchbar'))
          .toHaveAttribute('placeholder', config.searchPlaceholder);
      }
    );
  });
};
