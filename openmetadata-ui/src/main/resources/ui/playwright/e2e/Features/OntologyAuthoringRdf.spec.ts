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

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import {
  Category,
  CreateRelationshipType,
  PaletteKey,
} from '../../../src/generated/api/data/createRelationshipType';
import { RelationshipType } from '../../../src/generated/entity/data/relationshipType';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  navigateToOntologyExplorer,
  readGraphEdges,
  readGraphZoom,
  readNodePositions,
  releaseOntologyEditLease,
  waitForGraphLoaded,
} from '../../utils/ontologyExplorer';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_authoring_${suffix}`);
const relationshipTypeRequest: CreateRelationshipType = {
  category: Category.Custom,
  crossGlossaryAllowed: false,
  description: 'Playwright-governed provider relationship.',
  displayName: `Provides ${suffix}`,
  name: `provides${suffix}`,
  paletteKey: PaletteKey.Teal,
  rdfPredicate: `https://example.com/ontology/${suffix}/provides`,
};
let source: GlossaryTerm;
let target: GlossaryTerm;
let broaderTarget: GlossaryTerm;
let relationshipType: RelationshipType;

const isRelationshipType = (value: unknown): value is RelationshipType =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'name' in value &&
  value.name === relationshipTypeRequest.name;

const createRelationshipType = async (
  apiContext: APIRequestContext
): Promise<RelationshipType> => {
  const response = await apiContext.post('/api/v1/relationshipTypes', {
    data: relationshipTypeRequest,
  });
  const body: unknown = response.ok() ? await response.json() : undefined;

  expect(response.ok(), await response.text()).toBe(true);
  expect(isRelationshipType(body)).toBe(true);
  if (!isRelationshipType(body)) {
    throw new Error('Relationship type response is invalid');
  }

  return body;
};

interface CanvasPixel {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

const readRenderedPixels = async (
  page: Page,
  clientX: number,
  clientY: number
): Promise<CanvasPixel[]> => {
  const sampleSize = 3;
  const screenshot = await page.screenshot({
    clip: {
      height: sampleSize,
      width: sampleSize,
      x: Math.round(clientX) - 1,
      y: Math.round(clientY) - 1,
    },
  });
  const imageUrl = `data:image/png;base64,${screenshot.toString('base64')}`;

  return page.evaluate(
    async ({ imageUrl, sampleSize }) => {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.height = sampleSize;
      canvas.width = sampleSize;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to inspect the rendered graph pixels');
      }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
      const colors: CanvasPixel[] = [];

      for (let index = 0; index < pixels.length; index += 4) {
        colors.push({
          alpha: pixels[index + 3],
          blue: pixels[index + 2],
          green: pixels[index + 1],
          red: pixels[index],
        });
      }

      return colors;
    },
    { imageUrl, sampleSize }
  );
};

