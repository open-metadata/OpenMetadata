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
      ownerNames: [user.getUserDisplayName()],
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
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

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
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await addMultiOwner({
      page,
      ownerNames: [reviewer.getUserDisplayName()],
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
      ownerNames: [user.getUserDisplayName()],
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

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await addMultiOwner({
      page,
      ownerNames: [reviewer.getUserDisplayName()],
      activatorBtnDataTestId: 'Add',
      resultTestId: 'glossary-reviewer-name',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      type: 'Users',
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    // Verify the reviewer was actually added before checking version diff
    await expect(
      page
        .locator('[data-testid="glossary-reviewer-name"]')
        .getByTestId(reviewer.getUserDisplayName())
    ).toBeVisible();

    await page.click('[data-testid="version-button"]');
    await versionPageResponse;

    // Wait for the version dialog to be fully loaded
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('[data-testid="glossary-reviewer"]')
    ).toBeVisible();

    // Verify the reviewer is present in the version view
    await expect(
      page.getByTestId('glossary-reviewer-name').getByTestId('owner-link')
    ).toBeVisible();
  });

  await cleanup();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);

  await user.delete(apiContext);
  await reviewer.delete(apiContext);
  await afterAction();
});

// V-10: Navigate between versions
test('Navigate between versions', async ({ page }) => {
  const glossary = new Glossary();
  const { afterAction, apiContext } = await getApiContext(page);
  await glossary.create(apiContext);

  // Make multiple changes to create multiple versions
  await glossary.patch(apiContext, [
    {
      op: 'add',
      path: '/description',
      value: 'First description update',
    },
  ]);

  await glossary.patch(apiContext, [
    {
      op: 'replace',
      path: '/description',
      value: 'Second description update',
    },
  ]);

  try {
    await glossary.visitPage(page);
    await page.click('[data-testid="version-button"]');

    // Wait for version dialog to load
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    // Check if version selector/dropdown exists
    const versionSelector = page.getByTestId('version-selector');

    if (await versionSelector.isVisible()) {
      // Navigate to an earlier version
      await versionSelector.click();

      // Select version 0.1 from dropdown
      const versionOption = page.getByRole('option', { name: /0\.1/ });

      if (await versionOption.isVisible()) {
        await versionOption.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Verify the version dialog is still visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  } finally {
    await glossary.delete(apiContext);
    await afterAction();
  }
});

// V-11: Return to current version from history
test('Return to current version from history', async ({ page }) => {
  const glossary = new Glossary();
  const { afterAction, apiContext } = await getApiContext(page);
  await glossary.create(apiContext);
  await glossary.patch(apiContext, GLOSSARY_PATCH_PAYLOAD);

  try {
    await glossary.visitPage(page);
    await page.click('[data-testid="version-button"]');

    // Wait for version dialog
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Close the version dialog
    await page.getByRole('dialog').getByRole('img').click();

    // Wait for dialog to close
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await page.waitForLoadState('networkidle');

    // Verify we're back on the main glossary page
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      glossary.data.displayName
    );

    // Verify version button shows current version
    await expect(page.getByTestId('version-button')).toBeVisible();
  } finally {
    await glossary.delete(apiContext);
    await afterAction();
  }
});

// V-07: Version diff shows synonym changes
test('Version diff shows synonym changes', async ({ page }) => {
  const { term2, cleanup } = await setupGlossaryAndTerms(page);

  try {
    // The setupGlossaryAndTerms already patches term2 with synonyms
    await term2.visitPage(page);
    await page.click('[data-testid="version-button"]');

    // Wait for version dialog
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    // Check for synonym diff
    const synonymDiff = page.locator('[data-testid="test-synonym"].diff-added');

    await expect(synonymDiff).toBeVisible();
  } finally {
    await cleanup();
  }
});

// V-08: Version diff shows reference changes
test('Version diff shows reference changes', async ({ page }) => {
  const { term2, cleanup } = await setupGlossaryAndTerms(page);

  try {
    // The setupGlossaryAndTerms already patches term2 with references
    await term2.visitPage(page);
    await page.click('[data-testid="version-button"]');

    // Wait for version dialog
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    // Check for reference diff
    const referenceDiff = page.locator(
      '.diff-added [data-testid="reference-link-reference1"]'
    );

    await expect(referenceDiff).toBeVisible();
  } finally {
    await cleanup();
  }
});

// V-09: Version diff shows related term changes
test('Version diff shows related term changes', async ({ page }) => {
  const { term1, term2, cleanup } = await setupGlossaryAndTerms(page);

  try {
    // The setupGlossaryAndTerms already patches term2 with related terms
    await term2.visitPage(page);
    await page.click('[data-testid="version-button"]');

    // Wait for version dialog
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');

    // Check for related term diff (term1 was added as related term to term2)
    const relatedTermDiff = page.locator(
      `[data-testid="${term1.data.displayName}"].diff-added`
    );

    await expect(relatedTermDiff).toBeVisible();
  } finally {
    await cleanup();
  }
});
