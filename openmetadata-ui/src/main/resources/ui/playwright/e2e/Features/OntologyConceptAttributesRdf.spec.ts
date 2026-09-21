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
import { expect, test } from '../../support/fixtures/base';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { OntologyRdfFixture } from '../../support/ontology/OntologyRdfFixture';
import { performAdminLogin } from '../../utils/admin';
import { fullUuid, uuid } from '../../utils/common';
import {
  navigateToOntologyStudio,
  readNodePositions,
  releaseOntologyEditLease,
  waitForGraphLoaded,
} from '../../utils/ontologyStudio';

const suffix = uuid().replaceAll('-', '');
const fixture = new OntologyRdfFixture(`pw_attributes_${suffix}`);

let party: GlossaryTerm;
let person: GlossaryTerm;
let customer: GlossaryTerm;

/**
 * Attributes inherit down the structural parent chain: Party declares partyId, Person adds email,
 * and Customer adds loyaltyTier. Customer should therefore report all three, with the two it does
 * not declare marked as inherited from the concept that does.
 */
const PARTY_ATTRIBUTE = 'partyId';
const PERSON_ATTRIBUTE = 'email';
const CUSTOMER_ATTRIBUTE = 'loyaltyTier';

const declareAttribute = (name: string) => [
  {
    op: 'add',
    path: '/attributes',
    value: [{ id: fullUuid(), name, dataType: 'STRING', isIdentifier: false }],
  },
];

const effectiveAttributeNames = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm
): Promise<string[]> => {
  const response = await apiContext.get(
    `/api/v1/glossaryTerms/${term.responseData.id}?fields=effectiveAttributes`
  );

  expect(response.ok(), await response.text()).toBe(true);

  const body = await response.json();

  return (body.effectiveAttributes ?? []).map(
    (attribute: { name: string }) => attribute.name
  );
};

