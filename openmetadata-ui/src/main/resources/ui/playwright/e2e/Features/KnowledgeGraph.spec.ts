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

import test, { expect, Page } from '@playwright/test';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Knowledge Graph', { tag: ['@knowledge-graph'] }, () => {
  let table: TableClass;

  const renderedPixelCount = async (page: Page): Promise<number> => {
    const canvas = page.getByTestId('knowledge-graph-3d').locator('canvas');

    return canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        return 0;
      }

      const context =
        element.getContext('webgl2') ?? element.getContext('webgl');
      if (!context || context.isContextLost()) {
        return 0;
      }

      const pixels = new Uint8Array(
        context.drawingBufferWidth * context.drawingBufferHeight * 4
      );
      context.readPixels(
        0,
        0,
        context.drawingBufferWidth,
        context.drawingBufferHeight,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels
      );

      let count = 0;
      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] > 0) {
          count += 1;
        }
      }

      return count;
    });
  };

  const expectRendererHealthy = async (
    page: Page,
    pageErrors: string[]
  ): Promise<void> => {
    const canvas = page.getByTestId('knowledge-graph-3d').locator('canvas');

    await expect(canvas).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );

    expect(
      pageErrors,
      `Knowledge Graph emitted page errors:\n${pageErrors.join('\n')}`
    ).toEqual([]);
    await expect
      .poll(() => renderedPixelCount(page), {
        message: 'Knowledge Graph should render non-transparent pixels',
        timeout: 15_000,
      })
      .toBeGreaterThan(0);

    expect(
      pageErrors,
      `Knowledge Graph emitted page errors:\n${pageErrors.join('\n')}`
    ).toEqual([]);
  };

  const openKnowledgeGraph = async (
    page: Page,
    focusTable = table
  ): Promise<string[]> => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) =>
      pageErrors.push(error.stack ?? error.message)
    );

    const graphResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response
          .url()
          .includes(`entityId=${focusTable.entityResponseData.id}`) &&
        response.url().includes('depth=1')
    );

    await page.goto(
      `/table/${getEncodedFqn(
        focusTable.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );

    const response = await graphResponse;

    expect(response.status()).toBe(200);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('knowledge-graph-3d-controls')).toBeVisible();
    await expect(page.getByTestId('knowledge-graph-3d-node-count')).toHaveText(
      /[1-9]\d* nodes/
    );
    await expectRendererHealthy(page, pageErrors);

    return pageErrors;
  };

  const selectDepth = async (
    page: Page,
    depth: number,
    focusTable = table
  ): Promise<void> => {
    const depthResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response
          .url()
          .includes(`entityId=${focusTable.entityResponseData.id}`) &&
        response.url().includes(`depth=${depth}`)
    );

    await page.getByTestId('kg3d-depth-control').getByRole('button').click();
    await page
      .getByRole('option', { name: String(depth), exact: true })
      .click();

    const response = await depthResponse;

    expect(response.url()).toContain(`depth=${depth}`);
    expect(response.status()).toBe(200);

    await waitForAllLoadersToDisappear(page);
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    table = new TableClass();

    await table.create(apiContext);
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: EntityDataClass.user1.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: EntityDataClass.domain1.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain1.responseData.name,
            displayName: EntityDataClass.domain1.responseData.displayName,
          },
        },
      ],
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('Verify the knowledge graph tab loads and fetches depth-1 graph data', async ({
    page,
  }) => {
    await openKnowledgeGraph(page);

    await expect(page.getByTestId('knowledge-graph-3d')).toBeVisible();
    await expect(page.getByTestId('knowledge-graph-3d-controls')).toBeVisible();
    await expect(page.getByTestId('knowledge-graph-3d-node-count')).toHaveText(
      /\d+ nodes/
    );
  });

  test('Verify changing the depth refetches the graph at the new depth', async ({
    page,
  }) => {
    const pageErrors = await openKnowledgeGraph(page);

    await selectDepth(page, 2);
    await expectRendererHealthy(page, pageErrors);
  });

  test('Verify the relationship lens can be switched to Ontology', async ({
    browser,
    page,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const ontologyTable = new TableClass();
    const relatedTable = new TableClass();

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await ontologyTable.create(apiContext);
      await relatedTable.create(apiContext);

      const glossaryTag = {
        tagFQN: glossaryTerm.responseData.fullyQualifiedName,
        labelType: 'Manual',
        state: 'Confirmed',
        source: 'Glossary',
      };
      await ontologyTable.patch({
        apiContext,
        patchData: [{ op: 'add', path: '/tags/-', value: glossaryTag }],
      });
      await relatedTable.patch({
        apiContext,
        patchData: [{ op: 'add', path: '/tags/-', value: glossaryTag }],
      });

      await expect(async () => {
        const response = await apiContext.post('/api/v1/rdf/sparql', {
          data: {
            query: `
              PREFIX om: <https://open-metadata.org/ontology/>
              ASK {
                GRAPH ?g {
                  <https://open-metadata.org/entity/table/${ontologyTable.entityResponseData.id}> om:hasGlossaryTerm <https://open-metadata.org/entity/glossaryTerm/${glossaryTerm.responseData.id}> .
                  <https://open-metadata.org/entity/table/${relatedTable.entityResponseData.id}> om:hasGlossaryTerm <https://open-metadata.org/entity/glossaryTerm/${glossaryTerm.responseData.id}> .
                }
              }
            `,
            format: 'json',
          },
        });
        const result = (await response.json()) as { boolean?: boolean };

        expect(response.ok()).toBe(true);
        expect(result.boolean).toBe(true);
      }).toPass({ intervals: [500, 1_000], timeout: 30_000 });

      const pageErrors = await openKnowledgeGraph(page, ontologyTable);
      await selectDepth(page, 2, ontologyTable);

      const controls = page.getByTestId('knowledge-graph-3d-controls');

      await controls.getByText('Ontology', { exact: true }).click();

      await expect(
        page.getByTestId('knowledge-graph-3d-caption-desc')
      ).toContainText('blueprint');
      await expect(
        page.getByTestId('knowledge-graph-3d-node-count')
      ).toHaveText(/[1-9]\d* linked assets · [1-9]\d* derived relationships/);
      await expectRendererHealthy(page, pageErrors);
    } finally {
      await Promise.allSettled([
        ontologyTable.delete(apiContext),
        relatedTable.delete(apiContext),
        glossary.delete(apiContext),
      ]);
      await afterAction();
    }
  });

  test('Verify the graph can be expanded to fullscreen and restored', async ({
    page,
  }) => {
    const pageErrors = await openKnowledgeGraph(page);

    const container = page.getByTestId('knowledge-graph-3d');

    await expect(container).not.toHaveClass(/full-screen-knowledge-graph-3d/);

    await page.getByTestId('full-screen').click();

    await expect(container).toHaveClass(/full-screen-knowledge-graph-3d/);
    await expect(page.getByTestId('exit-full-screen')).toBeVisible();

    await page.getByTestId('exit-full-screen').click();

    await expect(container).not.toHaveClass(/full-screen-knowledge-graph-3d/);
    await expect(page.getByTestId('full-screen')).toBeVisible();
    await expectRendererHealthy(page, pageErrors);
  });

  test('Verify reset-view and export controls are available once the graph loads', async ({
    page,
  }) => {
    const pageErrors = await openKnowledgeGraph(page);

    const controls = page.getByTestId('knowledge-graph-3d-controls');

    await expect(
      controls.getByRole('button', { name: 'Reset view' })
    ).toBeEnabled();
    await expect(
      controls.getByRole('button', { name: 'Export' })
    ).toBeEnabled();

    await controls.getByRole('button', { name: 'Reset view' }).click();
    await expectRendererHealthy(page, pageErrors);
  });

  test('Verify switching the level updates the caption to the domain view', async ({
    page,
  }) => {
    const pageErrors = await openKnowledgeGraph(page);

    const controls = page.getByTestId('knowledge-graph-3d-controls');

    // Changing the level is a client-side roll-up; the caption description swaps
    // to the domain-level copy. Independent of the WebGL scene.
    await controls.getByText('Domain', { exact: true }).click();

    await expect(
      page.getByTestId('knowledge-graph-3d-caption-desc')
    ).toContainText('Domains and how they relate');
    await expectRendererHealthy(page, pageErrors);
  });
});
