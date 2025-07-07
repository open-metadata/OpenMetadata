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
import test, { expect } from '@playwright/test';
import { GLOSSARY_PATCH_PAYLOAD } from '../../constant/version';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { Glossary } from '../../support/glossary/Glossary';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { addMultiOwner } from '../../utils/entity';
import { setupGlossaryAndTerms } from '../../utils/glossary';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const user = new UserClass();
const reviewer = new UserClass();

test.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  await user.create(apiContext);
  await reviewer.create(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Glossary', async ({ page }) => {
  test.slow(true);

  const glossary = new Glossary();
  const { afterAction, apiContext } = await getApiContext(page);
  await glossary.create(apiContext);
  await glossary.patch(apiContext, GLOSSARY_PATCH_PAYLOAD);

  await test.step('Version changes', async () => {
    await glossary.visitPage(page);

    await page.click('[data-testid="version-button"]');

    await expect(
      page
        .getByTestId('asset-description-container')
        .getByTestId('markdown-parser')
        .locator('span')
        .filter({ hasText: 'Description' })
    ).toBeVisible();

    await expect(
      page.locator(
        '.diff-added [data-testid="tag-PersonalData.SpecialCategory"]'
      )
    ).toBeVisible();

    await expect(
      page.locator('.diff-added [data-testid="tag-PII.Sensitive"]')
    ).toBeVisible();
  });

  await test.step('Should display the owner & reviewer changes', async () => {
    await glossary.visitPage(page);

    await expect(page.getByTestId('version-button')).toHaveText(/0.2/);

    await addMultiOwner({
      page,
      ownerNames: [user.getUserName()],
      activatorBtnDataTestId: 'add-owner',
      resultTestId: 'glossary-right-panel-owner-link',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: true,
      type: 'Users',
    });

    await page.reload();
    const versionPageResponse = page.waitForResponse(
      `/api/v1/glossaries/${glossary.responseData.id}/versions/0.2`
    );
    await page.click('[data-testid="version-button"]');
    await versionPageResponse;

    await expect(
      page.locator(
        '[data-testid="glossary-right-panel-owner-link"] [data-testid="diff-added"]'
      )
    ).toBeVisible();

    const glossaryRes = page.waitForResponse(
      'api/v1/glossaryTerms?directChildrenOf=*'
    );
    await page.click('[data-testid="version-button"]');
    await glossaryRes;

    await addMultiOwner({
      page,
      ownerNames: [reviewer.getUserName()],
      activatorBtnDataTestId: 'Add',
      resultTestId: 'glossary-reviewer-name',
      endpoint: EntityTypeEndpoint.Glossary,
      type: 'Users',
    });

    await page.reload();
    await page.click('[data-testid="version-button"]');
    await versionPageResponse;

    await expect(
      page.locator(
        '[data-testid="glossary-reviewer"] [data-testid="diff-added"]'
      )
    ).toBeVisible();
  });

  await glossary.delete(apiContext);
  await afterAction();
});

test('GlossaryTerm', async ({ page }) => {
  test.slow(true);

  const { term1, term2, cleanup } = await setupGlossaryAndTerms(page);

  await test.step('Version changes', async () => {
    await term2.visitPage(page);

    await page.click('[data-testid="version-button"]');

    await expect(
      page
        .getByTestId('asset-description-container')
        .getByTestId('markdown-parser')
        .locator('span')
        .filter({ hasText: 'Description' })
    ).toBeVisible();

    await expect(
      page.locator(
        '.diff-added [data-testid="tag-PersonalData.SpecialCategory"]'
      )
    ).toBeVisible();

    await expect(
      page.locator('.diff-added [data-testid="tag-PII.Sensitive"]')
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="test-synonym"].diff-added')
    ).toBeVisible();

    await expect(
      page.locator(`[data-testid="${term1.data.displayName}"].diff-added`)
    ).toBeVisible();

    await expect(
      page.locator('.diff-added [data-testid="reference-link-reference1"]')
    ).toBeVisible();
  });

  await test.step('Should display the owner & reviewer changes', async () => {
    await term2.visitPage(page);

    await expect(page.getByTestId('version-button')).toHaveText(/0.2/);

    await addMultiOwner({
      page,
      ownerNames: [user.getUserName()],
      activatorBtnDataTestId: 'add-owner',
      resultTestId: 'glossary-right-panel-owner-link',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: true,
      type: 'Users',
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    const versionPageResponse = page.waitForResponse(
      `/api/v1/glossaryTerms/${term2.responseData.id}/versions/0.2`
    );
    await page.click('[data-testid="version-button"]');
    await versionPageResponse;

    await expect(
      page.locator(
        '[data-testid="glossary-right-panel-owner-link"] [data-testid="diff-added"]'
      )
    ).toBeVisible();

    const glossaryTermsRes = page.waitForResponse(
      '/api/v1/glossaryTerms/name/**'
    );
    await page.getByRole('dialog').getByRole('img').click();
    await glossaryTermsRes;

    await addMultiOwner({
      page,
      ownerNames: [reviewer.getUserName()],
      activatorBtnDataTestId: 'Add',
      resultTestId: 'glossary-reviewer-name',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      type: 'Users',
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.click('[data-testid="version-button"]');
    await versionPageResponse;

    const diffLocator = page.locator(
      '[data-testid="glossary-reviewer"] [data-testid="diff-added"]'
    );

    await diffLocator.waitFor({ state: 'attached' });

    await expect(diffLocator).toBeVisible();
  });

  await cleanup();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);

  await user.delete(apiContext);
  await reviewer.delete(apiContext);
  await afterAction();
});
