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
import { expect, Page } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { test } from '../../support/fixtures/userPages';
import { performAdminLogin } from '../../utils/admin';
import { redirectToExplorePage } from '../../utils/common';

const testEntity = new TableClass();
const testDataProduct = new DataProduct(
  [EntityDataClass.domain1],
  'PW_TestDataProduct'
);

test.beforeAll('Setup shared test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await EntityDataClass.preRequisitesForTests(apiContext);
  await testEntity.create(apiContext);
  await testDataProduct.create(apiContext);

  // Assign the test entity to domain1 so data products can be linked
  await testEntity.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: EntityDataClass.domain1.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup shared test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await testDataProduct.delete(apiContext);
  await testEntity.delete(apiContext);
  await EntityDataClass.postRequisitesForTests(apiContext);

  await afterAction();
});

async function openEntitySummaryPanel(
  page: Page,
  entityType: string,
  entityFqn: string
) {
  await page.getByRole('button', { name: 'Data Assets' }).click();
  const dataAssetDropdownRequest = page.waitForResponse(
    '/api/v1/search/aggregate?index=dataAsset&field=entityType.keyword*'
  );
  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill(entityType.toLowerCase());
  await dataAssetDropdownRequest;
  await page.getByTestId(`${entityType.toLowerCase()}-checkbox`).check();
  await page.getByTestId('update-btn').click();
  await page.waitForLoadState('networkidle');

  await page
    .waitForSelector('[data-testid="loader"]', {
      state: 'detached',
      timeout: 15000,
    })
    .catch(() => {
      // Loader might not appear, continue
    });

  const entityCard = page.locator(
    `[data-testid="table-data-card_${entityFqn}"]`
  );
  await entityCard.waitFor({ state: 'visible', timeout: 15000 });
  await entityCard.click();
  await page.waitForLoadState('networkidle');
}

async function navigateToExploreAndSelectTable(page: Page) {
  await redirectToExplorePage(page);

  await page
    .waitForSelector('[data-testid="loader"]', {
      state: 'detached',
      timeout: 15000,
    })
    .catch(() => {
      // Loader might not appear, continue
    });
  await openEntitySummaryPanel(
    page,
    'table',
    testEntity.entityResponseData.fullyQualifiedName
  );

  await page
    .waitForSelector('[data-testid="loader"]', {
      state: 'detached',
      timeout: 15000,
    })
    .catch(() => {
      // Loader might not appear, continue
    });

  await page.waitForSelector('.highlight-card', {
    timeout: 15000,
  });

  const summaryPanel = page.locator('.entity-summary-panel-container');

  await expect(summaryPanel).toBeVisible({ timeout: 15000 });
}

async function waitForPatchResponse(page: Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/') &&
      resp.request().method() === 'PATCH' &&
      !resp.url().includes('/api/v1/analytics')
  );
}

