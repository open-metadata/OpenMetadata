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
import { load } from 'js-yaml';
import { DataContract } from '../../../src/generated/entity/data/dataContract';
import { TableClass } from '../../support/entity/TableClass';
import { createAdminApiContext } from '../../utils/admin';
import { okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
} from '../../utils/common';
import {
  exportContractYaml,
  navigateToContractTab,
  openContractActionsDropdown,
} from '../../utils/dataContracts';
import { expect, test } from '../fixtures/pages';

let table: TableClass;
let contractId: string;

test.describe('ODCS export versions', { tag: ['@Governance'] }, () => {
  test.beforeAll(async () => {
    table = new TableClass();
    const { apiContext, afterAction } = await createAdminApiContext();
    try {
      await table.create(apiContext);
      const response = await apiContext.post('/api/v1/dataContracts', {
        data: {
          name: `odcs_export_${table.entity.name}`,
          entity: { id: table.entityResponseData.id, type: 'table' },
          schema: table.entityResponseData.columns,
        },
      });
      const contract = await okJson<DataContract>(
        response,
        'create ODCS export fixture'
      );
      contractId = contract.id;
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    try {
      if (contractId) {
        const response = await apiContext.delete(
          `/api/v1/dataContracts/${contractId}?hardDelete=true`
        );
        expect(response.ok()).toBeTruthy();
      }
      if (table) {
        await table.delete(apiContext);
      }
    } finally {
      await afterAction();
    }
  });

  test('exports v3.1.0 by default', async ({ page }) => {
    await table.visitEntityPage(page);
    await navigateToContractTab(page);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname ===
          `/api/v1/dataContracts/${contractId}/odcs/yaml`
    );

    const filename = await exportContractYaml(page, 'odcs');
    const response = await responsePromise;
    expect(new URL(response.url()).searchParams.get('odcsVersion')).toBe(
      'v3.1.0'
    );
    expect(response.status()).toBe(200);
    expect(load(await response.text())).toMatchObject({ apiVersion: 'v3.1.0' });
    expect(filename).toMatch(/\.odcs\.yaml$/);
  });

  test('allows selecting each published version and cancelling', async ({
    page,
  }, testInfo) => {
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    for (const version of [
      'v3.1.0',
      'v3.0.2',
      'v3.0.1',
      'v3.0.0',
      'v2.2.2',
      'v2.2.1',
    ]) {
      await test.step(`Select ${version}`, async () => {
        await openContractActionsDropdown(page);
        await page.getByTestId('export-odcs-contract-button').click();
        const dialog = page.getByTestId('odcs-export-modal');
        const selector = dialog.getByRole('button', { name: /Version/ });
        await expect(dialog).toBeVisible();
        await expect(selector).toContainText('v3.1.0');
        await scrollIntoViewAndSettle(selector);
        await selectOptionWithRetry(
          selector,
          page.getByRole('option', { name: version, exact: true })
        );
        await expect(selector).toContainText(version);
        if (version === 'v2.2.2') {
          await page.screenshot({
            path: testInfo.outputPath('odcs-export-version-selector.png'),
          });
        }
        await clickIgnoringToasts(
          dialog.getByRole('button', { name: 'Cancel', exact: true })
        );
        await expect(dialog).not.toBeVisible();
      });
    }
  });

  test('exports each selected published version', async ({ page }) => {
    await table.visitEntityPage(page);
    await navigateToContractTab(page);

    for (const version of [
      'v3.1.0',
      'v3.0.2',
      'v3.0.1',
      'v3.0.0',
      'v2.2.2',
      'v2.2.1',
    ]) {
      await test.step(`Export ${version}`, async () => {
        const responsePromise = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname ===
              `/api/v1/dataContracts/${contractId}/odcs/yaml`
        );
        const filename = await exportContractYaml(page, 'odcs', version);
        const response = await responsePromise;
        expect(new URL(response.url()).searchParams.get('odcsVersion')).toBe(
          version
        );
        expect(response.status()).toBe(200);
        expect(load(await response.text())).toMatchObject({
          apiVersion: version,
        });
        expect(filename).toMatch(/\.odcs\.yaml$/);
      });
    }
  });
});
