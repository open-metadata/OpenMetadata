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
import { Page } from '@playwright/test';
import { readFile } from 'fs/promises';
import {
  AxiomType,
  CreateOntologyAxiom,
  ExpressionKind,
  Provenance,
} from '../../../src/generated/api/data/createOntologyAxiom';
import {
  FindingSeverity,
  LogicalCheck,
  OntologyReleaseValidation,
} from '../../../src/generated/api/data/ontologyReleaseValidation';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { Task } from '../../../src/generated/entity/tasks/task';
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

const approveAndActivate = async (
  page: Page,
  ontology: Ontology,
  release: OntologyRelease,
  tasks: string[]
) => {
  const api = await getWorkerAdminAPIContext();
  const task = await okJson<Task>(
    await api.post('/api/v1/tasks', {
      data: {
        name: `Review ${release.fullyQualifiedName}`,
        category: 'Approval',
        type: 'RequestApproval',
        about: `<#E::ontologyRelease::${release.fullyQualifiedName}>`,
      },
    }),
    'Submit release review'
  );
  tasks.push(task.id);
  await expect
    .poll(async () => {
      const ready = await okJson<Task>(
        await api.get(`/api/v1/tasks/${task.id}`),
        'Read release review'
      );

      return ready.availableTransitions?.length;
    })
    .toBe(2);
  await page.goto(`/tasks/${task.id}`);
  const approved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/tasks/${task.id}/resolve` &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('task-approve').click();
  expect((await approved).ok()).toBeTruthy();
  await expect(page.getByTestId('task-status-badge')).toHaveText('Approved');
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology state'
  );
  const activated = await okJson<OntologyState>(
    await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
      data: {
        releaseId: release.id,
        expectedActivationRevision: state.activationRevision,
      },
    }),
    'Activate release'
  );
  expect(activated.activeReleaseId).toBe(release.id);
};

const openExport = async (page: Page, ontology: Ontology) => {
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
      isolatedUser: reviewer,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const tasks: string[] = [];
      const name = `pw_native_export_${uuid()}`;
      const namespace = `https://example.org/${name}#`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name,
            iri: `https://example.org/${name}`,
            namespace,
            reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
          },
        }),
        'Create export ontology'
      );
      const other = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: {
            name: `${name}_other`,
            iri: `https://example.org/${name}_other`,
            namespace: `https://example.org/${name}_other#`,
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
                iri: `${owner.namespace}${conceptName}`,
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
              displayName: 'Customer is a Party',
              description: 'Every customer is a party.',
              ontology: ontology.name,
              axiomType: AxiomType.SubclassOf,
              subjectIri: customer.iri,
              provenance: Provenance.Manual,
              expressions: [
                { kind: ExpressionKind.NamedClass, classIri: party.iri },
              ],
            } satisfies CreateOntologyAxiom,
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
        await approveAndActivate(page, ontology, release, tasks);
        await openExport(page, ontology);

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

        await test.step('A gated download of the valid release completes', async () => {
          await page.getByTestId('ontology-export-shacl-gate').click();
          const fetched = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === exportPath(release) &&
              new URL(response.url()).searchParams.get('shaclGate') === 'true'
          );
          const downloaded = page.waitForEvent('download');
          await clickIgnoringToasts(
            page.getByTestId('ontology-run-release-export')
          );
          expect((await fetched).ok()).toBeTruthy();
          expect((await downloaded).suggestedFilename()).toBe(
            `${name}-release-${release.releaseRevision}.rdf`
          );
          await page.getByTestId('ontology-import-export-trigger').click();
        });

        await test.step('SKOS-XL gives every label its own node', async () => {
          await page.getByTestId('ontology-release-format-skos').click();
          await page.getByTestId('ontology-export-skos-xl').click();
          const preview = page.getByTestId('ontology-release-export-preview');
          await expect(preview).toContainText('skosxl:Label');
          await expect(preview).toContainText('Client');
        });

        await test.step('The gate blocks the download while the stubbed report has a violation', async () => {
          const report: OntologyReleaseValidation = {
            releaseId: release.id,
            contentDigest: release.contentDigest,
            valid: false,
            logicalCheck: LogicalCheck.NotRun,
            deprecationImpacts: [],
            shacl: {
              violationCount: 1,
              warningCount: 0,
              truncated: false,
              findings: [
                {
                  severity: FindingSeverity.Violation,
                  message: 'Concept needs a label',
                  focusIri: customer.iri,
                  shapeIri: `${customer.iri}Shape`,
                },
              ],
            },
            structure: {
              releaseId: release.id,
              contentDigest: release.contentDigest,
              valid: true,
              violationCount: 0,
              violations: [],
            },
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
        for (const id of tasks) {
          await deleteFixtureEntity(api, `/api/v1/tasks/${id}?hardDelete=true`);
        }
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