test.describe('Right Entity Panel - Admin User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ adminPage }) => {
    await navigateToExploreAndSelectTable(adminPage);
  });

  test('Description Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    const editButton = descriptionSection.getByTestId('edit-description');
    if (await editButton.isVisible()) {
      await editButton.click();

      await expect(adminPage.getByTestId('header')).toHaveText(
        'Edit Description'
      );

      const editor = adminPage
        .locator('.ProseMirror[contenteditable="true"]')
        .first();
      await editor.click();
      await editor.fill('Admin updated description');

      const patchResp = waitForPatchResponse(adminPage);
      await adminPage.getByTestId('save').click();
      await patchResp;

      await expect(adminPage.getByTestId('markdown-editor')).not.toBeVisible();
      await expect(
        adminPage.getByText(/Description updated successfully/)
      ).toBeVisible();
    }
  });

  test('Owners Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const ownersSection = summaryPanel.locator('.owners-section');

    await expect(ownersSection).toBeVisible();

    const editButton = ownersSection.getByTestId('edit-owners');
    if (await editButton.isVisible()) {
      await editButton.click();

      const popover = adminPage.getByTestId('select-owner-tabs');

      await expect(popover).toBeVisible();

      await adminPage.getByRole('tab', { name: 'Users' }).click();

      const firstOwner = adminPage.getByRole('listitem', {
        name: 'admin',
        exact: true,
      });
      if (await firstOwner.isVisible()) {
        await firstOwner.click();
        const updateBtn = adminPage.getByRole('button', { name: 'Update' });
        if (await updateBtn.isVisible()) {
          await updateBtn.click();
          await waitForPatchResponse(adminPage);

          await expect(
            adminPage.getByText(/Owners updated successfully/i)
          ).toBeVisible();
        }
      }
    }
  });

  test('Tier Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await adminPage
      .locator('[data-testid="edit-icon-tier"]')
      .scrollIntoViewIfNeeded();
    await adminPage.waitForSelector('[data-testid="edit-icon-tier"]', {
      state: 'visible',
    });

    await adminPage.locator('[data-testid="edit-icon-tier"]').click();

    const tierCard = adminPage.locator('.ant-popover');

    await expect(tierCard).toBeVisible();

    const tier1Radio = adminPage.getByTestId('radio-btn-Tier1');
    await tier1Radio.click();
    await adminPage.waitForSelector('[data-testid="update-tier-card"]', {
      state: 'visible',
    });
    await adminPage.getByTestId('update-tier-card').click();
    const patchResp = waitForPatchResponse(adminPage);
    await patchResp;

    await expect(
      adminPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Tags Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const tagsSection = summaryPanel.locator('.tags-section');

    await expect(tagsSection).toBeVisible();

    await adminPage
      .locator('[data-testid="edit-icon-tags"]')
      .scrollIntoViewIfNeeded();
    await adminPage.waitForSelector('[data-testid="edit-icon-tags"]', {
      state: 'visible',
    });

    await adminPage.locator('[data-testid="edit-icon-tags"]').click();

    const tagsPopover = adminPage.locator('.ant-popover');

    await expect(tagsPopover).toBeVisible();

    const tagOption = adminPage.getByTitle('None');
    if (await tagOption.isVisible()) {
      await tagOption.click();

      const updateBtn = adminPage.getByRole('button', { name: 'Update' });
      if (await updateBtn.isVisible()) {
        await updateBtn.click();
        await waitForPatchResponse(adminPage);

        await expect(
          adminPage.getByText(/Tags updated successfully/i)
        ).toBeVisible();
      }
    }
  });

  test('Glossary Terms Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const glossarySection = summaryPanel.locator('.glossary-terms-section');

    await expect(glossarySection).toBeVisible();

    await adminPage
      .locator('[data-testid="edit-glossary-terms"]')
      .scrollIntoViewIfNeeded();
    await adminPage.waitForSelector('[data-testid="edit-glossary-terms"]', {
      state: 'visible',
    });

    await adminPage.locator('[data-testid="edit-glossary-terms"]').click();

    const glossaryPopover = adminPage.locator('.ant-popover');

    await expect(glossaryPopover).toBeVisible();

    const firstTerm = adminPage.locator('.ant-list-item').first();
    await firstTerm.click();

    const patchResp = waitForPatchResponse(adminPage);
    await adminPage.getByRole('button', { name: 'Update' }).click();
    await patchResp;

    await expect(
      adminPage.getByText(/Glossary terms updated successfully/i)
    ).toBeVisible();
  });

  test('Domains Section - Add and Update', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const domainsSection = summaryPanel.locator('.domains-section');

    await expect(domainsSection).toBeVisible();

    const domainEditButton = domainsSection.locator(
      '[data-testid="add-domain"]'
    );
    if (await domainEditButton.isVisible()) {
      await domainEditButton.click();

      const tree = adminPage.getByTestId('domain-selectable-tree');

      await expect(tree).toBeVisible();

      const firstNode = tree
        .locator('[data-testid="tag-TestDomain"]')
        .waitFor({ state: 'visible' });
      await firstNode;
      await tree.locator('[data-testid="tag-TestDomain"]').click();
      const updateBtn = adminPage.getByRole('button', { name: 'Update' });
      if (await updateBtn.isVisible()) {
        await updateBtn.click();
        await waitForPatchResponse(adminPage);

        await expect(
          adminPage.getByText(/Domains updated successfully/i)
        ).toBeVisible();
      }
    }
  });

  test('Tab Navigation - Schema Tab', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const schemaTab = summaryPanel.getByRole('menuitem', { name: /schema/i });

    if (await schemaTab.isVisible()) {
      await schemaTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Tab Navigation - Lineage Tab', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const lineageTab = summaryPanel.getByRole('menuitem', {
      name: /lineage/i,
    });

    if (await lineageTab.isVisible()) {
      await lineageTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Tab Navigation - Data Quality Tab', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    if (await dqTab.isVisible()) {
      await dqTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content, .data-quality-tab-container'
      );

      await expect(tabContent.first()).toBeVisible();
    }
  });

  test('Tab Navigation - Custom Properties Tab', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    if (await cpTab.isVisible()) {
      await cpTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });
});

