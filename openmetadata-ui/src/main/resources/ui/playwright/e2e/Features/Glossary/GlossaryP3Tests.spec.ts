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
import { SidebarItem } from '../../../constant/sidebar';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { okJson } from '../../../utils/apiResponse';
import {
  fillDescriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { selectActiveGlossary } from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// ============================================================================
// P3 TESTS - Nice to Have (Edge Cases, Stress Tests, UI States)
// ============================================================================

test.describe('Glossary P3 Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // G-C11: Create glossary with unicode/emoji in name
  test('should create glossary with unicode characters in name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const unicodeName = `Glossary_日本語_${Date.now()}`;

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.getByTestId('form-heading').waitFor();

      // Use name with unicode characters
      await page.fill('[data-testid="name"]', unicodeName);
      await fillDescriptionBox(page, 'Glossary with unicode characters');

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().endsWith('/api/v1/glossaries') &&
            res.request().method() === 'POST'
        ),
        // A stale navigation toast can overlap this centered button. Keyboard
        // activation exercises the same form submission without a pointer race.
        page.getByTestId('save-glossary').press('Enter'),
      ]);
      glossary.responseData = await response.json();
      expect(response.ok()).toBe(true);

      // Verify glossary was created
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      if (glossary.responseData) {
        await glossary.delete(apiContext);
      }
      await afterAction();
    }
  });

  for (const [field, value] of [
    ['color', '#FF5733'],
    ['iconURL', 'https://example.com/icon.png'],
  ] as const) {
    test(`removes an existing term style ${field} and persists the change`, async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const term = new GlossaryTerm(glossary);
      try {
        await glossary.create(apiContext);
        await term.create(apiContext);
        await term.patch(apiContext, [
          { op: 'add', path: '/style', value: { [field]: value } },
        ]);
        const path = `/api/v1/glossaryTerms/${term.responseData.id}`;
        const styled = await okJson<{ style: Record<string, string> }>(
          await apiContext.get(path),
          'Read styled term'
        );
        expect(styled.style[field]).toBe(value);
        await term.patch(apiContext, [
          { op: 'remove', path: `/style/${field}` },
        ]);
        const saved = await okJson<{ style?: Record<string, string> }>(
          await apiContext.get(path),
          'Read term after style removal'
        );
        expect(saved.style?.[field]).toBeUndefined();
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  }

  // S-S06: Search with special characters
  test('should handle special characters in search', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Find the glossary terms search input (not the global search)
      // It has placeholder "Search Terms" and is within the glossary content area
      const searchInput = page.getByPlaceholder(/search.*term/i);

      // Wait for search input to be visible
      await searchInput.waitFor({ state: 'visible', timeout: 10000 });

      const search = waitForResponseWithStatus(
        page,
        (response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === 'GET' &&
            url.pathname === '/api/v1/glossaryTerms/search' &&
            url.searchParams.get('glossaryFqn') ===
              glossary.responseData.fullyQualifiedName &&
            url.searchParams.get('q') === '@'
          );
        },
        200
      );
      await searchInput.fill('@');
      const result = await okJson<{ data: unknown[] }>(
        await search,
        'Search glossary terms with a special character'
      );
      expect(result.data).toHaveLength(0);
      await expect(page.getByTestId(glossaryTerm.data.displayName)).toHaveCount(
        0
      );
      await expect(
        page
          .getByTestId('glossary-terms-table')
          .getByText('No matching results', { exact: true })
      ).toBeVisible();

      await searchInput.clear();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // VT-08: Vote count displays correctly
  test('should display vote count correctly', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await glossary.visitEntityPage(page);

      const count = page.getByTestId('up-vote-count');
      await expect(count).toHaveText('0');
      const vote = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname ===
            `/api/v1/glossaries/${glossary.responseData.id}/vote`,
        200
      );
      await page.getByTestId('up-vote-btn').click();
      await vote;
      await expect(count).toHaveText('1');
      const stored = await okJson<{ votes: { upVotes: number } }>(
        await apiContext.get(`/api/v1/glossaries/${glossary.responseData.id}`, {
          params: { fields: 'votes' },
        }),
        'Read saved glossary vote'
      );
      expect(stored.votes.upVotes).toBe(1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(count).toHaveText('1');
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // NAV-06: Back/forward browser navigation
  test('should handle back/forward browser navigation', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term
      await page.click(`[data-testid="${glossaryTerm.data.displayName}"]`);
      await waitForAllLoadersToDisappear(page);

      // Verify we're on term page
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(glossaryTerm.data.displayName);

      // Go back
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      // Should be back on glossary page
      await expect(page.getByTestId('entity-header-name')).toBeVisible();

      // Go forward
      await page.goForward({ waitUntil: 'domcontentloaded' });

      // Should be on term page again
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // UI-02: Loading skeleton displays
  test('should show loading state during navigation', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await expect(page.getByTestId('glossary-terms-table')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('expands and restores the glossary term overview', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await glossaryTerm.visitEntityPage(page);

      const overview = page.getByRole('tabpanel', { name: 'Overview' });
      const content = overview.getByTestId(/^KnowledgePanel.LeftPanel/);
      await expect(content).toBeVisible();
      const width = await content.evaluate(
        (element) => element.getBoundingClientRect().width
      );
      const toggle = page.getByTestId('tab-expand-button');
      await toggle.click();
      await expect
        .poll(() =>
          content.evaluate((element) => element.getBoundingClientRect().width)
        )
        .toBeGreaterThan(width);
      await toggle.click();
      await expect
        .poll(() =>
          content.evaluate((element) => element.getBoundingClientRect().width)
        )
        .toBeCloseTo(width, 0);
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        glossaryTerm.data.displayName
      );
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-05: Special characters in all fields
  test('should handle special characters in term fields', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      // Create term with special characters in description and synonyms
      const response = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          glossary: glossary.data.name,
          name: `SpecialTerm_${Date.now()}`,
          displayName: `Special-Term_${Date.now()}`,
          description:
            'Description with special chars: &amp; "quotes" & apostrophe',
          synonyms: ['synonym-1', 'synonym_2', 'synonym-3'],
        },
      });

      const saved = await okJson<{
        id: string;
        fullyQualifiedName: string;
        description: string;
      }>(response, 'Create term with supported characters');
      expect(response.status()).toBe(201);
      const stored = await okJson<{ description: string }>(
        await apiContext.get(`/api/v1/glossaryTerms/${saved.id}`),
        'Read term with supported characters'
      );
      expect(stored.description).toBe(saved.description);
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-06: Unicode/emoji handling
  test('should handle unicode and emoji in description', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      // Create term with unicode in description
      const response = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          glossary: glossary.data.name,
          name: `UnicodeTerm_${Date.now()}`,
          displayName: `UnicodeTerm_${Date.now()}`,
          description: 'Unicode: café, naïve, 日本語, 🐘',
        },
      });

      const saved = await okJson<{
        id: string;
        fullyQualifiedName: string;
        description: string;
      }>(response, 'Create term with supported characters');
      expect(response.status()).toBe(201);
      const stored = await okJson<{ description: string }>(
        await apiContext.get(`/api/v1/glossaryTerms/${saved.id}`),
        'Read term with supported characters'
      );
      expect(stored.description).toBe(saved.description);

      await page.goto(
        `/glossary/${encodeURIComponent(saved.fullyQualifiedName)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(
        page.getByText('Unicode: café, naïve, 日本語, 🐘', { exact: true })
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-07: Concurrent edit conflict
  test('should handle concurrent edits gracefully', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      // Make two rapid updates to simulate concurrent edits
      const update1 = apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/description',
              value: 'Concurrent update 1',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      const update2 = apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/description',
              value: 'Concurrent update 2',
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Wait for both to complete
      const [response1, response2] = await Promise.all([update1, update2]);

      // At least one should succeed, other may fail with conflict
      const bothHandled =
        (response1.ok() || response1.status() === 409) &&
        (response2.ok() || response2.status() === 409);

      expect(bothHandled).toBe(true);
      expect([response1, response2].some((response) => response.ok())).toBe(
        true
      );
      const stored = await okJson<{ description: string }>(
        await apiContext.get(
          `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`
        ),
        'Read concurrent edit result'
      );
      const committed = await Promise.all(
        [response1, response2]
          .filter((response) => response.ok())
          .map((response) =>
            okJson<{ description: string }>(response, 'Read committed edit')
          )
      );
      expect(committed.map((result) => result.description)).toContain(
        stored.description
      );
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-08: Network timeout handling
  test('should handle slow network gracefully', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      const glossariesPromise = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          response.url().includes('/api/v1/glossaries'),
        200
      );

      await sidebarClick(page, SidebarItem.GLOSSARY);

      const response = await glossariesPromise;
      expect(response.status()).toBe(200);

      // Verify page is functional
      await expect(
        page
          .locator(
            '[data-testid="add-glossary"], [data-testid="glossary-left-panel"]'
          )
          .first()
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-09: Session expiry during operation
  test('should maintain session during normal operations', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await glossary.visitEntityPage(page);

      // Perform multiple operations

      // Navigate around
      await sidebarClick(page, SidebarItem.GLOSSARY);

      // Go back to glossary
      await selectActiveGlossary(page, glossary.data.displayName);

      // Session should still be valid
      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-10: Maximum nesting depth (10+ levels)
  test('should handle deep nesting', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      let parentFqn: string | undefined;
      const terms: GlossaryTerm[] = [];
      for (let depth = 1; depth <= 10; depth++) {
        const term = new GlossaryTerm(
          glossary,
          parentFqn,
          `Level${depth}_${Date.now()}`
        );
        await term.create(apiContext);
        parentFqn = term.responseData.fullyQualifiedName;
        terms.push(term);
      }
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      for (const [index, term] of terms.entries()) {
        const row = page
          .getByRole('row')
          .filter({ has: page.getByTestId(term.data.displayName) });
        await expect(row).toBeVisible();
        if (index < terms.length - 1) {
          await row.getByTestId('expand-icon').click();
        }
      }
      await expect(page.getByTestId(terms[9].data.displayName)).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // PF-07: Rapid operations (stress test)
  test('should handle rapid UI interactions', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Wait for page to load

      // Rapid clicks on various elements
      const searchInput = page.getByPlaceholder(/search.*term/i);

      // Rapid search operations
      for (let i = 0; i < 5; i++) {
        await searchInput.fill(`test${i}`);
      }

      // Clear search
      await searchInput.clear();

      // Page should still be functional
      await expect(
        page.getByTestId(glossaryTerm.data.displayName)
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // Additional test: API rate limiting handling
  test('should handle multiple rapid API calls', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      // Make multiple rapid API calls
      const calls = [];

      for (let i = 0; i < 5; i++) {
        calls.push(
          apiContext.get(`/api/v1/glossaries/${glossary.responseData.id}`)
        );
      }

      const responses = await Promise.all(calls);

      expect(responses).toHaveLength(5);
      const entities = await Promise.all(
        responses.map((response) =>
          okJson<{ id: string; fullyQualifiedName: string }>(
            response,
            'Concurrent glossary read'
          )
        )
      );
      for (const entity of entities) {
        expect(entity.id).toBe(glossary.responseData.id);
        expect(entity.fullyQualifiedName).toBe(
          glossary.responseData.fullyQualifiedName
        );
      }
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // UI-03: Error state on API failure - non-existent glossary
  test('should show error state when navigating to non-existent glossary', async ({
    page,
  }) => {
    const { afterAction } = await getApiContext(page);

    try {
      const name = `NonExistentGlossary_${Date.now()}`;
      await page.goto(`/glossary/${name}`, { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText(`Glossary instance for ${name} not found`, {
          exact: true,
        })
      ).toBeVisible();
    } finally {
      await afterAction();
    }
  });

  // UI-03: Error state on API failure - non-existent term
  test('should show error state when navigating to non-existent term', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      // First create a glossary so we can test with a valid glossary but invalid term
      await glossary.create(apiContext);

      const fqn = `${
        glossary.responseData.fullyQualifiedName
      }.NonExistentTerm_${Date.now()}`;
      const missingTerm = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          decodeURIComponent(new URL(response.url()).pathname) ===
            `/api/v1/glossaryTerms/name/${fqn}`,
        404
      );
      await page.goto(`/glossary/${encodeURIComponent(fqn)}`, {
        waitUntil: 'domcontentloaded',
      });
      await missingTerm;
      await expect(
        page.getByText(`Glossary term instance for ${fqn} not found`, {
          exact: true,
        })
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // Test for URL validation when creating a glossary term
  test('should validate reference URL requires http/https prefix when creating term', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.getByTestId('add-new-tag-button-header').click();
      await page.getByTestId('name').waitFor();

      await page.fill('[data-testid="name"]', 'TestTerm');
      await fillDescriptionBox(page, 'Test description');

      const addReferenceBtn = page.getByTestId('add-reference');
      await addReferenceBtn.click();

      await page.locator('#name-0').fill('BBC');
      await page.locator('#url-0').fill('www.bbc.co.uk');

      await page.getByTestId('save-glossary-term').click();

      await expect(
        page.getByText('URL must start with http:// or https://')
      ).toBeVisible();

      await page.locator('#url-0').clear();
      await page.locator('#url-0').fill('https://www.bbc.co.uk');

      const saveResponse = page.waitForResponse('/api/v1/glossaryTerms');
      await page.getByTestId('save-glossary-term').click();
      await saveResponse;

      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // Test for URL validation when editing a glossary term reference
  test('should validate reference URL requires http/https prefix when editing term', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page
        .getByRole('link', { name: glossaryTerm.data.displayName })
        .click();

      await page.getByTestId('term-references-add-button').click();

      await expect(
        page
          .getByTestId('glossary-term-references-modal')
          .getByText('References')
      ).toBeVisible();

      await page.locator('#references_0_name').fill('Wikipedia');
      await page.locator('#references_0_endpoint').fill('en.wikipedia.org');

      await page.getByTestId('save-btn').click();

      await expect(
        page.getByText('URL must start with http:// or https://')
      ).toBeVisible();

      await page.locator('#references_0_endpoint').clear();
      await page
        .locator('#references_0_endpoint')
        .fill('https://en.wikipedia.org');

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-btn').click();
      await saveRes;

      await expect(page.getByTestId('reference-link-Wikipedia')).toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
