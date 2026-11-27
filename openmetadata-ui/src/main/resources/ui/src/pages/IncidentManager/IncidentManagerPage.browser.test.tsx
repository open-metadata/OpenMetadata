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
 * Incident list paging is offset based (testCaseIncidentStatus/search/list),
 * so it does not use the shared cursor contract. A page change must send one
 * request, and the rows must stay those of the page the pager shows even when
 * an earlier request answers last (issue 38927).
 */
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { networkIdle } from '../../test/browser/network';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const TOTAL = 35;
const TABLE_FQN = 'pw_service.pw_db.pw_schema.pw_table';
const SLOW_RESPONSE_MS = 1_000;

const incidents: TestCaseResolutionStatus[] = many(TOTAL, (i) => {
  const testCase = named('incident', i, TABLE_FQN);

  return {
    id: testCase.id,
    stateId: testCase.id,
    timestamp: 1_700_000_000_000 - i,
    updatedAt: 1_700_000_000_000 - i,
    severity: Severities.Severity1,
    testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
    testCaseReference: { ...testCase, type: 'testCase' },
  };
});

const rowLabel = (i: number) => named('incident', i).displayName;

/**
 * Serves the incident list by offset and records the offset of every list
 * request. While `slowFirstPage` is set, page 1 answers after the others, the
 * order that left page-1 rows under a "Page 3 of 3" pager.
 */
const serveIncidents = () => {
  const offsets: number[] = [];
  const control = { offsets, slowFirstPage: false };
  worker.use(
    http.get(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list',
      async ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? PAGE_SIZE_BASE);
        offsets.push(offset);
        if (control.slowFirstPage && offset === 0) {
          await delay(SLOW_RESPONSE_MS);
        }

        return HttpResponse.json({
          data: incidents.slice(offset, offset + limit),
          paging: { offset, limit, total: TOTAL },
        });
      }
    )
  );

  return control;
};

const expectPage = async (first: number, pageNumber: number) => {
  await expect
    .element(page.getByText(rowLabel(first), { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByTestId('page-indicator'))
    .toHaveTextContent(new RegExp(`${pageNumber}\\s*of\\s*3`));
};

describe('Incident Manager pagination', () => {
  test(
    'Next sends one request per page and keeps that page when page 1 answers late',
    async () => {
      const list = serveIncidents();
      await renderApp('/incident-manager');

      await expect
        .element(page.getByText(rowLabel(1), { exact: true }), {
          timeout: scaled(60_000),
        })
        .toBeVisible();

      await networkIdle();
      list.offsets.length = 0;
      list.slowFirstPage = true;

      await userEvent.click(page.getByTestId('next'));
      await expectPage(PAGE_SIZE_BASE + 1, 2);
      await userEvent.click(page.getByTestId('next'));
      await expectPage(2 * PAGE_SIZE_BASE + 1, 3);
      // networkIdle waits for every request in flight, so a page-1 request,
      // if one was sent, has answered before the rows are checked again.
      await networkIdle();

      expect(list.offsets).toEqual([PAGE_SIZE_BASE, 2 * PAGE_SIZE_BASE]);

      await expectPage(2 * PAGE_SIZE_BASE + 1, 3);

      expect(page.getByText(rowLabel(1), { exact: true }).query()).toBeNull();
      expect(new URL(location.href).searchParams.get('currentPage')).toBe('3');
    },
    scaled(90_000)
  );

  test(
    'a reload on page 3 fetches page 3, and Previous fetches page 2 once',
    async () => {
      const list = serveIncidents();
      await renderApp('/incident-manager?currentPage=3');

      await expectPage(2 * PAGE_SIZE_BASE + 1, 3);
      await networkIdle();

      expect(list.offsets).toEqual([2 * PAGE_SIZE_BASE]);

      list.offsets.length = 0;
      await userEvent.click(page.getByTestId('previous'));
      await expectPage(PAGE_SIZE_BASE + 1, 2);
      await networkIdle();

      expect(list.offsets).toEqual([PAGE_SIZE_BASE]);
    },
    scaled(90_000)
  );
});
