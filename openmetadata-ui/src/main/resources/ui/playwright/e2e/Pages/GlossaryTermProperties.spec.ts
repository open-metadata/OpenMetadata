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

import { APIRequestContext, Page, Response } from '@playwright/test';
import { PolicyRulesType } from '../../support/access-control/PoliciesClass';
import { expect, test } from '../../support/fixtures/userPages';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { chooseSelectOption, uuid } from '../../utils/common';
import {
  fillGlossaryTermForm,
  saveGlossaryTermForm,
  waitForGlossaryTermForm,
} from '../../utils/glossaryForm';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

const glossary = new Glossary();
const parentTerm = new GlossaryTerm(glossary);
const childTerm = new GlossaryTerm(glossary);

const PROPERTY_EDITOR_RULES: PolicyRulesType[] = [
  {
    name: 'ViewGlossary-Rule',
    resources: ['glossary', 'glossaryTerm'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
  {
    name: 'EditTermProperties-Rule',
    resources: ['glossaryTerm'],
    operations: ['EditGlossaryTermProperties'],
    effect: 'allow',
  },
];

const PARENT_VALUE = 'Alpha';
const CHILD_VALUE = 'Beta';
const OVERRIDE_VALUE = 'Gamma';

// Property names stay alphanumeric so the derived `name` equals the display
// name and the row test ids are predictable.
const newPropertyName = (prefix: string) => `${prefix}${uuid()}`;

const isTermRequest = (response: Response, method: string) =>
  response.url().includes('/api/v1/glossaryTerms/') &&
  response.request().method() === method;

const visitTerm = async (page: Page, term: GlossaryTerm) => {
  const termResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .includes(
          `/api/v1/glossaryTerms/name/${encodeURIComponent(
            term.responseData.fullyQualifiedName
          )}`
        ),
    200
  );
  await page.goto(
    `/glossary/${encodeURIComponent(term.responseData.fullyQualifiedName)}`
  );
  await termResponse;

  await expect(page.getByTestId('entity-header-display-name')).toHaveText(
    term.responseData.displayName
  );
  await expect(page.getByTestId('glossary-term-properties')).toBeVisible();
};

const getPropertyRow = (page: Page, name: string) =>
  page.getByTestId(`glossary-term-property-${name}`);

const seedProperty = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  name: string,
  value?: string
) => {
  const operations: Record<string, unknown>[] = [
    {
      op: 'add',
      path: '/propertyDefinitions',
      value: [{ name, displayName: name, datatype: 'string' }],
    },
  ];
  if (value !== undefined) {
    operations.push({
      op: 'add',
      path: '/propertyValues',
      value: { [name]: [value] },
    });
  }
  await term.patch(apiContext, operations);
};

const clearProperties = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm
) => {
  await term.patch(apiContext, [
    { op: 'remove', path: '/propertyValues' },
    { op: 'remove', path: '/propertyDefinitions' },
  ]);
};

const savePropertyModal = async (page: Page) => {
  const patchResponse = waitForResponseWithStatus(
    page,
    (response) => isTermRequest(response, 'PATCH'),
    200
  );
  await page.getByTestId('property-save').click();
  await patchResponse;

  await expect(page.getByTestId('property-save')).toBeHidden();
};

const openAddMenuItem = async (page: Page, name: RegExp) => {
  await page.getByTestId('glossary-term-add-button-menu').click();
  await page.getByRole('menuitem', { name }).click();
};

