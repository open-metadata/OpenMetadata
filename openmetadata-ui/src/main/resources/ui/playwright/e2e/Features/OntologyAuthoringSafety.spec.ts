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

import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  scrollIntoViewAndSettle,
  uuid,
} from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });
test.describe(
  'Native ontology authoring safeguards',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const [mode, theme] of [
      ['classic', 'light'],
      ['ai', 'light'],
      ['ai', 'dark'],
    ]) {
      test(`preserves drafts, selects class IRIs, and exposes publication review in ${mode} ${theme} mode`, async ({
        isolatedUserPage: page,
        isolatedUser: user,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const name = 'pw_authoring_safety_' + uuid();
        const owner = await okJson<Ontology>(
          await api.post('/api/v1/ontologies', {
            data: { name, iri: 'urn:' + name, namespace: 'urn:' + name + ':' },
          }),
          'Create safeguard ontology'
        );
        try {
          await page.addInitScript((theme) => {
            localStorage.setItem('ui-theme', theme);
          }, theme);
          await okJson(
            await api.put(
              '/api/v1/users/' + user.responseData.id + '/preferences/appMode',
              { data: { type: 'appMode', config: { value: mode } } }
            ),
            'Set own app mode'
          );
          const concepts: OntologyConcept[] = [];
          for (const name of ['Customer', 'Person']) {
            concepts.push(
              await okJson<OntologyConcept>(
                await api.post('/api/v1/ontologyConcepts', {
                  data: {
                    name,
                    displayName: name,
                    ontology: owner.fullyQualifiedName,
                    conceptType: 'OWL_CLASS',
                    iri: owner.namespace + name,
                  },
                }),
                'Create class reference'
              )
            );
          }
          const property = await okJson<OntologyProperty>(
            await api.post('/api/v1/ontologyProperties', {
              data: {
                name: 'knows',
                ontology: owner.fullyQualifiedName,
                iri: owner.namespace + 'knows',
                kind: 'OBJECT',
              },
            }),
            'Create property reference'
          );
          await page.goto('/governance/ontology?ontology=' + owner.id);
          if (theme === 'dark') {
            await expect(page.locator('html')).toHaveClass(/dark-mode/);
          }
          await page.getByTestId('mode-tab-edit').click();
          await test.step('Cancel and discard a new class without writing it', async () => {
            await page.getByTestId('ontology-add-concept').click();
            await page.getByTestId('new-class-label').fill('Unsaved class');
            await page.getByTestId('mode-tab-view').click();
            const confirmation = page.getByRole('dialog', {
              name: 'Discard your changes?',
            });
            await expect(confirmation).toBeVisible();
            await confirmation
              .getByRole('button', { name: 'Cancel', exact: true })
              .click();
            await expect(page.getByTestId('new-class-label')).toHaveValue(
              'Unsaved class'
            );
            if (mode === 'ai') {
              await page
                .getByTestId('ask-rail')
                .getByTestId('ask-logo-btn')
                .press('Enter');
              await expect(confirmation).toBeVisible();
              await confirmation
                .getByRole('button', { name: 'Cancel', exact: true })
                .click();
              await expect(page.getByTestId('new-class-label')).toHaveValue(
                'Unsaved class'
              );
            }
            await page.getByTestId('ontology-new-class-close').click();
            await expect(confirmation).toBeVisible();
            await confirmation
              .getByRole('button', { name: 'Discard', exact: true })
              .click();
            await expect(
              page.getByTestId('ontology-new-class-panel')
            ).toHaveCount(0);
            const saved = await okJson<{ data: OntologyConcept[] }>(
              await api.get('/api/v1/ontologyConcepts', {
                params: { ontology: owner.fullyQualifiedName },
              }),
              'Read preserved classes'
            );
            expect(saved.data.map((concept) => concept.id).sort()).toEqual(
              concepts.map((concept) => concept.id).sort()
            );
          });
          await test.step('Guard real definition and settings forms, then clear protection after save', async () => {
            await page.getByTestId('submode-tab-definitions').click();
            for (const [tab, editorId, row, endpoint] of [
              [
                'Concepts',
                'ontology-concept-editor',
                'Customer',
                '/api/v1/ontologyConcepts/' + concepts[0].id,
              ],
              [
                'Properties',
                'ontology-property-editor',
                'knows',
                '/api/v1/ontologyProperties/' + property.id,
              ],
              [
                'Settings',
                'ontology-create-form',
                '',
                '/api/v1/ontologies/' + owner.id,
              ],
            ]) {
              await page.getByRole('tab', { name: tab, exact: true }).click();
              if (row) {
                await page
                  .getByRole('button', { name: row, exact: true })
                  .click();
              }
              const editor = page.getByTestId(editorId);
              const description = editor.getByRole('textbox', {
                name: 'Description',
                exact: true,
              });
              const text = 'Saved ' + tab + ' description';
              await description.fill(text);
              if (tab === 'Concepts') {
                await page
                  .getByRole('button', { name: 'Person', exact: true })
                  .click();
              } else {
                await page
                  .getByRole('tab', { name: 'Constraints', exact: true })
                  .click();
              }
              const confirmation = page.getByRole('dialog', {
                name: 'Discard your changes?',
              });
              await expect(confirmation).toBeVisible();
              await confirmation
                .getByRole('button', { name: 'Cancel', exact: true })
                .click();
              await expect(description).toHaveValue(text);
              const saved = page.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname === endpoint &&
                  response.request().method() === 'PATCH',
                { timeout: 20_000 }
              );
              await clickIgnoringToasts(
                editor.getByRole('button', { name: 'Save', exact: true })
              );
              const updated = await okJson<{ description: string }>(
                await saved,
                'Save guarded definition'
              );
              expect(updated.description).toBe(text);
              if (tab === 'Settings') {
                await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
                  'aria-selected',
                  'true'
                );
                await page.getByTestId('mode-tab-edit').click();
                await page.getByTestId('submode-tab-definitions').click();
              }
              await page
                .getByRole('tab', { name: 'Constraints', exact: true })
                .click();
              await expect(
                page.getByRole('tab', { name: 'Constraints', exact: true })
              ).toHaveAttribute('aria-selected', 'true');
              await expect(confirmation).toHaveCount(0);
            }
          });
          await test.step('Protect edits before opening sibling authoring workflows', async () => {
            await page
              .getByRole('tab', { name: 'Settings', exact: true })
              .click();
            const description = page
              .getByTestId('ontology-create-form')
              .getByRole('textbox', { name: 'Description', exact: true });
            await description.fill('Keep settings until discard');
            const confirmation = page.getByRole('dialog', {
              name: 'Discard your changes?',
            });
            for (const trigger of [
              'ontology-library-trigger',
              'ontology-import-export-trigger',
            ]) {
              await page.getByTestId(trigger).click();
              await expect(confirmation).toBeVisible();
              await confirmation
                .getByRole('button', { name: 'Cancel', exact: true })
                .click();
              await expect(description).toHaveValue(
                'Keep settings until discard'
              );
            }
            await page.getByTestId('ontology-scope-menu-trigger').click();
            await page.getByTestId('ontology-create').click();
            await expect(confirmation).toBeVisible();
            await confirmation
              .getByRole('button', { name: 'Discard', exact: true })
              .click();
            await expect(page.getByTestId('ontology-create-form')).toHaveCount(
              0
            );
            await page
              .getByTestId('ontology-create-name')
              .fill('Unsaved ontology');
            await page.getByTestId('ontology-create-cancel').click();
            await expect(confirmation).toBeVisible();
            await confirmation
              .getByRole('button', { name: 'Cancel', exact: true })
              .click();
            await expect(page.getByTestId('ontology-create-name')).toHaveValue(
              'Unsaved ontology'
            );
            await page.getByTestId('ontology-create-cancel').click();
            await confirmation
              .getByRole('button', { name: 'Discard', exact: true })
              .click();
            await expect(
              page.getByTestId('ontology-create-dialog')
            ).toHaveCount(0);
            await page.getByTestId('mode-tab-edit').click();
          });
          await test.step('Select classes by label and persist their exact IRIs', async () => {
            await page.getByTestId('submode-tab-definitions').click();
            await page
              .getByRole('tab', { name: 'Constraints', exact: true })
              .click();
            await page.getByTestId('ontology-add-axiom').click();
            const editor = page.getByTestId('ontology-axiom-panel');
            await editor
              .getByRole('textbox', { name: 'Display Name', exact: true })
              .fill('Customer is a Person');
            await editor
              .getByRole('textbox', { name: 'Description', exact: true })
              .fill('Every customer is a person.');
            for (const [label, name] of [
              ['Subject', 'Customer'],
              ['Concept IRI', 'Person'],
            ]) {
              const input = editor.getByRole('combobox', {
                name: new RegExp(label),
              });
              await scrollIntoViewAndSettle(input);
              if (label === 'Subject') {
                await input.fill(' customer ');
                await input.press('Tab');
              } else {
                await input.fill(name);
                await input.press('ArrowDown');
                await page
                  .getByRole('option', { name: new RegExp('^' + name) })
                  .click();
              }
              await expect(input).toHaveValue(name);
            }
            await expect(
              editor.getByTestId('ontology-axiom-preview')
            ).toContainText('Customer Subclass of Person');
            await testInfo.attach('axiom-draft-' + mode + '-' + theme, {
              body: await page.screenshot(),
              contentType: 'image/png',
            });
            await page
              .getByRole('tab', { name: 'Settings', exact: true })
              .click();
            await page
              .getByRole('dialog')
              .getByRole('button', { name: 'Cancel', exact: true })
              .click();
            await expect(
              editor.getByRole('textbox', { name: 'Display Name', exact: true })
            ).toHaveValue('Customer is a Person');
            const created = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
                response.request().method() === 'POST'
            );
            await clickIgnoringToasts(
              page.getByTestId('ontology-axiom-submit')
            );
            const axiom = await okJson<OntologyAxiom>(
              await created,
              'Create class statement'
            );
            expect(axiom).toMatchObject({
              axiomType: 'SUBCLASS_OF',
              subjectIri: concepts[0].iri,
              expressions: [{ kind: 'NAMED_CLASS', classIri: concepts[1].iri }],
            });
            await expect(
              page.getByRole('button', {
                name: 'Customer is a Person',
                exact: true,
              })
            ).toBeVisible();
            await testInfo.attach('axiom-' + mode, {
              body: await page.screenshot(),
              contentType: 'image/png',
            });
            await page.getByTestId('mode-tab-view').click();
            await expect(page.getByTestId('mode-tab-view')).toHaveAttribute(
              'aria-selected',
              'true'
            );
            await expect(page.getByRole('dialog')).toHaveCount(0);
          });
          await test.step('Expose review configuration in the publication workflow', async () => {
            await page.getByTestId('ontology-publication-trigger').click();
            await expect(
              page.getByTestId('ontology-release-reviewers')
            ).toBeVisible();
            await expect(
              page.getByTestId('ontology-capture-release')
            ).toBeEnabled();
            await testInfo.attach('publication-' + mode, {
              body: await page.screenshot(),
              contentType: 'image/png',
            });
          });
        } finally {
          expect(
            (
              await api.delete(
                '/api/v1/users/' + user.responseData.id + '/preferences/appMode'
              )
            ).ok()
          ).toBeTruthy();
          await deleteFixtureEntity(
            api,
            '/api/v1/ontologies/' + owner.id + '?recursive=true&hardDelete=true'
          );
        }
      });
    }
  }
);
