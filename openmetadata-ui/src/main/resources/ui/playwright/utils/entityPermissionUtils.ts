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

import { expect, Page } from '@playwright/test';
import { VIEW_ALL_RULE } from '../constant/permission';
import { PolicyClass } from '../support/access-control/PoliciesClass';
import { RolesClass } from '../support/access-control/RolesClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { UserClass } from '../support/user/UserClass';
import { getApiContext, redirectToHomePage } from './common';

// Base entity interface for permission tests
interface BaseEntity {
  visitEntityPage: (page: Page) => Promise<void>;
}

// All operations across all entities
const ALL_OPERATIONS = [
  // Common operations

  'EditDescription',
  'EditOwners',
  'EditTier',
  'EditDisplayName',
  'EditTags',
  'EditGlossaryTerms',
  'Delete',

  // Table-specific operations
  'ViewQueries',
  'ViewSampleData',
  'ViewDataProfile',
  'ViewTests',
  'ViewProfilerGlobalConfiguration',
  'EditQueries',
  'EditDataProfile',
  'EditSampleData',
  'EditTests',

  // Usage operations (for multiple entities)
  'ViewUsage',
  'EditUsage',

  // Pipeline-specific operations
  'EditStatus',
];

let policy: PolicyClass;
let role: RolesClass;

export const initializePermissions = async (
  page: Page,
  effect: 'allow' | 'deny'
) => {
  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  policy = new PolicyClass();

  const policyRules = [
    ...VIEW_ALL_RULE,
    {
      name: `Global${effect}AllOperationsPolicy`,
      resources: ['All'],
      operations: ALL_OPERATIONS,
      effect,
    },
  ];

  await policy.create(apiContext, policyRules);

  role = new RolesClass();
  await role.create(apiContext, [policy.responseData.name]);

  return { apiContext, policy, role };
};

export const assignRoleToUser = async (page: Page, testUser: UserClass) => {
  const { apiContext } = await getApiContext(page);

  await testUser.patch({
    apiContext,
    patchData: [
      {
        op: 'replace',
        path: '/roles',
        value: [
          {
            id: role.responseData.id,
            type: 'role',
            name: role.responseData.name,
          },
        ],
      },
    ],
  });
};

export const cleanupPermissions = async (page: Page) => {
  const { apiContext, afterAction } = await getApiContext(page);
  await role.delete(apiContext);
  await policy.delete(apiContext);
  await afterAction();
};

// Helper function to check element visibility based on configuration
const checkElementVisibility = async (
  testUserPage: Page,
  config: {
    testId: string;
    type: string;
    containers?: string[];
  },
  effect: 'allow' | 'deny'
) => {
  const { testId, type } = config;

  if (effect === 'allow') {
    switch (type) {
      case 'direct': {
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).toBeVisible();

        break;
      }

      case 'multiple-containers': {
        // Handle elements that exist in multiple containers
        const containerLocators =
          config.containers?.map((container) =>
            testUserPage
              .locator(`[data-testid="${container}"]`)
              .locator(`button[data-testid="${testId}"]`)
          ) || [];

        const containerVisibilityChecks = await Promise.all(
          containerLocators.map((locator) => locator.isVisible())
        );

        // In allow case: any one of the containers should have the element visible
        expect(
          containerVisibilityChecks.some((visible) => visible)
        ).toBeTruthy();

        break;
      }

      case 'with-manage-button': {
        const manageButton = testUserPage.locator(
          '[data-testid="manage-button"]'
        );
        if (await manageButton.isVisible()) {
          await manageButton.click();

          await expect(
            testUserPage.locator(`[data-testid="${testId}"]`)
          ).toBeVisible();
        }

        break;
      }

      default: {
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).toBeVisible();
      }
    }
  } else {
    // Deny effect
    switch (type) {
      case 'direct': {
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).not.toBeVisible();

        break;
      }

      case 'multiple-containers': {
        // Handle elements that exist in multiple containers for deny case
        const containerLocators =
          config.containers?.map((container) =>
            testUserPage
              .locator(`[data-testid="${container}"]`)
              .locator(`button[data-testid="${testId}"]`)
          ) || [];

        const containerVisibilityChecks = await Promise.all(
          containerLocators.map((locator) => locator.isVisible())
        );

        // In deny case: none of the containers should have the element visible
        expect(
          containerVisibilityChecks.every((visible) => !visible)
        ).toBeTruthy();

        break;
      }

      case 'with-manage-button': {
        const manageButton = testUserPage.locator(
          '[data-testid="manage-button"]'
        );
        if (await manageButton.isVisible()) {
          await manageButton.click();

          await expect(
            testUserPage.locator(`[data-testid="${testId}"]`)
          ).not.toBeVisible();
        }

        break;
      }

      default: {
        await expect(
          testUserPage.locator(`[data-testid="${testId}"]`)
        ).not.toBeVisible();
      }
    }
  }
};

// Test common operations for any entity
export const testCommonOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  // Navigate to entity page
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Define test configurations with special handling
  const testIdsConfigs = [
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
    // 'edit-custom-fields',
    // 'edit-certification'
  ];

  await expect(
    testUserPage.locator('[data-testid="entity-header-title"]')
  ).toBeVisible();

  for (const config of testIdsConfigs) {
    await checkElementVisibility(testUserPage, config, effect);
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

// Helper function to test profiler tab permissions
export const testProfilerTabPermission = async (
  testUserPage: Page,
  tabName: string,
  effect: 'allow' | 'deny',
  expectedErrorMessage?: string
) => {
  await testUserPage
    .locator('[data-testid="profiler-tab-left-panel"]')
    .getByText(tabName)
    .click();

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
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
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
};

export const testTopicSpecificOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewSampleData for Topic
  await testPermissionErrorVisibility(
    testUserPage,
    'sample_data',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
  );
};

export const testDashboardSpecificOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Dashboard
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testPipelineSpecificOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test Edit Lineage for Pipeline
  await testUserPage.getByRole('tab', { name: 'Lineage' }).click();
  if (effect === 'allow') {
    await testUserPage.getByTestId('edit-lineage').click();

    await expect(testUserPage.getByTestId('edit-lineage')).toBeVisible();
  } else {
    await testUserPage.getByTestId('edit-lineage').click();

    await expect(testUserPage.getByTestId('edit-lineage')).not.toBeVisible();
  }
};

export const testSearchIndexSpecificOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
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
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Stored Procedure
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testDashboardDataModelSpecificOperations = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test Edit Lineage for Dashboard Data Model
  await testUserPage.getByRole('tab', { name: 'Lineage' }).click();
  if (effect === 'allow') {
    await testUserPage.getByTestId('edit-lineage').click();

    await expect(testUserPage.getByTestId('edit-lineage')).toBeVisible();
  } else {
    await testUserPage.getByTestId('edit-lineage').click();

    await expect(testUserPage.getByTestId('edit-lineage')).not.toBeVisible();
  }
};

// Helper function to run common permission tests
export const runCommonPermissionTests = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny'
) => {
  await testCommonOperations(testUserPage, entity, effect);
};

// Helper function to run entity-specific permission tests
export const runEntitySpecificPermissionTests = async (
  testUserPage: Page,
  entity: BaseEntity,
  effect: 'allow' | 'deny',
  specificTest?: (
    page: Page,
    entity: BaseEntity,
    effect: 'allow' | 'deny'
  ) => Promise<void>
) => {
  if (specificTest) {
    await specificTest(testUserPage, entity, effect);
  }
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
} as const;
