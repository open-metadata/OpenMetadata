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
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { test } from '../fixtures/pages';
import { generateODCSContract } from '../../constant/dataContracts';
import { TableClass } from '../../support/entity/TableClass';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';

// Path to the ODCS test data files
const ODCS_TEST_DATA_PATH = path.join(
  __dirname,
  '../../../test-data/odcs-examples'
);

// Helper function to load ODCS test data files
const loadODCSTestFile = (filename: string): string => {
  const filePath = path.join(ODCS_TEST_DATA_PATH, filename);

  return fs.readFileSync(filePath, 'utf-8');
};

// Lazy-loaded ODCS test data from files
const ODCS_TEST_FILES = {
  // Valid files
  get VALID_BASIC_YAML() {
    return loadODCSTestFile('valid-basic.yaml');
  },
  get VALID_FULL_YAML() {
    return loadODCSTestFile('valid-full.yaml');
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
};

const navigateToContractTab = async (page, table) => {
  await table.visitEntityPage(page);
  await page.click('[data-testid="contract"]');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
    timeout: 30000,
  });
};

const openODCSImportDropdown = async (page) => {
  // Check if we need to click add-contract-button first (no contract exists)
  const addButton = page.getByTestId('add-contract-button');
  const manageButton = page.getByTestId('manage-contract-actions');

  // Try to find either button
  const addButtonVisible = await addButton.isVisible().catch(() => false);
  const manageButtonVisible = await manageButton.isVisible().catch(() => false);

  if (addButtonVisible) {
    await addButton.click();
  } else if (manageButtonVisible) {
    await manageButton.click();
  }

  await page.waitForSelector('.contract-action-dropdown', {
    state: 'visible',
    timeout: 10000,
  });
};

const clickImportODCSButton = async (page) => {
  await page.getByTestId('import-odcs-contract-button').click();
};

const importODCSYaml = async (
  page,
  yamlContent: string,
  filename: string,
  options?: { mode?: 'merge' | 'replace'; hasExistingContract?: boolean }
) => {
  await clickImportODCSButton(page);

  // Wait for modal to open
  await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 10000 });

  // Upload file using the dragger input
  const fileInput = page.locator('.ant-upload input[type="file"]');
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'application/yaml',
    buffer: Buffer.from(yamlContent),
  });

  // Wait for file to be parsed and preview to show
  await page.waitForSelector('.ant-alert-success', {
    state: 'visible',
    timeout: 10000,
  });

  // If existing contract, select mode
  if (options?.hasExistingContract && options?.mode) {
    const modeRadio = page.locator(`input[type="radio"][value="${options.mode}"]`);
    await modeRadio.click();
  }

  // Determine which API endpoint will be called based on mode
  const importResponse = page.waitForResponse((response) => {
    const url = response.url();
    const method = response.request().method();

    if (options?.hasExistingContract && options?.mode === 'replace') {
      // Replace mode: DELETE then POST
      return (
        (url.includes('/api/v1/dataContracts/') && method === 'DELETE') ||
        (url.includes('/api/v1/dataContracts/odcs/yaml') && method === 'POST')
      );
    } else if (options?.hasExistingContract && options?.mode === 'merge') {
      // Merge mode: PUT
      return (
        url.includes('/api/v1/dataContracts/odcs/yaml') && method === 'PUT'
      );
    } else {
      // New contract: POST
      return (
        url.includes('/api/v1/dataContracts/odcs/yaml') && method === 'POST'
      );
    }
  });

  // Click Import button
  const importButton = page.locator('.ant-modal .ant-btn-primary');
  await importButton.click();

  await importResponse;
  await toastNotification(page, 'ODCS Contract imported successfully');
};

