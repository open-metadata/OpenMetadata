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
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../support/entity/StoredProcedureClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { getApiContext, redirectToHomePage } from './common';

// All operations across all entities
const ALL_OPERATIONS = [
  // Common operations
  'EditDescription',
  'EditOwners',
  'EditTier',
  'EditCertification',

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

export const assignRoleToUser = async (page: Page, testUser: any) => {
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

// Test common operations for any entity
export const testCommonOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  // Navigate to entity page
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  // Check visibility of common UI elements (same for all entities)
  const commonTestIds = [
    'edit-description',
    // 'edit-tags',
    // 'edit-glossary-terms',
    'edit-tier',
    'edit-owner',
    // 'edit-display-name',
    // 'edit-custom-fields',
    // 'edit-certification'
  ];

  await expect(
    testUserPage.locator('[data-testid="entity-header-title"]')
  ).toBeVisible();

  for (const testId of commonTestIds) {
    if (effect === 'allow') {
      await expect(
        testUserPage.locator(`[data-testid="${testId}"]`)
      ).toBeVisible();
    } else {
      await expect(
        testUserPage.locator(`[data-testid="${testId}"]`)
      ).not.toBeVisible();
    }
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
  entity: any,
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
  entity: any,
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

export const testContainerSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Container
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testDashboardSpecificOperations = async (
  testUserPage: Page,
  entity: any,
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
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Pipeline
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );

  // Test EditStatus for Pipeline (if status edit button exists)
  if (effect === 'deny') {
    await expect(
      testUserPage.locator('[data-testid="edit-status"]')
    ).not.toBeVisible();
  }
};

export const testMlModelSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for ML Model
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testSearchIndexSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Search Index
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testStoredProcedureSpecificOperations = async (
  testUserPage: Page,
  entity: any,
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

export const testMetricSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Metric
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testApiEndpointSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for API Endpoint
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

export const testDashboardDataModelSpecificOperations = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await entity.visitEntityPage(testUserPage);

  // Test ViewUsage for Dashboard Data Model
  await testPermissionErrorVisibility(
    testUserPage,
    'usage',
    effect,
    "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
  );
};

// Helper function to run common permission tests
export const runCommonPermissionTests = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny'
) => {
  await testCommonOperations(testUserPage, entity, effect);
};

// Helper function to run entity-specific permission tests
export const runEntitySpecificPermissionTests = async (
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  specificTest?: (
    page: Page,
    entity: any,
    effect: 'allow' | 'deny'
  ) => Promise<void>
) => {
  if (specificTest) {
    await specificTest(testUserPage, entity, effect);
  }
};

// Entity configuration with their specific test functions
export const entityConfig = {
  ApiEndpoint: {
    class: ApiEndpointClass,
    specificTest: testApiEndpointSpecificOperations,
  },
  Table: {
    class: TableClass,
    specificTest: testTableSpecificOperations,
  },
  StoredProcedure: {
    class: StoredProcedureClass,
    specificTest: testStoredProcedureSpecificOperations,
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
    specificTest: testContainerSpecificOperations,
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
    specificTest: testMetricSpecificOperations,
  },
} as const;
