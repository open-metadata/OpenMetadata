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
import { expect, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { isRepresentativeEntityRun } from '../../../utils/entityMatrix';
import { test } from '../../fixtures/pages';

type HeartbeatWindow = Window & {
  lineageHeartbeat?: { ticks: number; longestGapMs: number };
};

const HEARTBEAT_MS = 50;
// A frozen tab shows up as one long gap between heartbeats. Parsing this
// response used to block the page for 20-90 s; the fixed parse needs well
// under a second, so 5 s fails only on a real freeze.
const MAX_MAIN_THREAD_GAP_MS = 5_000;

const tableRef = (fqn: string) => ({
  id: `id-${fqn}`,
  type: 'table',
  fullyQualifiedName: fqn,
});

const lineageNode = (
  fqn: string,
  nodeDepth: number,
  upstreamCount: number
) => ({
  entity: {
    ...tableRef(fqn),
    name: fqn.split('.').pop(),
    entityType: 'table',
    columns: [],
  },
  paging: { entityUpstreamCount: upstreamCount, entityDownstreamCount: 0 },
  nodeDepth,
});

const lineageEdge = (from: string, to: string) => ({
  fromEntity: tableRef(from),
  toEntity: tableRef(to),
  docId: `${from}-->${to}`,
});

/**
 * The shape a busy table returns at upstream depth 2 with 50 nodes per layer:
 * 50 + 2,500 upstream nodes, and the second layer's own upstream edges, which
 * point at tables that were never fetched.
 */
const buildBusyTableLineage = (rootFqn: string) => {
  const root = { ...lineageNode(rootFqn, 0, 50) };
  const nodes: Record<string, ReturnType<typeof lineageNode>> = {
    [rootFqn]: root,
  };
  const upstreamEdges: Record<string, ReturnType<typeof lineageEdge>> = {};
  const addEdge = (from: string, to: string) => {
    const edge = lineageEdge(from, to);
    upstreamEdges[edge.docId] = edge;
  };

  for (let i = 0; i < 50; i++) {
    const first = `${rootFqn}_u${i}`;
    nodes[first] = lineageNode(first, -1, 50);
    addEdge(first, rootFqn);
    for (let j = 0; j < 50; j++) {
      const second = `${first}_u${j}`;
      nodes[second] = lineageNode(second, -2, 20);
      addEdge(second, first);
      for (let k = 0; k < 20; k++) {
        addEdge(`${second}_unfetched${k}`, second);
      }
    }
  }

  return { nodes, upstreamEdges, downstreamEdges: {} };
};

const startHeartbeat = (page: Page) =>
  page.addInitScript((intervalMs) => {
    const heartbeat = { ticks: 0, longestGapMs: 0 };
    let last = performance.now();
    (window as HeartbeatWindow).lineageHeartbeat = heartbeat;
    setInterval(() => {
      const now = performance.now();
      heartbeat.longestGapMs = Math.max(heartbeat.longestGapMs, now - last);
      heartbeat.ticks += 1;
      last = now;
    }, intervalMs);
  }, HEARTBEAT_MS);

const readHeartbeat = (page: Page) =>
  page.evaluate(() => {
    const { ticks = 0, longestGapMs = 0 } =
      (window as HeartbeatWindow).lineageHeartbeat ?? {};

    return { ticks, longestGapMs };
  });

// Building and parsing a 52,550-edge response is too heavy for every pull
// request and merge-queue run, so those runs leave this suite out. The nightly
// full suite runs it, and so does the gating run of a pull request that edits
// this file (see utils/entityMatrix.ts).
if (!isRepresentativeEntityRun(__filename)) {
  test.describe(
    'Lineage tab with a very large lineage response',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    () => {
      const table = new TableClass();

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await table.create(apiContext);
        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await table.delete(apiContext);
        await afterAction();
      });

      test('keeps the page responsive while it processes 52,550 edges', async ({
        page,
      }) => {
        test.slow();

        const rootFqn = table.entityResponseData.fullyQualifiedName ?? '';
        const body = JSON.stringify(buildBusyTableLineage(rootFqn));
        await page.route('**/api/v1/lineage/getLineage?*', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body })
        );
        await startHeartbeat(page);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        const lineageResponse = page.waitForResponse(
          '**/api/v1/lineage/getLineage?*'
        );
        await page.getByTestId('lineage').click();
        await (await lineageResponse).finished();

        const { ticks: ticksAtResponse } = await readHeartbeat(page);

        // Wait until the page has run two seconds of heartbeats after the
        // response: by then the response has been parsed, and any long block
        // while parsing it is recorded as the longest gap.
        await expect
          .poll(
            async () => (await readHeartbeat(page)).ticks - ticksAtResponse,
            {
              timeout: 120_000,
            }
          )
          .toBeGreaterThan(2_000 / HEARTBEAT_MS);

        const { longestGapMs } = await readHeartbeat(page);

        expect(longestGapMs).toBeLessThan(MAX_MAIN_THREAD_GAP_MS);
      });
    }
  );
}
