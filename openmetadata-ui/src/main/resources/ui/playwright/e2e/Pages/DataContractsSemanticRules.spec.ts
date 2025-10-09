/*
 *  Copyright 2025 Collate.
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
import { expect } from '@playwright/test';
import {
  DATA_CONTRACT_SEMANTICS1,
  DATA_CONTRACT_SEMANTIC_OPERATIONS,
} from '../../constant/dataContracts';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import {
  assignDomain,
  redirectToHomePage,
  removeDomain,
} from '../../utils/common';
import {
  performInitialStepForRules,
  saveAndTriggerDataContractValidation,
} from '../../utils/dataContracts';
import {
  addOwner,
  removeOwnersFromList,
  updateDescription,
  updateOwner,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

test.describe('Data Contracts Semantics Rule Owner', () => {
  const user = new UserClass();
  const user2 = new UserClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await user2.create(apiContext);
    await afterAction();
  });

  test('Validate Owner Rule Is_Not', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await addOwner({
          page,
          owner: user2.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Owner with is not condition should passed with different owner',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Owners',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--value .ant-select'),
          user.responseData.name,
          true
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    await test.step(
      'Owner with is not condition should failed with same owner',
      async () => {
        await removeOwnersFromList({
          page,
          ownerNames: [user2.getUserName()],
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await updateOwner({
          page,
          owner: user.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );
  });

  test('Validate Owner Rule Any_In', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await addOwner({
          page,
          owner: user2.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      "Should Failed since entity owner doesn't make the list of any_in",
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Owners',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.any_in
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--value .ant-select'),
          user.responseData.name,
          true
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );

    await test.step(
      'Should Passed since entity owner present in the list of any_in',
      async () => {
        await removeOwnersFromList({
          page,
          ownerNames: [user2.getUserName()],
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await updateOwner({
          page,
          owner: user.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );
  });

  test('Validate Owner Rule Not_In', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await addOwner({
          page,
          owner: user2.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      "Should Passed since entity owner doesn't make the list of not_in",
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Owners',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.not_in
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--value .ant-select'),
          user.responseData.name,
          true
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    await test.step(
      'Should Failed since entity owner present in the list of not_in',
      async () => {
        await removeOwnersFromList({
          page,
          ownerNames: [user2.getUserName()],
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await updateOwner({
          page,
          owner: user.responseData.displayName,
          type: 'Users',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );
  });

  test('Validate Owner Rule Is_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await performInitialStepForRules(page);
      }
    );

    await test.step("Should Failed since entity don't have owner", async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Owners',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is_set
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });

    await test.step('Should Passed since entity has owner', async () => {
      await addOwner({
        page,
        owner: user2.responseData.displayName,
        type: 'Users',
        endpoint: EntityTypeEndpoint.Table,
        dataTestId: 'data-assets-header',
      });

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });
  });

  test.fixme('Validate Owner Rule Is_Not_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await performInitialStepForRules(page);
      }
    );

    await test.step("Should Passed since entity don't have owner", async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Owners',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not_set
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Should Failed since entity has owner', async () => {
      await addOwner({
        page,
        owner: user2.responseData.displayName,
        type: 'Users',
        endpoint: EntityTypeEndpoint.Table,
        dataTestId: 'data-assets-header',
      });

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });
});

test.describe('Data Contracts Semantics Rule Description', () => {
  test('Validate Description Rule Contains', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Description with contains condition should passed',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Description',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.contains
        );

        const inputElement = ruleLocator.locator(
          '.rule--widget--TEXT input[type="text"]'
        );
        await inputElement.fill('description');

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    await test.step(
      'Description with contains and wrong value should failed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await updateDescription(page, 'New Contract Rules Setting');

        await page.click('[data-testid="contract"]');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );
  });

  test('Validate Description Rule Not Contains', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Description with not_contains condition should failed',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Description',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.not_contains
        );
        const inputElement = ruleLocator.locator(
          '.rule--widget--TEXT input[type="text"]'
        );
        await inputElement.fill('description');

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );

    await test.step(
      'Description with not_contains condition should passed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await updateDescription(page, 'New Contract Rules Setting');

        await page.click('[data-testid="contract"]');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );
  });

  test('Validate Description Rule Is_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Description with is_set condition should passed',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Description',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is_set
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    await test.step(
      'Description with is_set condition should failed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await updateDescription(page, '');

        await page.click('[data-testid="contract"]');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );
  });

  test('Validate Description Rule Is_Not_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Description with is_not_set condition should failed',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Description',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not_set
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );

    await test.step(
      'Description with is_not_set condition should passed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await updateDescription(page, '');

        await page.click('[data-testid="contract"]');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );
  });
});

test.describe('Data Contracts Semantics Rule Domain', () => {
  const domain1 = new Domain();
  const domain2 = new Domain();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domain1.create(apiContext);
    await domain2.create(apiContext);
    await afterAction();
  });

  test('Validate Domain Rule Is', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await assignDomain(page, domain1.responseData);

        await performInitialStepForRules(page);
      }
    );

    await test.step('Domain with Is condition should passed', async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Domain',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--value .ant-select'),
        domain1.responseData.name,
        true
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Domain with Is condition should failed', async () => {
      await removeDomain(page, domain1.responseData);
      await assignDomain(page, domain2.responseData);

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });

  test('Validate Domain Rule Is Not', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await assignDomain(page, domain1.responseData);

        await performInitialStepForRules(page);
      }
    );

    await test.step('Domain with IsNot condition should passed', async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Domain',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--value .ant-select'),
        domain2.responseData.name,
        true
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Domain with IsNot condition should failed', async () => {
      await removeDomain(page, domain1.responseData);
      await assignDomain(page, domain2.responseData);

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });

  test('Validate Domain Rule Any_In', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await assignDomain(page, domain1.responseData);

        await performInitialStepForRules(page);
      }
    );

    await test.step('Domain with AnyIn condition should passed', async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Domain',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.any_in
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--value .ant-select'),
        domain1.responseData.name,
        true
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Domain with AnyIn condition should failed', async () => {
      await removeDomain(page, domain1.responseData);
      await assignDomain(page, domain2.responseData);

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });

  test('Validate Domain Rule Not_In', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await assignDomain(page, domain2.responseData);
        await performInitialStepForRules(page);
      }
    );

    await test.step('Domain with NotIn condition should passed', async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Domain',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.not_in
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--value .ant-select'),
        domain1.responseData.name,
        true
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Domain with NotIn condition should failed', async () => {
      await removeDomain(page, domain2.responseData);
      await assignDomain(page, domain1.responseData);

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });

  test('Validate Domain Rule Is_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await assignDomain(page, domain1.responseData);
        await performInitialStepForRules(page);
      }
    );

    await test.step('Domain with IsSet condition should passed', async () => {
      await page.getByRole('tab', { name: 'Semantics' }).click();

      await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
      await page.fill(
        '#semantics_0_description',
        DATA_CONTRACT_SEMANTICS1.description
      );

      const ruleLocator = page.locator('.group').nth(0);
      await selectOption(
        page,
        ruleLocator.locator('.group--field .ant-select'),
        'Domain',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is_set
      );

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Domain with IsSet condition should failed', async () => {
      await removeDomain(page, domain1.responseData);

      await page.getByTestId('manage-contract-actions').click();

      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });

      const runNowResponse = page.waitForResponse(
        '/api/v1/dataContracts/*/validate'
      );
      await page.getByTestId('contract-run-now-button').click();
      await runNowResponse;

      await page.reload();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Failed');

      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).toContainText('Contract Failed');
    });
  });

  test.fixme('Validate Domain Rule Is_Not_Set', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Domain with IsNotSet condition should passed',
      async () => {
        await page.getByRole('tab', { name: 'Semantics' }).click();

        await page.fill('#semantics_0_name', DATA_CONTRACT_SEMANTICS1.name);
        await page.fill(
          '#semantics_0_description',
          DATA_CONTRACT_SEMANTICS1.description
        );

        const ruleLocator = page.locator('.group').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.group--field .ant-select'),
          'Domain',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not_set
        );

        // save and trigger contract validation
        await saveAndTriggerDataContractValidation(page, true);

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Passed');
        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).not.toBeVisible();
      }
    );

    await test.step(
      'Domain with IsNotSet condition should failed',
      async () => {
        await assignDomain(page, domain1.responseData);

        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        const runNowResponse = page.waitForResponse(
          '/api/v1/dataContracts/*/validate'
        );
        await page.getByTestId('contract-run-now-button').click();
        await runNowResponse;

        await page.reload();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          page.getByTestId('contract-status-card-item-semantics-status')
        ).toContainText('Failed');

        await expect(
          page.getByTestId('data-contract-latest-result-btn')
        ).toContainText('Contract Failed');
      }
    );
  });
});
