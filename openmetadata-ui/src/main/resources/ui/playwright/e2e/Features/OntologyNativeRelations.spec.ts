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
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { RelationshipType } from '../../../src/generated/entity/data/relationshipType';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import { clickGraphNode } from '../../utils/ontologyStudio';

const PART_OF = 'https://open-metadata.org/ontology/partOf';
const HAS_PART = 'https://open-metadata.org/ontology/hasPart';
const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

test.use({ isolatedUserOptions: { isAdmin: true } });

const openRelationPicker = async (page: Page, conceptId: string) => {
  await clickGraphNode(page, conceptId);
  const inspector = page.getByTestId('ontology-concept-inspector');
  await inspector.getByTestId('ontology-add-relationship').click();

  return { inspector, picker: page.getByTestId('relationship-type-picker') };
};

const submitRelation = async (
  page: Page,
  inspector: ReturnType<Page['getByTestId']>,
  targetName: string
) => {
  const target = inspector.getByLabel('Target');
  await scrollIntoViewAndSettle(target);
  await selectOptionWithRetry(
    target,
    page.getByRole('option', { name: targetName, exact: true })
  );
  await expect(target).toContainText(targetName);
  const axiomCreated = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
      response.request().method() === 'POST'
  );
  await clickIgnoringToasts(
    inspector.getByTestId('ontology-relationship-submit')
  );

  return axiomCreated;
};

