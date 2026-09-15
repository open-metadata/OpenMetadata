/*
 *  Copyright 2024 Collate.
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

import { expect, Locator, Page } from '@playwright/test';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../support/entity/DatabaseClass';
import { DirectoryClass } from '../support/entity/DirectoryClass';
import { EntityClass } from '../support/entity/EntityClass';
import { FileClass } from '../support/entity/FileClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { DashboardServiceClass } from '../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../support/entity/service/DatabaseServiceClass';
import { SpreadsheetClass } from '../support/entity/SpreadsheetClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { WorksheetClass } from '../support/entity/WorksheetClass';
import { UserClass } from '../support/user/UserClass';
import { redirectToHomePage } from './common';
import { addCustomPropertiesForEntity } from './customProperty';
import { waitForAllLoadersToDisappear } from './entity';
import { settingClick, SettingOptionsType } from './sidebar';

// All operations across all entities
export const ALL_OPERATIONS = [
  // Common operations
  'EditDescription',
  'EditOwners',
  'EditTier',
  'EditDisplayName',
  'EditTags',
  'EditGlossaryTerms',
  'EditCustomFields',
  'Delete',

  // Entity specific operations
  'ViewQueries',
  'ViewSampleData',
  'ViewDataProfile',
  'ViewTests',
  'ViewUsage',
  'EditQueries',
  'EditDataProfile',
  'EditSampleData',
  'EditTests',
  'EditStatus',
  'EditLineage',
];

// Helper function to check element visibility based on configuration
/**
 * Opens the manage menu from a known-closed state.
 *
 * The trigger is a react-aria Dropdown, so pressing it toggles. The two configs
 * that use it run back to back in the same loop, and the second one arrives with
 * the menu already open -- when this was measured, delete-button was already in
 * the DOM before its own click. A bare click would close the menu, leaving the
 * assertion after it reading a menu that is not on screen.
 */
const openManageMenu = async (page: Page, manageButton: Locator) => {
  await page.keyboard.press('Escape');
  await manageButton.click();
};

/**
 * The set of checks checkElementVisibility knows how to run.
 *
 * Declared as a union rather than `string` so a mistyped type is a compile
 * error. It used to fall through to `default`, where the deny branch asserted
 * `not.toBeVisible()` on a test id nothing renders -- a silent pass.
 */
type PermissionCheckType =
  | 'direct'
  | 'multiple-containers'
  | 'with-manage-button'
  | 'label';

type PermissionCheckConfig = {
  testId: string;
  type: PermissionCheckType;
  containers?: string[];
};

