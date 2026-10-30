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

import { Route } from '@playwright/test';
import { v4 as uuid } from 'uuid';
import { TestCaseFailureReasonType } from '../../../../src/generated/tests/resolved';
import {
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../src/generated/tests/testCaseResolutionStatus';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/isolatedUser';
import { okJson } from '../../../utils/apiResponse';
import { clickIgnoringToasts, getApiContext } from '../../../utils/common';

const HISTORY_PAGE_SIZE = 50;

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Incident history pagination',
  { tag: DOMAIN_TAGS.OBSERVABILITY },
  () => {
    test('loads older timeline events without changing the latest status', async ({
      isolatedUserPage: page,
    }) => {
      const table = new TableClass();
      await page.goto('/');
      const { apiContext, afterAction } = await getApiContext(page);
      let releaseOlder = () => {};
      const olderGate = new Promise<void>((resolve) => {
        releaseOlder = resolve;
      });
      let historyUrl = '';
      let handler: ((route: Route) => Promise<void>) | undefined;

      try {
        const testCase =
          await test.step('Create an isolated incident', async () => {
            const created = await table.createTestCase(apiContext);
            await table.addTestCaseResult(
              apiContext,
              created.fullyQualifiedName,
              {
                result: 'Seeded incident history pagination test',
                testCaseStatus: 'Failed',
                timestamp: Date.now(),
                testResultValue: [{ name: 'rowCount', value: '0' }],
              }
            );

            return created;
          });
        let taskIds: string[] = [];
        await expect
          .poll(
            async () => {
              const response = await apiContext.get('/api/v1/tasks', {
                params: {
                  aboutEntity: testCase.fullyQualifiedName,
                  category: 'Incident',
                  limit: 100,
                },
              });
              const body = await okJson<{
                data: { id: string; type: string }[];
              }>(response, 'Find the seeded incident task');
              taskIds = body.data
                .filter((task) => task.type === 'TestCaseResolution')
                .map((task) => task.id);

              return taskIds;
            },
            { timeout: 60_000 }
          )
          .toHaveLength(1);
        const stateId = taskIds[0];
        historyUrl = `**/api/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/${stateId}*`;
        const history: TestCaseResolutionStatus[] = Array.from(
          { length: HISTORY_PAGE_SIZE + 2 },
          (_, index) => ({
            id: uuid(),
            stateId,
            testCaseReference: {
              id: testCase.id,
              type: 'testCase',
              name: testCase.name,
              fullyQualifiedName: testCase.fullyQualifiedName,
            },
            timestamp: index + 1,
            updatedAt: Date.UTC(2026, 0, index + 1),
            testCaseResolutionStatusType:
              index === HISTORY_PAGE_SIZE + 1
                ? TestCaseResolutionStatusTypes.Resolved
                : index === 0
                ? TestCaseResolutionStatusTypes.New
                : TestCaseResolutionStatusTypes.ACK,
            updatedBy: {
              id: uuid(),
              type: 'user',
              name: `history_event_${index}`,
              displayName: `History event ${index}`,
            },
            testCaseResolutionStatusDetails: {
              resolvedBy: {
                id: uuid(),
                type: 'user',
                name: `history_event_${index}`,
                displayName: `History event ${index}`,
              },
              testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
            },
          })
        ).reverse();
        const cursor = Buffer.from(
          `${history[HISTORY_PAGE_SIZE - 1].timestamp}|${
            history[HISTORY_PAGE_SIZE - 1].id
          }`
        ).toString('base64url');
        handler = async (route) => {
          const url = new URL(route.request().url());
          const after = url.searchParams.get('after');
          const limit = Number(url.searchParams.get('limit') ?? history.length);
          if (after) {
            expect(after).toBe(cursor);
            await olderGate;
          }
          const data = after
            ? history.slice(HISTORY_PAGE_SIZE)
            : history.slice(0, limit);
          const last = data[data.length - 1];
          const next =
            !after && data.length < history.length
              ? Buffer.from(`${last.timestamp}|${last.id}`).toString(
                  'base64url'
                )
              : undefined;
          await route.fulfill({
            json: {
              data,
              paging: {
                total: history.length,
                after: next,
              },
            },
          });
        };
        // Backend cursor correctness has SQL/API coverage; this fixture makes UI paging deterministic.
        await page.route(historyUrl, handler);
        await test.step('Open the production timeline and its first page', async () => {
          const firstPage = page.waitForResponse((response) => {
            const url = new URL(response.url());

            return (
              response.request().method() === 'GET' &&
              url.pathname.endsWith(`/stateId/${stateId}`) &&
              url.searchParams.get('limit') === String(HISTORY_PAGE_SIZE) &&
              !url.searchParams.has('after')
            );
          });
          await page.goto(
            `/test-case/${encodeURIComponent(
              testCase.fullyQualifiedName
            )}/test-case-results`
          );
          await page.getByRole('tab', { name: /Incident/i }).click();
          expect((await firstPage).status()).toBe(200);
        });
        const header = page.getByTestId(
          'incident-manager-task-header-container'
        );
        const steps = header.getByTestId('task-resolution-steps');
        const labels = steps.getByText(/^By History event \d+ on/);
        const loadMore = header.getByRole('button', {
          name: /^Load more$/i,
        });
        await expect(header).toBeVisible();
        await expect(labels).toHaveText(
          Array.from(
            { length: HISTORY_PAGE_SIZE },
            (_, index) => new RegExp(`^By History event ${index + 2} on(?: |$)`)
          )
        );
        await expect(header.getByTestId('failure-reason')).toContainText(
          'FalsePositive'
        );
        await test.step('Load the remaining older events through the real control', async () => {
          const olderRequested = page.waitForRequest(
            (request) =>
              new URL(request.url()).searchParams.get('after') === cursor
          );
          const olderResponse = page.waitForResponse(
            (response) =>
              response.request().method() === 'GET' &&
              new URL(response.url()).searchParams.get('after') === cursor
          );
          await expect(loadMore).toBeEnabled();
          await clickIgnoringToasts(loadMore);
          await olderRequested;
          await expect(
            header.getByRole('button', { disabled: true })
          ).toHaveCount(1);
          releaseOlder();
          expect((await olderResponse).status()).toBe(200);
          await expect(labels).toHaveText(
            Array.from(
              { length: HISTORY_PAGE_SIZE + 1 },
              (_, index) =>
                new RegExp(`^By History event ${index + 1} on(?: |$)`)
            )
          );
          await expect(steps.getByText('New', { exact: true })).toBeVisible();
          await expect(header.getByTestId('failure-reason')).toContainText(
            'FalsePositive'
          );
          await expect(loadMore).toHaveCount(0);
        });
      } finally {
        releaseOlder();
        if (handler) {
          await page.unrouteAll({ behavior: 'wait' });
        }
        await table.delete(apiContext);
        await afterAction();
      }
    });
  }
);
