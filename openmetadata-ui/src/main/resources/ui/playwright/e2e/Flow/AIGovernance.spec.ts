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
import { expect, test } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('AI Governance Studio', () => {
  test('renders AI-only sidebar, hero actions, seeded registry, and editable detail header', async ({
    page,
  }) => {
    await page.goto('/governance/ai-governance/overview');

    const secondaryNav = page.getByTestId('ai-gov-secondary-nav');
    await expect(secondaryNav).toBeVisible();
    await expect(secondaryNav.getByText('AI Assets')).toBeVisible();
    await expect(secondaryNav.getByText('Governance')).not.toBeVisible();
    await expect(secondaryNav.getByText('Workspace')).not.toBeVisible();
    await expect(secondaryNav.getByText('Glossary')).not.toBeVisible();
    await expect(secondaryNav.getByText('AI Asset Registry')).toBeVisible();
    await expect(secondaryNav.getByText('Shadow AI')).toBeVisible();
    await expect(secondaryNav.getByText('Audit Reports')).toBeVisible();

    const rowsAreAligned = await secondaryNav
      .locator('.ai-gov-secondary-nav-item')
      .evaluateAll((rows) =>
        rows.every((row) => {
          const icon = row.querySelector(
            '.ai-gov-secondary-nav-item-icon-slot'
          );
          const content = row.querySelector(
            '.ai-gov-secondary-nav-item-content'
          );

          if (!icon || !content) {
            return false;
          }

          return (
            icon.getBoundingClientRect().right <=
            content.getBoundingClientRect().left
          );
        })
      );

    expect(rowsAreAligned).toBeTruthy();
    await expect(page.getByText('Export audit pack')).toBeVisible();
    await expect(page.getByText('Configure risk council')).toBeVisible();

    await page.goto('/governance/ai-governance/registry');

    await expect(page.getByText('Claims Triage Copilot')).toBeVisible();
    await expect(page.getByText('GPT-4o Claims Production')).toBeVisible();
    await expect(page.getByText('Customer Profile Tools')).toBeVisible();

    await page.goto(
      '/governance/ai-governance/registry/aiApplication/claims-triage-copilot/overview'
    );

    await expect(page.getByText('Claims Triage Copilot')).toBeVisible();
    await expect(page.getByText('Owners')).toBeVisible();
    await expect(page.getByText('Domains')).toBeVisible();
    await expect(page.getByText('Tags')).toBeVisible();
    await expect(page.getByTestId('ai-gov-edit-display-name')).toBeVisible();
    await page.getByTestId('ai-gov-edit-description').click();
    await expect(page.getByTestId('ai-gov-description-input')).toBeVisible();
  });
});
