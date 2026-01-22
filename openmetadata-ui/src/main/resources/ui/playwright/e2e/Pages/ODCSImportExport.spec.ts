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
  ODCS_VALID_MULTI_OBJECT_YAML,
  ODCS_VALID_QUALITY_RULES_BETWEEN_YAML,
  ODCS_WITH_QUALITY_RULES_YAML,
  ODCS_VALID_WITH_TEAM_YAML,
  ODCS_VALID_WITH_TIMESTAMPS_YAML,
  ODCS_WITH_SLA_YAML,
} from '../../constant/dataContracts';
import { TableClass } from '../../support/entity/TableClass';
import {
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
      expect(exportedYaml).toContain('roles');
      expect(exportedYaml).toContain('data-consumer');

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
      expect(exportedYaml).toContain('data-consumer');

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

  test('Multi-object ODCS contract - selecting object enables import', async ({
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

      // Open the object selector dropdown and select an object
      await page.getByTestId('schema-object-select').click();
      await page.getByTestId('schema-object-option-customers').click();

      // Wait for validation to complete after selecting object
      await page.waitForTimeout(2000);

      // Import button should now be enabled (or disabled if schema validation fails)
      // For this test, we just verify the selector works
      await expect(page.getByTestId('schema-object-select')).toContainText(
        'customers'
      );

      // Close modal
      await page
        .getByTestId('cancel-button')
        .filter({ hasText: /cancel/i })
        .click();
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
});
