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
import { APIRequestContext, Page, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import {
  createLandingPageAccount,
  deleteLandingPageAccount,
  expect,
  LandingPageAccount,
  openLandingPageAccountPage,
  test,
} from '../../../support/fixtures/landingPageUser';
import { performAdminLogin } from '../../../utils/admin';
import { okJson, settleAll } from '../../../utils/apiResponse';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { getEncodedFqn } from '../../../utils/entity';

const PLATFORM_HEALTH_KEY = 'KnowledgePanel.PlatformHealth';
const TOPIC_KEY = 'platformHealth';
const OVERVIEW_PATH = '/api/v1/services/overview';
const SERVICES_SETTINGS_PATH = '/settings/services';
/** The card lists this many failing services before offering "View all". */
const MAX_VISIBLE_ROWS = 3;
const FAILING_SERVICE_COUNT = MAX_VISIBLE_ROWS + 1;

type HealthBucket = 'failed' | 'partialSuccess' | 'success' | 'notRun';

interface ServicesOverviewBody {
  total: number;
  healthCounts?: Record<string, Partial<Record<HealthBucket, number>>>;
}

interface SeededService {
  service: DatabaseServiceClass;
  pipelineFqn?: string;
}

/**
 * Names sort ahead of nearly everything else on the server.
 *
 * The card reads the first page of failing services the overview endpoint
 * returns, and that page is ordered by name. A leading digit keeps the seeded
 * services on it however many failing services other specs leave behind, so
 * the card's three rows are chosen among them by recency alone.
 */
const seededServiceName = (bucket: string) =>
  `0-pw-platform-health-${bucket}-${uuid()}`;

const createServiceWithRun = async (
  apiContext: APIRequestContext,
  bucket: string,
  run?: { state: 'failed' | 'success'; timestamp: number; error?: string }
): Promise<SeededService> => {
  const service = new DatabaseServiceClass(seededServiceName(bucket));
  await service.create(apiContext);

  if (!run) {
    return { service };
  }

  const pipeline = await okJson<{ fullyQualifiedName: string }>(
    await apiContext.post('/api/v1/services/ingestionPipelines', {
      data: {
        airflowConfig: { scheduleInterval: '0 0 * * *' },
        loggerLevel: 'INFO',
        name: `pw-platform-health-${uuid()}`,
        pipelineType: 'metadata',
        service: {
          id: service.entityResponseData.id,
          type: 'databaseService',
        },
        sourceConfig: { config: { type: 'DatabaseMetadata' } },
      },
    }),
    'Platform health ingestion pipeline'
  );

  await recordRun(apiContext, pipeline.fullyQualifiedName, run);

  return { pipelineFqn: pipeline.fullyQualifiedName, service };
};

const recordRun = async (
  apiContext: APIRequestContext,
  pipelineFqn: string,
  run: { state: 'failed' | 'success'; timestamp: number; error?: string }
) => {
  const response = await apiContext.put(
    `/api/v1/services/ingestionPipelines/${getEncodedFqn(
      pipelineFqn
    )}/pipelineStatus`,
    {
      data: {
        endDate: run.timestamp,
        pipelineState: run.state,
        runId: uuid(),
        startDate: run.timestamp - 60_000,
        timestamp: run.timestamp,
        ...(run.error && {
          status: [
            {
              errors: 1,
              failures: [{ error: run.error, name: 'Source' }],
              filtered: 0,
              name: 'Source',
              records: 0,
              warnings: 0,
            },
          ],
        }),
      },
    }
  );

  expect(response.ok(), await response.text()).toBe(true);
};

const isHealthOverviewResponse = (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname === OVERVIEW_PATH &&
    url.searchParams.get('includeHealth') === 'true' &&
    url.searchParams.getAll('health').includes('failed')
  );
};

/**
 * Keeps the newest failed-services overview the page received.
 *
 * The card refetches when a websocket marks ingestion dirty, which other specs
 * trigger at will, so its chips are compared with the answer it is currently
 * showing rather than with whichever one arrived first.
 */
const trackLatestOverview = (page: Page) => {
  let latest: ServicesOverviewBody | undefined;

  page.on('response', async (response) => {
    if (!isHealthOverviewResponse(response) || !response.ok()) {
      return;
    }
    latest = await response.json().catch(() => latest as ServicesOverviewBody);
  });

  return () => latest;
};

const sumHealth = (body: ServicesOverviewBody, bucket: HealthBucket) =>
  Object.values(body.healthCounts ?? {}).reduce(
    (total, byHealth) => total + (byHealth[bucket] ?? 0),
    0
  );

