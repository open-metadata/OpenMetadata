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

import { randomUUID } from 'crypto';
import { OntologyBulkSubmission } from '../../../src/generated/api/data/ontologyBulkSubmission';
import { OntologyImpactReport } from '../../../src/generated/api/data/ontologyImpactReport';
import { OntologyImportResult } from '../../../src/generated/api/data/ontologyImportResult';
import { expect, test } from '../../support/fixtures/base';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  navigateToOntologyStudio,
  releaseOntologyEditLease,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

const bulkGlossary = new Glossary();
const suffix = uuid().replaceAll('-', '');
const governanceFixture = new OntologyRdfFixture(`pw_governance_${suffix}`);
let impactParent: GlossaryTerm;
let impactChild: GlossaryTerm;

const INVALID_SHACL_ONTOLOGY = `
@prefix om: <https://open-metadata.org/ontology/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<https://example.com/ontology/BrokenTerm>
  a om:GlossaryTerm ;
  rdfs:label "Broken term" ;
  om:fullyQualifiedName "Broken.Term" .
`;

const isBulkSubmission = (value: unknown): value is OntologyBulkSubmission =>
  typeof value === 'object' &&
  value !== null &&
  'executionMode' in value &&
  value.executionMode === 'SYNCHRONOUS' &&
  'result' in value &&
  typeof value.result === 'object' &&
  value.result !== null;

const isImportResult = (value: unknown): value is OntologyImportResult =>
  typeof value === 'object' &&
  value !== null &&
  'validationReport' in value &&
  typeof value.validationReport === 'object' &&
  value.validationReport !== null &&
  'termsCreated' in value &&
  typeof value.termsCreated === 'number';

const isImpactReport = (value: unknown): value is OntologyImpactReport =>
  typeof value === 'object' &&
  value !== null &&
  'children' in value &&
  Array.isArray(value.children) &&
  'impactToken' in value &&
  typeof value.impactToken === 'string';

