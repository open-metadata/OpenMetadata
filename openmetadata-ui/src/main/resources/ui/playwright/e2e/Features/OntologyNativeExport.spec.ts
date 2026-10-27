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
import { readFile } from 'fs/promises';
import { Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

const EXPORT_CARDS = [
  { card: 'rdfxml', extension: 'rdf', marker: 'rdf:RDF' },
  { card: 'skos', extension: 'ttl', marker: 'skos:broader' },
  { card: 'jsonld', extension: 'jsonld', marker: '@id' },
  { card: 'csv', extension: 'csv', marker: 'CONCEPT' },
] as const;

const exportPath = (release: OntologyRelease) =>
  `/api/v1/ontologyReleases/${release.id}/export`;

const openExport = async (page: Page, ontology: Ontology, active: string) => {
  const state = await page.request.get(
    `/api/v1/ontologies/${ontology.id}/state`
  );
  const current = await okJson<OntologyState>(state, 'Read ontology state');
  await page.route(`**/api/v1/ontologies/${ontology.id}/state`, (route) =>
    route.fulfill({ json: { ...current, activeReleaseId: active } })
  );
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-import-export-trigger').click();
  await expect(
    page.getByTestId('ontology-release-export-preview')
  ).toBeVisible();
};

test.describe(
  'Native ontology release export',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('downloads every format of the current ontology release, then gates on SHACL', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_export_${uuid()}`;
      const namespace = `urn:${name}:`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `urn:${name}`, namespace },
        }),
        'Create export ontology'
      );
      const other = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name: `${name}_other`,
            iri: `urn:${name}_other`,
            namespace: `urn:${name}_other:`,
          },
        }),
        'Create unrelated ontology'
      );
      try {
        const concept = async (conceptName: string, owner: Ontology) =>
          okJson<OntologyConcept>(
            await api.post('/api/v1/ontologyConcepts', {
              data: {
                name: conceptName,
                ontology: owner.fullyQualifiedName,
                iri: `${
                  owner.id === ontology.id ? namespace : `urn:${name}_other:`
                }${conceptName}`,
                conceptType: 'OWL_CLASS',
                synonyms: conceptName === 'Customer' ? ['Client'] : [],
              },
            }),
            `Create ${conceptName}`
          );
        const customer = await concept('Customer', ontology);
        const party = await concept('Party', ontology);
        await concept('Stranger', other);
        await okJson(
          await api.post('/api/v1/ontologyAxioms', {
            data: {
              name: 'customer-is-party',
              ontology: ontology.fullyQualifiedName,
              axiomType: 'SUBCLASS_OF',
              subjectIri: customer.iri,
              provenance: 'MANUAL',
              expressions: [{ kind: 'NAMED_CLASS', classIri: party.iri }],
            },
          }),
          'Create parent axiom'
        );
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read ontology revision'
        );
        const release = await okJson<OntologyRelease>(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: { expectedWorkingRevision: state.workingRevision },
          }),
          'Capture release'
        );
        await openExport(page, ontology, release.id);

        for (const { card, extension, marker } of EXPORT_CARDS) {
          await test.step(`Download ${card}`, async () => {
            if (card !== 'rdfxml') {
              await page.getByTestId(`ontology-release-format-${card}`).click();
            }
            const fetched = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === exportPath(release) &&
                new URL(response.url()).searchParams.get('format') === card &&
                new URL(response.url()).searchParams.get('shaclGate') ===
                  'false'
            );
            const downloaded = page.waitForEvent('download');
            await clickIgnoringToasts(
              page.getByTestId('ontology-run-release-export')
            );
            const response = await fetched;
            expect(response.ok()).toBeTruthy();
            const download = await downloaded;
            expect(download.suggestedFilename()).toBe(
              `${name}-release-${release.releaseRevision}.${extension}`
            );
            const path = testInfo.outputPath(download.suggestedFilename());
            await download.saveAs(path);
            const content = await readFile(path, 'utf8');
            expect(content).toContain(marker);
            expect(content).toContain(customer.iri);
            expect(content).not.toContain('Stranger');
            await page.getByTestId('ontology-import-export-trigger').click();
          });
        }

        await test.step('SKOS-XL gives every label its own node', async () => {
          await page.getByTestId('ontology-release-format-skos').click();
          await page.getByTestId('ontology-export-skos-xl').click();
          const preview = page.getByTestId('ontology-release-export-preview');
          await expect(preview).toContainText('skosxl:Label');
          await expect(preview).toContainText('Client');
        });

        await test.step('The gate blocks the download while the report has a violation', async () => {
          const report = {
            valid: false,
            shacl: {
              violationCount: 1,
              findings: [
                {
                  severity: 'Violation',
                  message: 'Concept needs a label',
                  focusIri: customer.iri,
                },
              ],
            },
            structure: { valid: true, violationCount: 0 },
          };
          await page.route(
            `**/api/v1/ontologyReleases/${release.id}/validation`,
            (route) => route.fulfill({ json: report })
          );
          await page.getByTestId('ontology-export-shacl-gate').click();
          await page.getByTestId('ontology-run-export-shacl').click();
          await expect(
            page.getByTestId('ontology-export-shacl-status')
          ).toHaveText('SHACL: 1 violation');
          await expect(
            page.getByTestId('ontology-export-shacl-findings')
          ).toContainText(customer.iri);
          await expect(
            page.getByTestId('ontology-run-release-export')
          ).toBeDisabled();
          await page.getByTestId('ontology-export-shacl-gate').click();
          await expect(
            page.getByTestId('ontology-run-release-export')
          ).toBeEnabled();
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${other.id}?recursive=true`
        );
      }
    });
  }
);
