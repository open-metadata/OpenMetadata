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
import { APIRequestContext, Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyAxiom } from '../../../src/generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { RelationshipType } from '../../../src/generated/entity/data/relationshipType';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import {
  clickGraphNode,
  findEmptyCanvasPoint,
  readGraphPoints,
  readNodePositions,
  waitForGraphPoints,
} from '../../utils/ontologyStudio';

const PART_OF = 'https://open-metadata.org/ontology/partOf';
const HAS_PART = 'https://open-metadata.org/ontology/hasPart';
const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

test.use({ isolatedUserOptions: { isAdmin: true } });

interface Fixture {
  readonly ontology: Ontology;
  readonly fqn: string;
  concept: (name: string) => Promise<OntologyConcept>;
  subclass: (
    child: OntologyConcept,
    parent: OntologyConcept
  ) => Promise<OntologyAxiom>;
  axioms: () => Promise<OntologyAxiom[]>;
  cleanup: () => Promise<void>;
}

const createFixture = async (
  api: APIRequestContext,
  prefix: string
): Promise<Fixture> => {
  const name = `pw_${prefix}_${uuid()}`;
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: { name, iri: `urn:${name}`, namespace: `urn:${name}:` },
    }),
    `Create the ${prefix} fixture`
  );
  const fqn = ontology.fullyQualifiedName ?? name;

  return {
    ontology,
    fqn,
    concept: async (conceptName) =>
      okJson<OntologyConcept>(
        await api.post('/api/v1/ontologyConcepts', {
          data: { name: conceptName, ontology: fqn, conceptType: 'OWL_CLASS' },
        }),
        `Create ${conceptName}`
      ),
    subclass: async (child, parent) =>
      okJson<OntologyAxiom>(
        await api.post('/api/v1/ontologyAxioms', {
          data: {
            name: `${child.name}Is${parent.name}`,
            displayName: `${child.name} is ${parent.name}`,
            description: `${child.name} is a ${parent.name}`,
            ontology: fqn,
            axiomType: 'SUBCLASS_OF',
            subjectIri: child.iri,
            expressions: [{ kind: 'NAMED_CLASS', classIri: parent.iri }],
            provenance: 'Manual',
          },
        }),
        `Relate ${child.name} to ${parent.name}`
      ),
    axioms: async () =>
      (
        await okJson<{ data: OntologyAxiom[] }>(
          await api.get('/api/v1/ontologyAxioms', {
            params: { ontologyId: ontology.id, limit: 100 },
          }),
          'List the axioms'
        )
      ).data,
    cleanup: async () => {
      await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
      );
    },
  };
};

const openStudio = async (page: Page, ontology: Ontology, edit: boolean) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-scope-menu-trigger')).toHaveAttribute(
    'data-scope-key',
    `ontology:${ontology.id}`
  );
  if (edit) {
    await page.getByTestId('mode-tab-edit').click();
    await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  }
  await readNodePositions(page);
};

const isAxiomsPost = (response: {
  url: () => string;
  request: () => { method: () => string };
}) =>
  new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
  response.request().method() === 'POST';

/** Picks the relation type once the picker is open for the pending source and target. */
const chooseRelationType = async (page: Page, typeIri: string) => {
  const picker = page.getByTestId('relationship-type-picker');
  await expect(picker).toBeVisible();
  await clickIgnoringToasts(picker.getByTestId(`relation-type-${typeIri}`));

  return picker;
};

/** Starts a click-connect from a node's handle and lands on the target node body. */
const connectByClick = async (page: Page, fromId: string, toId: string) => {
  const ports = await waitForGraphPoints(page, 'port', [fromId]);
  await page.mouse.click(ports[fromId].x, ports[fromId].y);
  await expect(page.getByTestId('ontology-connect-instruction')).toBeVisible();
  const nodes = await readGraphPoints(page, 'node');
  await page.mouse.click(nodes[toId].x, nodes[toId].y);
};

