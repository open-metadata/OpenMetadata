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

import { expect } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { deleteFixtureEntity, okJson } from '../../../utils/apiResponse';
import {
  clickIgnoringToasts,
  fillDescriptionBox,
  uuid,
} from '../../../utils/common';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';
import {
  disableAiAppMode,
  stubUserPreferencesAppMode,
} from '../../Utils/appMode';

interface SavedQuery {
  id: string;
  query: string;
  description?: string;
  queryUsedIn: Array<{ id: string }>;
  owners: Array<{ id: string; name: string }>;
}

test.describe(
  'Classic Incident Manager SQL query',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Incident_Manager` },
  () => {
    let table: TableClass;
    let testCaseFqn: string;
    let tableFqn: string;
    let initialQuery: string;
    let savedQueryId: string | undefined;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      table = new TableClass();
      savedQueryId = undefined;
      try {
        await table.create(apiContext);
        const fqn = table.entityResponseData.fullyQualifiedName;
        if (!fqn) {
          throw new Error('Created table must have a fully qualified name');
        }
        tableFqn = fqn;
        const testCase = await table.createTestCase(apiContext);
        testCaseFqn = testCase.fullyQualifiedName;
        initialQuery = `SELECT * FROM test_table /* ${uuid()} */`;
        const response = await apiContext.put(
          `/api/v1/dataQuality/testCases/${testCase.id}/inspectionQuery`,
          {
            data: JSON.stringify(initialQuery),
            headers: { 'Content-Type': 'application/json' },
          }
        );
        expect(response.status()).toBe(200);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        if (savedQueryId) {
          await deleteFixtureEntity(
            apiContext,
            `/api/v1/queries/${savedQueryId}?hardDelete=true`
          );
        }
        await table.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await disableAiAppMode(page);
      await stubUserPreferencesAppMode(page, 'classic');
      await page.goto(
        `/test-case/${encodeURIComponent(testCaseFqn)}/sql-query`,
        {
          waitUntil: 'domcontentloaded',
        }
      );
      await expect(page.getByTestId('add-to-table-button')).toBeVisible();
    });

    test('validates a required query and saves the edited SQL for its table', async ({
      page,
      browser,
    }) => {
      const dialog = page.getByRole('dialog', { name: 'Add New Query' });
      const editor = dialog
        .getByTestId('sql-editor-container')
        .getByRole('textbox');
      const editedQuery = `${initialQuery}\nWHERE id > 0`;
      const description = 'Inspection query saved from the incident';

      await test.step('Show the inspection query and reject an empty query', async () => {
        await page.getByTestId('add-to-table-button').click();
        await expect(dialog).toBeVisible();
        await expect(editor).toContainText(initialQuery);
        await expect(dialog.getByTestId('table')).toBeDisabled();
        await expect(dialog.getByTestId('table')).toHaveValue(tableFqn);
        await editor.fill('');
        await clickIgnoringToasts(
          dialog.getByRole('button', { name: 'Save', exact: true })
        );
        await expect(dialog.getByText(/SQL Query.*required/i)).toBeVisible();
      });

      await test.step('Save and verify the persisted query, owner and table', async () => {
        await editor.fill(editedQuery);
        await fillDescriptionBox(dialog, description);
        const responsePromise = waitForResponseWithStatus(
          page,
          (response) =>
            new URL(response.url()).pathname === '/api/v1/queries' &&
            response.request().method() === 'POST',
          201
        );
        await clickIgnoringToasts(
          dialog.getByRole('button', { name: 'Save', exact: true })
        );
        const response = await responsePromise;
        const savedQuery: SavedQuery = await response.json();
        savedQueryId = savedQuery.id;
        expect(savedQuery.query).toBe(editedQuery);
        expect(savedQuery.description).toContain(description);
        expect(savedQuery.queryUsedIn).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: table.entityResponseData.id }),
          ])
        );
        expect(savedQuery.owners).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: 'admin' })])
        );
        await expect(dialog).not.toBeVisible();
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          const persisted = await okJson<SavedQuery>(
            await apiContext.get(
              `/api/v1/queries/${savedQueryId}?fields=queryUsedIn,owners`
            ),
            'Read saved inspection query'
          );
          expect(persisted.query).toBe(editedQuery);
          expect(persisted.description).toContain(description);
        } finally {
          await afterAction();
        }
      });
    });
  }
);
