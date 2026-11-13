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
import { APIRequestContext, Locator, Page } from '@playwright/test';
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
  selectOptionWithRetry,
  uuid,
} from '../../utils/common';
import {
  chooseInspectorRelationType,
  clickGraphNode,
  readNodePositions,
} from '../../utils/ontologyStudio';

const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const AXIOM_TYPE_BUTTON =
  /^(Subclass of|Disjoint with|Equivalent to|Class membership|Data property fact|Object property fact) Type/;
const MODES = ['classic', 'ai'] as const;

type Mode = (typeof MODES)[number];

interface Fixture {
  readonly ontology: Ontology;
  readonly fqn: string;
  concept: (name: string) => Promise<OntologyConcept>;
  property: (
    name: string,
    kind: 'DATA' | 'OBJECT'
  ) => Promise<OntologyProperty>;
  axiom: (data: Record<string, unknown>) => Promise<OntologyAxiom>;
  axioms: () => Promise<OntologyAxiom[]>;
  cleanup: () => Promise<void>;
}

test.use({ isolatedUserOptions: { isAdmin: true } });

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
    property: async (propertyName, kind) =>
      okJson<OntologyProperty>(
        await api.post('/api/v1/ontologyProperties', {
          data: { name: propertyName, ontology: fqn, kind },
        }),
        `Create ${propertyName}`
      ),
    axiom: async (data) =>
      okJson<OntologyAxiom>(
        await api.post('/api/v1/ontologyAxioms', {
          data: {
            description: 'Fixture rule',
            displayName: String(data.name),
            ontology: fqn,
            provenance: 'Manual',
            ...data,
          },
        }),
        `Create ${String(data.name)}`
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

const setMode = async (
  api: APIRequestContext,
  userId: string | undefined,
  mode: Mode
) => {
  await okJson(
    await api.put(`/api/v1/users/${userId}/preferences/appMode`, {
      data: { type: 'appMode', config: { value: mode } },
    }),
    'Set own app mode'
  );
};

const openOntology = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-scope-menu-trigger')).toHaveAttribute(
    'data-scope-key',
    `ontology:${ontology.id}`
  );
  await page.getByTestId('mode-tab-edit').click();
  await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
    'aria-selected',
    'true'
  );
};

const openConstraints = async (page: Page, ontology: Ontology) => {
  await openOntology(page, ontology);
  await page.getByTestId('submode-tab-definitions').click();
  await page.getByRole('tab', { name: 'Constraints', exact: true }).click();
};

const openNewRule = async (page: Page) => {
  await page.getByTestId('ontology-add-axiom').click();
  const editor = page.getByTestId('ontology-axiom-panel');
  await expect(editor).toBeVisible();

  return editor;
};

/**
 * Types into a label picker and takes the option whose label starts with `label`.
 * A picker that spans ontologies can list the same label twice; `iri` picks the one
 * that belongs to the ontology under test.
 */
const pickByLabel = async (picker: Locator, label: string, iri?: string) => {
  const input = picker.getByRole('combobox');
  await scrollIntoViewAndSettle(input);
  await input.fill(label);
  await input.press('ArrowDown');
  const option = picker
    .page()
    .getByRole('option', { name: new RegExp(`^${label}`) });
  await (iri ? option.filter({ hasText: iri }) : option).click();
  await expect(input).toHaveValue(label);
};

/** Pastes an address into a picker, the way a rule points at another ontology. */
const pasteIri = async (picker: Locator, iri: string) => {
  const input = picker.locator('input');
  await input.fill(iri);
  await input.press('Tab');
};

/** An imported-style rule opens with a property condition; a class fact needs a named class instead. */
const useNamedClassCondition = async (editor: Locator) => {
  await selectOptionWithRetry(
    editor
      .getByTestId('ontology-expression-0')
      .getByRole('button', { name: 'Constraint Type', exact: true }),
    editor.page().getByRole('option', { name: 'Classification', exact: true })
  );
};

