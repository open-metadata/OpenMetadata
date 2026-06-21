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
import { Glossary } from '../../support/glossary/Glossary';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';

// Runs only in the RDF-enabled "Ontology RDF" Playwright project (Fuseki up,
// RDF_ENABLED=true). The import works without RDF, but the export round-trip
// assertion below only holds when the triplestore is enabled.
const HCP_IRI = 'http://example.com/ontology/hcp#HealthcareProvider';

const ONTOLOGY = `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix hcp:  <http://example.com/ontology/hcp#> .
@prefix sct:  <http://snomed.info/id/> .

hcp:HealthcareProvider a skos:Concept ;
    skos:prefLabel "Healthcare Provider" ;
    skos:definition "A person who delivers care." ;
    skos:altLabel "HCP" ;
    skos:closeMatch sct:158965000 .

hcp:Physician a owl:Class ;
    skos:prefLabel "Physician" ;
    rdfs:subClassOf hcp:HealthcareProvider ;
    hcp:prescribes hcp:Drug .

hcp:Drug a skos:Concept ;
    skos:prefLabel "Drug" .

hcp:prescribes a owl:ObjectProperty ;
    rdfs:label "prescribes" .
`;

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Ontology RDF Import', { tag: ['@ontology-rdf'] }, () => {
  const glossary = new Glossary();
  const consumerUser = new UserClass();

  test.beforeAll('Seed glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.create(apiContext);
    await consumerUser.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup glossary', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await consumerUser.delete(apiContext);
    await afterAction();
  });

  test('imports an OWL/SKOS ontology from the manage menu and round-trips through the RDF backend', async ({
    page,
    browser,
  }) => {
    await redirectToHomePage(page);
    await glossary.visitPage(page);

    await page.getByTestId('manage-button').click();
    await page.getByText('Import Ontology').click();

    await expect(page.getByTestId('upload-ontology-dragger')).toBeVisible();

    await page
      .locator('[data-testid="upload-ontology-dragger"] input[type="file"]')
      .setInputFiles({
        name: 'hcp.ttl',
        mimeType: 'text/turtle',
        buffer: Buffer.from(ONTOLOGY),
      });

    // Dry-run validation runs automatically and reports the parsed counts.
    await expect(page.getByTestId('ontology-validation-summary')).toBeVisible();

    await page.getByTestId('import-ontology-submit').click();

    // The modal closes once the import commits.
    await expect(page.getByTestId('upload-ontology-dragger')).not.toBeVisible();

    // The imported concept shows up in the glossary term tree.
    await expect(page.getByText('Healthcare Provider').first()).toBeVisible();

    // RDF round-trip: with the triplestore enabled, exporting the glossary as an
    // ontology reproduces the canonical concept IRI we imported.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const response = await apiContext.get(
      `/api/v1/rdf/glossary/${glossary.responseData.id}/export?format=turtle`
    );

    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain(HCP_IRI);

    await afterAction();
  });

  test('hides Import Ontology from a user without glossary edit permission', async ({
    browser,
  }) => {
    const userPage = await browser.newPage();
    await consumerUser.login(userPage);
    await redirectToHomePage(userPage);

    // A read-only data consumer can open the glossary (visitPage asserts the
    // header is rendered), but the Import Ontology action is gated behind the
    // same edit permission as CSV import/export and must not be reachable.
    await glossary.visitPage(userPage);

    const manageButton = userPage.getByTestId('manage-button');
    if (await manageButton.isVisible().catch(() => false)) {
      await manageButton.click();
    }

    await expect(userPage.getByText('Import Ontology')).toBeHidden();

    await userPage.close();
  });
});
