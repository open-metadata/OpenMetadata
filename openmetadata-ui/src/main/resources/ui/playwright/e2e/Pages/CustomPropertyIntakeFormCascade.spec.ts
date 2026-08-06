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

/**
 * Deleting a custom property must prune it from that entity type's intake form.
 *
 * This is the one custom-property test that has to CREATE and DELETE properties
 * rather than read the shared fixtures, and it also needs an intake form to
 * prune from. That makes it the only spec contending for two singleton
 * resources at once:
 *
 *   - the entity-type row, which `PUT /api/v1/metadata/types/{id}` rewrites
 *     wholesale and CustomProperties.spec.ts also writes
 *   - the intake form, which is one-per-entityType and IntakeForm.spec.ts
 *     creates and deletes
 *
 * No single spec file serialises both, so this lives in its own Playwright
 * project that depends on `chromium`. By the time it runs, both of those specs
 * have finished and it is the sole writer of either resource.
 */

import { expect, test } from '@playwright/test';
import { INTAKE_FORM_CUSTOM_PROPERTY_ENTITIES } from '../../constant/customProperty';
import { createNewPage, uuid } from '../../utils/common';
import {
  createStringCustomProperty,
  removeCustomPropertyByApi,
  removeIntakeForm,
} from '../../utils/customProperty';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

for (const entityType of INTAKE_FORM_CUSTOM_PROPERTY_ENTITIES) {
  test.describe(`Custom property intake-form cascade for ${entityType}`, () => {
    const deletedProperty = `pwIntakeDeleted${uuid()}`;
    const survivingProperty = `pwIntakeSurviving${uuid()}`;

    test.beforeAll(
      'Create the disposable intake-form properties',
      async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);

        for (const propertyName of [deletedProperty, survivingProperty]) {
          await createStringCustomProperty(
            apiContext,
            entityType,
            propertyName
          );
        }

        await afterAction();
      }
    );

    test.afterAll(
      'Remove the intake form and any surviving properties',
      async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);

        // Both helpers no-op when the target is already gone, so this cleans up
        // whether the test passed, failed mid-way, or never ran. Leaving an
        // enabled intake form behind would make every other spec's create form
        // for this entity demand a required field.
        await removeIntakeForm(apiContext, entityType);

        for (const propertyName of [deletedProperty, survivingProperty]) {
          await removeCustomPropertyByApi(apiContext, entityType, propertyName);
        }

        await afterAction();
      }
    );

    test(`deleting a required custom property prunes it from the ${entityType} intake form`, async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await removeIntakeForm(apiContext, entityType);

      const createResponse = await apiContext.post(
        '/api/v1/governance/intakeForms',
        {
          data: {
            name: entityType,
            entityType,
            enabled: true,
            formFields: [
              {
                fieldKind: 'customProperty',
                fieldLabel: deletedProperty,
                fieldPath: `extension.${deletedProperty}`,
                required: true,
              },
              {
                fieldKind: 'customProperty',
                fieldLabel: survivingProperty,
                fieldPath: `extension.${survivingProperty}`,
                required: false,
              },
            ],
          },
        }
      );

      expect(createResponse.status()).toBe(201);

      await removeCustomPropertyByApi(apiContext, entityType, deletedProperty);

      const intakeFormResponse = await apiContext.get(
        `/api/v1/governance/intakeForms/entityType/${entityType}`
      );

      expect(intakeFormResponse.status()).toBe(200);

      const intakeForm = (await intakeFormResponse.json()) as {
        formFields: Array<{ fieldPath: string; required: boolean }>;
        requiredFields: Array<{ fieldPath: string }>;
      };

      expect(intakeForm.formFields).toEqual([
        expect.objectContaining({
          fieldPath: `extension.${survivingProperty}`,
          required: false,
        }),
      ]);
      expect(intakeForm.requiredFields).toHaveLength(0);

      await afterAction();
    });
  });
}
