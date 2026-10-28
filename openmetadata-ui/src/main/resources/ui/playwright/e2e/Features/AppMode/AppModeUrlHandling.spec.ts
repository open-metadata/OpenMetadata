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
import { Page } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { createNewPage } from '../../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';
import { expect, test } from './fixtures';

test.describe('AppMode — URL handling', { tag: ['@Platform'] }, () => {
  test('redirects /service/<cat>/<fqn> to /connections/<cat>/<fqn> in AI mode', async ({
    page,
  }) => {
    await enableAiAppMode(page);

    await test.step('Visit /service/<cat>/<fqn>', async () => {
      await page.goto('/service/databaseServices/sampleService.foo', {
        waitUntil: 'domcontentloaded',
      });
    });

    await test.step('URL is rewritten to the /connections namespace', async () => {
      await expect(page).toHaveURL(
        /\/connections\/databaseServices\/sampleService\.foo/
      );
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });

  test('renders the AI not-found page at /404 in AI mode (does NOT delegate to the catch-all)', async ({
    page,
  }) => {
    await enableAiAppMode(page);

    await test.step('Navigate to /404 inside AI mode', async () => {
      await page.goto('/404', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('AI not-found page is rendered (not an infinite redirect loop)', async () => {
      await expect(page).toHaveURL(/\/404$/);
      await expect(page.getByTestId('ai-not-found-page')).toBeVisible();
      // Full page like the classic 404: no AI shell sidebar.
      await expect(page.getByTestId('ask-sidebar')).not.toBeAttached();
    });
  });

  test('delegates classic-only URLs to the default tree wrapped in the AI shell', async ({
    page,
  }) => {
    await enableAiAppMode(page);

    await test.step('Visit /explore — a route no app-mode module defines', async () => {
      await page.goto('/explore', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Page renders inside the AI shell (sidebar visible) at the delegated URL', async () => {
      await expect(page).toHaveURL(/\/explore/);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });

  test('serves the AI My Data page at the /my-data path in AI mode', async ({
    page,
  }) => {
    await enableAiAppMode(page);

    await test.step('Visit /my-data while in AI mode', async () => {
      await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('The AI My Data page renders in the AI shell at /my-data', async () => {
      await expect(page).toHaveURL(/\/my-data$/);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });

  // In AI mode a settings link opens the settings modal over the current page
  // (ADR:2026-10-21-settings-pages-are-classic-only). It must keep the page's
  // query string: react-router resolves a bare `#hash` target with an empty one.
  test('a team owner link opens the team in the settings modal and keeps the query string', async ({
    page,
    browser,
  }) => {
    const table = new TableClass();
    const team = new TeamClass();
    const { apiContext, afterAction } = await createNewPage(browser);

    try {
      await test.step('Create a table owned by a team', async () => {
        await team.create(apiContext);
        await table.create(apiContext);
        await table.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: team.responseData.id, type: 'team' }],
            },
          ],
        });
      });

      const teamName = team.responseData.name;
      let pageUrl = new URL('http://placeholder');

      await test.step('Open the table page with a query string in AI mode', async () => {
        await enableAiAppMode(page);
        await page.goto(
          `/table/${getEncodedFqn(
            table.entityResponseData.fullyQualifiedName ?? ''
          )}?pwKeep=1`,
          { waitUntil: 'domcontentloaded' }
        );
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();

        pageUrl = new URL(page.url());

        expect(pageUrl.searchParams.get('pwKeep')).toBe('1');
      });

      await test.step('Click the team in the owner popover', async () => {
        // The owner chip's testid is the owner's display name, not its name.
        await page
          .getByTestId('owner-link')
          .getByTestId(team.responseData.displayName)
          .hover();
        const popover = page.getByTestId('user-popover-card');
        await expect(popover).toBeVisible();
        await popover.getByTestId('team-name').click();
      });

      await test.step('The modal opens on the team over the same page and query', async () => {
        await expect
          .poll(() => {
            const url = new URL(page.url());

            return `${url.pathname}${url.search}${url.hash}`;
          })
          .toBe(
            `${pageUrl.pathname}${
              pageUrl.search
            }#members/teams/${encodeURIComponent(teamName)}`
          );
        await expect(page.getByTestId('ai-profile-page')).toBeVisible();
        await expect(page.getByTestId('team-detail')).toBeVisible();
      });
    } finally {
      await table.delete(apiContext);
      await team.delete(apiContext);
      await afterAction();
    }
  });

  // /my-data is the personal-space My Data page in AI mode; the home landing
  // page only renders at /, so the sidebar Home item has to point there.
  test('opens the home landing page from the sidebar Home item in AI mode', async ({
    page,
  }) => {
    await enableAiAppMode(page);
    const homeNavItem = page.getByTestId('ask-nav-item-home');

    await test.step('Start on a page Home does not own', async () => {
      await page.goto('/explore', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);
      await expect(homeNavItem).not.toHaveClass(/ask-nav-item--active/);
    });

    await test.step('Home opens the landing page at / and is highlighted', async () => {
      await homeNavItem.click();

      await expect(page).toHaveURL((url) => url.pathname === '/');
      await expect(page.getByTestId('home-landing-page')).toBeVisible();
      await expect(homeNavItem).toHaveClass(/ask-nav-item--active/);
    });

    await test.step('Home is not highlighted on the personal-space /my-data page', async () => {
      await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/my-data$/);
      await expect(homeNavItem).not.toHaveClass(/ask-nav-item--active/);
    });
  });

  /**
   * Install-gated plugin modules register their routes only once
   * `/api/v1/apps/installed` resolves. Before that the route table is
   * incomplete, and the catch-all used to navigate to /404 — destroying the
   * requested URL before the full table mounted. Any deep link or reload in AI
   * mode could land on Not Found.
   */
  test.describe('cold boot with route registration still in flight', () => {
    // Holding the response keeps that window open on every run. Without it the
    // defect only surfaced on some boots, so the test would pass by luck.
    const holdApplicationsFetch = async (page: Page, delayMs = 2500) => {
      await page.route('**/api/v1/apps/installed*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await route.continue();
      });
    };

    const AI_ROUTES = [
      '/observability/data-quality',
      '/observability/incident-manager',
    ];

    for (const route of AI_ROUTES) {
      test(`keeps ${route} instead of redirecting to /404`, async ({
        page,
      }) => {
        await enableAiAppMode(page);
        await holdApplicationsFetch(page);

        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await expect(page).toHaveURL(new RegExp(`${route}$`));
      });
    }

    test('preserves the query string across a reload', async ({ page }) => {
      // The reported repro: apply a filter, then hit reload.
      const filtered =
        '/observability/incident-manager?testCaseResolutionStatusType=New';

      await enableAiAppMode(page);
      await holdApplicationsFetch(page);

      await page.goto(filtered, { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/testCaseResolutionStatusType=New/);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/testCaseResolutionStatusType=New/);
      await expect(page.getByTestId('incident-groups')).toBeVisible();
    });
  });
});
