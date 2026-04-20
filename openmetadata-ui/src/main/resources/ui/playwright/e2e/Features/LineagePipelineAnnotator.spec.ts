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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  getAuthContext,
  getToken,
  redirectToHomePage,
  uuid,
} from '../../utils/common';

/**
 * Playwright tests for the pipeline-as-annotator lineage scenario.
 *
 * Verifies two bugs that were fixed:
 *  Bug #1: Service nodes (databaseService, messagingService, pipelineService) must NOT
 *           appear in entity-level lineage views.
 *  Bug #2: The pipeline service must appear in service-level lineage with correct edges.
 *
 * Topology: table → topic (annotated with pipeline)
 */

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

let table: TableClass;
let dbServiceFqn: string;
let messagingServiceFqn: string;
let pipelineServiceFqn: string;
let topicFqn: string;
let pipelineFqn: string;

const LINEAGE_API = '/api/v1/lineage/getLineage?fqn=*';

test.describe('Lineage Pipeline Annotator', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    table = new TableClass();
    await table.create(apiContext);
    dbServiceFqn = table.serviceResponseData.fullyQualifiedName ?? '';

    const msName = `pw-kafka-${uuid()}`;
    const msResp = await apiContext
      .post('/api/v1/services/messagingServices', {
        data: {
          name: msName,
          serviceType: 'Kafka',
          connection: {
            config: { type: 'Kafka', bootstrapServers: 'localhost:9092' },
          },
        },
      })
      .then((r) => r.json());
    messagingServiceFqn = msResp.fullyQualifiedName;

    const topicResp = await apiContext
      .post('/api/v1/topics', {
        data: {
          name: `pw-topic-${uuid()}`,
          service: messagingServiceFqn,
          partitions: 1,
        },
      })
      .then((r) => r.json());
    topicFqn = topicResp.fullyQualifiedName;

    const psName = `pw-airflow-${uuid()}`;
    const psResp = await apiContext
      .post('/api/v1/services/pipelineServices', {
        data: {
          name: psName,
          serviceType: 'Airflow',
          connection: {
            config: {
              type: 'Airflow',
              hostPort: 'http://localhost:8080',
            },
          },
        },
      })
      .then((r) => r.json());
    pipelineServiceFqn = psResp.fullyQualifiedName;

    const pipelineResp = await apiContext
      .post('/api/v1/pipelines', {
        data: {
          name: `pw-pipeline-${uuid()}`,
          service: pipelineServiceFqn,
        },
      })
      .then((r) => r.json());
    pipelineFqn = pipelineResp.fullyQualifiedName;

    await apiContext.put('/api/v1/lineage', {
      data: {
        edge: {
          fromEntity: { id: table.entityResponseData.id, type: 'table' },
          toEntity: { id: topicResp.id, type: 'topic' },
          lineageDetails: {
            source: 'PipelineLineage',
            pipeline: { id: pipelineResp.id, type: 'pipeline' },
          },
        },
      },
    });

    await apiContext.dispose();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    await table.delete(apiContext);
    await apiContext.delete(
      `/api/v1/services/messagingServices/name/${encodeURIComponent(
        messagingServiceFqn
      )}?recursive=true&hardDelete=true`
    );
    await apiContext.delete(
      `/api/v1/services/pipelineServices/name/${encodeURIComponent(
        pipelineServiceFqn
      )}?recursive=true&hardDelete=true`
    );

    await apiContext.dispose();
    await page.close();
  });

  test('entity lineage does not include service nodes', async ({ page }) => {
    const tableFqn = table.entityResponseData.fullyQualifiedName ?? '';
    await page.goto(`/table/${encodeURIComponent(tableFqn)}`);

    const lineageResponsePromise = page.waitForResponse(LINEAGE_API);
    await page.click('[data-testid="lineage"]');
    const lineageResponse = await lineageResponsePromise;
    const lineageData = await lineageResponse.json();

    const nodeFqns = Object.keys(lineageData.nodes ?? {});

    expect(nodeFqns).not.toContain(dbServiceFqn);
    expect(nodeFqns).not.toContain(messagingServiceFqn);
    expect(nodeFqns).not.toContain(pipelineServiceFqn);
    expect(nodeFqns).toContain(topicFqn);
  });

  test('entity lineage edge preserves pipeline annotation', async ({
    page,
  }) => {
    const tableFqn = table.entityResponseData.fullyQualifiedName ?? '';
    await page.goto(`/table/${encodeURIComponent(tableFqn)}`);

    const lineageResponsePromise = page.waitForResponse(LINEAGE_API);
    await page.click('[data-testid="lineage"]');
    const lineageResponse = await lineageResponsePromise;
    const lineageData = await lineageResponse.json();

    const downstreamEdges = Object.values(lineageData.downstreamEdges ?? {});

    const hasPipelineAnnotation = downstreamEdges.some(
      (edge) => edge?.pipeline?.fullyQualifiedName === pipelineFqn
    );

    expect(hasPipelineAnnotation).toBe(true);
  });

  test('service lineage has pipeline service connected to both services', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    const response = await apiContext.get(
      `/api/v1/lineage/getLineage?fqn=${encodeURIComponent(
        pipelineServiceFqn
      )}&type=pipelineService&upstreamDepth=1&downstreamDepth=1`
    );

    expect(response.ok()).toBe(true);

    const data = await response.json();
    const nodeFqns = Object.keys(data.nodes ?? {});

    expect(nodeFqns).toContain(dbServiceFqn);
    expect(nodeFqns).toContain(messagingServiceFqn);

    await apiContext.dispose();
  });

  test('database service has pipeline service as downstream in service lineage', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    const token = await getToken(page);
    const apiContext = await getAuthContext(token);

    const response = await apiContext.get(
      `/api/v1/lineage/getLineage?fqn=${encodeURIComponent(
        dbServiceFqn
      )}&type=databaseService&upstreamDepth=0&downstreamDepth=1`
    );

    expect(response.ok()).toBe(true);

    const data = await response.json();
    const nodeFqns = Object.keys(data.nodes ?? {});

    expect(nodeFqns).toContain(pipelineServiceFqn);

    await apiContext.dispose();
  });
});