test.describe(
  'Ontology relationship authoring',
  { tag: ['@ontology-rdf'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await fixture.create(apiContext);
        source = await fixture.createTerm(apiContext, `AuthorSource${suffix}`);
        target = await fixture.createTerm(apiContext, `AuthorTarget${suffix}`);
        broaderTarget = await fixture.createTerm(
          apiContext,
          `BroaderTarget${suffix}`
        );
        relationshipType = await createRelationshipType(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await fixture.delete(apiContext);
        if (relationshipType?.id) {
          const response = await apiContext.delete(
            `/api/v1/relationshipTypes/${relationshipType.id}?hardDelete=true`
          );
          expect(response.ok(), await response.text()).toBe(true);
        }
      } finally {
        await afterAction();
      }
    });

    // TODO(ontology-tabs): the "Term" Edit sub-nav tab was removed; term editing now
    // happens through the Edit-Graph inline inspector (ontology-authoring-inspector).
    // Re-route this custom-relationship flow through node selection or delete it.
    test.fixme(
      'authors a custom relationship through the structured Term surface',
      async ({ browser }) => {
        test.slow();
        const { page, apiContext, afterAction } = await performAdminLogin(
          browser
        );

        try {
          await navigateToOntologyExplorer(page);
          await fixture.selectInStudio(page);
          await page.getByTestId('mode-tab-edit').click();
          await expect(
            page.getByTestId('ontology-edit-lease-status')
          ).toContainText('Active');
          await page.getByTestId('submode-tab-term').click();
          await expect(page.getByTestId('ontology-term-editor')).toBeVisible();

          await page
            .getByTestId('ontology-term-editor')
            .getByRole('button', { name: / Term$/ })
            .click();
          await page
            .getByRole('listbox', { name: 'Term', exact: true })
            .getByRole('option', { name: source.responseData.displayName })
            .click();
          await page
            .getByTestId(`term-editor-relation-${relationshipType.name}`)
            .click();
          await page
            .getByTestId('ontology-term-editor')
            .getByRole('button', { name: / Target term$/ })
            .click();
          await page
            .getByRole('listbox', { name: 'Target term' })
            .getByRole('option', { name: target.responseData.displayName })
            .click();

          const relationResponse = page.waitForResponse(
            (response) =>
              response
                .url()
                .endsWith(
                  `/api/v1/glossaryTerms/${source.responseData.id}/relations`
                ) && response.request().method() === 'POST'
          );
          await page.getByTestId('term-editor-add-relationship').click();
          expect((await relationResponse).ok()).toBe(true);

          await releaseOntologyEditLease(
            page,
            fixture.glossary.responseData.id
          );
          await fixture.expectRelationProjected(
            apiContext,
            source,
            relationshipTypeRequest.rdfPredicate,
            target
          );
          const versions = await apiContext.get(
            `/api/v1/glossaryTerms/${source.responseData.id}/versions`
          );
          expect(versions.ok()).toBe(true);
        } finally {
          await afterAction();
        }
      }
    );

    test('opens the design-matched inline inspector in Edit Graph mode', async ({
      browser,
    }) => {
      const { page, afterAction } = await performAdminLogin(browser);

      try {
        await navigateToOntologyExplorer(page);
        await fixture.selectInStudio(page);
        await page.getByTestId('mode-tab-edit').click();
        await expect(
          page.getByTestId('ontology-edit-lease-status')
        ).toContainText('Active');
        await waitForGraphLoaded(page);

        const positions = await readNodePositions(page);
        const sourcePosition = positions[source.responseData.id];
        expect(sourcePosition).toBeDefined();
        await page.mouse.click(sourcePosition.x, sourcePosition.y);

        const inspector = page.getByTestId('ontology-authoring-inspector');
        await expect(inspector).toBeVisible();
        await expect(inspector).toHaveCSS('width', '300px');
        await expect(inspector).toContainText(source.responseData.displayName);
        await expect(page.locator('.ontology-slideout-open')).toHaveCount(0);
        await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
      } finally {
        await afterAction();
      }
    });

    test('authors a core relationship from the graph port and renders its edge', async ({
      browser,
    }) => {
      test.slow();
      const { page, apiContext, afterAction } = await performAdminLogin(
        browser
      );

      try {
        await navigateToOntologyExplorer(page);
        await fixture.selectInStudio(page);
        await page.getByTestId('mode-tab-edit').click();
        await expect(
          page.getByTestId('ontology-edit-lease-status')
        ).toContainText('Active');
        await waitForGraphLoaded(page);

        const positions = await readNodePositions(page);
        const sourcePosition = positions[target.responseData.id];
        const targetPosition = positions[broaderTarget.responseData.id];
        expect(sourcePosition).toBeDefined();
        expect(targetPosition).toBeDefined();

        const graphZoom = await readGraphZoom(page);
        const portCenterX = sourcePosition.x + 75 * graphZoom;
        const portCenterY = sourcePosition.y;
        const centerPixels = await readRenderedPixels(
          page,
          portCenterX,
          portCenterY
        );
        const fillPixels = await readRenderedPixels(
          page,
          portCenterX + 5 * graphZoom,
          portCenterY + 5 * graphZoom
        );
        expect(
          centerPixels.some(
            ({ alpha, blue, green, red }) =>
              alpha > 240 && red > 220 && green > 220 && blue > 220
          )
        ).toBe(true);
        expect(
          fillPixels.some(
            ({ alpha, blue, green, red }) =>
              alpha > 240 && red < 80 && green > 70 && blue > 190
          )
        ).toBe(true);

        await page.mouse.click(portCenterX, portCenterY);
        await expect(
          page.getByTestId('ontology-connect-instruction')
        ).toBeVisible();
        await page.mouse.click(targetPosition.x, targetPosition.y);
        await expect(
          page.getByTestId('relationship-type-picker')
        ).toBeVisible();

        const relationResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(
                `/api/v1/glossaryTerms/${target.responseData.id}/relations`
              ) && response.request().method() === 'POST'
        );
        await page.getByTestId('relation-type-broader').click();
        expect((await relationResponse).ok()).toBe(true);

        await expect
          .poll(async () => {
            const edges = await readGraphEdges(page);

            return edges.some(
              (edge) =>
                edge.from === target.responseData.id &&
                edge.to === broaderTarget.responseData.id &&
                edge.relationType === 'broader'
            );
          })
          .toBe(true);
        await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
        await fixture.expectProjected(apiContext, broaderTarget);
      } finally {
        await afterAction();
      }
    });
  }
);
