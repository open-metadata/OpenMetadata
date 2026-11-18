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
import { Locator, Page, Request, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { expect, test } from '../../../support/fixtures/landingPageUser';
import { ignoreClosedTarget } from '../../../support/fixtures/serverLoad';
import { okJson } from '../../../utils/apiResponse';
import { redirectToHomePage } from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { selectTopicCardFilterOption } from '../../../utils/widgetFilters';

const DATA_ESTATE_KEY = 'KnowledgePanel.DataEstate';
const TOPIC_KEY = 'dataEstate';
const DAY_MS = 24 * 60 * 60 * 1000;
const CHARTS_PATH =
  '/api/v1/analytics/dataInsights/system/charts/listChartData';
const TOTALS_CHART = 'total_data_assets';
const COVERAGE_CHART = 'percentage_of_data_asset_with_description';

/**
 * `MAX_NAMED_CONNECTORS` in src/hooks/useDataEstate.ts: past this many
 * connectors the card names the largest ones and folds the rest into "Other".
 * Duplicated rather than imported so the spec states the contract instead of
 * agreeing with whatever the source says.
 */
const MAX_NAMED_CONNECTORS = 6;

/**
 * Entity types the card must never list under "by connector".
 *
 * The breakdown used to be read off the `total_data_assets` data-insight
 * chart, whose group dimension is the entity type — so the card printed
 * `table 800`, `chart 120`, `databaseSchema 83` beneath a "BY CONNECTOR"
 * heading. The service dimension exists only on the search aggregation, which
 * is where `useDataEstate` reads it from now. These names reappearing is that
 * regression returning, and nothing else in the suite would catch it.
 */
const ENTITY_TYPE_NAMES = [
  'table',
  'chart',
  'database',
  'databaseSchema',
  'dashboard',
  'dashboardDataModel',
  'storedProcedure',
  'topic',
  'metric',
];

type AggregateBody = {
  aggregations?: Record<
    string,
    { buckets?: { key: string; doc_count: number }[] }
  >;
};

/** The estate figures the card is expected to print, from the connector aggregate it read. */
interface ExpectedEstate {
  total: number;
  /** Per-connector counts, largest first, before folding. */
  connectorCounts: number[];
}

const isEstateChartsRequest = (request: Request) => {
  const url = new URL(request.url());
  const chartNames = url.searchParams.get('chartNames') ?? '';

  return (
    request.method() === 'GET' &&
    url.pathname === CHARTS_PATH &&
    chartNames.includes(TOTALS_CHART) &&
    chartNames.includes(COVERAGE_CHART)
  );
};

const chartWindowOf = (request: Request) => {
  const url = new URL(request.url());

  return (
    Number(url.searchParams.get('end')) - Number(url.searchParams.get('start'))
  );
};

const isConnectorAggregateRequest = (request: Request) => {
  if (
    request.method() !== 'POST' ||
    new URL(request.url()).pathname !== '/api/v1/search/aggregate'
  ) {
    return false;
  }
  const body = request.postDataJSON() as {
    fieldName?: string;
    index?: string;
  } | null;

  return body?.fieldName === 'serviceType' && body?.index === 'dataAsset';
};

const waitForEstateCharts = (page: Page, windowDays: number) =>
  waitForResponseWithStatus(
    page,
    (response) =>
      isEstateChartsRequest(response.request()) &&
      chartWindowOf(response.request()) === windowDays * DAY_MS,
    200
  );

const waitForConnectorAggregate = (page: Page) =>
  waitForResponseWithStatus(
    page,
    (response) => isConnectorAggregateRequest(response.request()),
    200
  );

const readExpectedEstate = async (
  aggregateResponse: Response
): Promise<ExpectedEstate> => {
  const aggregate = await okJson<AggregateBody>(
    aggregateResponse,
    'Connector aggregate'
  );
  // The engine prefixes the aggregation name with its type (`sterms#…`).
  const [serviceTypes] = Object.entries(aggregate.aggregations ?? {})
    .filter(([name]) => name.endsWith('serviceType'))
    .map(([, value]) => value.buckets ?? []);
  const connectorCounts = (serviceTypes ?? [])
    .map((bucket) => bucket.doc_count)
    .sort((a, b) => b - a);

  // The header is "Data Assets by Connector": the sum of the split beneath it,
  // whether or not Data Insights has rows.
  return {
    connectorCounts,
    total: connectorCounts.reduce((sum, count) => sum + count, 0),
  };
};

/** The legend the card owes: the largest connectors, then one "Other" for the rest. */
const foldConnectorCounts = (counts: number[]) => {
  if (counts.length <= MAX_NAMED_CONNECTORS) {
    return counts;
  }
  const rest = counts.slice(MAX_NAMED_CONNECTORS - 1);

  return [
    ...counts.slice(0, MAX_NAMED_CONNECTORS - 1),
    rest.reduce((sum, count) => sum + count, 0),
  ];
};

const toDigits = (text: string) => Number(text.replace(/\D/g, ''));

const readTotal = async (widget: Locator) =>
  toDigits(await widget.getByTestId('data-estate-total').innerText());

const openEstate = async (page: Page) => {
  const chartsResponse = waitForEstateCharts(page, 7);
  const aggregateResponse = waitForConnectorAggregate(page);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, DATA_ESTATE_KEY);
  await chartsResponse;
  const expected = await readExpectedEstate(await aggregateResponse);

  return { expected, widget };
};

