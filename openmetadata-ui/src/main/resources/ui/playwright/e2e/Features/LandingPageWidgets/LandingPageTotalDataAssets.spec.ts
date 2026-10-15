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
import { Page, Request, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { expect, test } from '../../../support/fixtures/landingPageUser';
import { okJson } from '../../../utils/apiResponse';
import { redirectToHomePage } from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { selectTopicCardFilterOption } from '../../../utils/widgetFilters';

const TOTAL_DATA_ASSETS_KEY = 'KnowledgePanel.TotalAssets';
const TOPIC_KEY = 'totalDataAssets';
const DAY_MS = 24 * 60 * 60 * 1000;
const CHARTS_PATH =
  '/api/v1/analytics/dataInsights/system/charts/listChartData';
const TOTALS_CHART = 'total_data_assets';

type ChartRow = { day: number; group?: string; count: number };
type ChartsBody = Record<string, { results?: ChartRow[] } | undefined>;
type AggregateBody = {
  aggregations?: Record<
    string,
    { buckets?: { key: string; doc_count: number }[] }
  >;
};

/** What the card owes: a total and one row per asset type holding assets. */
interface ExpectedTotals {
  total: number;
  typeCount: number;
}

const isTotalsChartsRequest = (request: Request) => {
  const url = new URL(request.url());

  return (
    request.method() === 'GET' &&
    url.pathname === CHARTS_PATH &&
    (url.searchParams.get('chartNames') ?? '').includes(TOTALS_CHART)
  );
};

const chartWindowOf = (request: Request) => {
  const url = new URL(request.url());

  return (
    Number(url.searchParams.get('end')) - Number(url.searchParams.get('start'))
  );
};

const isEntityTypeAggregateRequest = (request: Request) => {
  if (
    request.method() !== 'POST' ||
    new URL(request.url()).pathname !== '/api/v1/search/aggregate'
  ) {
    return false;
  }
  const body = request.postDataJSON() as { fieldName?: string } | null;

  return body?.fieldName === 'entityType';
};

const waitForTotalsCharts = (page: Page, windowDays: number) =>
  waitForResponseWithStatus(
    page,
    (response) =>
      isTotalsChartsRequest(response.request()) &&
      chartWindowOf(response.request()) === windowDays * DAY_MS,
    200
  );

/** Per-type counts on the chart's newest day — the split the card draws. */
const newestDayByType = (rows: ChartRow[]) => {
  const newest = rows.reduce((day, row) => Math.max(day, row.day), 0);
  const byType = new Map<string, number>();
  rows
    .filter((row) => row.day === newest)
    .forEach((row) =>
      byType.set(
        row.group ?? '',
        (byType.get(row.group ?? '') ?? 0) + row.count
      )
    );

  return Array.from(byType.values()).filter((count) => count > 0);
};

/**
 * Data Insights only has rows once its pipeline has run — the Basic lane never
 * runs it — so the card then falls back to a live count by entity type. The
 * expectation is read off whichever answer the card actually used.
 */
const readExpectedTotals = async (
  chartsResponse: Response,
  liveResponse: Promise<Response>
): Promise<ExpectedTotals> => {
  const charts = await okJson<ChartsBody>(chartsResponse, 'Totals chart');
  const rows = charts[TOTALS_CHART]?.results ?? [];

  if (rows.length > 0) {
    const counts = newestDayByType(rows);

    return {
      total: counts.reduce((sum, count) => sum + count, 0),
      typeCount: counts.length,
    };
  }

  const aggregate = await okJson<AggregateBody>(
    await liveResponse,
    'Live entity type aggregate'
  );
  const [buckets] = Object.entries(aggregate.aggregations ?? {})
    .filter(([name]) => name.endsWith('entityType'))
    .map(([, value]) => value.buckets ?? []);
  const counts = (buckets ?? [])
    .map((bucket) => bucket.doc_count)
    .filter((count) => count > 0);

  return {
    total: counts.reduce((sum, count) => sum + count, 0),
    typeCount: counts.length,
  };
};

const toDigits = (text: string) => Number(text.replace(/\D/g, ''));

const openTotals = async (page: Page) => {
  const chartsResponse = waitForTotalsCharts(page, 7);
  // Hoisted with the charts listener: the live count fires right after the
  // chart answers empty, before the expectation could start waiting for it.
  const liveResponse = waitForResponseWithStatus(
    page,
    (response) => isEntityTypeAggregateRequest(response.request()),
    200
  );
  // Not awaited unless the chart is empty; a pending listener is harmless.
  liveResponse.catch(() => undefined);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, TOTAL_DATA_ASSETS_KEY);
  const expected = await readExpectedTotals(await chartsResponse, liveResponse);

  return { expected, widget };
};

test.describe(
  'Landing page total data assets',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('shows the total and one row per asset type from the answer it read', async ({
      page,
    }) => {
      const { expected, widget } = await openTotals(page);

      // Every lane seeds data assets before this runs, so either source has
      // something to count.
      expect(expected.total).toBeGreaterThan(0);

      await expect
        .poll(async () =>
          toDigits(
            await widget.getByTestId('total-data-assets-total').innerText()
          )
        )
        .toBe(expected.total);
      await expect(
        widget.getByTestId('asset-type-rows').getByRole('listitem')
      ).toHaveCount(expected.typeCount);
    });

    test('rows are ordered largest asset type first', async ({ page }) => {
      const { widget } = await openTotals(page);
      const counts = widget.getByTestId('asset-type-count');

      await expect(counts).not.toHaveCount(0);

      const values = (await counts.allInnerTexts()).map(toDigits);

      expect(values).toEqual([...values].sort((a, b) => b - a));
    });

    test('changing the range asks for the new window', async ({ page }) => {
      const { widget } = await openTotals(page);
      const thirtyDayResponse = waitForTotalsCharts(page, 30);

      await selectTopicCardFilterOption(
        page,
        widget,
        'total-data-assets-window-filter',
        '30'
      );

      await thirtyDayResponse;

      await expect(
        widget.getByTestId('total-data-assets-window-filter')
      ).toContainText('Last 30 days');
      await expect(
        widget.getByTestId(`topic-body-${TOPIC_KEY}`)
      ).toHaveAttribute('aria-busy', 'false');
    });
  }
);