/** The chip labels the card owes for one overview answer. */
const expectedChipLabels = (body: ServicesOverviewBody) => ({
  failing: `${
    sumHealth(body, 'failed') + sumHealth(body, 'partialSuccess')
  } of ${body.total} failing`,
  healthy: `${sumHealth(body, 'success')} healthy`,
  notRun: `${sumHealth(body, 'notRun')} not run yet`,
});

const readChipLabels = async (page: Page) => {
  const card = page.getByTestId(`topic-card-${TOPIC_KEY}`);

  return {
    failing: (await card.getByTestId('topic-stat-failing').innerText()).trim(),
    healthy: (await card.getByTestId('topic-stat-healthy').innerText()).trim(),
    notRun: (await card.getByTestId('topic-stat-not-run').innerText()).trim(),
  };
};

/**
 * The destination rendered, not just the URL changed.
 *
 * Outside an embedded connections surface the base router sends the card to
 * Settings > Services, which renders the service-category menu and has no
 * health filter, so the card links there unfiltered. The `health` filter is
 * only appended where `ConnectionsRouterClassBase` points at the Connections
 * page, which reads it.
 */
const expectServicesSettingsPage = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();
};

const openPlatformHealth = async (page: Page) => {
  const overview = page.waitForResponse(isHealthOverviewResponse);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, PLATFORM_HEALTH_KEY);
  const response = await overview;

  expect(response.status()).toBe(200);

  return widget;
};

test.describe(
  'Landing page platform health',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    // One copy of the seed, in one worker. The card's rows are the most
    // recent failures on the server's first name-ordered page, so a second
    // worker seeding the same shape in parallel would push this copy's target
    // out of the three rows the card shows.
    test.describe.configure({ mode: 'serial' });

    let failing: SeededService[] = [];
    let healthy: SeededService;
    let notRun: SeededService;
    let target: SeededService;
    const targetError = `Playwright seeded failure ${uuid()}`;

    test.beforeAll(
      'Seed services in every health bucket',
      async ({ browser }) => {
        test.slow();

        const { apiContext, afterAction } = await performAdminLogin(browser);
        const now = Date.now();

        try {
          failing = await Promise.all(
            Array.from({ length: FAILING_SERVICE_COUNT }, (_, index) =>
              createServiceWithRun(apiContext, `failing-${index}`, {
                error: targetError,
                state: 'failed',
                // Spaced a minute apart, the last one newest.
                timestamp: now - (FAILING_SERVICE_COUNT - index) * 60_000,
              })
            )
          );
          target = failing[FAILING_SERVICE_COUNT - 1];
          [healthy, notRun] = await Promise.all([
            createServiceWithRun(apiContext, 'healthy', {
              state: 'success',
              timestamp: now,
            }),
            createServiceWithRun(apiContext, 'not-run'),
          ]);
        } finally {
          await afterAction();
        }
      }
    );

    test.afterAll('Delete the seeded services', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await settleAll(
          [...failing, healthy, notRun]
            .filter((seeded) => seeded?.service.isCreated())
            .map((seeded) => seeded.service.delete(apiContext))
        );
      } finally {
        await afterAction();
      }
    });

    test('summarises every health bucket from the server tally', async ({
      page,
    }) => {
      const latestOverview = trackLatestOverview(page);
      const widget = await openPlatformHealth(page);
      const card = widget.getByTestId(`topic-card-${TOPIC_KEY}`);

      await expect(card.getByTestId(`topic-status-${TOPIC_KEY}`)).toBeVisible();

      // Polled as a list of disagreements, so a failure names the chip and
      // both labels rather than reporting a bare `false`.
      await expect
        .poll(async () => {
          const body = latestOverview();
          if (!body) {
            return ['no overview response yet'];
          }
          const expected = expectedChipLabels(body);
          const shown = await readChipLabels(page);

          return (Object.keys(expected) as (keyof typeof expected)[])
            .filter((chip) => shown[chip] !== expected[chip])
            .map(
              (chip) =>
                `${chip}: shown "${shown[chip]}", expected "${expected[chip]}"`
            );
        })
        .toEqual([]);

      // The seed alone fills every bucket, so every chip is a live link.
      await expect(card.getByTestId('topic-stat-failing')).toBeEnabled();
      await expect(card.getByTestId('topic-stat-healthy')).toBeEnabled();
      await expect(card.getByTestId('topic-stat-not-run')).toBeEnabled();
    });

    test('lists the newest failure with its own error and offers the rest', async ({
      page,
    }) => {
      const widget = await openPlatformHealth(page);
      const rows = widget.getByTestId('platform-health-rows');
      const targetRow = rows.getByTestId(
        `failing-service-${target.service.entityResponseData.id}`
      );

      await expect(targetRow).toBeVisible();
      await expect(targetRow).toContainText(
        target.service.entityResponseData.name
      );
      await expect(targetRow).toContainText(targetError);
      await expect(rows.locator('li')).toHaveCount(MAX_VISIBLE_ROWS);

      // More failing services than rows, so the card offers the full list.
      await expect(
        widget.getByTestId('view-all-failing-services')
      ).toBeVisible();
    });

    test("a failing row opens that service's Agents tab", async ({ page }) => {
      const widget = await openPlatformHealth(page);
      const { fullyQualifiedName, id } = target.service.entityResponseData;

      await widget.getByTestId(`failing-service-${id}`).click();

      await expect(page).toHaveURL(
        new RegExp(
          `/service/databaseServices/${getEncodedFqn(
            fullyQualifiedName ?? ''
          )}/agents`
        )
      );
    });

    // Classic mode has no health-filtered listing -- only the Connections
    // page reads `health` -- so the chips and "View all" open Settings >
    // Services without a filter rather than promise one that is ignored.
    test('View all opens the services list', async ({ page }) => {
      const widget = await openPlatformHealth(page);

      await widget.getByTestId('view-all-failing-services').click();

      await expect(page).toHaveURL(new RegExp(`${SERVICES_SETTINGS_PATH}$`));
      await expectServicesSettingsPage(page);
    });

    for (const chip of [
      { id: 'failing' },
      { id: 'healthy' },
      { id: 'not-run' },
    ]) {
      test(`the ${chip.id} chip opens the services list`, async ({ page }) => {
        const widget = await openPlatformHealth(page);

        await widget.getByTestId(`topic-stat-${chip.id}`).click();

        await expect(page).toHaveURL(new RegExp(`${SERVICES_SETTINGS_PATH}$`));
        await expectServicesSettingsPage(page);
      });
    }

    test('the footer opens the services list', async ({ page }) => {
      const widget = await openPlatformHealth(page);

      await widget.getByTestId(`topic-action-${TOPIC_KEY}`).click();

      await expect(page).toHaveURL(new RegExp(`${SERVICES_SETTINGS_PATH}$`));
      await expectServicesSettingsPage(page);
    });
  }
);

