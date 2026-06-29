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
import { createNewPage } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

// The Knowledge Graph tab is a WebGL (react-force-graph-3d) scene, so the graph
// nodes/edges are drawn on a canvas and are not addressable in the DOM. These
// E2E tests therefore exercise what IS observable in the DOM and independent of
// WebGL availability (the controls toolbar and caption render above the scene,
// outside its error boundary): the RDF /graph/explore integration (initial +
// depth changes), the level/relationship-lens controls, and the reset/export
// buttons. Node selection and panel rendering are covered by the component's
// Jest tests.
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Knowledge Graph', { tag: ['@knowledge-graph'] }, () => {
  let table: TableClass;

  const openKnowledgeGraph = async (page: Page): Promise<void> => {
    const graphResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes(`entityId=${table.entityResponseData.id}`) &&
        response.url().includes('depth=1')
    );

    await page.goto(
      `/table/${getEncodedFqn(
        table.entityResponseData.fullyQualifiedName ?? ''
      )}/knowledge_graph`
    );

    const response = await graphResponse;

    expect(response.status()).toBe(200);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('knowledge-graph-3d-controls')).toBeVisible();
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
    await openKnowledgeGraph(page);

    const depth2Response = page.waitForResponse(
      (response) =>
        response.url().includes('/rdf/graph/explore') &&
        response.url().includes('depth=2')
    );

    // The depth control is an Untitled-UI Select: click its trigger to open the
    // listbox, then pick option "2".
    await page.getByTestId('kg3d-depth-control').getByRole('button').click();
    await page.getByRole('option', { name: '2', exact: true }).click();

    const response = await depth2Response;

    expect(response.url()).toContain('depth=2');
    expect(response.status()).toBe(200);

    await waitForAllLoadersToDisappear(page);
  });

  test('Verify the relationship lens can be switched to Ontology', async ({
    page,
  }) => {
    await openKnowledgeGraph(page);

    const controls = page.getByTestId('knowledge-graph-3d-controls');

    // Switching the lens is a client-side filter; the caption description picks
    // up the ontology suffix. This does not depend on the WebGL scene.
    await controls.getByText('Ontology', { exact: true }).click();

    await expect(
      page.getByTestId('knowledge-graph-3d-caption-desc')
    ).toContainText('ontology relations');
  });

  test('Verify reset-view and export controls are available once the graph loads', async ({
    page,
  }) => {
    await openKnowledgeGraph(page);

    const controls = page.getByTestId('knowledge-graph-3d-controls');

    await expect(
      controls.getByRole('button', { name: 'Reset view' })
    ).toBeEnabled();
    await expect(
      controls.getByRole('button', { name: 'Export' })
    ).toBeEnabled();
  });

  test('Verify switching the level updates the caption to the domain view', async ({
    page,
  }) => {
    await openKnowledgeGraph(page);

    const controls = page.getByTestId('knowledge-graph-3d-controls');

    // Changing the level is a client-side roll-up; the caption description swaps
    // to the domain-level copy. Independent of the WebGL scene.
    await controls.getByText('Domain', { exact: true }).click();

    await expect(
      page.getByTestId('knowledge-graph-3d-caption-desc')
    ).toContainText('Domains and how they relate');
  });
});