test.describe('Glossary term properties', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await glossary.create(apiContext);
      await parentTerm.create(apiContext);
      childTerm.data.parent = parentTerm.responseData.fullyQualifiedName;
      await childTerm.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      await glossary.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.describe('define, inherit, override, reset and delete', () => {
    test.describe.configure({ mode: 'serial' });

    const propertyName = newPropertyName('Steward');

    test('shows the empty state before any property exists', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);

      await expect(
        adminPage.getByTestId('glossary-term-properties-empty')
      ).toContainText('No properties yet');
    });

    test('defines a property on the parent term from the Add menu', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);
      await openAddMenuItem(adminPage, /Property/);

      await adminPage.getByTestId('property-name-input').fill(propertyName);
      await adminPage.getByTestId('property-value-input').fill(PARENT_VALUE);
      await savePropertyModal(adminPage);

      const row = getPropertyRow(adminPage, propertyName);
      await expect(row).toContainText('Defined here');
      await expect(
        adminPage.getByTestId(`glossary-term-property-value-${propertyName}`)
      ).toHaveText(PARENT_VALUE);
      await expect(
        adminPage.getByTestId('glossary-term-properties-summary')
      ).toContainText('1 defined here');
    });

    test('the child term inherits the property and names its source', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, childTerm);

      const row = getPropertyRow(adminPage, propertyName);
      await expect(row).toContainText(parentTerm.responseData.displayName);
      await expect(
        adminPage.getByTestId(`glossary-term-property-value-${propertyName}`)
      ).toHaveText(PARENT_VALUE);
      await expect(
        adminPage.getByTestId(`delete-property-${propertyName}`)
      ).toBeHidden();
      await expect(
        adminPage.getByTestId('glossary-term-properties-summary')
      ).toContainText('1 inherited from parent terms');
    });

    test('overrides the inherited value on the child term', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, childTerm);

      await adminPage.getByTestId(`edit-property-${propertyName}`).click();
      await expect(adminPage.getByTestId('property-name-input')).toBeDisabled();
      await adminPage.getByTestId('property-value-input').fill(CHILD_VALUE);
      await savePropertyModal(adminPage);

      const row = getPropertyRow(adminPage, propertyName);
      await expect(row).toContainText('Overridden here');
      await expect(
        adminPage.getByTestId(`glossary-term-property-value-${propertyName}`)
      ).toHaveText(CHILD_VALUE);
    });

    test('resets the override to the inherited value', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, childTerm);

      const patchResponse = waitForResponseWithStatus(
        adminPage,
        (response) => isTermRequest(response, 'PATCH'),
        200
      );
      await adminPage.getByTestId(`reset-property-${propertyName}`).click();
      await patchResponse;

      await expect(
        adminPage.getByTestId(`glossary-term-property-value-${propertyName}`)
      ).toHaveText(PARENT_VALUE);
      await expect(
        adminPage.getByTestId(`reset-property-${propertyName}`)
      ).toBeHidden();
    });

    test('deleting the property confirms the impact and removes the child value', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, childTerm);
      await adminPage.getByTestId(`edit-property-${propertyName}`).click();
      await adminPage.getByTestId('property-value-input').fill(CHILD_VALUE);
      await savePropertyModal(adminPage);

      await visitTerm(adminPage, parentTerm);

      const impactResponse = waitForResponseWithStatus(
        adminPage,
        (response) =>
          response.request().method() === 'GET' &&
          response
            .url()
            .includes(`/propertyDefinitions/${propertyName}/impact`),
        200
      );
      await adminPage.getByTestId(`delete-property-${propertyName}`).click();
      await impactResponse;

      await expect(adminPage.getByTestId('delete-modal')).toContainText(
        childTerm.responseData.fullyQualifiedName
      );

      const deleteResponse = waitForResponseWithStatus(
        adminPage,
        (response) => isTermRequest(response, 'PATCH'),
        200
      );
      await adminPage.getByTestId('confirm-button').click();
      await deleteResponse;

      await expect(getPropertyRow(adminPage, propertyName)).toBeHidden();

      await visitTerm(adminPage, childTerm);

      await expect(getPropertyRow(adminPage, propertyName)).toBeHidden();
    });
  });

  test.describe('create form', () => {
    const inheritedName = newPropertyName('Region');
    const addedName = newPropertyName('Tier');
    const createdTerm = new GlossaryTerm(glossary, undefined, undefined);

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await seedProperty(apiContext, parentTerm, inheritedName, PARENT_VALUE);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await clearProperties(apiContext, parentTerm);
      } finally {
        await afterAction();
      }
    });

    test('creates a child term with its own property and shows the inherited one', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);
      await openAddMenuItem(adminPage, /Child term/);
      const form = await waitForGlossaryTermForm(
        adminPage,
        'Add Glossary Term'
      );

      await expect(
        form.getByTestId(`inherited-property-${inheritedName}`)
      ).toContainText(parentTerm.responseData.displayName);

      await fillGlossaryTermForm(adminPage, form, {
        name: createdTerm.data.name,
        displayName: createdTerm.data.displayName,
        description: 'Child term created with properties',
      });

      await form.getByTestId(`override-inherited-${inheritedName}`).click();
      await form
        .getByTestId(`inherited-value-${inheritedName}`)
        .fill(OVERRIDE_VALUE);
      await expect(
        form.getByTestId(`inherited-property-${inheritedName}`)
      ).toContainText('Overridden here');

      await form.getByTestId('add-property-row').click();
      await form.getByTestId('property-name-0').fill(addedName);
      await form.getByTestId('property-value-0').fill(CHILD_VALUE);

      const response = await saveGlossaryTermForm(adminPage, 'create');

      const payload = response.request().postDataJSON();
      expect(payload.propertyDefinitions).toEqual([
        expect.objectContaining({ name: addedName, datatype: 'string' }),
      ]);
      expect(payload.propertyValues).toEqual({
        [addedName]: [CHILD_VALUE],
        [inheritedName]: [OVERRIDE_VALUE],
      });

      createdTerm.responseData = await response.json();
      await visitTerm(adminPage, createdTerm);

      await expect(getPropertyRow(adminPage, addedName)).toContainText(
        'Defined here'
      );
      await expect(getPropertyRow(adminPage, inheritedName)).toContainText(
        parentTerm.responseData.displayName
      );
      await expect(getPropertyRow(adminPage, inheritedName)).toContainText(
        'Overridden here'
      );
      await expect(
        adminPage.getByTestId(`glossary-term-property-value-${inheritedName}`)
      ).toHaveText(OVERRIDE_VALUE);
    });

    test('reverts an override in the create form back to the inherited value', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);
      await openAddMenuItem(adminPage, /Child term/);
      const form = await waitForGlossaryTermForm(
        adminPage,
        'Add Glossary Term'
      );
      const inherited = form.getByTestId(`inherited-property-${inheritedName}`);

      await form.getByTestId(`override-inherited-${inheritedName}`).click();
      await form
        .getByTestId(`inherited-value-${inheritedName}`)
        .fill(OVERRIDE_VALUE);
      await expect(inherited).toContainText(OVERRIDE_VALUE);

      await form.getByTestId(`revert-inherited-${inheritedName}`).click();

      await expect(inherited).toContainText(PARENT_VALUE);
      await expect(inherited).not.toContainText('Overridden here');
    });

    test('picks a property type with the keyboard in the add modal', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);
      await adminPage.getByTestId('add-property-button').click();

      const types = adminPage.getByRole('radiogroup', { name: 'Type' });
      await types.getByRole('radio', { name: 'Text' }).focus();
      await adminPage.keyboard.press('ArrowRight');

      await expect(types.getByRole('radio', { name: 'Number' })).toBeChecked();
      await expect(types.getByRole('radio')).toHaveCount(6);
    });

    test('blocks submit while a new property row has no name', async ({
      adminPage,
    }) => {
      await visitTerm(adminPage, parentTerm);
      await openAddMenuItem(adminPage, /Child term/);
      const form = await waitForGlossaryTermForm(
        adminPage,
        'Add Glossary Term'
      );

      await form.getByTestId('add-property-row').click();
      await form.getByTestId('property-value-0').fill(CHILD_VALUE);
      await chooseSelectOption(
        form.getByTestId('property-type-0'),
        adminPage.getByRole('option', { name: 'Number', exact: true })
      );
      await adminPage.getByTestId('save-glossary-term').press('Enter');

      await expect(adminPage.getByTestId('glossary-term-drawer')).toBeVisible();
    });
  });

  test.describe('permissions', () => {
    const readOnlyName = newPropertyName('Owner');

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await seedProperty(apiContext, parentTerm, readOnlyName, PARENT_VALUE);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await clearProperties(apiContext, parentTerm);
      } finally {
        await afterAction();
      }
    });

    test('a data consumer sees the properties read-only', async ({
      dataConsumerPage,
    }) => {
      await visitTerm(dataConsumerPage, parentTerm);

      await expect(
        dataConsumerPage.getByTestId(
          `glossary-term-property-value-${readOnlyName}`
        )
      ).toHaveText(PARENT_VALUE);
      await expect(
        dataConsumerPage.getByTestId('add-property-button')
      ).toBeHidden();
      await expect(
        dataConsumerPage.getByTestId(`edit-property-${readOnlyName}`)
      ).toBeHidden();
      await expect(
        dataConsumerPage.getByTestId(`delete-property-${readOnlyName}`)
      ).toBeHidden();
    });

    test('a view-only user sees the properties read-only', async ({
      viewOnlyPage,
    }) => {
      await visitTerm(viewOnlyPage, parentTerm);

      await expect(getPropertyRow(viewOnlyPage, readOnlyName)).toBeVisible();
      await expect(
        viewOnlyPage.getByTestId('add-property-button')
      ).toBeHidden();
      await expect(
        viewOnlyPage.getByTestId(`edit-property-${readOnlyName}`)
      ).toBeHidden();
    });

    test.describe('a user granted only EditGlossaryTermProperties', () => {
      // The seeded role pages cannot express this policy, so the test mints its own user.
      const propertyEditor = new UserClass();

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await propertyEditor.create(apiContext, false);
          await propertyEditor.setCustomRulePolicy(
            apiContext,
            PROPERTY_EDITOR_RULES,
            'PW%Edit-Term-Properties'
          );
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          await propertyEditor.delete(apiContext);
        } finally {
          await afterAction();
        }
      });

      test('can add and override properties but no other edit action', async ({
        browser,
      }) => {
        const page = await browser.newPage();
        const addedName = newPropertyName('Added');
        try {
          await propertyEditor.signIn(page);

          await visitTerm(page, parentTerm);
          await expect(page.getByTestId('edit-description')).toBeHidden();
          await page.getByTestId('add-property-button').click();
          await page.getByTestId('property-name-input').fill(addedName);
          await page.getByTestId('property-value-input').fill(PARENT_VALUE);
          await savePropertyModal(page);
          await expect(getPropertyRow(page, addedName)).toContainText(
            'Defined here'
          );

          await visitTerm(page, childTerm);
          await page.getByTestId(`edit-property-${readOnlyName}`).click();
          await page.getByTestId('property-value-input').fill(CHILD_VALUE);
          await savePropertyModal(page);
          await expect(getPropertyRow(page, readOnlyName)).toContainText(
            'Overridden here'
          );
          await expect(page.getByTestId('edit-description')).toBeHidden();
        } finally {
          await page.close();
        }
      });
    });
  });
});