test.describe(
  'Landing page platform health without ingestion access',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    let policy: PolicyClass;
    let role: RolesClass;
    let account: LandingPageAccount;

    test.beforeAll(
      'Create a viewer denied ingestion pipelines',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          policy = new PolicyClass();
          role = new RolesClass();
          const createdPolicy = await policy.create(apiContext, [
            {
              name: `pw-deny-ingestion-${uuid()}`,
              resources: ['ingestionPipeline'],
              operations: ['ViewAll', 'ViewBasic'],
              effect: 'deny',
            },
          ]);
          const createdRole = await role.create(apiContext, [
            createdPolicy.fullyQualifiedName ?? createdPolicy.name,
          ]);

          account = await createLandingPageAccount(apiContext, {
            roles: [
              {
                id: createdRole.id ?? '',
                name: createdRole.name,
                type: 'role',
              },
            ],
          });
        } finally {
          await afterAction();
        }
      }
    );

    test.afterAll('Delete the restricted viewer', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await deleteLandingPageAccount(apiContext, account);
        await role.delete(apiContext);
        await policy.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test('shows the no-permission card and never asks for service health', async ({
      browser,
    }) => {
      const page = await openLandingPageAccountPage(browser, account);
      const overviewRequests: string[] = [];

      page.on('request', (request) => {
        if (new URL(request.url()).pathname === OVERVIEW_PATH) {
          overviewRequests.push(request.url());
        }
      });

      try {
        await redirectToHomePage(page);
        const widget = await waitForLandingPageWidget(
          page,
          PLATFORM_HEALTH_KEY
        );
        const card = widget.getByTestId(`topic-card-${TOPIC_KEY}`);

        await expect(card).toContainText(
          'You do not have the necessary permissions to view this data.'
        );
        await expect(card.getByTestId('topic-stat-failing')).toHaveCount(0);
        await expect(card.getByTestId(`topic-action-${TOPIC_KEY}`)).toHaveCount(
          0
        );
        // A sibling card that did fetch is proof the page finished its first
        // round of requests, so the absence below is not just "not yet".
        await waitForLandingPageWidget(page, 'KnowledgePanel.DataEstate');

        expect(overviewRequests).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }
);
