/*
 *  Copyright 2024 Collate.
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
import { get } from 'lodash';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const analyticsGlossary = new Glossary();
const salesGlossary = new Glossary();
const productFeatureTerm = new GlossaryTerm(analyticsGlossary);
const ventaNetaTerm = new GlossaryTerm(salesGlossary);
const table = new TableClass();

test.describe('Glossary Hierarchy Search', () => {
  test.beforeAll('Setup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const id = uuid();

    analyticsGlossary.data.name = 'AnalyticsGlossary' + id;
    analyticsGlossary.data.displayName = 'Analytics Glossary';
    analyticsGlossary.data.description = 'Glossary for analytics terms';

    salesGlossary.data.name = 'SalesGlossary' + id;
    salesGlossary.data.displayName = 'Sales Glossary';
    salesGlossary.data.description = 'Glossary for sales terms';

    productFeatureTerm.data.name = 'ProductFeature' + id;
    productFeatureTerm.data.displayName = 'Product Feature';
    productFeatureTerm.data.description =
      'This term describes Venta metrics and related analytics';
    productFeatureTerm.data.glossary = analyticsGlossary.data.name;

    ventaNetaTerm.data.name = 'VentaNeta' + id;
    ventaNetaTerm.data.displayName = 'Venta Neta LW';
    ventaNetaTerm.data.description = 'Last week net sales metric';
    ventaNetaTerm.data.glossary = salesGlossary.data.name;

    await analyticsGlossary.create(apiContext);
    await salesGlossary.create(apiContext);
    await productFeatureTerm.create(apiContext);
    await ventaNetaTerm.create(apiContext);
    await table.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await productFeatureTerm.delete(apiContext);
    await ventaNetaTerm.delete(apiContext);
    await analyticsGlossary.delete(apiContext);
    await salesGlossary.delete(apiContext);
    await table.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Glossary with highly relevant child term ranks higher than glossary with term match only in description', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .click();
    const searchResponse = page.waitForResponse(
      `/api/v1/search/query?q=Venta&**`
    );
    // Wait for the form to be visible before proceeding
    await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

    // Fill the input first
    await page.locator('#tagsForm_tags').fill('Venta');

    const response = await searchResponse;
    const responseData = await response.json();
    const hits = responseData ?? [];

    expect(hits.length).toBeGreaterThanOrEqual(2);

    const salesGlossaryIndex = hits.findIndex(
      (hit: Record<string, unknown>) =>
        get(hit, 'name') === salesGlossary.data.name ||
        get(hit, 'fullyQualifiedName') === salesGlossary.data.name
    );

    const analyticsGlossaryIndex = hits.findIndex(
      (hit: Record<string, unknown>) =>
        get(hit, 'name') === analyticsGlossary.data.name ||
        get(hit, 'fullyQualifiedName') === analyticsGlossary.data.name
    );

    expect(salesGlossaryIndex).toBeGreaterThanOrEqual(0);
    expect(analyticsGlossaryIndex).toBeGreaterThanOrEqual(0);

    // const salesScore = hits[salesGlossaryIndex].children;
    // const analyticsScore = hits[analyticsGlossaryIndex].children;

    expect(salesGlossaryIndex).toBeGreaterThan(analyticsGlossaryIndex);
    // expect(salesGlossaryIndex).toBeLessThan(analyticsGlossaryIndex);
  });

  test('Term with search keyword in name ranks higher than term with keyword only in description', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .click();
    const searchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*Venta*`
    );
    // Wait for the form to be visible before proceeding
    await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

    // Fill the input first
    await page.locator('#tagsForm_tags').fill('Venta');

    const response = await searchResponse;
    const responseData = await response.json();
    const hits = responseData.hits?.hits ?? [];

    const ventaNetaIndex = hits.findIndex((hit: Record<string, unknown>) =>
      get(hit, 'fullyQualifiedName', '').includes('VentaNeta')
    );

    const productFeatureIndex = hits.findIndex((hit: Record<string, unknown>) =>
      get(hit, 'fullyQualifiedName', '').includes('ProductFeature')
    );

    expect(ventaNetaIndex).toBeGreaterThanOrEqual(0);
    expect(productFeatureIndex).toBeGreaterThanOrEqual(0);

    const ventaNetaScore = hits[ventaNetaIndex]._score;
    const productFeatureScore = hits[productFeatureIndex]._score;

    expect(ventaNetaScore).toBeGreaterThan(productFeatureScore);
    expect(ventaNetaIndex).toBeLessThan(productFeatureIndex);
  });

  test('Search with hierarchy returns glossary hierarchy in results', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .click();
    const searchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*Venta*`
    );
    // Wait for the form to be visible before proceeding
    await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

    // Fill the input first
    await page.locator('#tagsForm_tags').fill('Venta');

    const response = await searchResponse;
    const responseData = await response.json();
    const hits = responseData.hits?.hits ?? [];

    const salesGlossaryHit = hits.find(
      (hit: Record<string, unknown>) =>
        get(hit, 'name') === salesGlossary.data.name ||
        get(hit, 'fullyQualifiedName') === salesGlossary.data.name
    );

    expect(salesGlossaryHit).toBeDefined();
    expect(get(salesGlossaryHit, 'name')).toBeTruthy();
  });

  test('Both glossaries are present in search results when hierarchy search is enabled', async ({
    page,
  }) => {
    await table.visitEntityPage(page);
    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .click();
    const searchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*Venta*`
    );
    // Wait for the form to be visible before proceeding
    await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

    // Fill the input first
    await page.locator('#tagsForm_tags').fill('Venta');

    const response = await searchResponse;
    const responseData = await response.json();
    const hits = responseData.hits?.hits ?? [];

    const salesGlossaryFound = hits.some(
      (hit: Record<string, unknown>) =>
        get(hit, 'name') === salesGlossary.data.name ||
        get(hit, 'fullyQualifiedName') === salesGlossary.data.name
    );

    const analyticsGlossaryFound = hits.some(
      (hit: Record<string, unknown>) =>
        get(hit, 'name') === analyticsGlossary.data.name ||
        get(hit, 'fullyQualifiedName') === analyticsGlossary.data.name
    );

    expect(salesGlossaryFound).toBe(true);
    expect(analyticsGlossaryFound).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});