/** Drags from a node's handle and releases over another node's body. */
const connectByDrag = async (page: Page, fromId: string, toId: string) => {
  const ports = await waitForGraphPoints(page, 'port', [fromId]);
  const nodes = await readGraphPoints(page, 'node');
  await page.mouse.move(ports[fromId].x, ports[fromId].y);
  await page.mouse.down();
  await page.mouse.move(
    (ports[fromId].x + nodes[toId].x) / 2,
    (ports[fromId].y + nodes[toId].y) / 2,
    { steps: 8 }
  );
  await page.mouse.move(nodes[toId].x, nodes[toId].y, { steps: 8 });
  await page.mouse.up();
};

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
          await picker.getByTestId('relation-type-search').fill('part');
          await scrollIntoViewAndSettle(partOf);
          await expect(partOf).toBeVisible();
          await testInfo.attach('native-relation-groups', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          await picker.getByTestId('relation-type-search').fill('');
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

        await test.step('A second Part Of reuses the pair', async () => {
          const { inspector } = await openRelationPicker(page, customer.id);
          await clickIgnoringToasts(
            page.getByTestId(`relation-type-${PART_OF}`)
          );
          const axiom = await okJson<OntologyAxiom>(
            await submitRelation(page, inspector, 'Account'),
            'Create the second Part Of relation'
          );
          expect(axiom.subjectIri).toBe(customer.iri);
          expect(await listProperties()).toHaveLength(2);
        });

        await test.step('Subclass Of writes the hierarchy axiom and no property', async () => {
          const { inspector } = await openRelationPicker(page, account.id);
          await clickIgnoringToasts(
            page.getByTestId(`relation-type-${SUBCLASS_OF}`)
          );
          const axiom = await okJson<OntologyAxiom>(
            await submitRelation(page, inspector, 'Customer'),
            'Create the Subclass Of relation'
          );
          expect(axiom.axiomType).toBe('SUBCLASS_OF');
          expect(axiom.subjectIri).toBe(account.iri);
          expect(axiom.expressions).toEqual([
            expect.objectContaining({ classIri: customer.iri }),
          ]);
          const properties = await listProperties();
          expect(properties).toHaveLength(2);
          expect(
            properties.some((property) => property.iri === SUBCLASS_OF)
          ).toBe(false);
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
          expect(primary?.inverse?.id).toBe(inverse?.id);
          expect(inverse?.inverse?.id).toBe(primary?.id);
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

        await test.step('Offer ontology-owned object properties beside admin types', async () => {
          const localIri = `${ontology.namespace}relatedLocally`;
          await okJson<OntologyProperty>(
            await api.post('/api/v1/ontologyProperties', {
              data: {
                name: 'relatedLocally',
                displayName: 'Related locally',
                ontology: ontologyFqn,
                iri: localIri,
                kind: 'OBJECT',
                inverse: localIri,
              },
            }),
            'Create an ontology-owned relation type'
          );
          await page.reload();
          await page.getByTestId('mode-tab-edit').click();
          const { picker } = await openRelationPicker(page, account.id);
          const custom = picker.getByTestId('group-custom');
          await expect(custom).toContainText(`governed by ${suffix}`);
          const local = custom.getByTestId(`relation-type-${localIri}`);
          await expect(local).toContainText('Related locally');
          await expect(local).toContainText('Inverse: Related locally');
          await scrollIntoViewAndSettle(local);
          await testInfo.attach('native-relation-custom-group', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('A data steward with native authoring rights sees admin types and no create option', async () => {
          await author.setDataStewardRole(api);
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
          await picker.getByTestId('relation-type-search').fill('governed by');
          await expect(picker.getByTestId('group-custom')).toContainText(
            `governed by ${suffix}`
          );
          await expect(picker.getByTestId('relation-type-create')).toHaveCount(
            0
          );
          await scrollIntoViewAndSettle(picker.getByTestId('group-custom'));
          await expect(picker.getByTestId('group-custom')).toBeVisible();
          await testInfo.attach('native-relation-steward', {
            body: await authorPage.screenshot(),
            contentType: 'image/png',
          });
          await picker
            .getByTestId('relation-type-search')
            .fill(`owned by ${suffix}`);
          await expect(picker.getByTestId('no-relation-types')).toBeVisible();
          await expect(picker.getByTestId('relation-type-create')).toHaveCount(
            0
          );
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

    test('places a new concept where the canvas is double-clicked and leaves View mode alone', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'place');
      try {
        const alpha = await fixture.concept('Alpha');
        const beta = await fixture.concept('Beta');
        await fixture.subclass(beta, alpha);

        await test.step('View mode ignores a double-click on the canvas and still selects a node', async () => {
          await openStudio(page, fixture.ontology, false);
          const empty = await findEmptyCanvasPoint(page);
          await page.mouse.dblclick(empty.x, empty.y);
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(0);
          await clickGraphNode(page, alpha.id);
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Alpha');
        });

        await test.step('Edit mode opens the one new-concept drawer and puts the node at the click', async () => {
          await page.getByTestId('mode-tab-edit').click();
          await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
            'aria-selected',
            'true'
          );
          await page
            .getByTestId('ontology-concept-inspector')
            .getByRole('button', { name: 'Close' })
            .click();
          const empty = await findEmptyCanvasPoint(page);
          await page.mouse.dblclick(empty.x, empty.y);
          const panel = page.getByTestId('ontology-new-class-panel');
          await expect(panel).toBeVisible();
          await expect(
            page.getByTestId('ontology-new-class-panel')
          ).toHaveCount(1);
          await page.getByTestId('new-class-label').fill('Placed Concept');
          await page
            .getByTestId('new-class-description')
            .fill('Dropped where the canvas was double-clicked.');
          const applied = page.waitForResponse(
            (response) =>
              response.url().includes('/ontologyChangeSets/') &&
              response.url().endsWith('/apply') &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('new-class-create').click();
          await okJson(await applied, 'Apply the placement plan');
          const placed = (
            await okJson<{ data: OntologyConcept[] }>(
              await api.get('/api/v1/ontologyConcepts', {
                params: { ontology: fixture.fqn, limit: 50 },
              }),
              'List the concepts'
            )
          ).data.find((candidate) => candidate.name === 'PlacedConcept');
          expect(placed).toBeDefined();
          if (!placed) {
            return;
          }

          const points = await waitForGraphPoints(page, 'node', [placed.id]);
          expect(Math.abs(points[placed.id].x - empty.x)).toBeLessThan(40);
          expect(Math.abs(points[placed.id].y - empty.y)).toBeLessThan(40);
          await testInfo.attach('g11-placement', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });

          await clickGraphNode(page, alpha.id);
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Alpha');
          const after = await readGraphPoints(page, 'node');
          expect(Math.abs(after[placed.id].x - empty.x)).toBeLessThan(40);
          expect(Math.abs(after[placed.id].y - empty.y)).toBeLessThan(40);
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('connects two concepts by clicking the handle and by dragging it', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'connect');
      try {
        const alpha = await fixture.concept('Alpha');
        const beta = await fixture.concept('Beta');
        const gamma = await fixture.concept('Gamma');
        await openStudio(page, fixture.ontology, true);

        await test.step('Click the handle, then the target, to make a subclass', async () => {
          await connectByClick(page, beta.id, alpha.id);
          const created = page.waitForResponse(isAxiomsPost);
          await chooseRelationType(page, SUBCLASS_OF);
          const axiom = await okJson<OntologyAxiom>(
            await created,
            'Create the clicked relation'
          );
          expect(axiom.subjectIri).toBe(beta.iri);
          expect(axiom.expressions).toEqual([
            expect.objectContaining({ classIri: alpha.iri }),
          ]);
        });

        await test.step('Drag from the handle onto the target to make a link', async () => {
          await connectByDrag(page, gamma.id, alpha.id);
          await testInfo.attach('g11-connect-drag', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
          const created = page.waitForResponse(isAxiomsPost);
          await chooseRelationType(page, PART_OF);
          const axiom = await okJson<OntologyAxiom>(
            await created,
            'Create the dragged relation'
          );
          expect(axiom.subjectIri).toBe(gamma.iri);
          expect(axiom.expressions).toEqual([
            expect.objectContaining({ propertyIri: PART_OF }),
          ]);
        });

        await test.step('Releasing a drag on empty canvas draws nothing', async () => {
          const before = (await fixture.axioms()).length;
          const ports = await waitForGraphPoints(page, 'port', [alpha.id]);
          const empty = await findEmptyCanvasPoint(page);
          await page.mouse.move(ports[alpha.id].x, ports[alpha.id].y);
          await page.mouse.down();
          await page.mouse.move(empty.x, empty.y, { steps: 10 });
          await page.mouse.up();
          await expect(
            page.getByTestId('relationship-type-picker')
          ).toHaveCount(0);
          expect((await fixture.axioms()).length).toBe(before);
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('says why a relationship cannot be saved before it is saved', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'checks');
      try {
        const alpha = await fixture.concept('Alpha');
        const beta = await fixture.concept('Beta');
        await fixture.subclass(beta, alpha);
        await openStudio(page, fixture.ontology, true);
        const saved: string[] = [];
        page.on('request', (request) => {
          if (
            new URL(request.url()).pathname === '/api/v1/ontologyAxioms' &&
            request.method() === 'POST'
          ) {
            saved.push(request.url());
          }
        });
        const message = page.getByTestId('relation-check-message');

        await test.step('A repeated relationship is refused with its own sentence', async () => {
          await connectByClick(page, beta.id, alpha.id);
          await chooseRelationType(page, SUBCLASS_OF);
          await expect(message).toHaveText(
            /This relationship already exists: Beta .* Alpha\./
          );
          await page.getByTestId('relation-type-cancel').click();
        });

        await test.step('A relationship from a concept to itself is refused', async () => {
          await connectByClick(page, alpha.id, alpha.id);
          await chooseRelationType(page, SUBCLASS_OF);
          await expect(message).toHaveText(
            'Alpha cannot be related to itself.'
          );
          await page.getByTestId('relation-type-cancel').click();
        });

        await test.step('A subclass that would close a loop is refused', async () => {
          await connectByClick(page, alpha.id, beta.id);
          await chooseRelationType(page, SUBCLASS_OF);
          await expect(message).toHaveText(
            /already a kind of .*This would make a loop\./
          );
          await page.getByTestId('relation-type-cancel').click();
        });

        expect(saved).toEqual([]);
        expect(await fixture.axioms()).toHaveLength(1);
      } finally {
        await fixture.cleanup();
      }
    });

    test('changes and deletes a relationship from the inspector and keeps both after reload', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rows');
      try {
        const alpha = await fixture.concept('Alpha');
        const beta = await fixture.concept('Beta');
        await fixture.subclass(beta, alpha);
        await openStudio(page, fixture.ontology, true);
        await clickGraphNode(page, beta.id);
        const rows = page
          .getByTestId('ontology-concept-inspector')
          .getByTestId('ontology-concept-relationships');

        await test.step('Change Subclass Of to Part Of', async () => {
          await expect(rows).toContainText('Alpha');
          await rows.getByTestId('ontology-relation-edit').click();
          await clickIgnoringToasts(
            page
              .getByTestId('relationship-type-picker')
              .getByTestId(`relation-type-${PART_OF}`)
          );
          await expect
            .poll(async () =>
              (await fixture.axioms()).map((axiom) => axiom.expressions?.[0])
            )
            .toEqual([expect.objectContaining({ propertyIri: PART_OF })]);

          await page.reload();
          await page.getByTestId('mode-tab-edit').click();
          await clickGraphNode(page, beta.id);
          await expect(rows).toContainText(/part of\s*Alpha/i);
        });

        await test.step('Delete the relationship', async () => {
          await rows.getByTestId('ontology-relation-delete').click();
          await expect(page.getByText('Relationship deleted.')).toBeVisible();
          await expect
            .poll(async () => (await fixture.axioms()).length)
            .toBe(0);

          await page.reload();
          await page.getByTestId('mode-tab-edit').click();
          await clickGraphNode(page, beta.id);
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).not.toContainText('Alpha');
          expect(await readGraphPoints(page, 'edge')).toEqual({});
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('opens the relationship detail when an edge is clicked', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'edge');
      try {
        const alpha = await fixture.concept('Alpha');
        const beta = await fixture.concept('Beta');
        const axiom = await fixture.subclass(beta, alpha);
        await openStudio(page, fixture.ontology, true);

        const edges = await waitForGraphPoints(page, 'edge', [
          `edge-${axiom.id}`,
        ]).catch(async () => readGraphPoints(page, 'edge'));
        const [edge] = Object.values(edges);
        await page.mouse.click(edge.x, edge.y);

        const detail = page.getByTestId('ontology-relation-detail');
        await expect(detail).toBeVisible();
        await expect(
          detail.getByTestId('ontology-relation-detail-source')
        ).toHaveText('Beta');
        await expect(
          detail.getByTestId('ontology-relation-detail-type')
        ).toHaveText('is a');
        await expect(
          detail.getByTestId('ontology-relation-detail-target')
        ).toHaveText('Alpha');
        await expect(
          detail.getByTestId('ontology-relation-detail-actions')
        ).toBeVisible();

        await detail.getByTestId('ontology-relation-delete').click();
        await expect.poll(async () => (await fixture.axioms()).length).toBe(0);
        await expect(detail).toHaveCount(0);
      } finally {
        await fixture.cleanup();
      }
    });

    test('shows what deleting a concept takes with it and removes the references with it', async ({
      isolatedUserPage: page,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'delete');
      const table = new TableClass({ name: `pw_g11_${uuid()}` });
      try {
        const parent = await fixture.concept('Parent');
        const child = await fixture.concept('Child');
        const uncle = await fixture.concept('Uncle');
        await fixture.subclass(child, parent);
        await fixture.subclass(parent, uncle);
        await table.create(api);
        await okJson<OntologyConceptBindingsResponse>(
          await api.put(`/api/v1/ontologyConcepts/${parent.id}/bindings`, {
            data: {
              expectedRevision: 0,
              asset: {
                assetType: 'table',
                assetId: table.entityResponseData.id,
                columns: [],
              },
            },
          }),
          'Bind a table to Parent'
        );

        await openStudio(page, fixture.ontology, true);
        await clickGraphNode(page, parent.id);
        await page.getByTestId('ontology-concept-more').click();
        await page.getByTestId('ontology-concept-delete').click();

        const dialog = page.getByTestId('ontology-concept-delete-dialog');
        await expect(
          dialog.getByTestId('ontology-delete-children')
        ).toContainText('1 child concept will move to the top level: Child.');
        await expect(
          dialog.getByTestId('ontology-delete-relationships')
        ).toContainText('2 relationships will be removed.');
        await expect(
          dialog.getByTestId('ontology-delete-bindings')
        ).toContainText('1 data asset binding will be removed');
        await testInfo.attach('g11-delete-impact', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });

        await dialog.getByTestId('ontology-delete-remove-references').uncheck();
        await expect(
          dialog.getByTestId('ontology-concept-delete-confirm')
        ).toBeDisabled();
        await dialog.getByTestId('ontology-delete-remove-references').check();
        await dialog.getByTestId('ontology-concept-delete-confirm').click();
        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await fixture.axioms()).length).toBe(0);

        await test.step('Undo brings back the concept and its relationships', async () => {
          await page.getByTestId('ontology-undo').click();
          await expect
            .poll(async () => (await fixture.axioms()).length)
            .toBe(2);
          const restored = await okJson<OntologyConcept>(
            await api.get(`/api/v1/ontologyConcepts/${parent.id}`),
            'Read the restored concept'
          );
          expect(restored.deleted).toBe(false);
          await expect
            .poll(async () => Object.keys(await readGraphPoints(page, 'node')))
            .toContain(parent.id);
        });
      } finally {
        await table.delete(api);
        await fixture.cleanup();
      }
    });

    test('offers Restore when a new concept reuses the name of a deleted one', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'reuse');
      try {
        const customer = await okJson<OntologyConcept>(
          await api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Customer',
              ontology: fixture.fqn,
              conceptType: 'OWL_CLASS',
              description: 'A party that buys from us.',
            },
          }),
          'Create Customer'
        );
        await fixture.concept('Anchor');

        await openStudio(page, fixture.ontology, true);
        await clickGraphNode(page, customer.id);
        await page.getByTestId('ontology-concept-more').click();
        await page.getByTestId('ontology-concept-delete').click();
        await page.getByTestId('ontology-concept-delete-confirm').click();
        await expect(
          page.getByTestId('ontology-concept-delete-dialog')
        ).toHaveCount(0);
        await expect(page.getByTestId('ontology-undo')).toBeVisible();
        await expect(page.getByTestId('ontology-undo')).toHaveCount(0, {
          timeout: 30_000,
        });

        const empty = await findEmptyCanvasPoint(page);
        await page.mouse.dblclick(empty.x, empty.y);
        await page.getByTestId('new-class-local-name').fill('Customer');
        await expect(page.getByTestId('new-class-name-deleted')).toContainText(
          'A deleted concept named Customer exists in this ontology.'
        );
        await expect(page.getByTestId('new-class-create')).toBeDisabled();

        await page.getByTestId('new-class-restore').click();
        await expect(page.getByTestId('ontology-new-class-panel')).toHaveCount(
          0
        );
        await expect
          .poll(async () => Object.keys(await readGraphPoints(page, 'node')))
          .toContain(customer.id);
        await expect(
          page.getByTestId('ontology-concept-inspector')
        ).toContainText('A party that buys from us.');

        await page.reload();
        await expect
          .poll(async () => Object.keys(await readGraphPoints(page, 'node')))
          .toContain(customer.id);
        const restored = await okJson<OntologyConcept>(
          await api.get(`/api/v1/ontologyConcepts/${customer.id}`),
          'Read Customer'
        );
        expect(restored.deleted).toBe(false);
        expect(restored.description).toBe('A party that buys from us.');
      } finally {
        await fixture.cleanup();
      }
    });

    test('lists Broader and Narrower under Relationships, not Properties', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'group');
      try {
        const iri = (local: string) => `${fixture.ontology.namespace}${local}`;
        const property = async (name: string, kind: 'OBJECT' | 'DATA') =>
          okJson<OntologyProperty>(
            await api.post('/api/v1/ontologyProperties', {
              data: {
                name,
                displayName: name,
                ontology: fixture.fqn,
                iri: iri(name),
                kind,
                ...(kind === 'DATA'
                  ? { range: ['http://www.w3.org/2001/XMLSchema#string'] }
                  : {}),
              },
            }),
            `Create ${name}`
          );
        await property('broader', 'OBJECT');
        await property('narrower', 'OBJECT');
        await property('legalName', 'DATA');

        await fixture.concept('Anchor');
        await openStudio(page, fixture.ontology, true);
        await page.getByTestId('submode-tab-definitions').click();
        await page
          .getByRole('tab', { name: 'Properties', exact: true })
          .click();

        const properties = page.getByTestId(
          'ontology-definition-group-property'
        );
        const relationships = page.getByTestId(
          'ontology-definition-group-relationship'
        );
        await expect(properties).toContainText('legalName');
        await expect(properties).not.toContainText('broader');
        await expect(properties).not.toContainText('narrower');
        await expect(relationships).toContainText('broader');
        await expect(relationships).toContainText('narrower');
      } finally {
        await fixture.cleanup();
      }
    });
  }
);
