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
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption, selectRange } from '../../utils/advancedSearch';
import {
    assignDataProduct,
    assignSingleSelectDomain,
    redirectToHomePage,
    removeDataProduct,
    removeSingleSelectDomain,
} from '../../utils/common';
import {
    performInitialStepForRules,
    saveAndTriggerDataContractValidation,
} from '../../utils/dataContracts';
import {
    customFormatDateTime,
    getCurrentMillis,
    getEpochMillisForFutureDays,
} from '../../utils/dateTime';
import {
    addOwner,
    removeOwnersFromList,
    updateDescription,
    updateDisplayNameForEntity,
    updateOwner,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

test.describe('Data Contracts Semantics Rule Owner', () => {
  const user = new UserClass();
  const user2 = new UserClass();
  const team = new TeamClass();
  const team2 = new TeamClass();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await user2.create(apiContext);
    await afterAction();
  });

  test('Validate Owner Rule Is', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    await table.create(apiContext);
    await team.create(apiContext);
    await team2.create(apiContext);

    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await addOwner({
          page,
          owner: team.responseData.displayName,
          type: 'Teams',
          endpoint: EntityTypeEndpoint.Table,
          dataTestId: 'data-assets-header',
        });

        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'Owner with is condition should passed with same team owner',
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
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--value .ant-select'),
          team.responseData.displayName,
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
      'Owner with is condition should failed with different owner',
      async () => {
        await updateOwner({
          page,
          owner: team2.responseData.displayName,
          type: 'Teams',
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

        await page.waitForLoadState('domcontentloaded');
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
          user.responseData.displayName,
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
          ownerNames: [user2.getUserDisplayName()],
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

        await page.waitForLoadState('domcontentloaded');
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
          user.responseData.displayName,
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
          ownerNames: [user2.getUserDisplayName()],
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

        await page.waitForLoadState('domcontentloaded');
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
          user.responseData.displayName,
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
          ownerNames: [user2.getUserDisplayName()],
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

        await page.waitForLoadState('domcontentloaded');
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

      await page.waitForLoadState('domcontentloaded');
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

      await page.waitForLoadState('domcontentloaded');
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

        await page.waitForLoadState('domcontentloaded');
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

        await page.waitForLoadState('domcontentloaded');
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

        await page.waitForLoadState('domcontentloaded');
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

        await page.waitForLoadState('domcontentloaded');
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

        await assignSingleSelectDomain(page, domain1.responseData);

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
      await removeSingleSelectDomain(page, domain1.responseData);
      await assignSingleSelectDomain(page, domain2.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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
        await assignSingleSelectDomain(page, domain1.responseData);

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
      await removeSingleSelectDomain(page, domain1.responseData);
      await assignSingleSelectDomain(page, domain2.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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

        await assignSingleSelectDomain(page, domain1.responseData);

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
      await removeSingleSelectDomain(page, domain1.responseData);
      await assignSingleSelectDomain(page, domain2.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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
        await assignSingleSelectDomain(page, domain2.responseData);
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
      await removeSingleSelectDomain(page, domain2.responseData);
      await assignSingleSelectDomain(page, domain1.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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
        await assignSingleSelectDomain(page, domain1.responseData);
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
      await removeSingleSelectDomain(page, domain1.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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
        await assignSingleSelectDomain(page, domain1.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

test.describe('Data Contracts Semantics Rule Version', () => {
  test('Validate Entity Version Is', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
    await afterAction();

    await test.step(
      'Open contract section and start adding contract',
      async () => {
        await redirectToHomePage(page);
        await table.visitEntityPage(page);
        await performInitialStepForRules(page);
      }
    );

    await test.step('Correct entity version should passed', async () => {
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
        'Version',
        true
      );
      await selectOption(
        page,
        ruleLocator.locator('.rule--operator .ant-select'),
        DATA_CONTRACT_SEMANTIC_OPERATIONS.is
      );

      await ruleLocator
        .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
        .fill('0.1');

      // save and trigger contract validation
      await saveAndTriggerDataContractValidation(page, true);

      await expect(
        page.getByTestId('contract-status-card-item-semantics-status')
      ).toContainText('Passed');
      await expect(
        page.getByTestId('data-contract-latest-result-btn')
      ).not.toBeVisible();
    });

    await test.step('Non-Correct entity version should failed', async () => {
      await assignSingleSelectDomain(page, domain.responseData);

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

      await page.waitForLoadState('domcontentloaded');
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

  test('Validate Entity Version Is Not', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
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
      'Contract with is_not condition for version should passed',
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
          'Version',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.is_not
        );

        await ruleLocator
          .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
          .fill('0.2');

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
      'Contract with is_not condition for version should failed',
      async () => {
        await assignSingleSelectDomain(page, domain.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate Entity Version Less than <', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
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
      'Contract with < condition for version should passed',
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
          'Version',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.less
        );

        await ruleLocator
          .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
          .fill('0.2');

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
      'Contract with < condition for version should failed',
      async () => {
        await assignSingleSelectDomain(page, domain.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate Entity Version Greater than >', async ({ page, browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
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
      'Contract with > condition for version should failed',
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
          'Version',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.greater
        );

        await ruleLocator
          .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
          .fill('0.1');

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
      'Contract with > condition for version should passed',
      async () => {
        await assignSingleSelectDomain(page, domain.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate Entity Version Less than equal <=', async ({
    page,
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
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
      'Contract with <= condition for version should passed',
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
          'Version',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.less_equal
        );

        await ruleLocator
          .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
          .fill('0.1');

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
      'Contract with <= condition for version should failed',
      async () => {
        await assignSingleSelectDomain(page, domain.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate Entity Version Greater than equal >=', async ({
    page,
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    const domain = new Domain();
    await table.create(apiContext);
    await domain.create(apiContext);
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
      'Contract with >= condition for version should passed',
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
          'Version',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.less_equal
        );

        await ruleLocator
          .locator('.rule--value .rule--widget--NUMBER .ant-input-number-input')
          .fill('0.1');

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
      'Contract with >= condition for version should failed',
      async () => {
        await assignSingleSelectDomain(page, domain.responseData);

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

        await page.waitForLoadState('domcontentloaded');
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

test.describe('Data Contracts Semantics Rule DataProduct', () => {
  const domain = new Domain();
  const testDataProducts = [
    new DataProduct([domain]),
    new DataProduct([domain]),
  ];
  const createdDataProducts: DataProduct[] = [];

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await domain.create(apiContext);
    for (const dp of testDataProducts) {
      await dp.create(apiContext);
      createdDataProducts.push(dp);
    }
    await afterAction();
  });

  test('Validate DataProduct Rule Is', async ({ page, browser }) => {
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
        await assignSingleSelectDomain(page, domain.responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[0].responseData,
        ]);
        await performInitialStepForRules(page);
      }
    );

    await test.step('DataProduct with Is condition should passed', async () => {
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
        'Data Product',
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
        createdDataProducts[0].responseData.name,
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

    await test.step('DataProduct with Is condition should failed', async () => {
      // Move to Schema Tab
      await page.getByTestId('schema').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await removeDataProduct(page, createdDataProducts[0].responseData);
      await assignDataProduct(page, domain.responseData, [
        createdDataProducts[1].responseData,
      ]);

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

      await page.waitForLoadState('domcontentloaded');
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

  test('Validate DataProduct Rule Is Not', async ({ page, browser }) => {
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
        await assignSingleSelectDomain(page, domain.responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[1].responseData,
        ]);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'DataProduct with Is Not condition should passed',
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
          'Data Product',
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
          createdDataProducts[0].responseData.name,
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
      'DataProduct with Is Not condition should passed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await removeDataProduct(page, createdDataProducts[1].responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[0].responseData,
        ]);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DataProduct Rule Any_In', async ({ page, browser }) => {
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
        await assignSingleSelectDomain(page, domain.responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[1].responseData,
        ]);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'DataProduct with Any In condition should failed',
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
          'Data Product',
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
          createdDataProducts[0].responseData.name,
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
      'DataProduct with Any In condition should passed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await removeDataProduct(page, createdDataProducts[1].responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[0].responseData,
        ]);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DataProduct Rule Not_In', async ({ page, browser }) => {
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
        await assignSingleSelectDomain(page, domain.responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[1].responseData,
        ]);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'DataProduct with Not In condition should passed',
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
          'Data Product',
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
          createdDataProducts[0].responseData.name,
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
      'DataProduct with Any In condition should passed',
      async () => {
        // Move to Schema Tab
        await page.getByTestId('schema').click();

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await removeDataProduct(page, createdDataProducts[1].responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[0].responseData,
        ]);

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DataProduct Rule Is_Set', async ({ page, browser }) => {
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
        await assignSingleSelectDomain(page, domain.responseData);
        await assignDataProduct(page, domain.responseData, [
          createdDataProducts[1].responseData,
        ]);
        await performInitialStepForRules(page);
      }
    );

    await test.step(
      'DataProduct with IsSet condition should passed',
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
          'Data Product',
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

    await test.step('Domain with IsSet condition should failed', async () => {
      // Move to Schema Tab
      await page.getByTestId('schema').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await removeDataProduct(page, createdDataProducts[1].responseData);

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

      await page.waitForLoadState('domcontentloaded');
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

  test.fixme(
    'Validate DataProduct Rule Is_Not_Set',
    async ({ page, browser }) => {
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
        'DataProduct with IsNotSet condition should passed',
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
            'Data Product',
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
        'DataProduct with IsNotSet condition should failed',
        async () => {
          // Move to Schema Tab
          await page.getByTestId('schema').click();

          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          await assignSingleSelectDomain(page, domain.responseData);

          await assignDataProduct(page, domain.responseData, [
            createdDataProducts[1].responseData,
          ]);

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

          await page.waitForLoadState('domcontentloaded');
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
    }
  );
});

test.describe('Data Contracts Semantics Rule DisplayName', () => {
  test('Validate DisplayName Rule Is', async ({ page, browser }) => {
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

    await test.step('DisplayName with Is condition should passed', async () => {
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
        'Display Name',
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
        table.entityResponseData.displayName,
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

    await test.step('DisplayName with Is condition should failed', async () => {
      await updateDisplayNameForEntity(
        page,
        `new displayName updated`,
        EntityTypeEndpoint.Table
      );

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

      await page.waitForLoadState('domcontentloaded');
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

  test('Validate DisplayName Rule Is Not', async ({ page, browser }) => {
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
      'DisplayName with Is Not condition should failed',
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
          'Display Name',
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
          table.entityResponseData.displayName,
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
      'DisplayName with Is Not condition should passed',
      async () => {
        await updateDisplayNameForEntity(
          page,
          `new displayName updated`,
          EntityTypeEndpoint.Table
        );

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DisplayName Rule Any_In', async ({ page, browser }) => {
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
      'DisplayName with Any In condition should passed',
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
          'Display Name',
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
          table.entityResponseData.displayName,
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
      'DisplayName with Any In condition should failed',
      async () => {
        await updateDisplayNameForEntity(
          page,
          `new displayName updated`,
          EntityTypeEndpoint.Table
        );

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DisplayName Rule Not_In', async ({ page, browser }) => {
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
      'DisplayName with Not In condition should failed',
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
          'Display Name',
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
          table.entityResponseData.displayName,
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
      'DisplayName with Not In condition should passed',
      async () => {
        await updateDisplayNameForEntity(
          page,
          `New displayName updated`,
          EntityTypeEndpoint.Table
        );

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DisplayName Rule Is_Set', async ({ page, browser }) => {
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
      'DisplayName with IsSet condition should passed',
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
          'Display Name',
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
      'DisplayName with IsSet condition should failed',
      async () => {
        await updateDisplayNameForEntity(
          page,
          ``,
          EntityTypeEndpoint.Table,
          true
        );

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

        await page.waitForLoadState('domcontentloaded');
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

  test('Validate DisplayName Rule Is_Not_Set', async ({ page, browser }) => {
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
      'DisplayName with IsNotSet condition should failed',
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
          'Display Name',
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
      'DisplayName with IsNotSet condition should passed',
      async () => {
        await updateDisplayNameForEntity(
          page,
          ``,
          EntityTypeEndpoint.Table,
          true
        );

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

        await page.waitForLoadState('domcontentloaded');
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

test.describe('Data Contracts Semantics Rule Updated on', () => {
  test('Validate UpdatedOn Rule Between', async ({ page, browser }) => {
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
      'UpdatedOn with Between condition should passed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.between
        );

        const startDate = customFormatDateTime(
          getCurrentMillis(),
          'dd.MM.yyyy'
        );
        const endDate = customFormatDateTime(
          getEpochMillisForFutureDays(5),
          'dd.MM.yyyy'
        );

        await selectRange(page, ruleLocator, startDate, endDate);

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
      'UpdatedOn with Between condition should failed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newStart = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );
        page.getByRole('textbox', { name: 'Enter date from' }).fill(newStart);
        await page.press('.ant-picker-input-active input', 'Enter');
        await page.press('.ant-picker-input-active input', 'Enter');

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
  });

  test('Validate UpdatedOn Rule Not_Between', async ({ page, browser }) => {
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
      'UpdatedOn with Between condition should failed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.not_between
        );

        const startDate = customFormatDateTime(
          getCurrentMillis(),
          'dd.MM.yyyy'
        );
        const endDate = customFormatDateTime(
          getEpochMillisForFutureDays(5),
          'dd.MM.yyyy'
        );

        await selectRange(page, ruleLocator, startDate, endDate);

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
      'UpdatedOn with Between condition should passed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newStart = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );
        await page
          .locator('.group')
          .nth(0)
          .locator('.rule--value .ant-picker-range')
          .click();

        await page.waitForSelector('.ant-picker-dropdown-range', {
          state: 'visible',
        });

        await page
          .getByRole('textbox', { name: 'Enter date from' })
          .fill(newStart);
        await page.press('.ant-picker-input-active input', 'Enter');
        await page.press('.ant-picker-input-active input', 'Enter');

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
  });

  test('Validate UpdatedOn Rule Less than', async ({ page, browser }) => {
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
      'UpdatedOn with Less than condition should failed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.less
        );

        const date = customFormatDateTime(getCurrentMillis(), 'dd.MM.yyyy');

        await ruleLocator.locator('.rule--value .ant-picker').click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(date);
        await page.press('.ant-picker-input input', 'Enter');

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
      'UpdatedOn with Less than condition should passed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newDate = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );

        await page
          .locator('.group')
          .nth(0)
          .locator('.rule--value .ant-picker')
          .click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(newDate);
        await page.press('.ant-picker-input input', 'Enter');

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
  });

  test('Validate UpdatedOn Rule Greater than', async ({ page, browser }) => {
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
      'UpdatedOn with Greater than condition should failed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.greater
        );

        const date = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );

        await ruleLocator.locator('.rule--value .ant-picker').click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(date);
        await page.press('.ant-picker-input input', 'Enter');

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
      'UpdatedOn with Greater than condition should passed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newDate = customFormatDateTime(
          getEpochMillisForFutureDays(-1),
          'dd.MM.yyyy'
        );

        await page
          .locator('.group')
          .nth(0)
          .locator('.rule--value .ant-picker')
          .click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(newDate);
        await page.press('.ant-picker-input input', 'Enter');

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
  });

  test('Validate UpdatedOn Rule Less than Equal', async ({ page, browser }) => {
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
      'UpdatedOn with LessThanEqual condition should passed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.less_equal
        );

        const date = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );

        await ruleLocator.locator('.rule--value .ant-picker').click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(date);
        await page.press('.ant-picker-input input', 'Enter');

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
      'UpdatedOn with Less than condition should failed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newDate = customFormatDateTime(
          getEpochMillisForFutureDays(-1),
          'dd.MM.yyyy'
        );

        await page
          .locator('.group')
          .nth(0)
          .locator('.rule--value .ant-picker')
          .click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(newDate);
        await page.press('.ant-picker-input input', 'Enter');

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
  });

  test('Validate UpdatedOn Rule Greater Than Equal', async ({
    page,
    browser,
  }) => {
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
      'UpdatedOn with GreaterThanEqual condition should passed',
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
          'Updated on',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          DATA_CONTRACT_SEMANTIC_OPERATIONS.greater_equal
        );

        const date = customFormatDateTime(
          getEpochMillisForFutureDays(-1),
          'dd.MM.yyyy'
        );

        await ruleLocator.locator('.rule--value .ant-picker').click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(date);
        await page.press('.ant-picker-input input', 'Enter');

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
      'UpdatedOn with GreaterThanEqual condition should failed',
      async () => {
        await page.getByTestId('manage-contract-actions').click();

        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });

        await page.getByTestId('contract-edit-button').click();

        await page.getByRole('tab', { name: 'Semantics' }).click();

        const newDate = customFormatDateTime(
          getEpochMillisForFutureDays(1),
          'dd.MM.yyyy'
        );

        await page
          .locator('.group')
          .nth(0)
          .locator('.rule--value .ant-picker')
          .click();
        await page.waitForSelector('.ant-picker-dropdown', {
          state: 'visible',
        });
        await page.locator('.ant-picker-input input').fill(newDate);
        await page.press('.ant-picker-input input', 'Enter');

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
  });
});