test.describe('Right Entity Panel - Data Steward User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ dataStewardPage }) => {
    await navigateToExploreAndSelectTable(dataStewardPage);
  });

  test('Data Steward - Description Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    const editButton = descriptionSection.getByTestId('edit-description');
    if (await editButton.isVisible()) {
      await editButton.click();

      await expect(dataStewardPage.getByTestId('header')).toHaveText(
        'Edit Description'
      );

      const editor = dataStewardPage
        .locator('.ProseMirror[contenteditable="true"]')
        .first();
      await editor.click();
      await editor.fill('Data Steward updated description');

      const patchResp = waitForPatchResponse(dataStewardPage);
      await dataStewardPage.getByTestId('save').click();
      await patchResp;

      await expect(
        dataStewardPage.getByTestId('markdown-editor')
      ).not.toBeVisible();
      await expect(
        dataStewardPage.getByText(/Description updated successfully/)
      ).toBeVisible();
    }
  });

  test('Data Steward - Owners Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const ownersSection = summaryPanel.locator('.owners-section');

    await expect(ownersSection).toBeVisible();

    const editButton = ownersSection.getByTestId('edit-owners');
    if (await editButton.isVisible()) {
      await editButton.click();

      const popover = dataStewardPage.getByTestId('select-owner-tabs');

      await expect(popover).toBeVisible();

      await dataStewardPage.getByRole('tab', { name: 'Users' }).click();

      const firstOwner = dataStewardPage.getByRole('listitem', {
        name: 'admin',
        exact: true,
      });
      if (await firstOwner.isVisible()) {
        await firstOwner.click();
        const updateBtn = dataStewardPage.getByRole('button', {
          name: 'Update',
        });
        if (await updateBtn.isVisible()) {
          await updateBtn.click();
          await waitForPatchResponse(dataStewardPage);

          await expect(
            dataStewardPage.getByText(/Owners updated successfully/i)
          ).toBeVisible();
        }
      }
    }
  });

  test('Data Steward - Tier Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await dataStewardPage
      .locator('[data-testid="edit-icon-tier"]')
      .scrollIntoViewIfNeeded();
    await dataStewardPage.waitForSelector('[data-testid="edit-icon-tier"]', {
      state: 'visible',
    });

    await dataStewardPage.locator('[data-testid="edit-icon-tier"]').click();

    const tierCard = dataStewardPage.locator('.ant-popover');

    await expect(tierCard).toBeVisible();

    const tier2Radio = dataStewardPage.getByTestId('radio-btn-Tier2');
    await tier2Radio.click();
    await dataStewardPage.waitForSelector('[data-testid="update-tier-card"]', {
      state: 'visible',
    });
    await dataStewardPage.getByTestId('update-tier-card').click();
    const patchResp = waitForPatchResponse(dataStewardPage);
    await patchResp;

    await expect(
      dataStewardPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Tags Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const tagsSection = summaryPanel.locator('.tags-section');

    await expect(tagsSection).toBeVisible();

    await dataStewardPage
      .locator('[data-testid="edit-icon-tags"]')
      .scrollIntoViewIfNeeded();
    await dataStewardPage.waitForSelector('[data-testid="edit-icon-tags"]', {
      state: 'visible',
    });

    await dataStewardPage.locator('[data-testid="edit-icon-tags"]').click();

    const tagsPopover = dataStewardPage.locator('.ant-popover');

    await expect(tagsPopover).toBeVisible();

    const tagOption = dataStewardPage.getByTitle('PII.Sensitive');
    if (await tagOption.isVisible()) {
      await tagOption.click();

      const updateBtn = dataStewardPage.getByRole('button', { name: 'Update' });
      if (await updateBtn.isVisible()) {
        await updateBtn.click();
        await waitForPatchResponse(dataStewardPage);

        await expect(
          dataStewardPage.getByText(/Tags updated successfully/i)
        ).toBeVisible();
      }
    }
  });

  test('Data Steward - Glossary Terms Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const glossarySection = summaryPanel.locator('.glossary-terms-section');

    await expect(glossarySection).toBeVisible();

    await dataStewardPage
      .locator('[data-testid="edit-glossary-terms"]')
      .scrollIntoViewIfNeeded();
    await dataStewardPage.waitForSelector(
      '[data-testid="edit-glossary-terms"]',
      {
        state: 'visible',
      }
    );

    await dataStewardPage
      .locator('[data-testid="edit-glossary-terms"]')
      .click();

    const glossaryPopover = dataStewardPage.locator('.ant-popover');

    await expect(glossaryPopover).toBeVisible();

    const firstTerm = dataStewardPage.locator('.ant-list-item').first();
    await firstTerm.click();

    const patchResp = waitForPatchResponse(dataStewardPage);
    await dataStewardPage.getByRole('button', { name: 'Update' }).click();
    await patchResp;

    await expect(
      dataStewardPage.getByText(/Glossary terms updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Should NOT have permissions for Domains', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );

    await expect(summaryPanel.getByTestId('add-domain')).not.toBeVisible();
    await expect(
      summaryPanel.getByTestId('edit-data-products')
    ).not.toBeVisible();
  });

  test('Data Steward - Tab Navigation - Schema Tab', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const schemaTab = summaryPanel.getByRole('menuitem', { name: /schema/i });

    if (await schemaTab.isVisible()) {
      await schemaTab.click();
      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Data Steward - Tab Navigation - Lineage Tab', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const lineageTab = summaryPanel.getByRole('menuitem', {
      name: /lineage/i,
    });

    if (await lineageTab.isVisible()) {
      await lineageTab.click();
      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Data Steward - Tab Navigation - Data Quality Tab', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    if (await dqTab.isVisible()) {
      await dqTab.click();
      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content, .data-quality-tab-container'
      );

      await expect(tabContent.first()).toBeVisible();
    }
  });

  test('Data Steward - Tab Navigation - Custom Properties Tab', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    if (await cpTab.isVisible()) {
      await cpTab.click();
      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });
});