const checkElementVisibility = async (
  testUserPage: Page,
  config: PermissionCheckConfig,
  effect: 'allow' | 'deny'
) => {
  const { testId, type } = config;

  if (effect === 'allow') {
    switch (type) {
      case 'direct': {
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`).first()
        ).toBeVisible();

        break;
      }

      case 'multiple-containers': {
        // Handle elements that exist in multiple containers. A container
        // testId (e.g. tags-container) can be rendered once per row/column
        // (e.g. Container entities' data model table), so resolve each
        // locator to its full list of matched buttons via `.all()` instead
        // of calling `.isVisible()` directly on a locator that may match
        // more than one element (which throws a strict-mode violation).
        const containerLocators =
          config.containers?.map((container) =>
            testUserPage
              .locator(`[data-testid="${container}"]`)
              .locator(`button[data-testid="${testId}"]`)
          ) || [];

        // `.all()` resolves against whatever is in the DOM at that instant --
        // unlike `expect(locator)`, it does not auto-wait. The containers and
        // their buttons mount asynchronously, so on a loaded CI runner the list
        // came back empty and `.some()` failed outright rather than waiting
        // (chromium-14, "Topic allow common operations permissions"). Retry the
        // whole read so the assertion measures the settled page.
        await expect(async () => {
          const containerButtons = await Promise.all(
            containerLocators.map((locator) => locator.all())
          );

          const containerVisibilityChecks = await Promise.all(
            containerButtons.flat().map((button) => button.isVisible())
          );

          // In allow case: any one of the matched buttons should be visible
          expect(
            containerVisibilityChecks.some((visible) => visible)
          ).toBeTruthy();
        }).toPass({ timeout: 15_000 });

        break;
      }

      case 'with-manage-button': {
        const manageButton = testUserPage.locator(
          '[data-testid="manage-button"]'
        );

        // Require the menu rather than skipping when it is missing. It is
        // offered on every entity measured when the operation is allowed
        // (fourteen of fourteen), and `isVisible()` is a point-in-time read, so
        // the old guard made a skipped check indistinguishable from a passing
        // one.
        await expect(manageButton).toBeVisible();
        await openManageMenu(testUserPage, manageButton);

        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).toBeVisible();

        break;
      }
      case 'label': {
        await expect(testUserPage.getByText(testId).first()).toBeVisible();

        break;
      }

      default: {
        throw new Error(`Unhandled permission check type: ${type}`);
      }
    }
  } else {
    // Deny effect
    switch (type) {
      case 'direct': {
        // `not.toBeVisible()` is also satisfied by an element that is simply not
        // there yet, so on its own it cannot tell a denied page from an
        // unrendered one. testCommonOperations now waits for the header before
        // any of these run, and under deny these affordances are absent from the
        // DOM rather than hidden -- measured zero on every entity -- so assert
        // absence.
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).toHaveCount(0);

        break;
      }

      case 'multiple-containers': {
        const containers = config.containers ?? [];
        const containerSelector = containers
          .map((container) => `[data-testid="${container}"]`)
          .join(', ');
        const buttonSelector = containers
          .map(
            (container) =>
              `[data-testid="${container}"] button[data-testid="${testId}"]`
          )
          .join(', ');

        // An empty list is not evidence of denial. The previous check read
        // `.all()` and asserted `.every(v => !v)`, which is vacuously true when
        // nothing has mounted -- and that is exactly what happened: measured
        // across fourteen entity types, the button list resolved to zero
        // elements every single time, so the assertion never once separated a
        // denied page from an unrendered one.
        //
        // Anchor on the containers instead. They render regardless of
        // permission (GlossaryTermsSection emits glossary-container in both its
        // branches); only the button inside is gated, since TagsContainerV2
        // renders add-tag behind `permission && isEmpty(tags)`. So the button is
        // absent from the DOM rather than merely hidden, and asserting its
        // absence only means something once its container is on the page.
        await expect(testUserPage.locator(containerSelector)).not.toHaveCount(
          0
        );
        await expect(testUserPage.locator(buttonSelector)).toHaveCount(0);

        break;
      }

      case 'with-manage-button': {
        const manageButton = testUserPage.locator(
          '[data-testid="manage-button"]'
        );

        // Denial takes two legitimate shapes here: no manage menu at all, or a
        // menu that does not carry this action. Twelve of the fourteen entities
        // measured render no manage-button under deny and only table and
        // database render one, so its absence must not fail -- but the old
        // `isVisible()` guard turned that into skipping the assertion outright
        // for those twelve, which is indistinguishable from passing.
        if ((await manageButton.count()) > 0) {
          await openManageMenu(testUserPage, manageButton);
        }

        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).toHaveCount(0);

        break;
      }
      case 'label': {
        // `getByText(...).first()` with `not.toBeVisible()` is also satisfied by
        // text that is simply not there yet, so on its own it cannot separate a
        // denied page from one still loading -- the same hole the other deny
        // branches had. Let the page settle and wait for the entity header,
        // which was present on all four entities that use this config in both
        // modes, then assert the label is absent. Absence is what denial
        // actually produces here: measured zero matches on every entity under
        // deny and exactly one under allow, so it is removed rather than hidden.
        await waitForAllLoadersToDisappear(testUserPage);
        await expect(
          testUserPage.locator('[data-testid="entity-header-title"]')
        ).toBeVisible();
        await expect(testUserPage.getByText(testId)).toHaveCount(0);

        break;
      }

      default: {
        throw new Error(`Unhandled permission check type: ${type}`);
      }
    }
  }
};

// Test common operations for any entity
export const testCommonOperations = async (
  testUserPage: Page,
  entity: EntityClass,
  effect: 'allow' | 'deny'
) => {
  // Navigate to entity page
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Define test configurations with special handling
  const testIdsConfigs: PermissionCheckConfig[] = [
    { testId: 'edit-description', type: 'direct' },
    {
      testId: 'add-tag',
      type: 'multiple-containers',
      containers: ['tags-container', 'glossary-container'],
    },
    { testId: 'edit-tier', type: 'direct' },
    { testId: 'edit-owner', type: 'direct' },
    { testId: 'rename-button', type: 'with-manage-button' },
    { testId: 'delete-button', type: 'with-manage-button' },
  ];

  await expect(
    testUserPage.locator('[data-testid="entity-header-title"]')
  ).toBeVisible();

  // The affordances these configs look for live in the entity header, which
  // mounts with the entity's data rather than with the route. An absent button
  // only means "denied" once that header is up -- before it, absence just means
  // "not yet". owner-label and the tier control were present on all fourteen
  // entities measured, under both allow and deny, so they mark that point.
  await expect(
    testUserPage.locator('[data-testid="owner-label"]')
  ).not.toHaveCount(0);
  await expect(testUserPage.locator('[data-testid="Tier"]')).not.toHaveCount(0);

  for (const config of testIdsConfigs) {
    await checkElementVisibility(testUserPage, config, effect);
  }

  if (effect === 'deny') {
    // Both controls render on every entity measured, in both modes, so an
    // `isVisible()` guard here could only ever skip the check on a page that had
    // not finished rendering -- which is indistinguishable from passing. Require
    // them, then assert the picker they open stays closed. Absence rather than
    // invisibility: measured across all fourteen entities, clicking either
    // control under deny leaves zero cards in the DOM.
    const tierLocator = testUserPage.getByTestId('Tier');
    await expect(tierLocator).toBeVisible();
    await tierLocator.click();
    await expect(testUserPage.getByTestId('cards')).toHaveCount(0);

    const certLocator = testUserPage.getByTestId('certification-value');
    await expect(certLocator).toBeVisible();
    await certLocator.click();
    await expect(testUserPage.getByTestId('certification-cards')).toHaveCount(
      0
    );
  }

  // Check custom properties
  const customPropertiesLocator = testUserPage.locator(
    '[data-testid="custom_properties"]'
  );

  // The tab renders on every entity in both modes, so guarding this on
  // `isVisible()` could only skip the check on an unrendered page. Require it.
  await expect(customPropertiesLocator).toBeVisible();
  await customPropertiesLocator.click();

  const customPropertyCard = testUserPage.locator(
    '[data-testid="custom-properties-card"]'
  );
  const customPropertyEditIcons = customPropertyCard.getByTestId('edit-icon');

  // Anchor on the card, which renders either way, so the edit affordance being
  // missing means denied rather than not yet drawn. Under deny the icons are
  // absent from the DOM, not hidden -- measured zero on every entity, against
  // hundreds under allow.
  await expect(customPropertyCard).toBeVisible();

  if (effect === 'allow') {
    await expect(customPropertyEditIcons).not.toHaveCount(0);
  } else {
    await expect(customPropertyEditIcons).toHaveCount(0);
  }
};

// Helper function to test permission error visibility
export const testPermissionErrorVisibility = async (
  testUserPage: Page,
  testId: string,
  effect: 'allow' | 'deny',
  expectedErrorMessage?: string
) => {
  await testUserPage.locator(`[data-testid="${testId}"]`).click();

  // Let the panel finish loading first. The allow branch below asserts the
  // permission error is *not* shown, which an unrendered panel satisfies just as
  // well as a permitted one.
  await waitForAllLoadersToDisappear(testUserPage);

  if (effect === 'deny') {
    await expect(
      testUserPage
        .locator('[data-testid="permission-error-placeholder"]')
        .getByText(
          expectedErrorMessage || "You don't have necessary permissions."
        )
    ).toBeVisible();
  } else {
    await expect(
      testUserPage
        .locator('[data-testid="permission-error-placeholder"]')
        .getByText(
          expectedErrorMessage || "You don't have necessary permissions."
        )
    ).not.toBeVisible();
  }
};

// Helper function to test profiler tab permissions
export const testProfilerTabPermission = async (
  testUserPage: Page,
  tabName: string,
  effect: 'allow' | 'deny',
  expectedErrorMessage?: string
) => {
  await testUserPage.getByRole('tab', { name: tabName }).click();

  // Same reason as testPermissionErrorVisibility: the allow branch asserts an
  // absence, so the tab has to have rendered before it means anything.
  await waitForAllLoadersToDisappear(testUserPage);

  if (effect === 'deny') {
    await expect(
      testUserPage
        .locator('[data-testid="permission-error-placeholder"]')
        .getByText(
          expectedErrorMessage || "You don't have necessary permissions."
        )
    ).toBeVisible();
  } else {
    await expect(
      testUserPage.locator('[data-testid="permission-error-placeholder"]')
    ).not.toBeVisible();
  }
};

// Entity-specific test functions
export const testTableSpecificOperations = async (
  testUserPage: Page,
  entity: TableClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test ViewQueries
  await testPermissionErrorVisibility(
    testUserPage,
    'table_queries',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Queries permission."
  );

  // Test ViewSampleData
  await testPermissionErrorVisibility(
    testUserPage,
    'sample_data',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
  );

  // Test ViewDataProfile
  await testUserPage.locator('[data-testid="profiler"]').click();

  // Test Table Profile
  await testProfilerTabPermission(
    testUserPage,
    'Table Profile',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Data Observability permission."
  );

  // Test Column Profile
  await testProfilerTabPermission(
    testUserPage,
    'Column Profile',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the ViewDataProfile permission."
  );

  // Test Data Quality
  await testProfilerTabPermission(
    testUserPage,
    'Data Quality',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Data Observability permission."
  );

  await checkElementVisibility(
    testUserPage,
    {
      testId: 'Usage',
      type: 'label',
    },
    effect
  );
};

export const testTopicSpecificOperations = async (
  testUserPage: Page,
  entity: TopicClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test ViewSampleData for Topic
  await testPermissionErrorVisibility(
    testUserPage,
    'sample_data',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
  );
};

export const testPipelineSpecificOperations = async (
  testUserPage: Page,
  entity: PipelineClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test Edit Lineage for Pipeline
  await testUserPage.getByRole('tab', { name: 'Lineage' }).click();
  await waitForAllLoadersToDisappear(testUserPage);

  // Anchor on the canvas, which renders in both modes -- measured one
  // `.react-flow` under allow and one under deny. Without it `not.toBeVisible()`
  // is equally satisfied by a Lineage tab that has not drawn yet. Under deny the
  // control is absent from the DOM rather than hidden.
  await expect(testUserPage.locator('.react-flow')).toBeVisible();

  if (effect === 'allow') {
    await expect(testUserPage.getByTestId('edit-lineage')).toBeVisible();
  } else {
    await expect(testUserPage.getByTestId('edit-lineage')).toHaveCount(0);
  }
};

export const testSearchIndexSpecificOperations = async (
  testUserPage: Page,
  entity: SearchIndexClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Search Index
  await testPermissionErrorVisibility(
    testUserPage,
    'sample_data',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
  );
};

export const testStoredProcedureSpecificOperations = async (
  testUserPage: Page,
  entity: TableClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Stored Procedure
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testDatabaseSpecificOperations = async (
  testUserPage: Page,
  entity: DatabaseClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  await expect(
    testUserPage.getByTestId('database-databaseSchemas')
  ).toBeVisible();

  await waitForAllLoadersToDisappear(testUserPage);

  await checkElementVisibility(
    testUserPage,
    { testId: 'Usage', type: 'label' },
    effect
  );
};

export const testDashboardDataModelSpecificOperations = async (
  testUserPage: Page,
  entity: DashboardDataModelClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Test Edit Lineage for Dashboard Data Model
  await testUserPage.getByRole('tab', { name: 'Lineage' }).click();
  await waitForAllLoadersToDisappear(testUserPage);

  // Anchor on the canvas, which renders in both modes -- measured one
  // `.react-flow` under allow and one under deny. Without it `not.toBeVisible()`
  // is equally satisfied by a Lineage tab that has not drawn yet. Under deny the
  // control is absent from the DOM rather than hidden.
  await expect(testUserPage.locator('.react-flow')).toBeVisible();

  if (effect === 'allow') {
    await expect(testUserPage.getByTestId('edit-lineage')).toBeVisible();
  } else {
    await expect(testUserPage.getByTestId('edit-lineage')).toHaveCount(0);
  }
};

// Regression test for updateVote dropping usageSummary from the re-fetch.
// Only called for the 'allow' effect: verifies Usage label is still visible
// after a vote action triggers the re-fetch of entity details.
const testVotePreservesUsage = async (testUserPage: Page) => {
  await testUserPage.locator('[data-testid="up-vote-btn"]').click();
  await expect(testUserPage.getByText('Usage').first()).toBeVisible();
};

export const testDashboardSpecificOperations = async (
  testUserPage: Page,
  entity: DashboardClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  await checkElementVisibility(
    testUserPage,
    {
      testId: 'Usage',
      type: 'label',
    },
    effect
  );

  if (effect === 'allow') {
    await testVotePreservesUsage(testUserPage);
  }
};

export const testMlModelSpecificOperations = async (
  testUserPage: Page,
  entity: MlModelClass,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  await checkElementVisibility(
    testUserPage,
    {
      testId: 'Usage',
      type: 'label',
    },
    effect
  );

  if (effect === 'allow') {
    await testVotePreservesUsage(testUserPage);
  }
};

// Helper function to run common permission tests
export const runCommonPermissionTests = async (
  testUserPage: Page,
  entity: EntityClass,
  effect: 'allow' | 'deny'
) => {
  await testCommonOperations(testUserPage, entity, effect);
};

export const runEntitySpecificPermissionTests = async (
  testUserPage: Page,
  entity: EntityClass,
  effect: 'allow' | 'deny',
  specificTest: (
    page: Page,
    entity: EntityClass,
    effect: 'allow' | 'deny'
  ) => Promise<void>
) => {
  await specificTest(testUserPage, entity, effect);
};

// Entity configuration with their specific test functions
export const entityConfig = {
  Table: {
    class: TableClass,
    specificTest: testTableSpecificOperations,
  },
  Dashboard: {
    class: DashboardClass,
    specificTest: testDashboardSpecificOperations,
  },
  Pipeline: {
    class: PipelineClass,
    specificTest: testPipelineSpecificOperations,
  },
  Topic: {
    class: TopicClass,
    specificTest: testTopicSpecificOperations,
  },
  MlModel: {
    class: MlModelClass,
    specificTest: testMlModelSpecificOperations,
  },
  Container: {
    class: ContainerClass,
  },
  SearchIndex: {
    class: SearchIndexClass,
    specificTest: testSearchIndexSpecificOperations,
  },
  DashboardDataModel: {
    class: DashboardDataModelClass,
    specificTest: testDashboardDataModelSpecificOperations,
  },
  Metric: {
    class: MetricClass,
  },
  Directory: {
    class: DirectoryClass,
  },
  File: {
    class: FileClass,
  },
  Spreadsheet: {
    class: SpreadsheetClass,
  },
  Worksheet: {
    class: WorksheetClass,
  },
  Database: {
    class: DatabaseClass,
    specificTest: testDatabaseSpecificOperations,
  },
} as const;

export const testDatabaseServiceSpecificOperations = async (
  testUserPage: Page,
  entity: DatabaseServiceClass,
  _effect: 'allow' | 'deny'
) => {
  const databasesResponsePromise = testUserPage.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/databases') &&
      response.request().method() === 'GET'
  );

  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  const databasesResponse = await databasesResponsePromise;

  expect(databasesResponse.status()).toBe(200);

  await expect(
    testUserPage.locator('[data-testid="service-children-table"]')
  ).toBeVisible();
};

export const testDashboardServiceSpecificOperations = async (
  testUserPage: Page,
  entity: DashboardServiceClass,
  _effect: 'allow' | 'deny'
) => {
  const dashboardsResponsePromise = testUserPage.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dashboards') &&
      response.request().method() === 'GET'
  );

  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  const dashboardsResponse = await dashboardsResponsePromise;

  expect(dashboardsResponse.status()).toBe(200);

  await expect(
    testUserPage.locator('[data-testid="service-children-table"]')
  ).toBeVisible();
};

export const serviceEntityConfig = {
  'Database Service': {
    class: DatabaseServiceClass,
    specificTest: testDatabaseServiceSpecificOperations,
  },
  'Dashboard Service': {
    class: DashboardServiceClass,
    specificTest: testDashboardServiceSpecificOperations,
  },
} as const;

// Function to create custom properties for different entity types
export const createCustomPropertyForEntity = async (
  browser: any,
  entityType: string,
  customPropertyName: string,
  adminUser: UserClass
) => {
  const page = await browser.newPage();
  await adminUser.login(page);

  // Map entity types to their correct API types (same as used in working tests)
  const entityTypeMapping: Record<string, string> = {
    Table: 'tables',
    Dashboard: 'dashboards',
    Pipeline: 'pipelines',
    Topic: 'topics',
    MlModel: 'mlmodels',
    Container: 'containers',
    SearchIndex: 'searchIndexes',
    DashboardDataModel: 'dashboardDataModels',
    Metric: 'metrics',
    Database: 'databases',
    DatabaseSchema: 'databaseSchemas',
    'Database Schema': 'databaseSchemas',
    StoredProcedure: 'storedProcedures',
    GlossaryTerm: 'glossaryTerm',
    Domain: 'domains',
    ApiCollection: 'apiCollections',
    ApiEndpoint: 'apiEndpoints',
    DataProduct: 'dataProducts',
    Directory: 'directories',
    File: 'files',
    Spreadsheet: 'spreadsheets',
    Worksheet: 'worksheets',
  };

  const entityApiType =
    entityTypeMapping[entityType] || entityType.toLowerCase();

  await settingClick(page, entityApiType as SettingOptionsType, true);

  await addCustomPropertiesForEntity({
    page,
    propertyName: customPropertyName,
    customPropertyData: {
      description: `Test ${entityType} custom property`,
      entityApiType,
    },
    customType: 'String',
  });

  await page.close();
};