test.describe(
  'Ontology governance and bulk authoring',
  { tag: ['@ontology-rdf'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await bulkGlossary.create(apiContext);
        await governanceFixture.create(apiContext);
        impactParent = await governanceFixture.createTerm(
          apiContext,
          `ImpactParent${suffix}`
        );
        impactChild = await governanceFixture.createTerm(
          apiContext,
          `ImpactChild${suffix}`,
          impactParent
        );
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await bulkGlossary.delete(apiContext);
        await governanceFixture.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    // TODO(ontology-tabs): the "Bulk Edit" Edit sub-nav tab (CSV bulk authoring) was
    // removed from the Ontology Studio. Restore the entry point or delete this test.
    test.fixme(
      'downloads the QTT template and validates CSV without persisting terms',
      async ({ browser }) => {
        const { page, apiContext, afterAction } = await performAdminLogin(
          browser,
          { navigate: true }
        );
        const termId = randomUUID();
        const termName = `BulkCustomer${termId.replaceAll('-', '')}`;
        const csv =
          'action,termId,name,displayName,description,parentId,iri\n' +
          `CREATE,${termId},${termName},Bulk Customer,Bulk customer concept,,`;

        try {
          await navigateToOntologyStudio(page);
          await page.getByTestId('ontology-scope-menu-trigger').click();
          await page
            .getByRole('menuitemradio')
            .filter({ hasText: bulkGlossary.responseData.displayName })
            .click();
          await page.getByTestId('mode-tab-edit').click();
          await expect(
            page.getByTestId('ontology-edit-lease-status')
          ).toContainText('Active');
          await page.getByTestId('submode-tab-bulk').click();
          await expect(
            page.getByTestId('ontology-bulk-authoring')
          ).toBeVisible();

          const [templateDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.getByTestId('ontology-bulk-download-template').click(),
          ]);
          expect(templateDownload.suggestedFilename()).toBe(
            'ontology-bulk-template.csv'
          );

          await page.getByRole('textbox', { name: 'CSV' }).fill(csv);
          const submissionResponsePromise = page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/v1/ontology/bulk') &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('ontology-bulk-submit').click();
          const submissionResponse = await submissionResponsePromise;
          const submissionBody: unknown = await submissionResponse.json();

          expect(submissionResponse.ok()).toBeTruthy();
          expect(isBulkSubmission(submissionBody)).toBeTruthy();
          if (!isBulkSubmission(submissionBody)) {
            throw new Error('Ontology bulk submission response is not valid');
          }

          expect(submissionBody.result?.dryRun).toBe(true);
          expect(submissionBody.result?.totalRows).toBe(1);
          expect(submissionBody.result?.validRows).toBe(1);
          expect(submissionBody.result?.invalidRows).toBe(0);
          expect(submissionBody.result?.changeSet).toBeUndefined();
          await expect(page.getByTestId('ontology-bulk-result')).toContainText(
            'Valid'
          );

          const termResponse = await apiContext.get(
            `/api/v1/glossaryTerms/${termId}`
          );
          expect(termResponse.status()).toBe(404);
          await releaseOntologyEditLease(page, bulkGlossary.responseData.id);
        } finally {
          await afterAction();
        }
      }
    );

    test('reports bounded SHACL violations during an RDF import dry run', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const glossaryName = encodeURIComponent(bulkGlossary.responseData.name);

      try {
        const response = await apiContext.put(
          `/api/v1/glossaries/name/${glossaryName}/importRdf?format=turtle&dryRun=true`,
          {
            data: INVALID_SHACL_ONTOLOGY,
            headers: { 'Content-Type': 'text/turtle' },
          }
        );
        const body: unknown = response.ok() ? await response.json() : undefined;

        expect(response.ok(), await response.text()).toBe(true);
        expect(isImportResult(body)).toBe(true);
        if (!isImportResult(body)) {
          throw new Error('Ontology SHACL dry-run response is invalid');
        }

        expect(body.dryRun).toBe(true);
        expect(body.validationReport.performed).toBe(true);
        expect(body.validationReport.conforms).toBe(false);
        expect(body.validationReport.violationCount).toBeGreaterThan(0);
        expect(body.validationReport.violations.length).toBeGreaterThan(0);
      } finally {
        await afterAction();
      }
    });

    test('rejects ontology configuration on a glossary', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        const response = await apiContext.patch(
          `/api/v1/glossaries/${bulkGlossary.responseData.id}`,
          {
            data: [
              {
                op: 'add',
                path: '/ontologyConfiguration',
                value: { layer: 'L3' },
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(response.status(), await response.text()).toBe(400);
        const glossary = await apiContext.get(
          `/api/v1/glossaries/${bulkGlossary.responseData.id}`
        );
        expect(glossary.ok(), await glossary.text()).toBe(true);
        expect(await glossary.json()).not.toHaveProperty(
          'ontologyConfiguration'
        );
      } finally {
        await afterAction();
      }
    });

    // TODO(ontology-tabs): reached via the removed "Term" Edit tab; re-route the delete-impact
    // preview through the Edit-Graph inline inspector (ontology-authoring-inspector).
    test.fixme(
      'previews a version-bound delete impact before enabling a destructive decision',
      async ({ browser }) => {
        const { page, afterAction } = await performAdminLogin(browser, {
          navigate: true,
        });

        try {
          await navigateToOntologyStudio(page);
          await governanceFixture.selectInStudio(page);
          await waitForGraphLoaded(page);
          await page.getByTestId('mode-tab-edit').click();
          await expect(
            page.getByTestId('ontology-edit-lease-status')
          ).toContainText('Active');
          await page.getByTestId('submode-tab-term').click();
          await page
            .getByTestId('ontology-term-editor')
            .getByRole('button', { name: / Term$/ })
            .click();
          await page
            .getByRole('listbox', { name: 'Term', exact: true })
            .getByRole('option', {
              name: impactParent.responseData.displayName,
            })
            .click();
          await expect(
            page.getByTestId('ontology-term-editor').getByRole('heading', {
              name: impactParent.responseData.displayName,
            })
          ).toBeVisible();

          const impactResponsePromise = page.waitForResponse(
            (response) =>
              response
                .url()
                .includes(
                  `/api/v1/ontology/impacts/glossaryTerms/${impactParent.responseData.id}/delete`
                ) && response.request().method() === 'GET'
          );
          await page.getByTestId('delete-impact-preview').click();
          const impactResponse = await impactResponsePromise;
          const impactBody: unknown = impactResponse.ok()
            ? await impactResponse.json()
            : undefined;

          expect(impactResponse.ok(), await impactResponse.text()).toBe(true);
          expect(isImpactReport(impactBody)).toBe(true);
          if (!isImpactReport(impactBody)) {
            throw new Error('Ontology delete impact response is invalid');
          }

          expect(impactBody.children.map((child) => child.id)).toContain(
            impactChild.responseData.id
          );
          await expect(
            page.getByTestId('delete-impact-confirm')
          ).toBeDisabled();
          await expect(page.getByTestId('delete-impact-cascade')).toBeVisible();
          await releaseOntologyEditLease(
            page,
            governanceFixture.glossary.responseData.id
          );
        } finally {
          await afterAction();
        }
      }
    );
  }
);