test.describe('Right Entity Panel - Data Consumer User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ dataConsumerPage }) => {
    await navigateToExploreAndSelectTable(dataConsumerPage);
  });

  test('Data Consumer - Description Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    const editButton = descriptionSection.getByTestId('edit-description');
    if (await editButton.isVisible()) {
      await editButton.click();

      await expect(dataConsumerPage.getByTestId('header')).toHaveText(
        'Edit Description'
      );

      const editor = dataConsumerPage
        .locator('.ProseMirror[contenteditable="true"]')
        .first();
      await editor.click();
      await editor.fill('Data Consumer updated description');

      const patchResp = waitForPatchResponse(dataConsumerPage);
      await dataConsumerPage.getByTestId('save').click();
      await patchResp;

      await expect(
        dataConsumerPage.getByTestId('markdown-editor')
      ).not.toBeVisible();
      await expect(
        dataConsumerPage.getByText(/Description updated successfully/)
      ).toBeVisible();
    }
  });

  test('Data Consumer - Should NOT have edit permissions for Owners', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const ownersSection = summaryPanel.locator('.owners-section');

    await expect(ownersSection).toBeVisible();
    await expect(summaryPanel.getByTestId('edit-owners')).not.toBeVisible();
  });

  test('Data Consumer - Tier Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await dataConsumerPage
      .locator('[data-testid="edit-icon-tier"]')
      .scrollIntoViewIfNeeded();
    await dataConsumerPage.waitForSelector('[data-testid="edit-icon-tier"]', {
      state: 'visible',
    });

    await dataConsumerPage.locator('[data-testid="edit-icon-tier"]').click();

    const tierCard = dataConsumerPage.locator('.ant-popover');

    await expect(tierCard).toBeVisible();

    const tier3Radio = dataConsumerPage.getByTestId('radio-btn-Tier3');
    await tier3Radio.click();
    await dataConsumerPage.waitForSelector('[data-testid="update-tier-card"]', {
      state: 'visible',
    });
    await dataConsumerPage.getByTestId('update-tier-card').click();
    const patchResp = waitForPatchResponse(dataConsumerPage);
    await patchResp;

    await expect(
      dataConsumerPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Data Consumer - Tags Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tagsSection = summaryPanel.locator('.tags-section');

    await expect(tagsSection).toBeVisible();

    await dataConsumerPage
      .locator('[data-testid="edit-icon-tags"]')
      .scrollIntoViewIfNeeded();
    await dataConsumerPage.waitForSelector('[data-testid="edit-icon-tags"]', {
      state: 'visible',
    });

    await dataConsumerPage.locator('[data-testid="edit-icon-tags"]').click();

    const tagsPopover = dataConsumerPage.locator('.ant-popover');

    await expect(tagsPopover).toBeVisible();

    const tagOption = dataConsumerPage.getByTitle('PersonalData.Personal');
    if (await tagOption.isVisible()) {
      await tagOption.click();

      const updateBtn = dataConsumerPage.getByRole('button', {
        name: 'Update',
      });
      if (await updateBtn.isVisible()) {
        await updateBtn.click();
        await waitForPatchResponse(dataConsumerPage);

        await expect(
          dataConsumerPage.getByText(/Tags updated successfully/i)
        ).toBeVisible();
      }
    }
  });

  test('Data Consumer - Glossary Terms Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const glossarySection = summaryPanel.locator('.glossary-terms-section');

    await expect(glossarySection).toBeVisible();

    await dataConsumerPage
      .locator('[data-testid="edit-glossary-terms"]')
      .scrollIntoViewIfNeeded();
    await dataConsumerPage.waitForSelector(
      '[data-testid="edit-glossary-terms"]',
      {
        state: 'visible',
      }
    );

    await dataConsumerPage
      .locator('[data-testid="edit-glossary-terms"]')
      .click();

    const glossaryPopover = dataConsumerPage.locator('.ant-popover');

    await expect(glossaryPopover).toBeVisible();

    const firstTerm = dataConsumerPage.locator('.ant-list-item').first();
    await firstTerm.click();

    const patchResp = waitForPatchResponse(dataConsumerPage);
    await dataConsumerPage.getByRole('button', { name: 'Update' }).click();
    await patchResp;

    await expect(
      dataConsumerPage.getByText(/Glossary terms updated successfully/i)
    ).toBeVisible();
  });

  test('Data Consumer - Should NOT have permissions for Domains & Data Products', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const domainsSection = summaryPanel.locator('.domains-section');

    await expect(domainsSection).toBeVisible();
    await expect(summaryPanel.getByTestId('add-domain')).not.toBeVisible();

    await expect(
      summaryPanel.getByTestId('edit-data-products')
    ).not.toBeVisible();
  });

  test('Data Consumer - Tab Navigation - Schema Tab', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const schemaTab = summaryPanel.getByRole('menuitem', { name: /schema/i });

    if (await schemaTab.isVisible()) {
      await schemaTab.click();
      await dataConsumerPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Data Consumer - Tab Navigation - Lineage Tab', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const lineageTab = summaryPanel.getByRole('menuitem', {
      name: /lineage/i,
    });

    if (await lineageTab.isVisible()) {
      await lineageTab.click();
      await dataConsumerPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });

  test('Data Consumer - Tab Navigation - Data Quality Tab', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    if (await dqTab.isVisible()) {
      await dqTab.click();
      await dataConsumerPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content, .data-quality-tab-container'
      );

      await expect(tabContent.first()).toBeVisible();
    }
  });

  test('Data Consumer - Tab Navigation - Custom Properties Tab', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    if (await cpTab.isVisible()) {
      await cpTab.click();
      await dataConsumerPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();
    }
  });
});
