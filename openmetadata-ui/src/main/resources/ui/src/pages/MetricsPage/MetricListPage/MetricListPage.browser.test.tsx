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
/**
 * Metrics list paging is offset based (/metrics/hierarchy) with its own
 * controls, so it does not use the shared cursor contract. Replaces
 * Pagination.spec.ts › "should test pagination on Metrics page".
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  Kind,
  MetricHierarchyItem,
} from '../../../generated/api/data/metricHierarchyItem';
import { many, named } from '../../../test/browser/fixtures/entities';
import { worker } from '../../../test/browser/msw';
import { renderApp } from '../../../test/browser/renderWithApp';

const items: MetricHierarchyItem[] = many(45, (i) => ({
  kind: Kind.Metric,
  metric: named('metric', i),
}));

const serveHierarchy = () => {
  const calls: URL[] = [];
  worker.use(
    http.get('/api/v1/metrics/hierarchy', ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);

      return HttpResponse.json({
        data: items.slice(offset, offset + limit),
        paging: { offset, limit, total: items.length },
      });
    }),
    // Each visible row fetches its own health summary (one call per row).
    http.get('/api/v1/metrics/:id/observability', () => HttpResponse.json({}))
  );

  return calls;
};

describe('Metrics pagination', () => {
  test('pages the hierarchy by offset, 20 at a time', async () => {
    const calls = serveHierarchy();
    await renderApp('/metrics');

    await expect
      .element(page.getByText('PW metric 01'), { timeout: 60_000 })
      .toBeVisible();
    expect(calls[0].searchParams.get('limit')).toBe('20');
    expect(calls[0].searchParams.get('offset')).toBe('0');
    await expect
      .element(page.getByTestId('metric-page-previous'))
      .toBeDisabled();
    await expect.element(page.getByTestId('metric-page-next')).toBeEnabled();

    await userEvent.click(page.getByTestId('metric-page-next'));

    await expect.element(page.getByText('PW metric 21')).toBeVisible();

    const last = calls[calls.length - 1];

    expect(last.searchParams.get('limit')).toBe('20');
    expect(last.searchParams.get('offset')).toBe('20');
    await expect
      .element(page.getByTestId('metric-page-previous'))
      .toBeEnabled();
    await expect
      .element(page.getByTestId('metric-page-indicator'))
      .toHaveTextContent(/2\s*of\s*3/);
  }, 90_000);
});