const openInspectorForTerm = async (page: Page, term: GlossaryTerm) => {
  await navigateToOntologyStudio(page);
  await fixture.selectInStudio(page);
  await page.getByTestId('mode-tab-edit').click();
  await expect(page.getByTestId('ontology-edit-lease-status')).toContainText(
    'Active'
  );
  await waitForGraphLoaded(page);

  const positions = await readNodePositions(page);
  const position = positions[term.responseData.id];
  expect(position).toBeDefined();
  await page.mouse.click(position.x, position.y);

  await expect(page.getByTestId('ontology-authoring-inspector')).toBeVisible();
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

test.describe(
  'Ontology concept attribute inheritance',
  { tag: ['@ontology-rdf'] },
  () => {
    test.beforeAll(
      'Seed a three-level concept hierarchy',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await fixture.create(apiContext);
        party = await fixture.createTerm(apiContext, `Party${suffix}`);
        person = await fixture.createTerm(apiContext, `Person${suffix}`, party);
        customer = await fixture.createTerm(
          apiContext,
          `Customer${suffix}`,
          person
        );

        await party.patch(apiContext, declareAttribute(PARTY_ATTRIBUTE));
        await person.patch(apiContext, declareAttribute(PERSON_ATTRIBUTE));
        await customer.patch(apiContext, declareAttribute(CUSTOMER_ATTRIBUTE));

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await fixture.delete(apiContext);
      await afterAction();
    });

    test('the API reports declared and inherited attributes for a descendant concept', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const response = await apiContext.get(
          `/api/v1/glossaryTerms/${customer.responseData.id}?fields=effectiveAttributes`
        );

        expect(response.ok(), await response.text()).toBe(true);

        const term = await response.json();
        const byName = Object.fromEntries(
          (term.effectiveAttributes ?? []).map(
            (attribute: { name: string }) => [attribute.name, attribute]
          )
        );

        expect(Object.keys(byName).sort()).toEqual(
          [CUSTOMER_ATTRIBUTE, PERSON_ATTRIBUTE, PARTY_ATTRIBUTE].sort()
        );
        expect(byName[CUSTOMER_ATTRIBUTE].inherited).toBeFalsy();
        expect(byName[PERSON_ATTRIBUTE].inherited).toBe(true);
        expect(byName[PERSON_ATTRIBUTE].declaringTerm.id).toBe(
          person.responseData.id
        );
        expect(byName[PARTY_ATTRIBUTE].inherited).toBe(true);
        expect(byName[PARTY_ATTRIBUTE].declaringTerm.id).toBe(
          party.responseData.id
        );
      } finally {
        await afterAction();
      }
    });

    test('a stored attribute list never absorbs an ancestor declaration', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const response = await apiContext.get(
          `/api/v1/glossaryTerms/${customer.responseData.id}?fields=effectiveAttributes`
        );
        const term = await response.json();

        expect(
          (term.attributes ?? []).map(
            (attribute: { name: string }) => attribute.name
          )
        ).toEqual([CUSTOMER_ATTRIBUTE]);
      } finally {
        await afterAction();
      }
    });

    test('the inspector renders inherited attributes as read-only and names their declaring concept', async ({
      page,
    }) => {
      await openInspectorForTerm(page, customer);

      await expect(
        page.getByTestId(`ontology-attribute-${CUSTOMER_ATTRIBUTE}`)
      ).toBeVisible();

      const inheritedFromPerson = page.getByTestId(
        `inherited-attribute-${PERSON_ATTRIBUTE}`
      );
      await expect(inheritedFromPerson).toBeVisible();
      await expect(inheritedFromPerson).toContainText(
        person.responseData.displayName
      );
      await expect(
        page.getByTestId(`inherited-attribute-${PARTY_ATTRIBUTE}`)
      ).toContainText(party.responseData.displayName);

      // Inherited declarations are edited on the concept that owns them, so the
      // descendant offers no remove control for them.
      await expect(
        page.getByTestId(`remove-attribute-${PERSON_ATTRIBUTE}`)
      ).toHaveCount(0);

      await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
    });

    test('a root concept shows only what it declares', async ({ page }) => {
      await openInspectorForTerm(page, party);

      await expect(
        page.getByTestId(`ontology-attribute-${PARTY_ATTRIBUTE}`)
      ).toBeVisible();
      await expect(
        page.getByTestId(`inherited-attribute-${PERSON_ATTRIBUTE}`)
      ).toHaveCount(0);

      await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
    });

    test('a concept redeclaring an ancestor attribute shadows it instead of duplicating it', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const shadowing = await fixture.createTerm(
          apiContext,
          `Shadowing${suffix}`,
          person
        );
        await shadowing.patch(apiContext, declareAttribute(PERSON_ATTRIBUTE));

        const response = await apiContext.get(
          `/api/v1/glossaryTerms/${shadowing.responseData.id}?fields=effectiveAttributes`
        );
        const term = await response.json();
        const emailEntries = (term.effectiveAttributes ?? []).filter(
          (attribute: { name: string }) => attribute.name === PERSON_ATTRIBUTE
        );

        expect(emailEntries).toHaveLength(1);
        expect(emailEntries[0].inherited).toBeFalsy();
      } finally {
        await afterAction();
      }
    });

    test('an attribute authored in the inspector reaches the concept and its descendants', async ({
      page,
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const authored = `authored${suffix}`;

      try {
        await openInspectorForTerm(page, person);

        await page.getByTestId('add-attribute').click();
        await page
          .getByTestId('attribute-name-input')
          .locator('input')
          .fill(authored);

        const saved = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/glossaryTerms/') &&
            response.request().method() === 'PATCH' &&
            response.status() === 200
        );
        await page.getByTestId('save-attribute').click();
        await saved;

        await expect(
          page.getByTestId(`ontology-attribute-${authored}`)
        ).toBeVisible();

        expect(
          await effectiveAttributeNames(apiContext, customer),
          'the descendant inherits an attribute authored through the UI'
        ).toContain(authored);

        await releaseOntologyEditLease(page, fixture.glossary.responseData.id);
      } finally {
        await afterAction();
      }
    });

    test('re-parenting a concept changes what it inherits', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        const movable = await fixture.createTerm(
          apiContext,
          `Movable${suffix}`,
          person
        );

        expect(await effectiveAttributeNames(apiContext, movable)).toContain(
          PERSON_ATTRIBUTE
        );

        await movable.patch(apiContext, [
          {
            op: 'replace',
            path: '/parent',
            value: {
              id: party.responseData.id,
              type: 'glossaryTerm',
              name: party.responseData.name,
              fullyQualifiedName: party.responseData.fullyQualifiedName,
            },
          },
        ]);

        const afterMove = await effectiveAttributeNames(apiContext, movable);

        expect(afterMove, 'it keeps the new parent chain').toContain(
          PARTY_ATTRIBUTE
        );
        expect(
          afterMove,
          'it no longer inherits from the concept it left'
        ).not.toContain(PERSON_ATTRIBUTE);
      } finally {
        await afterAction();
      }
    });

    test('a concept shadows an ancestor attribute that shares its IRI', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const sharedIri = `http://example.com/ontology/${suffix}#contact`;

      try {
        const iriParent = await fixture.createTerm(
          apiContext,
          `IriParent${suffix}`
        );
        await iriParent.patch(apiContext, [
          {
            op: 'add',
            path: '/attributes',
            value: [
              {
                id: fullUuid(),
                name: 'ancestorContact',
                iri: sharedIri,
                dataType: 'STRING',
                isIdentifier: false,
              },
            ],
          },
        ]);

        const iriChild = await fixture.createTerm(
          apiContext,
          `IriChild${suffix}`,
          iriParent
        );
        await iriChild.patch(apiContext, [
          {
            op: 'add',
            path: '/attributes',
            value: [
              {
                id: fullUuid(),
                name: 'ownContact',
                iri: sharedIri,
                dataType: 'STRING',
                isIdentifier: false,
              },
            ],
          },
        ]);

        expect(
          await effectiveAttributeNames(apiContext, iriChild),
          'the same IRI means the same property, so only the local name survives'
        ).toEqual(['ownContact']);
      } finally {
        await afterAction();
      }
    });

    /**
     * Effective attributes are recomputed per read rather than stored, so an ancestor edit must
     * reach every descendant immediately. This is the case an indexed or cached copy would get
     * wrong.
     */
    test('editing an ancestor changes what its descendants inherit', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const addedAttribute = 'taxId';

      try {
        const before = await effectiveAttributeNames(apiContext, customer);

        expect(before).not.toContain(addedAttribute);

        await party.patch(apiContext, [
          {
            op: 'add',
            path: '/attributes',
            value: [
              {
                id: fullUuid(),
                name: PARTY_ATTRIBUTE,
                dataType: 'STRING',
                isIdentifier: false,
              },
              {
                id: fullUuid(),
                name: addedAttribute,
                dataType: 'STRING',
                isIdentifier: false,
              },
            ],
          },
        ]);

        const afterAdd = await effectiveAttributeNames(apiContext, customer);

        expect(
          afterAdd,
          'the grandchild picks up an attribute added two levels up'
        ).toContain(addedAttribute);

        await party.patch(apiContext, declareAttribute(PARTY_ATTRIBUTE));

        const afterRemove = await effectiveAttributeNames(apiContext, customer);

        expect(
          afterRemove,
          'removing it from the ancestor withdraws it from the grandchild'
        ).not.toContain(addedAttribute);
        expect(afterRemove).toContain(PARTY_ATTRIBUTE);
      } finally {
        await afterAction();
      }
    });
  }
);
