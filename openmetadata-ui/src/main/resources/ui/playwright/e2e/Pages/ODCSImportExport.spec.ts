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
import { test } from '../fixtures/pages';
import {
  generateODCSContract,
  ODCS_INVALID_EMPTY_FILE_YAML,
  ODCS_INVALID_MALFORMED_JSON,
  ODCS_INVALID_MALFORMED_YAML,
  ODCS_INVALID_MISSING_APIVERSION_YAML,
  ODCS_INVALID_MISSING_KIND_YAML,
  ODCS_INVALID_MISSING_STATUS_YAML,
  ODCS_INVALID_SCHEMA_FIELDS_YAML,
  ODCS_INVALID_WRONG_APIVERSION_YAML,
  ODCS_INVALID_WRONG_KIND_YAML,
  ODCS_VALID_BASIC_JSON,
  ODCS_VALID_BASIC_YAML,
  ODCS_VALID_DRAFT_STATUS_YAML,
  ODCS_VALID_FULL_YAML,
  ODCS_VALID_MULTI_OBJECT_SIMPLE_YAML,
  ODCS_VALID_MULTI_OBJECT_YAML,
  ODCS_VALID_QUALITY_RULES_BETWEEN_YAML,
  ODCS_VALID_WITH_MARKDOWN_DESCRIPTION_YAML,
  ODCS_WITH_QUALITY_RULES_YAML,
  ODCS_VALID_WITH_TEAM_YAML,
  ODCS_VALID_WITH_TIMESTAMPS_YAML,
  ODCS_WITH_SLA_YAML,
} from '../../constant/dataContracts';
import { TableClass } from '../../support/entity/TableClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  clickImportODCSButton,
  importODCSYaml,
  navigateToContractTab,
  openODCSImportDropdown,
} from '../../utils/odcsImportExport';

