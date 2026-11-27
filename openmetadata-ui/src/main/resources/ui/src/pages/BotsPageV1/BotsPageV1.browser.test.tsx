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
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { LimitBanner } from '../../components/common/LimitBanner/LimitBanner';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { Bot } from '../../generated/entity/bot';
import { LimitConfig } from '../../interface/platform/limits.interface';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { describePaginatedList } from '../../test/browser/paginationContract';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const bots: Bot[] = many(40, (i) => ({
  ...named('bot', i),
  botUser: { id: named('bot-user', i).id, type: 'user' },
}));

describePaginatedList({
  name: 'Settings › Bots',
  route: '/settings/bots',
  listPath: '/api/v1/bots',
  items: bots,
  itemLabel: (b) => b.displayName ?? b.name,
  // BotListV1 also loads up to BOT_SEARCH_PAGE_SIZE bots once for its search map.
  isPageRequest: (url) => url.searchParams.get('limit') !== '100',
});

const LIMITS_ON: LimitConfig = {
  enable: true,
  limits: {
    config: {
      version: 'test',
      plan: 'FREE',
      installationType: 'test',
      deployment: 'test',
      companyName: 'test',
      domain: 'test',
      instances: 1,
      featureLimits: [],
    },
  },
};

const botLimit = (currentCount: number) => ({
  featureLimitStatuses: [
    {
      name: 'bot',
      limitReached: false,
      currentCount,
      configuredLimit: {
        name: 'bot',
        maxVersions: 0,
        disableFields: [],
        limits: { softLimit: 8, hardLimit: 10 },
      },
    },
  ],
});

// GitHub issue 32676: the banner kept the pre-delete count until the page unmounted.
describe('Settings › Bots › plan limit banner', () => {
  afterEach(() => {
    useLimitStore.setState(useLimitStore.getInitialState(), true);
  });

  test(
    'clears the banner once deleting a bot brings usage back under the limit',
    async () => {
      let stored = bots.slice(0, 8);
      const limitCalls: string[] = [];
      worker.use(
        http.get('/api/v1/bots', () =>
          HttpResponse.json({
            data: stored,
            paging: { total: stored.length },
          })
        ),
        http.delete('/api/v1/bots/:id', ({ params }) => {
          stored = stored.filter((b) => b.id !== params.id);

          return HttpResponse.json({ version: 0.2 });
        }),
        http.get('/api/v1/limits/features/bot', () => {
          limitCalls.push('bot');

          return HttpResponse.json(botLimit(stored.length));
        })
      );
      // AppContainer loads the limits config and mounts the banner; neither is
      // part of the router renderApp mounts, so do both here.
      useLimitStore.setState({ config: LIMITS_ON });
      await renderApp('/settings/bots', undefined, {
        wrap: (app) => (
          <>
            <LimitBanner />
            {app}
          </>
        ),
      });

      const banner = page.getByText(/8\/10 \(FREE, 80%\)/);

      await expect.element(banner, { timeout: scaled(60_000) }).toBeVisible();

      await userEvent.click(page.getByTestId(`bot-delete-${stored[0].name}`));
      await userEvent.click(page.getByTestId('confirm-button'));

      await expect.poll(() => limitCalls.length).toBe(2);
      await expect.element(page.getByText('PW bot 01')).not.toBeInTheDocument();
      await expect
        .poll(() =>
          document
            .querySelector('header.pricing-banner')
            ?.hasAttribute('hidden')
        )
        .toBe(true);
      await expect.element(banner).not.toBeInTheDocument();
    },
    scaled(90_000)
  );
});