test.describe(
  'Native ontology relations',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('offers registry relation types with their inverses', async ({
      isolatedUserPage: page,
      freshUserPage: { page: authorPage, user: author },
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const suffix = uuid();
      const name = `pw_native_relations_${suffix}`;
      const policy = new PolicyClass();
      const role = new RolesClass();
      const createdTypes: RelationshipType[] = [];
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
        }),
        'Create native relations fixture'
      );
      const ontologyFqn = ontology.fullyQualifiedName ?? name;

      const listProperties = async () =>
        (
          await okJson<{ data: OntologyProperty[] }>(
            await api.get('/api/v1/ontologyProperties', {
              params: { ontology: ontologyFqn, limit: 50 },
            }),
            'List native properties'
          )
        ).data;

      try {
        const createConcept = async (conceptName: string) =>
          okJson<OntologyConcept>(
            await api.post('/api/v1/ontologyConcepts', {
              data: {
                name: conceptName,
                ontology: ontologyFqn,
                conceptType: 'OWL_CLASS',
              },
            }),
            `Create ${conceptName}`
          );
        const account = await createConcept('Account');
        const customer = await createConcept('Customer');

        await test.step('Offer the registry groups with their inverses', async () => {
          await page.goto(`/governance/ontology?ontology=${ontology.id}`);
          await expect(
            page.getByTestId('ontology-scope-menu-trigger')
          ).toHaveAttribute('data-scope-key', `ontology:${ontology.id}`);
          await page.getByTestId('mode-tab-edit').click();
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          const { picker } = await openRelationPicker(page, account.id);
          await expect(picker.getByTestId('group-core')).toContainText(
            'Subclass Of'
          );
          await expect(
            picker.getByTestId(`relation-type-${SUBCLASS_OF}`)
          ).toBeVisible();
          const partOf = picker.getByTestId(`relation-type-${PART_OF}`);
          await expect(partOf).toContainText('Part Of');
          await expect(partOf).toContainText('Has Part');
          await expect(
            picker.getByTestId(`relation-type-${HAS_PART}`)
          ).toContainText('Part Of');
          await testInfo.attach('native-relation-groups', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('Add Part Of from Account to Customer', async () => {
          const inspector = page.getByTestId('ontology-concept-inspector');
          await clickIgnoringToasts(
            page.getByTestId(`relation-type-${PART_OF}`)
          );
          const axiom = await okJson<OntologyAxiom>(
            await submitRelation(page, inspector, 'Customer'),
            'Create the Part Of relation'
          );
          expect(axiom.subjectIri).toBe(account.iri);
          expect(axiom.expressions).toEqual([
            expect.objectContaining({ propertyIri: PART_OF }),
          ]);

          const properties = await listProperties();
          const byIri = new Map(
            properties.map((property) => [property.iri, property])
          );
          expect(properties).toHaveLength(2);
          expect(byIri.get(PART_OF)?.inverse).toBe(HAS_PART);
          expect(byIri.get(HAS_PART)?.inverse).toBe(PART_OF);

          await clickGraphNode(page, customer.id);
          await expect(
            inspector.getByTestId('ontology-concept-relationships')
          ).toContainText(/has part\s*Account/i);
          await testInfo.attach('native-relation-part-of', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('Create an admin type with its inverse from the picker', async () => {
          const label = `governed by ${suffix}`;
          const inverseLabel = `governs ${suffix}`;
          const { inspector, picker } = await openRelationPicker(
            page,
            account.id
          );
          await picker.getByTestId('relation-type-search').fill(label);
          await picker.getByTestId('relation-type-create').click();
          await expect(inspector).toContainText(label);

          const target = inspector.getByLabel('Target');
          await scrollIntoViewAndSettle(target);
          await selectOptionWithRetry(
            target,
            page.getByRole('option', { name: 'Customer', exact: true })
          );
          await inspector.getByTestId('ontology-relationship-submit').click();

          const dialog = page.getByTestId('relationship-type-dialog');
          await expect(
            dialog.getByTestId('relationship-type-name')
          ).toHaveValue(label);
          await dialog
            .getByTestId('relationship-type-inverse')
            .fill(inverseLabel);
          const axiomCreated = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
              response.request().method() === 'POST'
          );
          await dialog.getByTestId('relationship-type-submit').click();
          const axiom = await okJson<OntologyAxiom>(
            await axiomCreated,
            'Create the custom relation'
          );
          await expect(dialog).toHaveCount(0);

          const registry = (
            await okJson<{ data: RelationshipType[] }>(
              await api.get('/api/v1/relationshipTypes', {
                params: { limit: 1000 },
              }),
              'List relationship types'
            )
          ).data;
          const primary = registry.find((type) => type.displayName === label);
          const inverse = registry.find(
            (type) => type.displayName === inverseLabel
          );
          expect(primary).toBeDefined();
          expect(inverse).toBeDefined();
          createdTypes.push(
            primary as RelationshipType,
            inverse as RelationshipType
          );
          expect(primary?.category).toBe('CUSTOM');
          expect(primary?.inverse?.name).toBe(inverse?.name);
          expect(inverse?.inverse?.name).toBe(primary?.name);
          expect(axiom.expressions).toEqual([
            expect.objectContaining({ propertyIri: primary?.rdfPredicate }),
          ]);

          const properties = await listProperties();
          const byIri = new Map(
            properties.map((property) => [property.iri, property])
          );
          expect(properties).toHaveLength(4);
          expect(byIri.get(primary?.rdfPredicate as string)?.inverse).toBe(
            inverse?.rdfPredicate
          );
          expect(byIri.get(inverse?.rdfPredicate as string)?.inverse).toBe(
            primary?.rdfPredicate
          );
          await testInfo.attach('native-relation-custom', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('An author without registry rights sees the admin types and no create option', async () => {
          await policy.create(api, [
            {
              name: 'native-ontology-author',
              resources: [
                'ontology',
                'ontologyConcept',
                'ontologyProperty',
                'ontologyAxiom',
              ],
              operations: ['ViewAll', 'Create', 'EditAll'],
              effect: 'allow',
            },
          ]);
          await role.create(api, [policy.responseData.name]);
          await author.patch({
            apiContext: api,
            patchData: [
              {
                op: 'add',
                path: '/roles/0',
                value: {
                  id: role.responseData.id,
                  type: 'role',
                  name: role.responseData.name,
                },
              },
            ],
          });

          await authorPage.goto(`/governance/ontology?ontology=${ontology.id}`);
          await authorPage.getByTestId('mode-tab-edit').click();
          await expect(authorPage.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          const { picker } = await openRelationPicker(authorPage, account.id);
          await expect(
            picker.getByTestId(`relation-type-${PART_OF}`)
          ).toContainText('Has Part');
          await expect(picker.getByTestId('group-custom')).toContainText(
            `governed by ${suffix}`
          );
          await picker
            .getByTestId('relation-type-search')
            .fill(`owned by ${suffix}`);
          await expect(picker.getByTestId('no-relation-types')).toBeVisible();
          await expect(picker.getByTestId('relation-type-create')).toHaveCount(
            0
          );
          await testInfo.attach('native-relation-steward', {
            body: await authorPage.screenshot(),
            contentType: 'image/png',
          });
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
        );
        for (const type of createdTypes) {
          await deleteFixtureEntity(
            api,
            `/api/v1/relationshipTypes/${type.id}?hardDelete=true`
          );
        }
        if (role.responseData.id) {
          await deleteFixtureEntity(
            api,
            `/api/v1/roles/${role.responseData.id}?hardDelete=true`
          );
        }
        if (policy.responseData.id) {
          await deleteFixtureEntity(
            api,
            `/api/v1/policies/${policy.responseData.id}?hardDelete=true`
          );
        }
      }
    });
  }
);
