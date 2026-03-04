/*
 *  Copyright 2025 Collate.
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
import { Page, Response } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { toastNotification } from './common';

export const navigateToContractTab = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  await page.click('[data-testid="contract"]');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
    timeout: 30000,
  });
};

export const openODCSImportDropdown = async (page: Page) => {
  const addButton = page.getByTestId('add-contract-button');
  const manageButton = page.getByTestId('manage-contract-actions');

  const addButtonVisible = await addButton.isVisible().catch(() => false);
  const manageButtonVisible = await manageButton.isVisible().catch(() => false);

  if (addButtonVisible) {
    await addButton.click();
    await page.getByTestId('add-contract-menu').waitFor({
    state: 'visible',
    timeout: 10000,
  });
  } else if (manageButtonVisible) {
    await manageButton.click();
  }
};

export const clickImportODCSButton = async (page: Page) => {
  await page.getByTestId('import-odcs-contract-button').click();
};

export const importODCSYaml = async (
  page: Page,
  yamlContent: string,
  filename: string,
  options?: { mode?: 'merge' | 'replace'; hasExistingContract?: boolean }
) => {
  await clickImportODCSButton(page);

  await page.getByTestId('import-contract-modal').waitFor({
    state: 'visible',
    timeout: 10000,
  });

  const fileInput = page.getByTestId('file-upload-input');
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'application/yaml',
    buffer: Buffer.from(yamlContent),
  });

  await page.getByTestId('file-info-card').waitFor({
    state: 'visible',
    timeout: 10000,
  });

  // If existing contract, select mode
  if (options?.hasExistingContract && options?.mode) {
    const modeRadio = page.locator(
      `input[type="radio"][value="${options.mode}"]`
    );
    await modeRadio.click();
  }

  // Determine which API endpoint will be called based on mode
  // ODCS imports use: POST (new) or PUT (merge/replace) to /dataContracts/odcs/yaml
  const importResponse = page.waitForResponse((response: Response) => {
    const url = response.url();
    const method = response.request().method();

    if (options?.hasExistingContract) {
      // Merge and Replace modes both use PUT to /dataContracts/odcs/yaml with mode param
      return (
        url.includes('/api/v1/dataContracts/odcs/yaml') && method === 'PUT'
      );
    } else {
      // New contract: POST to /dataContracts/odcs/yaml
      return (
        url.includes('/api/v1/dataContracts/odcs/yaml') && method === 'POST'
      );
    }
  });

  // Click Import button
  const importButton = await page.getByTestId('import-button');
  await importButton.click({delay: 100});

  await importResponse;
  await toastNotification(page, 'ODCS Contract imported successfully');
};