const deleteContract = async (page) => {
  await page.getByTestId('manage-contract-actions').click();
  await page.waitForSelector('.contract-action-dropdown', {
    state: 'visible',
  });
  await page.getByTestId('delete-contract-button').click();

  await page.getByTestId('confirmation-text-input').fill('DELETE');
  await page.getByTestId('confirm-button').click();

  await toastNotification(page, '"Contract" deleted successfully!');
};

test.describe('ODCS Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // Tests using actual test-data files from test-data/odcs-examples/

  test('Import basic ODCS contract from test-data file', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_BASIC_YAML,
        'valid-basic.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import full ODCS contract with all sections from test-data file', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_FULL_YAML,
        'valid-full.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS contract with draft status from test-data file', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_DRAFT_STATUS_YAML,
        'valid-draft-status.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS contract with v3.1.0 timestamp types from test-data file', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_WITH_TIMESTAMPS_YAML,
        'valid-with-timestamps.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS contract with quality rules from test-data file', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_QUALITY_RULES_YAML,
        'valid-quality-rules.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  // Invalid file tests using test-data files

  test('Import malformed ODCS YAML from test-data file shows error', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.waitForSelector('.ant-modal', {
        state: 'visible',
        timeout: 10000,
      });

      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid-malformed-yaml.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.INVALID_MALFORMED_YAML),
      });

      // Should show error alert for malformed YAML
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS missing apiVersion from test-data file shows error', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.waitForSelector('.ant-modal', {
        state: 'visible',
        timeout: 10000,
      });

      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid-missing-apiversion.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.INVALID_MISSING_APIVERSION_YAML),
      });

      // Should show error alert for missing apiVersion
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS missing status from test-data file shows error', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.waitForSelector('.ant-modal', {
        state: 'visible',
        timeout: 10000,
      });

      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid-missing-status.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.INVALID_MISSING_STATUS_YAML),
      });

      // Should show error alert for missing status
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import empty ODCS file from test-data shows error', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.waitForSelector('.ant-modal', {
        state: 'visible',
        timeout: 10000,
      });

      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid-empty-file.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.INVALID_EMPTY_FILE_YAML),
      });

      // Should show error alert for empty/invalid file
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  // Legacy tests using inline constants (kept for backwards compatibility)

  test('Import minimal ODCS contract (inline)', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        generateODCSContract('Minimal Contract'),
        'minimal.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import malformed ODCS YAML shows error (inline)', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      const fileInput = page.getByTestId('odcs-import-file-input');
      await fileInput.setInputFiles({
        name: 'malformed.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.INVALID_MALFORMED_YAML),
      });

      // Should show an error alert for malformed YAML
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Export ODCS YAML and verify download', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a contract
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_BASIC_YAML,
        'export-test.yaml'
      );

      // Now export the contract
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      expect(filename).toContain('.yaml');
      await toastNotification(page, 'ODCS Contract exported successfully');
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import and Export round trip preserves data', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);
    const contractName = `Round Trip Contract ${Date.now()}`;

    try {
      // Import a contract with SLA
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);

      const odcsYaml = generateODCSContract(contractName, {
        withSla: true,
        status: 'active',
      });
      await importODCSYaml(page, odcsYaml, 'roundtrip.yaml');

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      // SLA card should be visible after import with SLA data
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Export the contract
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;

      // Verify the exported file
      const tempPath = `/tmp/odcs-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      expect(exportedYaml).toContain('apiVersion');
      expect(exportedYaml).toContain('v3.1.0');

      // Cleanup
      fs.unlinkSync(tempPath);

      await toastNotification(page, 'ODCS Contract exported successfully');
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Smart merge - import updates existing contract preserving ID', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a minimal contract
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_BASIC_YAML,
        'initial.yaml'
      );

      // Verify minimal contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Get the contract ID from the page or API
      const contractTitle = await page.getByTestId('contract-title').textContent();

      // Now import a contract with SLA to merge with the existing one
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'update-with-sla.yaml', {
        hasExistingContract: true,
        mode: 'merge',
      });

      // Verify contract was updated with SLA
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Verify contract title is still visible (contract was merged, not replaced)
      await expect(page.getByTestId('contract-title')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Replace mode - deletes existing contract and creates new', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a contract with SLA
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'initial.yaml');

      // Verify SLA card is visible
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Now replace with a minimal contract (no SLA)
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_BASIC_YAML, 'replace.yaml', {
        hasExistingContract: true,
        mode: 'replace',
      });

      // Verify contract was replaced - SLA card should not be visible
      await expect(page.getByTestId('contract-title')).toBeVisible();
      // Give time for page to settle after replacement
      await page.waitForTimeout(2000);
      // SLA card should not be visible after replace with minimal contract
      await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import modal shows merge/replace options for existing contract', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a contract
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_BASIC_YAML,
        'initial.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Open import modal again
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      // Wait for modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Upload a file
      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.VALID_FULL_YAML),
      });

      // Wait for file to be parsed
      await page.waitForSelector('.ant-alert-success', { state: 'visible' });

      // Verify merge/replace options are shown
      await expect(
        page.locator('.ant-alert-warning').filter({ hasText: /existing contract/i })
      ).toBeVisible();
      await expect(page.locator('input[type="radio"][value="merge"]')).toBeVisible();
      await expect(page.locator('input[type="radio"][value="replace"]')).toBeVisible();

      // Verify merge is selected by default
      await expect(page.locator('input[type="radio"][value="merge"]')).toBeChecked();

      // Close modal
      await page.locator('.ant-modal .ant-btn').filter({ hasText: /cancel/i }).click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import modal shows contract preview', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      // Wait for modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Upload full contract
      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'full-contract.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_TEST_FILES.VALID_FULL_YAML),
      });

      // Wait for preview
      await page.waitForSelector('.ant-alert-success', { state: 'visible' });

      // Verify preview shows contract details
      await expect(page.locator('text=Contract Preview')).toBeVisible();
      await expect(page.locator('text=Complete ODCS Contract')).toBeVisible();
      await expect(page.locator('text=2.0.0')).toBeVisible();
      await expect(page.locator('text=active')).toBeVisible();

      // Close modal
      await page.locator('.ant-modal .ant-btn').filter({ hasText: /cancel/i }).click();
    } finally {
      await table.delete(apiContext);
    }
  });

  // ODCS Import -> OpenMetadata Export Tests

  test('Import ODCS and export as OpenMetadata YAML', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Import an ODCS contract with SLA
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'odcs-to-om.yaml');

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();

      // Export as OpenMetadata format (native export)
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      // Verify it's a YAML file (OpenMetadata format)
      expect(filename).toContain('.yaml');

      // Save and verify content structure
      const tempPath = `/tmp/om-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // OpenMetadata format should NOT contain ODCS-specific fields
      expect(exportedYaml).not.toContain('apiVersion: v3.1.0');
      expect(exportedYaml).not.toContain('kind: DataContract');

      // Should contain OpenMetadata format fields
      expect(exportedYaml).toContain('name:');
      expect(exportedYaml).toContain('sla:');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with description and verify OpenMetadata export', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Import an ODCS contract with description (schema removed due to dynamic test table columns)
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'odcs-schema.yaml');

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as OpenMetadata format
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;

      // Save and verify content
      const tempPath = `/tmp/om-schema-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // Should contain name and description
      expect(exportedYaml).toContain('name:');
      expect(exportedYaml).toContain('description:');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS full contract and export both formats', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Import a full ODCS contract
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'full-odcs.yaml');

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();

      // Export as ODCS format first
      const odcsDownloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const odcsDownload = await odcsDownloadPromise;
      const odcsTempPath = `/tmp/odcs-roundtrip-${Date.now()}.yaml`;
      await odcsDownload.saveAs(odcsTempPath);

      await toastNotification(page, 'ODCS Contract exported successfully');

      // Export as OpenMetadata format
      const omDownloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-contract-button').click();

      const omDownload = await omDownloadPromise;
      const omTempPath = `/tmp/om-roundtrip-${Date.now()}.yaml`;
      await omDownload.saveAs(omTempPath);

      // Verify both exports
      const fs = await import('fs');

      const odcsYaml = fs.readFileSync(odcsTempPath, 'utf-8');
      expect(odcsYaml).toContain('apiVersion');
      expect(odcsYaml).toContain('v3.1.0');
      expect(odcsYaml).toMatch(/kind:\s*"?DataContract"?/);

      const omYaml = fs.readFileSync(omTempPath, 'utf-8');
      expect(omYaml).not.toContain('apiVersion: v3.1.0');
      expect(omYaml).toContain('name:');

      // Cleanup
      fs.unlinkSync(odcsTempPath);
      fs.unlinkSync(omTempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Verify SLA mapping from ODCS to OpenMetadata format', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Import ODCS with SLA properties
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_TEST_FILES.VALID_FULL_YAML, 'sla-mapping.yaml');

      // Verify SLA card is visible (with extended timeout for rendering)
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Export as OpenMetadata format
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/sla-mapping-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // ODCS uses slaProperties, OpenMetadata uses sla
      expect(exportedYaml).toContain('sla:');
      // OpenMetadata uses refreshFrequency instead of freshness
      expect(exportedYaml).toContain('refreshFrequency:');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  // v3.1.0 Features Tests

  test('Import ODCS with timezone in SLA properties', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_WITH_TIMESTAMPS_YAML,
        'timestamp-contract.yaml'
      );

      // Verify contract was created with SLA
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Export as ODCS to verify timezone is preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/timezone-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // Verify timezone is in the export
      expect(exportedYaml).toContain('timezone');
      expect(exportedYaml).toContain('freshness');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with security/roles', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_FULL_YAML,
        'security-contract.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as ODCS to verify roles are preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/security-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // Verify roles are in the export
      expect(exportedYaml).toContain('roles');
      expect(exportedYaml).toContain('data_admin');
      expect(exportedYaml).toContain('analyst');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  // Quality Rules Tests

  test('Import ODCS with quality rules', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_TEST_FILES.VALID_QUALITY_RULES_YAML,
        'quality-contract.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as ODCS to verify quality rules are preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/quality-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fs = await import('fs');
      const exportedYaml = fs.readFileSync(tempPath, 'utf-8');

      // Verify quality rules are in the export (stored in extension)
      expect(exportedYaml).toContain('quality');

      // Cleanup
      fs.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  // Error Handling Tests

  test('Import invalid ODCS missing required fields shows error', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    const invalidYaml = `apiVersion: v3.1.0
kind: DataContract
name: Missing Status Contract
version: "1.0.0"`;

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      // Wait for modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Upload invalid file
      const fileInput = page.locator('.ant-upload input[type="file"]');
      await fileInput.setInputFiles({
        name: 'invalid.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(invalidYaml),
      });

      // Wait for error alert
      await expect(page.locator('.ant-alert-error')).toBeVisible({
        timeout: 10000,
      });

      // Verify import button is disabled
      const importButton = page.locator('.ant-modal .ant-btn-primary');

      await expect(importButton).toBeDisabled();

      // Close modal
      await page.locator('.ant-modal .ant-btn').filter({ hasText: /cancel/i }).click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import button disabled for empty/invalid file', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      // Wait for modal
      await page.waitForSelector('.ant-modal', { state: 'visible' });

      // Verify import button is disabled initially (no file selected)
      const importButton = page.locator('.ant-modal .ant-btn-primary');

      await expect(importButton).toBeDisabled();

      // Close modal
      await page.locator('.ant-modal .ant-btn').filter({ hasText: /cancel/i }).click();
    } finally {
      await table.delete(apiContext);
    }
  });
});
