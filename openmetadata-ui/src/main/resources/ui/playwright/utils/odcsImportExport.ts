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
import * as fs from 'fs';
import * as path from 'path';
import { TableClass } from '../support/entity/TableClass';
import { toastNotification } from './common';

// Path to the ODCS test data files
const ODCS_TEST_DATA_PATH = path.join(
  __dirname,
  '../test-data/odcs-examples'
);

// Helper function to load ODCS test data files
export const loadODCSTestFile = (filename: string): string => {
  const filePath = path.join(ODCS_TEST_DATA_PATH, filename);

  return fs.readFileSync(filePath, 'utf-8');
};

// Lazy-loaded ODCS test data from files
export const ODCS_TEST_FILES = {
  // Valid files
  get VALID_BASIC_YAML() {
    return loadODCSTestFile('valid-basic.yaml');
  },
  get VALID_FULL_YAML() {
    return loadODCSTestFile('valid-full.yaml');
  },
  get VALID_FULL_NO_SCHEMA_YAML() {
    return loadODCSTestFile('valid-full-no-schema.yaml');
  },
  get VALID_DRAFT_STATUS_YAML() {
    return loadODCSTestFile('valid-draft-status.yaml');
  },
  get VALID_WITH_TIMESTAMPS_YAML() {
    return loadODCSTestFile('valid-with-timestamps.yaml');
  },
  get VALID_QUALITY_RULES_YAML() {
    return loadODCSTestFile('valid-quality-rules.yaml');
  },
  get VALID_QUALITY_RULES_BETWEEN_YAML() {
    return loadODCSTestFile('valid-quality-rules-between.yaml');
  },
  get VALID_WITH_TEAM_YAML() {
    return loadODCSTestFile('valid-with-team.yaml');
  },
  get VALID_BASIC_JSON() {
    return loadODCSTestFile('valid-basic.json');
  },
  get VALID_FULL_JSON() {
    return loadODCSTestFile('valid-full.json');
  },
  // Invalid files
  get INVALID_EMPTY_FILE_YAML() {
    return loadODCSTestFile('invalid-empty-file.yaml');
  },
  get INVALID_MALFORMED_YAML() {
    return loadODCSTestFile('invalid-malformed-yaml.yaml');
  },
  get INVALID_MALFORMED_JSON() {
    return loadODCSTestFile('invalid-malformed.json');
  },
  get INVALID_MISSING_APIVERSION_YAML() {
    return loadODCSTestFile('invalid-missing-apiversion.yaml');
  },
  get INVALID_MISSING_KIND_YAML() {
    return loadODCSTestFile('invalid-missing-kind.yaml');
  },
  get INVALID_MISSING_STATUS_YAML() {
    return loadODCSTestFile('invalid-missing-status.yaml');
  },
  get INVALID_NOT_YAML_TXT() {
    return loadODCSTestFile('invalid-not-yaml.txt');
  },
  get INVALID_WRONG_APIVERSION_YAML() {
    return loadODCSTestFile('invalid-wrong-apiversion.yaml');
  },
  get INVALID_WRONG_KIND_YAML() {
    return loadODCSTestFile('invalid-wrong-kind.yaml');
  },
  get INVALID_SCHEMA_FIELDS_YAML() {
    return loadODCSTestFile('invalid-schema-fields.yaml');
  },
  // Multi-object files
  get VALID_MULTI_OBJECT_YAML() {
    return loadODCSTestFile('valid-multi-object.yaml');
  },
  // Sample data compatible files (for testing with sample_data service)
  get SAMPLE_DATA_DIM_ADDRESS_YAML() {
    return loadODCSTestFile('sample-data-dim-address.yaml');
  },
  get SAMPLE_DATA_DIM_CUSTOMER_YAML() {
    return loadODCSTestFile('sample-data-dim-customer.yaml');
  },
  get SAMPLE_DATA_MULTI_OBJECT_YAML() {
    return loadODCSTestFile('sample-data-multi-object.yaml');
  },
};

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
  const importButton = page.getByTestId('import-button');
  await importButton.click();

  await importResponse;
  await toastNotification(page, 'ODCS Contract imported successfully');
};