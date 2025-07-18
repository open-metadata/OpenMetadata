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
import { getApiContext, redirectToHomePage } from './common';

// Common function to handle entity-specific operation testing
const testEntitySpecificOperation = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  operations: string[],
  entityName: string,
  effect: 'allow' | 'deny',
  testSteps: (testUserPage: Page, effect: 'allow' | 'deny') => Promise<void>,
  testUser: any
) => {
  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  const policy = new PolicyClass();
  await policy.create(apiContext, [
    ...VIEW_ALL_RULE,
    {
      name: `${entityName}${effect}SpecificOperationsPolicy`,
      resources: ['All'],
      operations: operations,
      effect,
    },
  ]);

  const role = new RolesClass();
  await role.create(apiContext, [policy.responseData.name]);

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

  await entity.visitEntityPage(testUserPage);

  await testSteps(testUserPage, effect);

  const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
    await getApiContext(page);
  await role.delete(cleanupContext);
  await policy.delete(cleanupContext);
  await cleanupAfterAction();
};

// Test common operations for any entity
export const testCommonOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const commonOperations = [
    // 'ViewAll',
    // 'ViewBasic',
    // 'EditAll',
    'EditDescription',
    // 'EditDisplayName',
    'EditOwners',
    // 'EditTags',
    // 'EditGlossaryTerms',
    'EditTier',
    'EditCertification',
    // 'EditCustomFields',
    // 'Create',
    // 'Delete'
  ];

  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  // Create policy with all common operations
  const policy = new PolicyClass();
  await policy.create(apiContext, [
    ...VIEW_ALL_RULE,
    {
      name: `${entity.getType()}${effect}CommonOperationsPolicy`,
      resources: ['All'],
      operations: commonOperations,
      effect,
    },
  ]);

  // Create role and assign to user
  const role = new RolesClass();
  await role.create(apiContext, [policy.responseData.name]);

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

  // Navigate to entity page
  await redirectToHomePage(testUserPage);
  await entity.visitEntityPage(testUserPage);

  await page.waitForLoadState('networkidle');

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

  // Cleanup
  const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
    await getApiContext(page);
  await role.delete(cleanupContext);
  await policy.delete(cleanupContext);
  await cleanupAfterAction();
};

// Entity-specific test functions
export const testTableSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const tableSpecificOperations = [
    'ViewQueries',
    'ViewSampleData',
    'ViewDataProfile',
    'ViewTests',
    'ViewProfilerGlobalConfiguration',
    'EditQueries',
    'EditDataProfile',
    'EditSampleData',
    'EditTests',
  ];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewQueries
    await testUserPage.locator('[data-testid="table_queries"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Queries permission."
          )
      ).toBeVisible();
    }

    // Test ViewSampleData

    await testUserPage.locator('[data-testid="sample_data"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
          )
      ).toBeVisible();
    }
    // Test ViewDataProfile
    await testUserPage.locator('[data-testid="profiler"]').click();

    await testUserPage
      .locator('[data-testid="profiler-tab-left-panel"]')
      .getByText('Table Profile')
      .click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Data Observability permission."
          )
      ).toBeVisible();
    }

    await testUserPage
      .locator('[data-testid="profiler-tab-left-panel"]')
      .getByText('Column Profile')
      .click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the ViewDataProfile permission."
          )
      ).toBeVisible();
    }

    // View Tests
    await testUserPage
      .locator('[data-testid="profiler-tab-left-panel"]')
      .getByText('Data Quality')
      .click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Data Observability permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    tableSpecificOperations,
    'Table',
    effect,
    testSteps,
    testUser
  );
};

export const testTopicSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const topicSpecificOperations = ['ViewSampleData'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewSampleData for Topic
    await testUserPage.locator('[data-testid="sample_data"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    topicSpecificOperations,
    'Topic',
    effect,
    testSteps,
    testUser
  );
};

export const testContainerSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const containerSpecificOperations = ['ViewUsage', 'EditUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Container
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    containerSpecificOperations,
    'Container',
    effect,
    testSteps,
    testUser
  );
};

export const testDashboardSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const dashboardSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Dashboard
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    dashboardSpecificOperations,
    'Dashboard',
    effect,
    testSteps,
    testUser
  );
};

export const testPipelineSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const pipelineSpecificOperations = ['ViewUsage', 'EditStatus'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Pipeline
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }

    // Test EditStatus for Pipeline (if status edit button exists)
    if (effect === 'deny') {
      await expect(
        testUserPage.locator('[data-testid="edit-status"]')
      ).not.toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    pipelineSpecificOperations,
    'Pipeline',
    effect,
    testSteps,
    testUser
  );
};

export const testMlModelSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const mlModelSpecificOperations = ['ViewUsage', 'EditUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for ML Model
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    mlModelSpecificOperations,
    'MlModel',
    effect,
    testSteps,
    testUser
  );
};

export const testSearchIndexSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const searchIndexSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Search Index
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    searchIndexSpecificOperations,
    'SearchIndex',
    effect,
    testSteps,
    testUser
  );
};

export const testStoredProcedureSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const storedProcedureSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Stored Procedure
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    storedProcedureSpecificOperations,
    'StoredProcedure',
    effect,
    testSteps,
    testUser
  );
};

export const testMetricSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const metricSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Metric
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    metricSpecificOperations,
    'Metric',
    effect,
    testSteps,
    testUser
  );
};

export const testApiEndpointSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const apiEndpointSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for API Endpoint
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    apiEndpointSpecificOperations,
    'ApiEndpoint',
    effect,
    testSteps,
    testUser
  );
};

export const testDashboardDataModelSpecificOperations = async (
  page: Page,
  testUserPage: Page,
  entity: any,
  effect: 'allow' | 'deny',
  testUser: any
) => {
  const dashboardDataModelSpecificOperations = ['ViewUsage'];

  const testSteps = async (testUserPage: Page, effect: 'allow' | 'deny') => {
    // Test ViewUsage for Dashboard Data Model
    await testUserPage.locator('[data-testid="usage"]').click();
    if (effect === 'deny') {
      await expect(
        testUserPage
          .locator('[data-testid="permission-error-placeholder"]')
          .getByText(
            "You don't have necessary permissions. Please check with the admin to get the View Usage permission."
          )
      ).toBeVisible();
    }
  };

  await testEntitySpecificOperation(
    page,
    testUserPage,
    entity,
    dashboardDataModelSpecificOperations,
    'DashboardDataModel',
    effect,
    testSteps,
    testUser
  );
};