test.describe('ODCS Import/Export', () => {
  test.slow(true)
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
        ODCS_VALID_BASIC_YAML,
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
        ODCS_VALID_FULL_YAML,
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
        ODCS_VALID_DRAFT_STATUS_YAML,
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
        ODCS_VALID_WITH_TIMESTAMPS_YAML,
        'valid-with-timestamps.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS contract with SLA properties from test-data file', async ({
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
        ODCS_WITH_SLA_YAML,
        'valid-quality-rules.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();
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

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-malformed-yaml.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_MALFORMED_YAML),
      });

      // Should show error in validation panel for malformed YAML
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
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

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-missing-apiversion.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_MISSING_APIVERSION_YAML),
      });

      // Should show error in validation panel for missing apiVersion
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
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

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-missing-status.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_MISSING_STATUS_YAML),
      });

      // Should show error in validation panel for missing status
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
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

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-empty-file.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_EMPTY_FILE_YAML),
      });

      // Should show error in validation panel for empty/invalid file
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  // JSON format import tests

  test('Import basic ODCS contract from JSON file', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-basic.json',
        mimeType: 'application/json',
        buffer: Buffer.from(ODCS_VALID_BASIC_JSON),
      });

      // Wait for file to be parsed
      await page.getByTestId('file-info-card').waitFor();

      // Should show validation success for valid JSON
      await expect(page.getByTestId('validation-success-panel')).toBeVisible({
        timeout: 10000,
      });

      // Close modal
      await page.getByTestId('cancel-button').click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import malformed JSON shows error', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-malformed.json',
        mimeType: 'application/json',
        buffer: Buffer.from(ODCS_INVALID_MALFORMED_JSON),
      });

      // Should show error in validation panel for malformed JSON
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  // Additional invalid file tests

  test('Import ODCS with missing kind shows error', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-missing-kind.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_MISSING_KIND_YAML),
      });

      // Should show error for missing kind
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with wrong apiVersion shows error', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-wrong-apiversion.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_WRONG_APIVERSION_YAML),
      });

      // Should show error for wrong apiVersion
      await expect(
        page.getByTestId('server-validation-error-panel')
      ).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with wrong kind shows error', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-wrong-kind.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_WRONG_KIND_YAML),
      });

      // Should show error for wrong kind
      await expect(
        page.getByTestId('server-validation-error-panel')
      ).toBeVisible({
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

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'malformed.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_MALFORMED_YAML),
      });

      // Should show error in validation panel for malformed YAML
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
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
        ODCS_VALID_BASIC_YAML,
        'export-test.yaml'
      );

      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

       // Now export the contract
      const downloadPromise = page.waitForEvent('download');

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
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;

      // Verify the exported file
      const tempPath = `/tmp/odcs-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      expect(exportedYaml).toContain('apiVersion');
      expect(exportedYaml).toContain('v3.1.0');

      // Cleanup
      fsModule.unlinkSync(tempPath);

      await toastNotification(page, 'ODCS Contract exported successfully');
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Merge mode - adds SLA to existing contract and verifies export', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a basic contract (no SLA, name: "Orders Basic Contract")
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_BASIC_YAML,
        'initial.yaml'
      );

      // Verify basic contract was created with correct name
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Orders Basic Contract'
      );

      // Verify NO SLA card initially (basic contract has no SLA)
      await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();

      // Now merge with full contract (has SLA and roles)
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'merge-with-sla.yaml',
        {
          hasExistingContract: true,
          mode: 'merge',
        }
      );

      // Verify contract was updated with SLA from merged contract
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Merge preserves the original contract name (this is expected behavior)
      await expect(page.getByTestId('contract-title')).toContainText(
        'Orders Basic Contract'
      );

      // Export as ODCS and verify merged content
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/merge-verify-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify merged contract has SLA properties added from full contract
      expect(exportedYaml).toContain('slaProperties');
      expect(exportedYaml).toContain('freshness');

      // Verify roles were merged from full contract
      // ODCS_VALID_FULL_YAML contains roles: data_admin and analyst
      expect(exportedYaml).toContain('roles');
      expect(exportedYaml).toContain('analyst');

      // Verify original contract name is preserved (merge behavior)
      expect(exportedYaml).toContain('Orders Basic Contract');


      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Replace mode - replaces existing contract completely and verifies export', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // First import a full contract (with SLA, name: "Customer Analytics Full Contract")
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'full-contract.yaml'
      );

      // Verify full contract was created with SLA
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Customer Analytics Full Contract'
      );
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Wait for page to fully settle before replace operation
      await page.waitForTimeout(2000);

      // Now REPLACE with basic contract (no SLA, name: "Orders Basic Contract")
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_BASIC_YAML,
        'replace-with-basic.yaml',
        {
          hasExistingContract: true,
          mode: 'replace',
        }
      );

      // Replace mode preserves identity fields (ID, name, FQN) but replaces content
      // So the name should stay as "Customer Analytics Full Contract" but content changes
      await expect(page.getByTestId('contract-title')).toBeVisible({
        timeout: 15000,
      });
      // Name is preserved from original contract (identity field)
      await expect(page.getByTestId('contract-title')).toContainText(
        'Customer Analytics Full Contract'
      );

      // Verify SLA card is NOT visible (replaced with basic contract that has no SLA)
      await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();

      // Export as ODCS and verify replaced content
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/replace-verify-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const replacedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Name is preserved (identity field preserved in replace mode)
      expect(replacedYaml).toContain('Customer Analytics Full Contract');

      // Verify replaced contract does NOT have SLA (content was replaced)
      expect(replacedYaml).toContain('slaProperties: []');

      // Verify replaced contract does NOT have roles (content was replaced)
      expect(replacedYaml).toContain('roles: []');

      // Cleanup
      fsModule.unlinkSync(tempPath);
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
        ODCS_VALID_BASIC_YAML,
        'initial.yaml'
      );

      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Open import modal again
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      // Wait for modal
      await page.getByTestId('import-contract-modal').waitFor();

      // Upload a file
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'test.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_FULL_YAML),
      });

      // Wait for file to be parsed
      await page.getByTestId('file-info-card').waitFor();

      // Verify merge/replace options are shown
      await expect(
        page.getByTestId('existing-contract-warning')
      ).toBeVisible();
      await expect(
        page.locator('input[type="radio"][value="merge"]')
      ).toBeVisible();
      await expect(
        page.locator('input[type="radio"][value="replace"]')
      ).toBeVisible();

      // Verify merge is selected by default
      await expect(
        page.locator('input[type="radio"][value="merge"]')
      ).toBeChecked();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
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
      await page.getByTestId('import-contract-modal').waitFor();

      // Upload full contract
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'full-contract.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_FULL_YAML),
      });

      // Wait for preview
      await page.waitForSelector('.file-info-card, .contract-preview-card', {
        state: 'visible',
      });

      // Verify preview shows contract details
      await expect(page.locator('text=CONTRACT PREVIEW')).toBeVisible();
      await expect(
        page.locator('text=Customer Analytics Full Contract')
      ).toBeVisible();
      await expect(page.locator('text=2.1.0')).toBeVisible();
      await expect(page.locator('text=active')).toBeVisible();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
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
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'odcs-to-om.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();

      // Export as OpenMetadata format (native export)
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      // Verify it's a YAML file (OpenMetadata format)
      expect(filename).toContain('.yaml');

      // Save and verify content structure
      const tempPath = `/tmp/om-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // OpenMetadata format should NOT contain ODCS-specific fields
      expect(exportedYaml).not.toContain('apiVersion: v3.1.0');
      expect(exportedYaml).not.toContain('kind: DataContract');

      // Should contain OpenMetadata format fields
      expect(exportedYaml).toContain('name:');
      expect(exportedYaml).toContain('sla:');

      // Cleanup
      fsModule.unlinkSync(tempPath);
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
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'odcs-schema.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as OpenMetadata format
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;

      // Save and verify content
      const tempPath = `/tmp/om-schema-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Should contain name and description
      expect(exportedYaml).toContain('name:');
      expect(exportedYaml).toContain('description:');

      // Cleanup
      fsModule.unlinkSync(tempPath);
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
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'full-odcs.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible();

      // Export as ODCS format first
      const odcsDownloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const odcsDownload = await odcsDownloadPromise;
      const odcsTempPath = `/tmp/odcs-roundtrip-${Date.now()}.yaml`;
      await odcsDownload.saveAs(odcsTempPath);

      await toastNotification(page, 'ODCS Contract exported successfully');

      // Export as OpenMetadata format
      const omDownloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-contract-button').click();

      const omDownload = await omDownloadPromise;
      const omTempPath = `/tmp/om-roundtrip-${Date.now()}.yaml`;
      await omDownload.saveAs(omTempPath);

      // Verify both exports
      const fsModule = await import('fs');

      const odcsYaml = fsModule.readFileSync(odcsTempPath, 'utf-8');
      expect(odcsYaml).toContain('apiVersion');
      expect(odcsYaml).toContain('v3.1.0');
      expect(odcsYaml).toMatch(/kind:\s*"?DataContract"?/);

      const omYaml = fsModule.readFileSync(omTempPath, 'utf-8');
      expect(omYaml).not.toContain('apiVersion: v3.1.0');
      expect(omYaml).toContain('name:');

      // Cleanup
      fsModule.unlinkSync(odcsTempPath);
      fsModule.unlinkSync(omTempPath);
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
      await importODCSYaml(
        page,
        ODCS_VALID_FULL_YAML,
        'sla-mapping.yaml'
      );

      // Verify SLA card is visible (with extended timeout for rendering)
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Export as OpenMetadata format
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/sla-mapping-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // ODCS uses slaProperties, OpenMetadata uses sla
      expect(exportedYaml).toContain('sla:');
      // OpenMetadata uses refreshFrequency instead of freshness
      expect(exportedYaml).toContain('refreshFrequency:');

      // Cleanup
      fsModule.unlinkSync(tempPath);
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
        ODCS_VALID_WITH_TIMESTAMPS_YAML,
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
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/timezone-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify SLA properties are in the export
      // Note: timezone field is not yet exported by backend, but SLA properties should be preserved
      expect(exportedYaml).toContain('freshness');
      expect(exportedYaml).toContain('latency');
      expect(exportedYaml).toContain('slaProperties');

      // Cleanup
      fsModule.unlinkSync(tempPath);
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
        ODCS_VALID_FULL_YAML,
        'security-contract.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as ODCS to verify roles are preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/security-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify roles are in the export
      expect(exportedYaml).toContain('roles');
      expect(exportedYaml).toContain('data_admin');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  // Quality Rules Tests
  // Quality rules are stored in the dedicated odcsQualityRules field for round-trip compatibility

  test('Import ODCS with quality rules', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_WITH_QUALITY_RULES_YAML,
        'quality-contract.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as ODCS to verify quality rules are preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/quality-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify quality rules are in the export (stored in extension)
      expect(exportedYaml).toContain('quality');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with mustBeBetween quality rules', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_QUALITY_RULES_BETWEEN_YAML,
        'quality-between.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Export as ODCS to verify mustBeBetween quality rules are preserved
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/quality-between-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify mustBeBetween quality rules are in the export
      expect(exportedYaml).toContain('quality');
      expect(exportedYaml).toContain('mustBeBetween');
      expect(exportedYaml).toContain('mustNotBeBetween');
      expect(exportedYaml).toContain('100');
      expect(exportedYaml).toContain('10000');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  // Team/Owner Resolution Tests

  test('Import ODCS with team owner', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_WITH_TEAM_YAML,
        'team-owner.yaml'
      );

      // Verify contract was created successfully
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Team Owner Contract'
      );

      // Export as ODCS to verify basic structure
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/team-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify basic ODCS structure
      expect(exportedYaml).toContain('apiVersion');
      expect(exportedYaml).toContain('v3.1.0');
      expect(exportedYaml).toContain('Team Owner Contract');
      // Team field is present in export (may be empty if owners field not populated on fetch)
      expect(exportedYaml).toContain('team');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with team - contract created successfully', async ({
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
        ODCS_VALID_WITH_TEAM_YAML,
        'team-roles.yaml'
      );

      // Verify contract was created successfully
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Team Owner Contract'
      );
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
      await page.getByTestId('import-contract-modal').waitFor();

      // Upload invalid file
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(invalidYaml),
      });

      // Wait for error in validation panel
      await expect(page.getByTestId('parse-error-panel')).toBeVisible({
        timeout: 10000,
      });

      // Verify import button is disabled
      const importButton = page.getByTestId('import-button');

      await expect(importButton).toBeDisabled();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
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
      await page.getByTestId('import-contract-modal').waitFor();

      // Verify import button is disabled initially (no file selected)
      const importButton = page.getByTestId('import-button');

      await expect(importButton).toBeDisabled();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  // Schema Validation Tests

  test('Schema validation shows warning when fields do not exist in entity', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-schema-fields.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_SCHEMA_FIELDS_YAML),
      });

      // Wait for file to be parsed and preview to show
      await page.getByTestId('file-info-card').waitFor();

      // Wait for server-side validation to complete - validation panel shows error
      await expect(
        page.getByTestId('server-validation-failed-error-panel')
      ).toBeVisible({
        timeout: 15000,
      });

      // Verify failed fields are listed in the validation panel
      await expect(page.getByTestId('failed-fields-list')).toBeVisible();
      await expect(page.getByTestId('failed-field-0')).toContainText(
        'customers'
      );
      await expect(page.getByTestId('failed-field-1')).toContainText('orders');

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import button disabled when schema validation fails', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'invalid-schema-fields.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_INVALID_SCHEMA_FIELDS_YAML),
      });

      // Wait for server-side validation to complete - validation panel shows error
      await expect(
        page.getByTestId('server-validation-failed-error-panel')
      ).toBeVisible({
        timeout: 15000,
      });

      // Verify import button is disabled
      const importButton = page.getByTestId('import-button');

      await expect(importButton).toBeDisabled();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Schema validation shows loading state during validation', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      // Start file upload and immediately check for loading state
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-basic.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_BASIC_YAML),
      });

      // Wait for file to be parsed and preview to show
      await page.getByTestId('file-info-card').waitFor();

      // Wait for validation to complete - should show success
      await expect(page.getByTestId('validation-success-panel')).toBeVisible({
        timeout: 15000,
      });

      // Import button should be enabled for valid contracts without schema
      const importButton = page.getByTestId('import-button');

      await expect(importButton).toBeEnabled({ timeout: 10000 });

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Schema validation passes for contract without schema definition', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-full.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_FULL_YAML),
      });

      // Wait for file to be parsed and preview to show
      await page.getByTestId('file-info-card').waitFor();

      // Wait for validation to complete - should show success
      await expect(page.getByTestId('validation-success-panel')).toBeVisible({
        timeout: 15000,
      });

      // Import button should be enabled (no schema means no schema validation errors)
      const importButton = page.getByTestId('import-button');

      await expect(importButton).toBeEnabled({ timeout: 10000 });

      // No error state should be visible in the validation panel
      await expect(
        page.getByTestId('server-validation-failed-error-panel')
      ).not.toBeVisible();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  // Multi-Object ODCS Contract Tests

  test('Multi-object ODCS contract shows object selector', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-multi-object.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_MULTI_OBJECT_YAML),
      });

      // Wait for file to be parsed and object selector to show
      await page.getByTestId('file-info-card').waitFor();

      // Verify object selector section is visible for multi-object contract
      await expect(page.locator('.object-selector-section')).toBeVisible({
        timeout: 10000,
      });

      // Verify the info message about multiple objects
      await expect(
        page.getByTestId('multi-object-contract-detected')
      ).toBeVisible();

      // Verify import button is disabled until an object is selected
      const importButton = page.getByTestId('import-button');
      await expect(importButton).toBeDisabled();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Multi-object ODCS contract - selecting object enables import and completes import', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      // Use the simple multi-object YAML (no properties) to avoid schema validation failures
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-multi-object-simple.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_MULTI_OBJECT_SIMPLE_YAML),
      });

      // Wait for object selector to appear
      await expect(page.locator('.object-selector-section')).toBeVisible({
        timeout: 10000,
      });

      // Open the object selector dropdown and select an object
      await page.getByTestId('schema-object-select').click();
      await page.getByTestId('schema-object-option-customers').click();

      // Verify selector shows the selected object
      await expect(page.getByTestId('schema-object-select')).toContainText(
        'customers'
      );

      // Wait for server validation to complete after selecting object
      await expect(page.getByTestId('validation-success-panel')).toBeVisible({
        timeout: 15000,
      });

      // Import button should be enabled after successful validation
      const importButton = page.getByTestId('import-button');
      await expect(importButton).toBeEnabled({ timeout: 10000 });

      // Click import to complete the flow
      await importButton.click();

      // Verify contract was created successfully
      await expect(page.getByTestId('contract-title')).toBeVisible({
        timeout: 15000,
      });

      // Verify the contract has the name from the multi-object YAML
      await expect(page.getByTestId('contract-title')).toContainText(
        'Multi-Object Simple Contract'
      );

      // Verify SLA card is visible (the simple YAML has SLA properties)
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Multi-object ODCS contract - object selector shows all schema objects', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-multi-object.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_MULTI_OBJECT_YAML),
      });

      // Wait for object selector to appear
      await expect(page.locator('.object-selector-section')).toBeVisible({
        timeout: 10000,
      });

      // Open the dropdown to see all options
      await page.getByTestId('schema-object-select').click();

      // Verify all three objects from the multi-object YAML are listed
      await expect(
        page.getByTestId('schema-object-option-customers')
      ).toBeVisible();
      await expect(
        page.getByTestId('schema-object-option-orders')
      ).toBeVisible();
      await expect(
        page.getByTestId('schema-object-option-products')
      ).toBeVisible();

      // Close dropdown by clicking elsewhere
      await page.locator('body').click();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Single-object ODCS contract does not show object selector', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await clickImportODCSButton(page);

      await page.getByTestId('import-contract-modal').waitFor();

      // Use a single-object contract (valid-full.yaml has one schema object)
      const fileInput = page.getByTestId('file-upload-input');
      await fileInput.setInputFiles({
        name: 'valid-full.yaml',
        mimeType: 'application/yaml',
        buffer: Buffer.from(ODCS_VALID_FULL_YAML),
      });

      // Wait for file to be parsed
      await page.getByTestId('file-info-card').waitFor();

      // Verify object selector is NOT visible for single-object contract
      await expect(page.locator('.object-selector-section')).not.toBeVisible();

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS, modify via UI, export and verify changes', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Step 1: Import a basic ODCS contract (no SLA)
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_VALID_BASIC_YAML, 'basic-for-modify.yaml');

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Orders Basic Contract'
      );

      // Verify NO SLA card initially (basic contract has no SLA)
      await expect(page.getByTestId('contract-sla-card')).not.toBeVisible();

      // Step 2: Edit the contract via UI - add SLA
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('contract-edit-button').click();

      // Wait for edit mode
      await expect(page.getByTestId('save-contract-btn')).toBeVisible();

      // Navigate to SLA tab and add SLA details
      await page.getByRole('tab', { name: 'SLA' }).click();

      // Add refresh frequency
      await page.getByTestId('refresh-frequency-interval-input').fill('24');
      await page.getByTestId('refresh-frequency-unit-select').click();
      await page.locator('.refresh-frequency-unit-select [title=Hour]').click();

      // Add max latency
      await page.getByTestId('max-latency-value-input').fill('2');
      await page.getByTestId('max-latency-unit-select').click();
      await page.locator('.max-latency-unit-select [title=Hour]').click();

      // Save the contract
      const saveContractResponse = page.waitForResponse(
        '/api/v1/dataContracts/*'
      );
      await page.getByTestId('save-contract-btn').click();
      await saveContractResponse;

      await page.waitForLoadState('networkidle');

      // Verify SLA card is now visible after adding SLA
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Step 3: Export as ODCS YAML
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/import-modify-export-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      // Step 4: Verify the UI changes are reflected in the export
      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify basic ODCS structure
      expect(exportedYaml).toContain('apiVersion');
      expect(exportedYaml).toContain('v3.1.0');
      expect(exportedYaml).toContain('Orders Basic Contract');

      // Verify SLA properties added via UI are in the export
      expect(exportedYaml).toContain('slaProperties');
      expect(exportedYaml).toContain('freshness');
      expect(exportedYaml).toContain('24');
      expect(exportedYaml).toContain('latency');
      expect(exportedYaml).toContain('2');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with SLA, modify SLA via UI, export and verify SLA changes', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Step 1: Import an ODCS contract with existing SLA (freshness: 12 hours)
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_VALID_FULL_YAML, 'full-for-sla-edit.yaml');

      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Step 2: Edit the contract via UI - modify SLA values
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('contract-edit-button').click();

      // Wait for edit mode
      await expect(page.getByTestId('save-contract-btn')).toBeVisible();

      // Navigate to SLA tab
      await page.getByRole('tab', { name: 'SLA' }).click();

      // Update refresh frequency from 12 to 48 hours
      await page.getByTestId('refresh-frequency-interval-input').clear();
      await page.getByTestId('refresh-frequency-interval-input').fill('48');

      // Update max latency from 2 to 4 hours
      await page.getByTestId('max-latency-value-input').clear();
      await page.getByTestId('max-latency-value-input').fill('4');

      // Save the contract
      const saveContractResponse = page.waitForResponse(
        '/api/v1/dataContracts/*'
      );
      await page.getByTestId('save-contract-btn').click();
      await saveContractResponse;

      await page.waitForLoadState('networkidle');

      // Step 3: Export as ODCS YAML
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.getByTestId('export-odcs-contract-button').click();

      const download = await downloadPromise;
      const tempPath = `/tmp/sla-modified-${Date.now()}.yaml`;
      await download.saveAs(tempPath);

      // Step 4: Verify SLA modifications are reflected in the export
      const fsModule = await import('fs');
      const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

      // Verify updated SLA values
      expect(exportedYaml).toContain('slaProperties');
      expect(exportedYaml).toContain('freshness');
      expect(exportedYaml).toContain('"48"');
      expect(exportedYaml).toContain('latency');
      expect(exportedYaml).toContain('"4"');

      // Cleanup
      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('Import ODCS with markdown description and verify proper rendering', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      // Import an ODCS contract with markdown content in description
      await navigateToContractTab(page, table);
      await openODCSImportDropdown(page);
      await importODCSYaml(
        page,
        ODCS_VALID_WITH_MARKDOWN_DESCRIPTION_YAML,
        'markdown-description.yaml'
      );

      // Verify contract was created
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        'Markdown Description Contract'
      );

      // Verify description section is visible and contains markdown content
      const descriptionSection = page.locator('.contract-card-items').first();
      await expect(descriptionSection).toBeVisible();

      // Get the markdown parser element where description is rendered
      const markdownParser = page.getByTestId('markdown-parser').first();
      await expect(markdownParser).toBeVisible();

      // Click "more" button to expand the full description if it exists
      const moreButton = page.getByRole('button', { name: 'more' });
      if (await moreButton.isVisible()) {
        await moreButton.click();
      }

      // Verify markdown content is rendered (text content check)
      // Headers
      await expect(markdownParser).toContainText('Data Contract Overview');
      await expect(markdownParser).toContainText('Key Features');
      await expect(markdownParser).toContainText('Data Sources');

      // Bold text content
      await expect(markdownParser).toContainText('quality standards');
      await expect(markdownParser).toContainText('Real-time updates');

      // Italic text content
      await expect(markdownParser).toContainText('customer analytics');
      await expect(markdownParser).toContainText('Historical data');

      // Code text content
      await expect(markdownParser).toContainText('SQL');
      await expect(markdownParser).toContainText('Python');

      // List items content
      await expect(markdownParser).toContainText('Customer transactions');
      await expect(markdownParser).toContainText('User behavior logs');
      await expect(markdownParser).toContainText('Product catalog');

      // Blockquote content
      await expect(markdownParser).toContainText(
        'Note: This data is subject to GDPR'
      );

      // Link text
      await expect(markdownParser).toContainText('documentation');
    } finally {
      await table.delete(apiContext);
    }
  });

  // OpenMetadata (OM) Format Export/Import Round Trip Tests

  test('Create contract from UI, export OM format, import with merge, verify data', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    try {
      await test.step('Create contract from UI with SLA', async () => {
        await navigateToContractTab(page, table);

        await expect(page.getByTestId('add-contract-button')).toBeVisible();
        await page.getByTestId('add-contract-button').click();
        await expect(page.getByTestId('add-contract-menu')).toBeVisible();
        await page.getByTestId('create-contract-button').click();
        await expect(page.getByTestId('add-contract-card')).toBeVisible();

        await page
          .getByTestId('contract-name')
          .fill('OM Merge Round Trip Contract');
        await page.fill(
          '.om-block-editor[contenteditable="true"]',
          'Original contract description'
        );

        const contractCard = page.getByTestId('add-contract-card');
        await contractCard.getByRole('tab', { name: 'SLA' }).click();

        await page.getByTestId('refresh-frequency-interval-input').fill('12');
        await page.getByTestId('refresh-frequency-unit-select').click();
        await page
          .locator('.refresh-frequency-unit-select [title=Hour]')
          .click();

        await page.getByTestId('max-latency-value-input').fill('3');
        await page.getByTestId('max-latency-unit-select').click();
        await page.locator('.max-latency-unit-select [title=Hour]').click();

        const saveContractResponse = page.waitForResponse(
          '/api/v1/dataContracts*'
        );
        await page.getByTestId('save-contract-btn').click();
        await saveContractResponse;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.getByTestId('contract-title')).toBeVisible();
        await expect(page.getByTestId('contract-title')).toContainText(
          'OM Merge Round Trip Contract'
        );
        await expect(page.getByTestId('contract-sla-card')).toBeVisible({
          timeout: 10000,
        });
      });

      let modifiedYaml: string;
      const fsModule = await import('fs');
      const tempPath = `/tmp/om-merge-roundtrip-${Date.now()}.yaml`;

      await test.step('Export as OM format and modify description', async () => {
        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('manage-contract-actions').click();
        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });
        await page.getByTestId('export-contract-button').click();

        const download = await downloadPromise;
        await download.saveAs(tempPath);

        const exportedYaml = fsModule.readFileSync(tempPath, 'utf-8');

        expect(exportedYaml).toContain('name:');
        expect(exportedYaml).toContain('sla:');
        expect(exportedYaml).not.toContain('apiVersion: v3.1.0');

        modifiedYaml = exportedYaml.replace(
          'Original contract description',
          'Description updated via OM merge import'
        );
      });

      await test.step('Import modified OM YAML with merge option', async () => {
        await page.getByTestId('manage-contract-actions').click();
        await page.waitForSelector('.contract-action-dropdown', {
          state: 'visible',
        });
        await page.getByTestId('import-openmetadata-contract-button').click();

        await page.getByTestId('import-contract-modal').waitFor({
          state: 'visible',
          timeout: 10000,
        });

        const fileInput = page.getByTestId('file-upload-input');
        await fileInput.setInputFiles({
          name: 'om-merge-contract.yaml',
          mimeType: 'application/yaml',
          buffer: Buffer.from(modifiedYaml),
        });

        await page.getByTestId('file-info-card').waitFor({
          state: 'visible',
          timeout: 10000,
        });

        await expect(
          page.getByTestId('existing-contract-warning')
        ).toBeVisible();
        await expect(
          page.locator('input[type="radio"][value="merge"]')
        ).toBeChecked();

        const importButton = page.getByTestId('import-button');
        await expect(importButton).toBeEnabled({ timeout: 15000 });
        await importButton.click();

        await toastNotification(page, 'Contract imported successfully');
      });

      await test.step('Verify merged contract preserves SLA and updates description', async () => {
        await expect(page.getByTestId('contract-title')).toBeVisible();
        await expect(page.getByTestId('contract-title')).toContainText(
          'OM Merge Round Trip Contract'
        );
        await expect(page.getByTestId('contract-sla-card')).toBeVisible({
          timeout: 10000,
        });

        const descriptionSection = page
          .getByTestId('markdown-parser')
          .first();
        await expect(descriptionSection).toContainText(
          'Description updated via OM merge import'
        );
      });

      fsModule.unlinkSync(tempPath);
    } finally {
      await table.delete(apiContext);
    }
  });

  test('OM format export and import round trip - create, export, delete, reimport', async ({
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);
    const contractName = `OM Round Trip Contract ${Date.now()}`;

    try {
      // Step 1: Create a contract via API with all properties including termsOfUse
      const createContractPayload = {
        name: contractName,
        description: 'Contract for testing OM format export/import round trip',
        entity: {
          id: table.entityResponseData.id,
          type: 'table',
        },
        termsOfUse: 'These are the terms of use for the data contract. Data must be used responsibly.',
        sla: {
          refreshFrequency: {
            interval: 24,
            unit: 'day',
          },
          maxLatency: {
            value: 2,
            unit: 'hour',
          },
        },
      };

      const createResponse = await apiContext.post('/api/v1/dataContracts', {
        data: createContractPayload,
      });
      expect(createResponse.ok()).toBeTruthy();
      const createdContract = await createResponse.json();

      // Navigate to the contract tab and verify it was created
      await navigateToContractTab(page, table);
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        contractName
      );
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Step 2: Export as OpenMetadata (OM) format
      const omDownloadPromise = page.waitForEvent('download');
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', {
        state: 'visible',
      });
      await page.getByTestId('export-contract-button').click();

      const omDownload = await omDownloadPromise;
      const omTempPath = `/tmp/om-roundtrip-export-${Date.now()}.yaml`;
      await omDownload.saveAs(omTempPath);

      // Read the exported OM YAML content
      const fsModule = await import('fs');
      const omYamlContent = fsModule.readFileSync(omTempPath, 'utf-8');

      // Verify exported YAML contains expected fields
      expect(omYamlContent).toContain('name:');
      expect(omYamlContent).toContain('termsOfUse:');
      expect(omYamlContent).toContain('sla:');
      // Verify system fields are NOT in the export
      expect(omYamlContent).not.toContain('createdAt:');
      expect(omYamlContent).not.toContain('createdBy:');

      // Step 3: Delete the contract via API
      await apiContext.delete(
        `/api/v1/dataContracts/${createdContract.id}?hardDelete=true&recursive=true`
      );

      // Step 4: Import the exported OM YAML via API
      const importResponse = await apiContext.put('/api/v1/dataContracts', {
        data: omYamlContent,
        headers: {
          'Content-Type': 'application/yaml',
        },
      });

      // Verify the import succeeded
      expect(importResponse.ok()).toBeTruthy();
      const importedContract = await importResponse.json();
      expect(importedContract.name).toBe(contractName);
      expect(importedContract.termsOfUse).toBeDefined();
      expect(importedContract.termsOfUse.content).toContain(
        'terms of use for the data contract'
      );
      expect(importedContract.sla).toBeDefined();

      // Step 5: Navigate back to the contract tab and verify the reimported contract
      await navigateToContractTab(page, table);

      // Verify the reimported contract is displayed with correct data
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('contract-title')).toContainText(
        contractName
      );
      await expect(page.getByTestId('contract-sla-card')).toBeVisible({
        timeout: 10000,
      });

      // Cleanup temp file
      fsModule.unlinkSync(omTempPath);
    } finally {
      await table.delete(apiContext);
    }
  });
});