const saveRule = async (page: Page) => {
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/ontologyAxioms' &&
      response.request().method() === 'POST'
  );
  await clickIgnoringToasts(page.getByTestId('ontology-axiom-submit'));
  const axiom = await okJson<OntologyAxiom>(await created, 'Create the rule');
  // Save keeps the overlay drawer open on the saved rule, over the list's Add button.
  // Close it only once it shows the saved rule, so the unsaved-changes guard has nothing to ask.
  const drawer = page.getByTestId('ontology-definition-drawer');
  await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(
    axiom.displayName || axiom.name
  );
  await drawer.getByTestId('ontology-definition-drawer-close').click();
  await expect(drawer).toHaveCount(0);

  return axiom;
};

const fillQuickMustHave = async (
  editor: Locator,
  subject: string,
  property: string
) => {
  await pickByLabel(editor.getByTestId('ontology-rule-subject'), subject);
  await pickByLabel(editor.getByTestId('ontology-rule-property'), property);
};

test.describe(
  'Ontology rules in plain language',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of MODES) {
      test(`lane 1: a quick rule reads as a sentence and saves without an IRI in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser: user,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const fixture = await createFixture(api, `rules_quick_${mode}`);
        try {
          const patient = await fixture.concept('Patient');
          const dateOfBirth = await fixture.property('dateOfBirth', 'DATA');
          await setMode(api, user.responseData.id, mode);

          await openConstraints(page, fixture.ontology);
          const editor = await openNewRule(page);

          await test.step('Pick the subject and property by label', async () => {
            await fillQuickMustHave(editor, 'Patient', 'dateOfBirth');
            await expect(
              editor.getByTestId('ontology-axiom-preview')
            ).toContainText('Patient must have exactly 1 dateOfBirth');
          });

          await test.step('Keep the rule name out of the quick form and Display Name optional', async () => {
            await expect(
              editor.getByRole('textbox', { name: /Rule name/ })
            ).toHaveCount(0);
            await expect(
              editor.getByRole('textbox', { name: 'Display Name (optional)' })
            ).toBeVisible();
            await expect(
              editor.getByRole('textbox', { name: 'Description (optional)' })
            ).toBeVisible();
          });

          await test.step('Save and read the stored rule', async () => {
            const axiom = await saveRule(page);

            expect(axiom).toMatchObject({
              axiomType: 'SUBCLASS_OF',
              subjectIri: patient.iri,
              expressions: [
                {
                  kind: 'RESTRICTION',
                  restrictionKind: 'EXACT',
                  cardinality: 1,
                  propertyIri: dateOfBirth.iri,
                },
              ],
            });
            expect(axiom.name).toMatch(
              /^patient-must-have-exactly-1-dateofbirth-/
            );
            await testInfo.attach(`g13-quick-${mode}`, {
              body: await page.screenshot(),
              contentType: 'image/png',
            });
          });
        } finally {
          await fixture.cleanup();
        }
      });
    }

    test('lane 2: saves the six statement kinds and says why a bad value is refused', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_kinds');
      try {
        const medicine = await fixture.concept('Medicine');
        const person = await fixture.concept('Person');
        const patient = await fixture.concept('Patient');
        const dateOfBirth = await fixture.property('dateOfBirth', 'DATA');
        const treats = await fixture.property('treats', 'OBJECT');
        await setMode(api, user.responseData.id, 'classic');

        await openConstraints(page, fixture.ontology);

        await test.step('Refuse a pasted value that is not an address beside the field', async () => {
          const editor = await openNewRule(page);
          await pickByLabel(
            editor.getByTestId('ontology-rule-property'),
            'dateOfBirth'
          );
          const refused = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                '/api/v1/ontologyAxioms/validate' && response.status() === 400
          );
          await pasteIri(
            editor.getByTestId('ontology-rule-subject'),
            'not an address'
          );
          const reason = ((await (await refused).json()) as { message: string })
            .message;

          expect(reason).not.toBe('');
          await expect(
            editor.getByTestId('ontology-axiom-rejection')
          ).toHaveText(reason);
          await expect(
            page.getByTestId('ontology-axiom-submit')
          ).toBeDisabled();
        });

        await test.step('Subclass of: a quick cardinality rule', async () => {
          const editor = page.getByTestId('ontology-axiom-panel');
          await pickByLabel(
            editor.getByTestId('ontology-rule-subject'),
            'Patient'
          );
          await pickByLabel(
            editor.getByTestId('ontology-rule-property'),
            'dateOfBirth'
          );
          const axiom = await saveRule(page);

          expect(axiom.axiomType).toBe('SUBCLASS_OF');
        });

        await test.step('Disjoint with: can never also be', async () => {
          const editor = await openNewRule(page);
          await pickByLabel(
            editor.getByTestId('ontology-rule-subject'),
            'Medicine'
          );
          await editor.getByRole('button', { name: /must have/ }).click();
          await page
            .getByRole('option', { name: 'can never also be', exact: true })
            .click();
          await pickByLabel(
            editor.getByTestId('ontology-rule-other'),
            'Person'
          );
          const axiom = await saveRule(page);

          expect(axiom).toMatchObject({
            axiomType: 'DISJOINT_WITH',
            subjectIri: medicine.iri,
            expressions: [{ kind: 'NAMED_CLASS', classIri: person.iri }],
          });
        });

        await test.step('Equivalent class: is the same as', async () => {
          const editor = await openNewRule(page);
          await pickByLabel(
            editor.getByTestId('ontology-rule-subject'),
            'Patient'
          );
          await editor.getByRole('button', { name: /must have/ }).click();
          await page
            .getByRole('option', { name: 'is the same as', exact: true })
            .click();
          await pickByLabel(
            editor.getByTestId('ontology-rule-other'),
            'Person'
          );
          const axiom = await saveRule(page);

          expect(axiom).toMatchObject({
            axiomType: 'EQUIVALENT_CLASS',
            subjectIri: patient.iri,
          });
        });

        await test.step('Class assertion, data property assertion and object property assertion', async () => {
          const editor = await openNewRule(page);
          await editor.getByTestId('ontology-axiom-mode-advanced').click();
          const type = editor.getByRole('button', { name: AXIOM_TYPE_BUTTON });

          await selectOptionWithRetry(
            type,
            page.getByRole('option', { name: 'Class membership', exact: true })
          );
          await pasteIri(
            editor.getByTestId('ontology-axiom-subject'),
            'urn:example:ada'
          );
          await useNamedClassCondition(editor);
          await pickByLabel(
            editor.getByTestId('ontology-expression-0'),
            'Patient'
          );
          const classAssertion = await saveRule(page);

          expect(classAssertion.axiomType).toBe('CLASS_ASSERTION');

          const dataEditor = await openNewRule(page);
          await dataEditor.getByTestId('ontology-axiom-mode-advanced').click();
          await selectOptionWithRetry(
            dataEditor.getByRole('button', { name: AXIOM_TYPE_BUTTON }),
            page.getByRole('option', {
              name: 'Data property fact',
              exact: true,
            })
          );
          await pasteIri(
            dataEditor.getByTestId('ontology-axiom-subject'),
            'urn:example:ada'
          );
          await pickByLabel(
            dataEditor.getByTestId('ontology-axiom-property'),
            'dateOfBirth'
          );
          await dataEditor
            .getByRole('textbox', { name: /^Value/ })
            .fill('1990-01-01');
          const dataAssertion = await saveRule(page);

          expect(dataAssertion).toMatchObject({
            axiomType: 'DATA_PROPERTY_ASSERTION',
            propertyIri: dateOfBirth.iri,
          });

          const objectEditor = await openNewRule(page);
          await objectEditor
            .getByTestId('ontology-axiom-mode-advanced')
            .click();
          await selectOptionWithRetry(
            objectEditor.getByRole('button', { name: AXIOM_TYPE_BUTTON }),
            page.getByRole('option', {
              name: 'Object property fact',
              exact: true,
            })
          );
          await pasteIri(
            objectEditor.getByTestId('ontology-axiom-subject'),
            'urn:example:dr-lee'
          );
          await pickByLabel(
            objectEditor.getByTestId('ontology-axiom-property'),
            'treats'
          );
          await objectEditor
            .getByRole('textbox', { name: /Target Concept IRI/ })
            .fill('urn:example:ada');
          const objectAssertion = await saveRule(page);

          expect(objectAssertion).toMatchObject({
            axiomType: 'OBJECT_PROPERTY_ASSERTION',
            propertyIri: treats.iri,
          });
        });

        await testInfo.attach('g13-six-kinds', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        expect(
          (await fixture.axioms()).map((axiom) => axiom.axiomType).sort()
        ).toEqual([
          'CLASS_ASSERTION',
          'DATA_PROPERTY_ASSERTION',
          'DISJOINT_WITH',
          'EQUIVALENT_CLASS',
          'OBJECT_PROPERTY_ASSERTION',
          'SUBCLASS_OF',
        ]);
      } finally {
        await fixture.cleanup();
      }
    });

    test('lane 3 and 4: converts a quick rule both ways, explains a rule it cannot, and reads help per kind', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_convert');
      try {
        await fixture.concept('Patient');
        await fixture.concept('Person');
        await fixture.property('dateOfBirth', 'DATA');
        await setMode(api, user.responseData.id, 'classic');

        await openConstraints(page, fixture.ontology);
        const editor = await openNewRule(page);
        await fillQuickMustHave(editor, 'Patient', 'dateOfBirth');
        const preview = editor.getByTestId('ontology-axiom-preview');

        await test.step('Quick to advanced and back keeps the rule', async () => {
          await editor.getByTestId('ontology-axiom-mode-advanced').click();
          await expect(preview).toContainText('Patient');
          await expect(editor.getByTestId('ontology-axiom-help')).toBeVisible();
          await editor.getByTestId('ontology-axiom-mode-quick').click();
          await expect(preview).toContainText(
            'Patient must have exactly 1 dateOfBirth'
          );
        });

        await test.step('Help text names only what the server enforces', async () => {
          const help = editor.getByTestId('ontology-rule-quick-help');

          await expect(help).toContainText('existing data is not checked');
          await editor.getByRole('button', { name: /must have/ }).click();
          await page
            .getByRole('option', { name: 'can never also be', exact: true })
            .click();
          await expect(help).toContainText('validation reports a conflict');
          await editor
            .getByRole('button', { name: /can never also be/ })
            .click();
          await page
            .getByRole('option', { name: 'is the same as', exact: true })
            .click();
          await expect(help).toContainText('add a mapping');
          await testInfo.attach('g13-help', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });

        await test.step('A rule with two conditions stays advanced and says why', async () => {
          await editor.getByTestId('ontology-axiom-mode-advanced').click();
          await editor.getByRole('button', { name: 'Add Constraint' }).click();
          await editor.getByTestId('ontology-axiom-mode-quick').click();

          await expect(
            editor.getByTestId('ontology-axiom-quick-lossy')
          ).toBeVisible();
          await expect(
            editor.getByTestId('ontology-axiom-mode-advanced')
          ).toHaveAttribute('aria-checked', 'true');
          await testInfo.attach('g13-convert', {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('lane 5: loads a condition tree three levels deep and previews it as saved', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_tree');
      try {
        const patient = await fixture.concept('Patient');
        const adult = await fixture.concept('Adult');
        const insured = await fixture.concept('Insured');
        const employed = await fixture.concept('Employed');
        await fixture.axiom({
          name: 'PatientTree',
          axiomType: 'SUBCLASS_OF',
          subjectIri: patient.iri,
          expressions: [
            {
              kind: 'INTERSECTION',
              operands: [
                { kind: 'NAMED_CLASS', classIri: adult.iri },
                {
                  kind: 'UNION',
                  operands: [
                    { kind: 'NAMED_CLASS', classIri: insured.iri },
                    { kind: 'NAMED_CLASS', classIri: employed.iri },
                  ],
                },
              ],
            },
          ],
        });
        await setMode(api, user.responseData.id, 'classic');

        await openConstraints(page, fixture.ontology);
        await page
          .getByRole('button', { name: 'PatientTree', exact: true })
          .click();
        const editor = page.getByTestId('ontology-axiom-panel');

        await expect(editor.getByTestId('ontology-expression-0')).toBeVisible();
        await expect(editor.getByTestId('ontology-expression-1')).toHaveCount(
          2
        );
        await expect(editor.getByTestId('ontology-expression-2')).toHaveCount(
          2
        );
        await expect(
          editor.getByTestId('ontology-axiom-preview')
        ).toContainText('Adult');
        await testInfo.attach('g13-tree', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      } finally {
        await fixture.cleanup();
      }
    });

    for (const mode of MODES) {
      test(`lane 6: opens a saved rule in the quick form and an imported rule in the advanced form in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser: user,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const fixture = await createFixture(api, `rules_edit_${mode}`);
        try {
          const patient = await fixture.concept('Patient');
          const adult = await fixture.concept('Adult');
          const insured = await fixture.concept('Insured');
          const dateOfBirth = await fixture.property('dateOfBirth', 'DATA');
          await fixture.axiom({
            name: 'PatientHasBirthDate',
            axiomType: 'SUBCLASS_OF',
            subjectIri: patient.iri,
            expressions: [
              {
                kind: 'RESTRICTION',
                restrictionKind: 'MIN',
                cardinality: 2,
                propertyIri: dateOfBirth.iri,
              },
            ],
          });
          await fixture.axiom({
            name: 'ImportedPatientRule',
            axiomType: 'EQUIVALENT_CLASS',
            subjectIri: patient.iri,
            provenance: 'Imported',
            expressions: [
              {
                kind: 'UNION',
                operands: [
                  { kind: 'NAMED_CLASS', classIri: adult.iri },
                  { kind: 'NAMED_CLASS', classIri: insured.iri },
                ],
              },
            ],
          });
          await setMode(api, user.responseData.id, mode);

          await openConstraints(page, fixture.ontology);
          await page
            .getByRole('button', { name: 'PatientHasBirthDate', exact: true })
            .click();
          const editor = page.getByTestId('ontology-axiom-panel');

          await expect(editor.getByTestId('ontology-rule-quick')).toBeVisible();
          await expect(
            editor.getByTestId('ontology-axiom-preview')
          ).toContainText('Patient must have at least 2 dateOfBirth');

          await page
            .getByRole('button', { name: 'ImportedPatientRule', exact: true })
            .click();

          await expect(
            page
              .getByTestId('ontology-axiom-panel')
              .getByTestId('ontology-axiom-quick-lossy')
          ).toBeVisible();
          await expect(page.getByTestId('ontology-expression-0')).toBeVisible();
          await testInfo.attach(`g13-edit-${mode}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        } finally {
          await fixture.cleanup();
        }
      });
    }

    for (const mode of MODES) {
      test(`lane 7: shows a clash on the graph, lists it, opens its concept and clears after the fix in ${mode} mode`, async ({
        isolatedUserPage: page,
        isolatedUser: user,
      }, testInfo) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const fixture = await createFixture(api, `rules_clash_${mode}`);
        try {
          const medicine = await fixture.concept('Medicine');
          const person = await fixture.concept('Person');
          const tonic = await fixture.concept('Tonic');
          await fixture.axiom({
            name: 'MedicineNotPerson',
            axiomType: 'DISJOINT_WITH',
            subjectIri: medicine.iri,
            expressions: [{ kind: 'NAMED_CLASS', classIri: person.iri }],
          });
          await fixture.axiom({
            name: 'TonicIsMedicine',
            axiomType: 'SUBCLASS_OF',
            subjectIri: tonic.iri,
            expressions: [{ kind: 'NAMED_CLASS', classIri: medicine.iri }],
          });
          const clash = await fixture.axiom({
            name: 'TonicIsPerson',
            axiomType: 'SUBCLASS_OF',
            subjectIri: tonic.iri,
            expressions: [{ kind: 'NAMED_CLASS', classIri: person.iri }],
          });
          await setMode(api, user.responseData.id, mode);

          await openOntology(page, fixture.ontology);
          await readNodePositions(page);

          const panel = page.getByTestId('ontology-conflicts-panel');

          await expect(page.getByTestId('ontology-conflicts-title')).toHaveText(
            'Conflict to resolve'
          );
          await expect(page.getByTestId('ontology-conflicts-count')).toHaveText(
            '1'
          );
          await expect(panel.getByTestId('ontology-conflict-row')).toHaveCount(
            1
          );
          await testInfo.attach(`g13-conflicts-${mode}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });

          await panel.getByTestId('ontology-conflict-resolve').click();
          const inspector = page.getByTestId('ontology-concept-inspector');
          await expect(
            inspector.getByRole('heading', { name: 'Tonic' })
          ).toBeVisible();
          await expect(
            inspector.getByTestId('ontology-concept-conflicts-toggle')
          ).toHaveAttribute('aria-expanded', 'true');

          expect(
            (
              await api.delete(
                `/api/v1/ontologyAxioms/${clash.id}?hardDelete=true`
              )
            ).ok()
          ).toBe(true);
          await openOntology(page, fixture.ontology);
          await expect(page.getByTestId('ontology-conflicts-title')).toHaveText(
            'Conflicts to resolve'
          );
        } finally {
          await fixture.cleanup();
        }
      });
    }

    test('lane 8: adds data, object and annotation properties and reuses a declared one', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_props');
      try {
        const customer = await fixture.concept('Customer');
        const order = await fixture.concept('Order');
        await setMode(api, user.responseData.id, 'classic');

        await openOntology(page, fixture.ontology);
        await readNodePositions(page);
        await clickGraphNode(page, customer.id);
        const inspector = page.getByTestId('ontology-concept-inspector');

        const openForm = async () => {
          await inspector.getByTestId('ontology-add-property').click();

          return inspector;
        };

        await test.step('Data property with a data type', async () => {
          const form = await openForm();
          await form.getByTestId('ontology-property-name').fill('email');
          await form.getByRole('button', { name: /Range/ }).click();
          await page.getByTestId('ontology-property-type-string').click();
          await clickIgnoringToasts(
            form.getByTestId('ontology-property-submit')
          );
          await expect(inspector.getByText('email')).toBeVisible();
        });

        await test.step('Annotation property', async () => {
          const form = await openForm();
          await form.getByTestId('ontology-property-kind-more').click();
          await form.getByTestId('ontology-property-kind-annotation').click();
          await form.getByTestId('ontology-property-name').fill('internalNote');
          await clickIgnoringToasts(
            form.getByTestId('ontology-property-submit')
          );
          await expect(inspector.getByText('internal note')).toBeVisible();
        });

        await test.step('Reuse email on another concept without a duplicate', async () => {
          await clickGraphNode(page, order.id);
          await expect(inspector).toContainText(order.name);
          await expect(inspector).not.toContainText('email');
          const form = await openForm();
          await form.getByTestId('ontology-property-source-existing').click();
          await pickByLabel(
            form.getByTestId('ontology-property-reuse'),
            'email'
          );
          const reused = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname.startsWith(
                '/api/v1/ontologyProperties/'
              ) && response.request().method() === 'PATCH'
          );
          await clickIgnoringToasts(
            form.getByTestId('ontology-property-submit')
          );
          expect((await reused).ok()).toBe(true);
          await expect(inspector.getByText('email')).toBeVisible();
        });

        const properties = (
          await okJson<{ data: OntologyProperty[] }>(
            await api.get('/api/v1/ontologyProperties', {
              params: { ontology: fixture.fqn, limit: 50 },
            }),
            'List the properties'
          )
        ).data;
        const byName = new Map(properties.map((p) => [p.name, p]));

        expect(properties).toHaveLength(2);
        expect(byName.get('email')).toMatchObject({
          kind: 'DATA',
          range: [`${XSD}string`],
          domain: expect.arrayContaining([customer.iri, order.iri]),
        });
        expect(byName.get('internalNote')?.kind).toBe('ANNOTATION');
        await testInfo.attach('g13-properties', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('lane 8b: picks a property domain and range by label', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_domain');
      try {
        const customer = await fixture.concept('Customer');
        await fixture.concept('Order');
        await setMode(api, user.responseData.id, 'classic');

        await openOntology(page, fixture.ontology);
        await page.getByTestId('submode-tab-definitions').click();
        await page
          .getByRole('tab', { name: 'Properties', exact: true })
          .click();
        await page.getByTestId('ontology-add-property').click();
        const editor = page.getByTestId('ontology-property-editor');

        await editor.getByRole('textbox', { name: /^Name/ }).fill('placedBy');
        await expect(
          editor.getByTestId('ontology-property-domain')
        ).not.toContainText('property chain');
        const domain = editor.getByTestId('ontology-property-domain');
        await pickByLabel(domain, 'Order');
        await domain.getByRole('button', { name: 'Add', exact: true }).click();
        const range = editor.getByTestId('ontology-property-range');
        await pickByLabel(range, 'Customer');
        await range.getByRole('button', { name: 'Add', exact: true }).click();
        const created = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/ontologyProperties' &&
            response.request().method() === 'POST'
        );
        await clickIgnoringToasts(
          editor.getByRole('button', { name: 'Create Property', exact: true })
        );
        const property = await okJson<OntologyProperty>(
          await created,
          'Create the property'
        );

        expect(property.range).toEqual([customer.iri]);
        expect(property.domain).toHaveLength(1);
      } finally {
        await fixture.cleanup();
      }
    });

    test('lane 9: adds a mapping by label, to another ontology by label, and by pasted address', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_mappings');
      const elsewhere = await createFixture(api, 'rules_mappings_other');
      try {
        const customer = await fixture.concept('Customer');
        const party = await fixture.concept('Party');
        const account = await elsewhere.concept('Account');
        await setMode(api, user.responseData.id, 'classic');

        await openOntology(page, fixture.ontology);
        await page.getByTestId('submode-tab-definitions').click();
        await page.getByRole('tab', { name: 'Concepts', exact: true }).click();
        await page
          .getByRole('button', { name: 'Customer', exact: true })
          .click();
        const editor = page.getByTestId('ontology-concept-editor');

        await editor.getByRole('button', { name: 'Add Mapping' }).click();
        await pickByLabel(
          editor
            .getByRole('group', { name: 'Mapping 1' })
            .getByTestId('ontology-mapping-concept'),
          'Party',
          party.iri
        );
        await editor.getByRole('button', { name: 'Add Mapping' }).click();
        const otherPicker = editor
          .getByRole('group', { name: 'Mapping 2' })
          .getByTestId('ontology-mapping-concept');
        const otherInput = otherPicker.getByRole('combobox');
        await otherInput.fill('Account');
        await otherInput.press('ArrowDown');
        const accountOption = page.getByRole('option', { name: /^Account/ });
        await expect(accountOption).toContainText(
          `${elsewhere.ontology.name} · ${account.iri}`
        );
        await accountOption.click();
        await editor.getByRole('button', { name: 'Add Mapping' }).click();
        await pasteIri(
          editor
            .getByRole('group', { name: 'Mapping 3' })
            .getByTestId('ontology-mapping-concept'),
          'https://schema.org/Person'
        );
        const saved = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
              `/api/v1/ontologyConcepts/${customer.id}` &&
            response.request().method() === 'PATCH'
        );
        await clickIgnoringToasts(editor.getByRole('button', { name: 'Save' }));
        const updated = await okJson<OntologyConcept>(
          await saved,
          'Save mappings'
        );

        expect(
          updated.conceptMappings?.map((mapping) => mapping.conceptIri).sort()
        ).toEqual(['https://schema.org/Person', account.iri, party.iri].sort());

        await openOntology(page, fixture.ontology);
        await readNodePositions(page);
        await clickGraphNode(page, customer.id);
        await expect(
          page.getByTestId('ontology-concept-inspector')
        ).toContainText('https://schema.org/Person');
        await testInfo.attach('g13-mappings', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      } finally {
        await fixture.cleanup();
        await elsewhere.cleanup();
      }
    });

    test('lane 10: Validate all lists every clash in the working draft', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_validate_all');
      try {
        const medicine = await fixture.concept('Medicine');
        const person = await fixture.concept('Person');
        const tonic = await fixture.concept('Tonic');
        const pill = await fixture.concept('Pill');
        const syrup = await fixture.concept('Syrup');
        await fixture.axiom({
          name: 'MedicineNotPerson',
          axiomType: 'DISJOINT_WITH',
          subjectIri: medicine.iri,
          expressions: [{ kind: 'NAMED_CLASS', classIri: person.iri }],
        });
        for (const child of [tonic, pill, syrup]) {
          for (const parent of [medicine, person]) {
            await fixture.axiom({
              name: `${child.name}Is${parent.name}`,
              axiomType: 'SUBCLASS_OF',
              subjectIri: child.iri,
              expressions: [{ kind: 'NAMED_CLASS', classIri: parent.iri }],
            });
          }
        }
        await setMode(api, user.responseData.id, 'classic');

        await openOntology(page, fixture.ontology);
        const panel = page.getByTestId('ontology-conflicts-panel');
        const validated = page.waitForResponse((response) =>
          response.url().endsWith('/working/validation')
        );
        await panel.getByTestId('ontology-validate-all').click();
        await validated;

        await expect(panel.getByTestId('ontology-conflict-row')).toHaveCount(3);
        await expect(page.getByTestId('ontology-conflicts-title')).toHaveText(
          'Conflicts to resolve'
        );
        await expect(page.getByTestId('ontology-conflicts-count')).toHaveText(
          '3'
        );
        for (const child of [tonic, pill, syrup]) {
          await expect(panel).toContainText(child.name);
        }
        await testInfo.attach('g13-validate-all', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      } finally {
        await fixture.cleanup();
      }
    });

    test('lane 11: the relationship picker warns when a new parent would clash', async ({
      isolatedUserPage: page,
      isolatedUser: user,
    }, testInfo) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const fixture = await createFixture(api, 'rules_picker_clash');
      try {
        const medicine = await fixture.concept('Medicine');
        const person = await fixture.concept('Person');
        const tonic = await fixture.concept('Tonic');
        await fixture.axiom({
          name: 'MedicineNotPerson',
          axiomType: 'DISJOINT_WITH',
          subjectIri: medicine.iri,
          expressions: [{ kind: 'NAMED_CLASS', classIri: person.iri }],
        });
        await fixture.axiom({
          name: 'TonicIsMedicine',
          axiomType: 'SUBCLASS_OF',
          subjectIri: tonic.iri,
          expressions: [{ kind: 'NAMED_CLASS', classIri: medicine.iri }],
        });
        await setMode(api, user.responseData.id, 'classic');

        await openOntology(page, fixture.ontology);
        await readNodePositions(page);
        await clickGraphNode(page, tonic.id);
        const inspector = page.getByTestId('ontology-concept-inspector');
        await inspector.getByTestId('ontology-add-relationship').click();
        await chooseInspectorRelationType(page, inspector, SUBCLASS_OF);
        const target = inspector.getByLabel('Target');
        await selectOptionWithRetry(
          target,
          page.getByRole('option', { name: 'Person', exact: true })
        );

        await expect(
          inspector.getByTestId('ontology-relationship-clash')
        ).toBeVisible();
        await expect(
          inspector.getByTestId('ontology-relationship-clash')
        ).toContainText('Tonic');
        await expect(
          inspector.getByTestId('ontology-relationship-submit')
        ).toBeEnabled();
        await testInfo.attach('g13-picker-clash', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      } finally {
        await fixture.cleanup();
      }
    });
  }
);