test.describe('Landing page data estate', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('reports the estate size as the sum of its connectors', async ({
    page,
  }) => {
    const { expected, widget } = await openEstate(page);

    // Every lane seeds data assets before this runs. The header used to print
    // the Data Insights total above a split that summed to something else.
    expect(expected.total).toBeGreaterThan(0);

    await expect
      .poll(() => readTotal(widget), {
        message: 'total is the sum of the per-connector counts',
      })
      .toBe(expected.total);
  });

  test('splits the estate by connector, folding the tail into Other', async ({
    page,
  }) => {
    const { expected, widget } = await openEstate(page);
    const breakdown = widget.getByTestId('connector-breakdown');
    const legendCounts = foldConnectorCounts(expected.connectorCounts);

    await expect(breakdown.getByTestId('connector-entry')).toHaveCount(
      legendCounts.length
    );

    // A legend entry without its count is the failure mode of the share bar:
    // the segment still renders, so the bar looks right while the number that
    // makes it readable is missing.
    await expect(breakdown.getByTestId('connector-count')).toHaveCount(
      legendCounts.length
    );
    await expect
      .poll(async () =>
        (
          await breakdown.getByTestId('connector-count').allInnerTexts()
        ).map(toDigits)
      )
      .toEqual(legendCounts);

    // The folded remainder is the one entry the card names itself.
    await expect(
      breakdown.getByTestId('connector-name').filter({ hasText: /^Other$/ })
    ).toHaveCount(
      expected.connectorCounts.length > MAX_NAMED_CONNECTORS ? 1 : 0
    );

    // "Across N connectors" counts every connector holding assets, not the
    // entries the bar names — folding must not shrink it.
    await expect(widget.getByTestId(`topic-card-${TOPIC_KEY}`)).toContainText(
      `across ${expected.connectorCounts.length} connector`
    );
  });

  test('never lists an entity type as a connector', async ({ page }) => {
    const { widget } = await openEstate(page);
    const names = widget
      .getByTestId('connector-breakdown')
      .getByTestId('connector-name');

    await expect(names).not.toHaveCount(0);

    // Compared with spaces stripped and case folded: the card runs service
    // types through `getFormattedDataAssetServiceType`, so a real connector
    // reads `Big Query`, while an entity type leaking through could read
    // `Database Schema` as easily as `databaseSchema`.
    const normalise = (name: string) => name.replace(/\s+/g, '').toLowerCase();
    const entityTypes = ENTITY_TYPE_NAMES.map(normalise);

    expect(
      (await names.allInnerTexts())
        .map(normalise)
        .filter((name) => entityTypes.includes(name))
    ).toEqual([]);
  });

  // The range drives the fetch, not just the label: the totals delta and the
  // coverage trend are both measured over it. The connector split and the
  // header that sums it deliberately are not — they are a live count — so they
  // have to survive the switch unchanged,
  // and the card must dim rather than drop back to its skeleton while the new
  // window loads.
  test('widening the range refetches the window and keeps the estate on screen', async ({
    page,
  }) => {
    const { widget } = await openEstate(page);
    const breakdown = widget.getByTestId('connector-breakdown');
    const body = widget.getByTestId(`topic-body-${TOPIC_KEY}`);
    const trigger = widget.getByTestId('data-estate-window-filter');
    const total = widget.getByTestId('data-estate-total');

    await expect(breakdown.getByTestId('connector-name')).not.toHaveCount(0);

    const connectorsBefore = await breakdown
      .getByTestId('connector-name')
      .allInnerTexts();
    const totalBefore = await total.innerText();

    // Hold the 90-day answer so the in-between state is observable rather than
    // a frame that may or may not be caught.
    let releaseNinetyDays = (): void => undefined;
    const ninetyDaysHeld = new Promise<void>((resolve) => {
      releaseNinetyDays = resolve;
    });
    await page.route(`**${CHARTS_PATH}?*`, async (route) => {
      if (chartWindowOf(route.request()) === 90 * DAY_MS) {
        await ninetyDaysHeld;
      }
      await ignoreClosedTarget(route, () => route.fallback());
    });

    const connectorRefetches: Request[] = [];
    page.on('request', (request) => {
      if (isConnectorAggregateRequest(request)) {
        connectorRefetches.push(request);
      }
    });

    const ninetyDayRequest = page.waitForRequest(
      (request) =>
        isEstateChartsRequest(request) && chartWindowOf(request) === 90 * DAY_MS
    );
    const ninetyDayResponse = waitForEstateCharts(page, 90);

    try {
      await selectTopicCardFilterOption(
        page,
        widget,
        'data-estate-window-filter',
        '90'
      );

      await test.step('the request asks for the last 90 days', async () => {
        const start = Number(
          new URL((await ninetyDayRequest).url()).searchParams.get('start')
        );

        // Measured back from the request's own `end`, so only the clock skew
        // between this process and the browser needs the tolerance.
        expect(Math.abs(start - (Date.now() - 90 * DAY_MS))).toBeLessThan(
          5 * 60 * 1000
        );
      });

      await test.step('the card dims in place while the window loads', async () => {
        await expect(trigger).toContainText('Last 90 days');
        await expect(body).toHaveAttribute('aria-busy', 'true');
        await expect(
          widget.getByTestId(`topic-body-skeleton-${TOPIC_KEY}`)
        ).toHaveCount(0);
        await expect(total).toHaveText(totalBefore);
      });
    } finally {
      releaseNinetyDays();
    }

    await test.step('the new window lands and the connectors stay put', async () => {
      await okJson(await ninetyDayResponse, '90-day estate charts');

      await expect(body).toHaveAttribute('aria-busy', 'false');
      await expect(total).toHaveText(totalBefore);
      await expect(trigger).toContainText('Last 90 days');
      await expect(breakdown.getByTestId('connector-name')).toHaveText(
        connectorsBefore
      );
      expect(connectorRefetches).toHaveLength(0);
    });
  });
});
