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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should check for glossary term search', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const glossaryName = 'Z_PW_GLOSSARY_SEARCH_TEST';
    const glossary = new Glossary(glossaryName);
    await glossary.create(apiContext);

    // Create 15 glossary terms
    const glossaryTerms = [];
    for (let i = 1; i <= 15; i++) {
      const termResponse = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          name: `SearchTestTerm${i}`,
          displayName: `Search Test Term ${i}`,
          description: `This is search test term number ${i}`,
          glossary: glossary.data.fullyQualifiedName,
        },
      });
      const termData = await termResponse.json();
      glossaryTerms.push(termData);
    }

    try {
      // Navigate to glossary
      await sidebarClick(page, SidebarItem.GLOSSARY);

      // Click on the created glossary
      await page.click(
        `[data-testid="glossary-left-panel"] >> text="${glossaryName}"`
      );

      // Wait for terms to load
      await page.waitForSelector('[data-testid="glossary-terms-table"]');

      // Test 1: Search for specific term
      const searchInput = page.locator('[data-testid="searchbar"] input');
      await searchInput.fill('SearchTestTerm5');

      // Wait for search API call with new endpoint
      const searchResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms/search') &&
          response.url().includes('q=SearchTestTerm5')
      );

      const searchData = await searchResponse.json();

      expect(searchData.data).toHaveLength(1);
      expect(searchData.data[0].name).toBe('SearchTestTerm5');

      // Verify UI shows only the searched term
      await expect(
        page.locator(
          '[data-testid="glossary-terms-table"] >> text="SearchTestTerm5"'
        )
      ).toBeVisible();
      await expect(
        page.locator(
          '[data-testid="glossary-terms-table"] >> text="SearchTestTerm4"'
        )
      ).not.toBeVisible();

      // Test 2: Partial search
      await searchInput.clear();
      await searchInput.fill('Test Term');

      const partialSearchResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms/search') &&
          response.url().includes('q=Test%20Term')
      );

      const partialSearchData = await partialSearchResponse.json();

      expect(partialSearchData.data.length).toBeGreaterThan(0);

      // Test 3: Clear search and verify all terms are shown
      await searchInput.clear();
      await page.waitForTimeout(500); // Wait for debounce

      // Verify terms are visible again
      await expect(
        page.locator('[data-testid="glossary-terms-table"]')
      ).toBeVisible();
    } finally {
      // Clean up
      for (const term of glossaryTerms) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/${term.id}?hardDelete=true`
        );
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should check for nested glossary term search', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const glossaryName = 'Z_PW_GLOSSARY_NESTED_SEARCH_TEST';
    const glossary = new Glossary(glossaryName);
    await glossary.create(apiContext);

    // Create parent term
    const parentTermResponse = await apiContext.post('/api/v1/glossaryTerms', {
      data: {
        name: 'ParentSearchTerm',
        displayName: 'Parent Search Term',
        description: 'This is the parent term',
        glossary: glossary.data.fullyQualifiedName,
      },
    });
    const parentTerm = await parentTermResponse.json();

    // Create child terms under parent
    const childTerms = [];
    for (let i = 1; i <= 5; i++) {
      const childResponse = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          name: `ChildSearchTerm${i}`,
          displayName: `Child Search Term ${i}`,
          description: `This is child term number ${i}`,
          glossary: glossary.data.fullyQualifiedName,
          parent: parentTerm.fullyQualifiedName,
        },
      });
      const childData = await childResponse.json();
      childTerms.push(childData);
    }

    // Create sibling terms at glossary level
    const siblingTerms = [];
    for (let i = 1; i <= 3; i++) {
      const siblingResponse = await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          name: `SiblingTerm${i}`,
          displayName: `Sibling Term ${i}`,
          description: `This is sibling term number ${i}`,
          glossary: glossary.data.fullyQualifiedName,
        },
      });
      const siblingData = await siblingResponse.json();
      siblingTerms.push(siblingData);
    }

    try {
      // Navigate to glossary
      await sidebarClick(page, SidebarItem.GLOSSARY);

      // Click on the created glossary
      await page.click(
        `[data-testid="glossary-left-panel"] >> text="${glossaryName}"`
      );

      // Wait for terms to load
      await page.waitForSelector('[data-testid="glossary-terms-table"]');

      // Navigate to parent term
      await page.click(
        `[data-testid="glossary-terms-table"] >> text="${parentTerm.displayName}"`
      );
      await page.waitForTimeout(1000);

      // Click on Terms tab to see child terms
      await page.click('[data-testid="terms"]');
      await page.waitForTimeout(500);

      // Test 1: Search within parent term for child terms
      const searchInput = page.locator('[data-testid="searchbar"] input');
      await searchInput.fill('Child');

      // Wait for search API call with parent filter
      const searchResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms/search') &&
          response.url().includes('q=Child') &&
          (response
            .url()
            .includes(
              `parentFqn=${encodeURIComponent(parentTerm.fullyQualifiedName)}`
            ) ||
            response.url().includes(`parent=${parentTerm.id}`))
      );

      const searchData = await searchResponse.json();

      expect(searchData.data).toHaveLength(5);
      expect(
        searchData.data.every((t) => t.name.startsWith('ChildSearchTerm'))
      ).toBeTruthy();

      // Verify UI shows only child terms, not sibling terms
      await expect(
        page.locator(
          '[data-testid="glossary-terms-table"] >> text="ChildSearchTerm1"'
        )
      ).toBeVisible();
      await expect(
        page.locator(
          '[data-testid="glossary-terms-table"] >> text="SiblingTerm1"'
        )
      ).not.toBeVisible();

      // Test 2: Search for specific child term
      await searchInput.clear();
      await searchInput.fill('ChildSearchTerm3');

      const specificSearchResponse = await page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms/search') &&
          response.url().includes('q=ChildSearchTerm3')
      );

      const specificSearchData = await specificSearchResponse.json();

      expect(specificSearchData.data).toHaveLength(1);
      expect(specificSearchData.data[0].name).toBe('ChildSearchTerm3');

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
    } finally {
      // Clean up - delete all terms and glossary
      for (const term of childTerms) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/${term.id}?hardDelete=true`
        );
      }
      await apiContext.delete(
        `/api/v1/glossaryTerms/${parentTerm.id}?hardDelete=true`
      );
      for (const term of siblingTerms) {
        await apiContext.delete(
          `/api/v1/glossaryTerms/${term.id}?hardDelete=true`
        );
      }
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should check for glossary term pagination', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const glossaries = [];
    for (let i = 0; i < 60; i++) {
      const glossary = new Glossary(`Z_PW_GLOSSARY_TEST_${i + 1}`);
      await glossary.create(apiContext);
      glossaries.push(glossary);
    }

    try {
      const glossaryRes = page.waitForResponse(
        '/api/v1/glossaryTerms?*directChildrenOf=*'
      );

      const glossaryAfterRes = page.waitForResponse(
        '/api/v1/glossaries?*after=*'
      );
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await glossaryRes;

      await page
        .getByTestId('glossary-left-panel-scroller')
        .scrollIntoViewIfNeeded();

      const res = await glossaryAfterRes;
      const json = await res.json();

      const firstGlossaryName = json.data[0].displayName;

      await expect(
        page
          .getByTestId('glossary-left-panel')
          .getByRole('menuitem', { name: firstGlossaryName })
      ).toBeVisible();
    } finally {
      for (const glossary of glossaries) {
        await glossary.delete(apiContext);
      }
      await afterAction();
    }
  });
});
