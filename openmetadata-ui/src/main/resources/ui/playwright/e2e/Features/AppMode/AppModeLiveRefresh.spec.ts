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

import { APIRequestContext, Page } from '@playwright/test';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { getApiContext } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForSearchIndexed } from '../../../utils/polling';
import { enableAiAppMode } from '../../Utils/appMode';
import { expect, test } from './fixtures';

// The OSS Marketplace module (marketplace.module.tsx) wires the Domains and
// Data Products list pages as keep-alive AI-mode routes so they live-refresh on
// a websocket data-invalidation signal. (Glossary/Tags are NOT covered: their
// list pages auto-navigate to a detail route on load, so the kept-alive list
// route is never the active route and the live-refresh can't reach the screen.)
// Per surface we assert: (1) the list page mounts inside the AI shell, (2) its
// detail route still resolves via the OSS catch-all, and (3) an entity created
// over REST ("another session") reloads the open list with no manual reload.
//
// The list shows only the first page (~9 rows) sorted alphabetically by name,
// and the shared test DB accumulates many domains/data products, so an
// unfiltered list would rarely surface a brand-new row regardless of
// live-refresh. We open each list pre-scoped to the new entity's unique token
// via `?q=<token>` (URL-backed search that survives the kept-alive remount) so
// the passively-refreshed page has the row as its single, first-page result.
// The trailing uuid segment of the support-class display name ("PW Domain
// <id>", "PW Data Product <id>") is unique per run, so a search scoped to it
// returns only this entity.
const uniqueToken = (displayName: string, fallback: string) =>
  displayName.split(' ').pop() || fallback;

// Open a list route in AI mode and confirm the page mounted inside the AI
// shell. getApiContext() reads the auth token from the loaded page, so it MUST
// be called after this navigation — never before.
const openListInAiMode = async (
  page: Page,
  route: string,
  urlMatcher: RegExp
) => {
  await enableAiAppMode(page);
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
  await expect(page).toHaveURL(urlMatcher);
  await expect(page.getByTestId('ask-sidebar')).toBeVisible();
  await expect(page.getByTestId('ai-not-found-page')).toBeHidden();
};

const safeDelete = async (
  entity: { delete: (ctx: APIRequestContext) => Promise<unknown> },
  apiContext: APIRequestContext
) => {
  await entity.delete(apiContext).catch(() => undefined);
};

const liveRefreshUntilVisible = async (
  page: Page,
  apiContext: APIRequestContext,
  entity: {
    collection: string;
    id?: string;
    token: string;
    displayName: string;
  },
  index: string
) => {
  expect(entity.id, 'entity id populated after create').toBeTruthy();
  await waitForSearchIndexed(apiContext, entity.token, index);

  // The `?q=<token>` scope means exactly one card renders, so filtering the
  // card-view by the display name resolves to a single element (no `.first()`).
  const card = page
    .getByTestId('card-view-container')
    .getByTestId('entity-card')
    .filter({ hasText: entity.displayName });

  let attempt = 0;
  await expect(async () => {
    attempt += 1;
    await apiContext.patch(`/api/v1/${entity.collection}/${entity.id}`, {
      data: [
        {
          op: 'add',
          path: '/description',
          value: `pw live-refresh ${attempt}`,
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    await expect(card).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000, intervals: [2_000, 3_000, 5_000] });
};

test.describe(
  'AppMode — Marketplace live refresh',
  { tag: ['@Governance'] },
  () => {
    test('Domains render in AI mode, live-refresh, and open detail', async ({
      page,
    }) => {
      test.slow();
      const domain = new Domain();
      const token = uniqueToken(domain.data.displayName, domain.data.name);
      await openListInAiMode(
        page,
        `/domain?q=${encodeURIComponent(token)}`,
        /\/domain(\/|$|\?)/
      );

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await test.step('a domain created elsewhere reloads the open list', async () => {
          await domain.create(apiContext);
          await liveRefreshUntilVisible(
            page,
            apiContext,
            {
              collection: 'domains',
              id: domain.responseData.id,
              token,
              displayName: domain.responseData.displayName,
            },
            'domain'
          );
        });

        await test.step('the detail route resolves via the OSS router (catch-all) in AI mode', async () => {
          const fqn =
            domain.responseData.fullyQualifiedName ?? domain.responseData.name;
          await page.goto(`/domain/${encodeURIComponent(fqn)}`, {
            waitUntil: 'domcontentloaded',
          });
          await waitForAllLoadersToDisappear(page);
          await expect(page.getByTestId('ask-sidebar')).toBeVisible();
          await expect(page.getByTestId('ai-not-found-page')).toBeHidden();
        });
      } finally {
        await safeDelete(domain, apiContext);
        await afterAction();
      }
    });

    test('Data Products render in AI mode and live-refresh', async ({
      page,
    }) => {
      test.slow();
      const domain = new Domain();
      const dataProduct = new DataProduct([domain]);
      const token = uniqueToken(
        dataProduct.data.displayName,
        dataProduct.data.name
      );
      await openListInAiMode(
        page,
        `/dataProduct?q=${encodeURIComponent(token)}`,
        /\/dataProduct(\/|$|\?)/
      );

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        // A data product requires an existing domain — DataProduct.create()
        // only references it, so create the domain first.
        await domain.create(apiContext);

        await test.step('a data product created elsewhere reloads the open list', async () => {
          await dataProduct.create(apiContext);
          await liveRefreshUntilVisible(
            page,
            apiContext,
            {
              collection: 'dataProducts',
              id: dataProduct.responseData.id,
              token,
              displayName: dataProduct.responseData.displayName,
            },
            'dataProduct'
          );
        });
      } finally {
        await safeDelete(dataProduct, apiContext);
        await safeDelete(domain, apiContext);
        await afterAction();
      }
    });
  }
);
