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

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import React from 'react';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  createContract,
  createOrUpdateContractFromODCSYaml,
  deleteContractById,
  importContractFromODCSYaml,
  parseODCSYaml,
  updateContract,
  validateContractYaml,
  validateODCSYaml,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ContractImportModal from './ODCSImportModal.component';

const mockTheme = {
  palette: {
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
    },
    primary: {
      main: '#1976d2',
    },
    divider: '#e0e0e0',
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
    },
    allShades: {
      success: {
        50: '#e8f5e9',
        500: '#4caf50',
        700: '#388e3c',
      },
      error: {
        50: '#ffebee',
        100: '#ffcdd2',
        600: '#e53935',
      },
      warning: {
        50: '#fff8e1',
        300: '#ffb74d',
        600: '#fb8c00',
        800: '#ef6c00',
      },
    },
  },
};

jest.mock('@mui/material', () => {
  const actualMui = jest.requireActual('@mui/material');

  return {
    ...actualMui,
    useTheme: () => mockTheme,
    Select: ({
      children,
      value,
      onChange,
      displayEmpty,
    }: {
      children: React.ReactNode;
      value: string;
      onChange: (e: { target: { value: string } }) => void;
      displayEmpty?: boolean;
    }) => (
      <select
        data-testid="object-selector"
        value={value}
        onChange={(e) => onChange({ target: { value: e.target.value } })}>
        {displayEmpty && <option value="">Select Schema Object</option>}
        {children}
      </select>
    ),
    MenuItem: ({
      children,
      value,
      disabled,
    }: {
      children: React.ReactNode;
      value: string;
      disabled?: boolean;
    }) => (
      <option disabled={disabled} value={value}>
        {children}
      </option>
    ),
  };
});

jest.mock('../../../rest/contractAPI', () => ({
  createContract: jest.fn(),
  createOrUpdateContractFromODCSYaml: jest.fn(),
  deleteContractById: jest.fn(),
  importContractFromODCSYaml: jest.fn(),
  parseODCSYaml: jest.fn(),
  updateContract: jest.fn(),
  validateContractYaml: jest.fn(),
  validateODCSYaml: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../assets/svg/upload-cloud.svg', () => ({
  ReactComponent: () => <div data-testid="cloud-upload-icon">CloudUpload</div>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'label.cancel': 'Cancel',
        'label.import': 'Import',
        'label.import-odcs-contract': 'Import ODCS Contract',
        'label.import-contract': 'Import Contract',
        'label.file': 'File',
        'label.contract-preview': 'Contract Preview',
        'label.name': 'Name',
        'label.display-name': 'Display Name',
        'label.version': 'Version',
        'label.status': 'Status',
        'label.includes': 'Includes',
        'label.schema': 'Schema',
        'label.sla': 'SLA',
        'label.security': 'Security',
        'label.team': 'Team',
        'label.semantic-plural': 'Semantics',
        'label.none': 'None',
        'label.not-specified': 'Not specified',
        'label.what-will-happen': 'What will happen',
        'label.merge-with-existing': 'Merge with existing',
        'label.replace-existing': 'Replace existing',
        'label.odcs-contract': 'ODCS Contract',
        'label.contract': 'Contract',
        'message.drag-drop-odcs-file': 'Drag and drop ODCS file here',
        'message.drag-drop-openmetadata-file':
          'Drag and drop OpenMetadata file here',
        'label.supports-yaml-format': 'Supports YAML format',
        'message.invalid-odcs-contract-format': 'Invalid ODCS contract format',
        'message.invalid-openmetadata-contract-format':
          'Invalid OpenMetadata contract format',
        'message.existing-contract-detected': 'Existing contract detected',
        'message.choose-import-mode': 'Choose import mode',
        'message.import-mode-merge-description':
          'Merge imported data with existing contract',
        'message.import-mode-replace-description':
          'Overwrite all contract fields with imported ODCS',
        'message.import-odcs-merge-preserve-id':
          'Preserve existing contract ID',
        'message.import-odcs-merge-update-fields':
          'Update fields from imported contract',
        'message.import-odcs-merge-preserve-reviewers':
          'Preserve existing reviewers',
        'message.import-odcs-merge-deep-merge-sla': 'Deep merge SLA properties',
        'message.import-odcs-replace-overwrite-all':
          'All contract fields will be overwritten',
        'message.import-odcs-replace-preserve-id':
          'Contract ID will be preserved',
        'message.import-odcs-replace-preserve-history':
          'Execution history will be preserved',
        'message.entity-imported-successfully': `${options?.entity} imported successfully`,
        'message.multi-object-contract-detected':
          'This contract contains multiple schema objects',
        'message.select-schema-object-to-import':
          'Select which schema object to import',
        'label.select-schema-object': 'Select Schema Object',
        'label.parse-error': 'Parse Error',
        'label.failed': 'Failed',
        'message.invalid-odcs-contract-format-required-fields':
          'The following fields are required: APIVersion, Kind, Status',
        'label.syntax': 'Syntax',
        'label.invalid': 'Invalid',
        'label.valid': 'Valid',
        'message.validating-contract-schema': 'Validating contract schema...',
        'label.schema-validation': 'Schema Validation',
        'label.passed': 'Passed',
        'message.schema-validation-passed':
          'Schema validation passed ({{count}} field(s) verified)',
        'message.contract-syntax-valid': 'Contract syntax is valid',
        'label.field-plural-lowercase': 'fields',
        'label.verified': 'verified',
        'label.error': 'error',
        'label.not-found-lowercase': 'not found',
        'label.replace-entire-contract': 'Replace entire contract',
        'message.please-select-action-below': 'Please select an action below.',
        'label.click-to-upload': 'Click to upload',
        'label.or-drag-and-drop': 'or drag and drop',
        'message.upload-file-description':
          'Upload a contract file to import or validate',
        'label.contract-validation': 'Contract Validation',
        'label.validation-failed': 'Validation Failed',
        'label.error-plural': 'Errors',
      };

      return translations[key] || key;
    },
  }),
}));

const mockOnClose = jest.fn();
const mockOnSuccess = jest.fn();

const mockExistingContract: DataContract = {
  id: 'existing-contract-id',
  name: 'Existing Contract',
  entity: { id: 'table-1', type: 'table' },
};

const mockImportedContract: DataContract = {
  id: 'imported-contract-id',
  name: 'Imported Contract',
  entity: { id: 'table-1', type: 'table' },
};

const validODCSYaml = `apiVersion: v3.1.0
kind: DataContract
id: test-contract
name: Test Contract
version: '1.0.0'
status: active
description:
  purpose: Test contract for unit testing
schema:
  - name: users
    properties:
      - name: id
        logicalType: string
slaProperties:
  - property: freshness
    value: '24'
    unit: hours
roles:
  - name: admin
    access: readWrite
team:
  - name: data-team
    role: owner`;

const validODCSYamlMinimal = `apiVersion: v3.1.0
kind: DataContract
id: minimal-contract
version: '1.0.0'
status: draft`;

const invalidODCSYaml = `name: Invalid Contract
version: '1.0.0'`;

const malformedYaml = `apiVersion: v3.1.0
kind: DataContract
  invalid: indentation
    broken: yaml`;

const validOpenMetadataYaml = `name: om-contract
displayName: OM Contract
description: Test OpenMetadata contract
entity:
  id: table-1
  type: table
schema:
  - name: users
sla:
  target: 99.9
security:
  level: high
semantics:
  - name: customer`;

const multiObjectODCSYaml = `apiVersion: v3.1.0
kind: DataContract
id: multi-object-contract
name: Multi Object Contract
version: '1.0.0'
status: active
schema:
  - name: users
  - name: orders
  - name: products`;

describe('ContractImportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (parseODCSYaml as jest.Mock).mockResolvedValue({
      schemaObjects: ['users'],
      hasMultipleObjects: false,
    });
    (validateODCSYaml as jest.Mock).mockResolvedValue({
      valid: true,
      schemaValidation: {
        passed: 1,
        failed: 0,
        total: 1,
        failedFields: [],
      },
    });
    (validateContractYaml as jest.Mock).mockResolvedValue({
      valid: true,
      schemaValidation: {
        passed: 1,
        failed: 0,
        total: 1,
        failedFields: [],
      },
    });
  });

  describe('Rendering', () => {
    it('should render modal when visible is true', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Import ODCS Contract')).toBeInTheDocument();
    });

    it('should not render modal content when visible is false', () => {
      render(
        <ContractImportModal
          entityId="table-1"
          entityType="table"
          format="odcs"
          visible={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(
        screen.queryByText('Import ODCS Contract')
      ).not.toBeInTheDocument();
    });

    it('should show file upload area initially', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
      expect(screen.getByText(/or drag and drop/)).toBeInTheDocument();
      expect(screen.getByText('Supports YAML format')).toBeInTheDocument();
    });

    it('should have Import button disabled initially', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const importButton = screen.getByRole('button', { name: 'Import' });

      expect(importButton).toBeDisabled();
    });

    it('should render OpenMetadata format modal title', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Import Contract')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('should accept YAML files and show preview', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('contract.yaml')).toBeInTheDocument();
      });
    });

    it('should show contract preview after valid file upload', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
        expect(screen.getByText(/Test Contract/)).toBeInTheDocument();
        expect(screen.getByText(/1.0.0/)).toBeInTheDocument();
        expect(screen.getByText(/active/)).toBeInTheDocument();
      });
    });

    it('should show includes section with detected features', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Schema')).toBeInTheDocument();
        expect(screen.getByText('SLA')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('Team')).toBeInTheDocument();
      });
    });

    it('should show error for invalid ODCS format', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([invalidODCSYaml], 'invalid.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            'The following fields are required: APIVersion, Kind, Status'
          )
        ).toBeInTheDocument();
        expect(screen.getByText('Parse Error')).toBeInTheDocument();
      });
    });

    it('should disable Import button when parse error occurs', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([invalidODCSYaml], 'invalid.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import' });

        expect(importButton).toBeDisabled();
      });
    });

    it('should enable Import button for valid file', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYamlMinimal], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import' });

        expect(importButton).not.toBeDisabled();
      });
    });

    it('should not process file if no file is selected', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [] } });
      });

      expect(screen.queryByText('contract.yaml')).not.toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over event', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dropZone = screen
        .getByText('Click to upload')
        .closest('div[class*="MuiBox"]') as HTMLElement;

      await act(async () => {
        fireEvent.dragOver(dropZone, { preventDefault: jest.fn() });
      });

      expect(dropZone).toBeInTheDocument();
    });

    it('should handle drag leave event', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dropZone = screen
        .getByText('Click to upload')
        .closest('div[class*="MuiBox"]') as HTMLElement;

      await act(async () => {
        fireEvent.dragLeave(dropZone, { preventDefault: jest.fn() });
      });

      expect(dropZone).toBeInTheDocument();
    });

    it('should handle valid file drop', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dropZone = screen
        .getByText('Click to upload')
        .closest('div[class*="MuiBox"]') as HTMLElement;

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      await waitFor(() => {
        expect(screen.getByText('contract.yaml')).toBeInTheDocument();
      });
    });

    it('should ignore invalid file extensions on drop', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dropZone = screen
        .getByText('Click to upload')
        .closest('div[class*="MuiBox"]') as HTMLElement;

      const file = new File(['invalid'], 'contract.txt', {
        type: 'text/plain',
      });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      expect(screen.queryByText('contract.txt')).not.toBeInTheDocument();
    });

    it('should handle drop with no files', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const dropZone = screen
        .getByText('Click to upload')
        .closest('div[class*="MuiBox"]') as HTMLElement;

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [] },
        });
      });

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
    });
  });

  describe('File Removal', () => {
    it('should remove file when delete button is clicked', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('contract.yaml')).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId('DeleteOutlineOutlinedIcon')
        .parentElement as HTMLElement;

      await act(async () => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Click to upload')).toBeInTheDocument();
      });
    });
  });

  describe('Existing Contract Detection', () => {
    it('should show merge/replace options when existing contract is provided', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Existing contract detected')
        ).toBeInTheDocument();
        expect(screen.getByText('Merge with existing')).toBeInTheDocument();
        expect(screen.getByText('Replace entire contract')).toBeInTheDocument();
      });
    });

    it('should not show merge/replace options when no existing contract', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.queryByText('Existing contract detected')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Merge with existing')
        ).not.toBeInTheDocument();
      });
    });

    it('should default to merge mode', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Merge with existing')).toBeInTheDocument();
      });

      const mergeRadio = screen.getByDisplayValue('merge');

      expect(mergeRadio).toBeChecked();
    });

    it('should show merge description when merge mode is selected', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Merge imported data with existing contract')
        ).toBeInTheDocument();
      });
    });

    it('should switch to replace mode when replace option is clicked', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Replace entire contract')).toBeInTheDocument();
      });

      const replaceRadio = screen.getByDisplayValue('replace');
      fireEvent.click(replaceRadio);

      await waitFor(() => {
        expect(replaceRadio).toBeChecked();
      });
    });
  });

  describe('Validation Panel', () => {
    it('should show validation loading state', async () => {
      (validateODCSYaml as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({ passed: 1, failed: 0, total: 1, failedFields: [] }),
              100
            )
          )
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Validating contract schema...')
        ).toBeInTheDocument();
      });
    });

    it('should show validation passed state', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Schema Validation')).toBeInTheDocument();
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });
    });

    it('should show validation failed state with failed fields', async () => {
      (validateODCSYaml as jest.Mock).mockResolvedValue({
        valid: false,
        schemaValidation: {
          passed: 0,
          failed: 2,
          total: 2,
          failedFields: ['field1', 'field2'],
        },
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText(/field1.*not found/i)).toBeInTheDocument();
        expect(screen.getByText(/field2.*not found/i)).toBeInTheDocument();
      });
    });

    it('should show server validation error', async () => {
      (validateODCSYaml as jest.Mock).mockRejectedValue(
        new Error('Server validation error')
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Server validation error')).toBeInTheDocument();
      });
    });

    it('should show entity validation errors when entityErrors are present', async () => {
      (validateODCSYaml as jest.Mock).mockResolvedValue({
        valid: false,
        entityErrors: [
          'name must match "^((?!::).)*$"',
          'name size must be between 1 and 256',
        ],
        schemaValidation: {
          passed: 1,
          failed: 0,
          total: 1,
          failedFields: [],
        },
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('entity-validation-error-panel')
        ).toBeInTheDocument();
        expect(screen.getByText('Contract Validation')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(
          screen.getByText('name must match "^((?!::).)*$"')
        ).toBeInTheDocument();
        expect(
          screen.getByText('name size must be between 1 and 256')
        ).toBeInTheDocument();
      });
    });

    it('should show constraint errors when constraintErrors are present', async () => {
      (validateODCSYaml as jest.Mock).mockResolvedValue({
        valid: false,
        constraintErrors: [
          'Entity type "unsupported" is not supported for data contracts',
        ],
        schemaValidation: {
          passed: 0,
          failed: 0,
          total: 0,
          failedFields: [],
        },
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('entity-validation-error-panel')
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            'Entity type "unsupported" is not supported for data contracts'
          )
        ).toBeInTheDocument();
      });
    });

    it('should disable import button when entity errors are present', async () => {
      (validateODCSYaml as jest.Mock).mockResolvedValue({
        valid: false,
        entityErrors: ['name size must be between 1 and 256'],
        schemaValidation: {
          passed: 1,
          failed: 0,
          total: 1,
          failedFields: [],
        },
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import' });

        expect(importButton).toBeDisabled();
      });
    });
  });

  describe('Multiple Schema Objects', () => {
    it('should call parseODCSYaml when multiple schema objects exist', async () => {
      (parseODCSYaml as jest.Mock).mockResolvedValue({
        schemaObjects: ['users', 'orders', 'products'],
        hasMultipleObjects: true,
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityName="users"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([multiObjectODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(parseODCSYaml).toHaveBeenCalledWith(multiObjectODCSYaml);
      });
    });

    it('should auto-select matching entity name and call validateODCSYaml', async () => {
      (parseODCSYaml as jest.Mock).mockResolvedValue({
        schemaObjects: ['users', 'orders', 'products'],
        hasMultipleObjects: true,
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityName="users"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([multiObjectODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(validateODCSYaml).toHaveBeenCalledWith(
          expect.any(String),
          'table-1',
          'table',
          'users'
        );
      });
    });

    it('should disable import button when no object is selected for multi-object contract', async () => {
      (parseODCSYaml as jest.Mock).mockResolvedValue({
        schemaObjects: ['users', 'orders', 'products'],
        hasMultipleObjects: true,
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([multiObjectODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import' });

        expect(importButton).toBeDisabled();
      });
    });

    it('should allow selecting a schema object from the selector', async () => {
      (parseODCSYaml as jest.Mock).mockResolvedValue({
        schemaObjects: ['users', 'orders', 'products'],
        hasMultipleObjects: true,
      });

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([multiObjectODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        const objectSelector = screen.getByTestId('object-selector');

        expect(objectSelector).toBeInTheDocument();
      });

      const objectSelector = screen.getByTestId('object-selector');

      await act(async () => {
        fireEvent.change(objectSelector, { target: { value: 'orders' } });
      });

      await waitFor(() => {
        expect(validateODCSYaml).toHaveBeenCalledWith(
          expect.any(String),
          'table-1',
          'table',
          'orders'
        );
      });
    });
  });

  describe('Import Flow', () => {
    it('should call importContractFromODCSYaml for new contract', async () => {
      (importContractFromODCSYaml as jest.Mock).mockResolvedValue(
        mockImportedContract
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(importContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table',
          'users'
        );
      });
    });

    it('should call createOrUpdateContractFromODCSYaml with merge mode', async () => {
      (createOrUpdateContractFromODCSYaml as jest.Mock).mockResolvedValue(
        mockImportedContract
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(createOrUpdateContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table',
          'merge',
          'users'
        );
        expect(deleteContractById).not.toHaveBeenCalled();
      });
    });

    it('should call createOrUpdateContractFromODCSYaml with replace mode', async () => {
      (createOrUpdateContractFromODCSYaml as jest.Mock).mockResolvedValue(
        mockImportedContract
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const replaceRadio = screen.getByDisplayValue('replace');
      fireEvent.click(replaceRadio);

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(createOrUpdateContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table',
          'replace',
          'users'
        );
      });
    });

    it('should show success toast on successful import', async () => {
      (importContractFromODCSYaml as jest.Mock).mockResolvedValue(
        mockImportedContract
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(showSuccessToast).toHaveBeenCalledWith(
          'ODCS Contract imported successfully'
        );
        expect(mockOnSuccess).toHaveBeenCalledWith(mockImportedContract);
      });
    });

    it('should show error toast on import failure', async () => {
      const mockError = new AxiosError('Import failed');
      (importContractFromODCSYaml as jest.Mock).mockRejectedValue(mockError);

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
        expect(mockOnSuccess).not.toHaveBeenCalled();
      });
    });

    it('should close modal on successful import', async () => {
      (importContractFromODCSYaml as jest.Mock).mockResolvedValue(
        mockImportedContract
      );

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle OpenMetadata import for new contract', async () => {
      (createContract as jest.Mock).mockResolvedValue(mockImportedContract);

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={null}
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validOpenMetadataYaml], 'om-contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(createContract).toHaveBeenCalled();
        expect(showSuccessToast).toHaveBeenCalledWith(
          'Contract imported successfully'
        );
        expect(mockOnSuccess).toHaveBeenCalledWith(mockImportedContract);
      });
    });

    it('should handle OpenMetadata import with replace mode for existing contract', async () => {
      (deleteContractById as jest.Mock).mockResolvedValue(undefined);
      (createContract as jest.Mock).mockResolvedValue(mockImportedContract);

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validOpenMetadataYaml], 'om-contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
      });

      const replaceRadio = screen.getByDisplayValue('replace');
      fireEvent.click(replaceRadio);

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(deleteContractById).toHaveBeenCalledWith(
          mockExistingContract.id
        );
        expect(createContract).toHaveBeenCalled();
        expect(mockOnSuccess).toHaveBeenCalledWith(mockImportedContract);
      });
    });

    it('should handle OpenMetadata import with merge mode for existing contract', async () => {
      (updateContract as jest.Mock).mockResolvedValue(mockImportedContract);

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          existingContract={mockExistingContract}
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validOpenMetadataYaml], 'om-contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import' });

      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(updateContract).toHaveBeenCalled();
        expect(deleteContractById).not.toHaveBeenCalled();
        expect(mockOnSuccess).toHaveBeenCalledWith(mockImportedContract);
      });
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when Cancel button is clicked', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset state when modal is closed', async () => {
      const { rerender } = render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('contract.yaml')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      rerender(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Click to upload')).toBeInTheDocument();
    });

    it('should call onClose when close icon is clicked', () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const closeIcon = screen.getByTestId('CloseIcon').parentElement;

      if (closeIcon) {
        fireEvent.click(closeIcon);

        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle contract without name gracefully', async () => {
      const noNameYaml = `apiVersion: v3.1.0
kind: DataContract
version: '1.0.0'
status: active`;

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([noNameYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Not specified/)).toBeInTheDocument();
      });
    });

    it('should handle contract with no optional sections', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYamlMinimal], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
        expect(screen.queryByText('Schema')).not.toBeInTheDocument();
        expect(screen.queryByText('SLA')).not.toBeInTheDocument();
      });
    });

    it('should handle malformed YAML gracefully', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([malformedYaml], 'malformed.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Parse Error')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('should handle OpenMetadata contract with display name', async () => {
      const omWithDisplayName = `name: test-contract
displayName: Test Display Name
description: Test
entity:
  id: table-1
  type: table`;

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([omWithDisplayName], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Test Display Name')).toBeInTheDocument();
      });
    });

    it('should handle parseODCSYaml error gracefully', async () => {
      (parseODCSYaml as jest.Mock).mockRejectedValue(new Error('Parse error'));

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="odcs"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validODCSYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
      });
    });

    it('should handle invalid OpenMetadata format', async () => {
      const invalidOMYaml = `description: No name field
version: 1.0`;

      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([invalidOMYaml], 'invalid-om.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Parse Error')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });
  });

  describe('OpenMetadata Format Preview', () => {
    it('should show OpenMetadata contract features in preview', async () => {
      render(
        <ContractImportModal
          visible
          entityId="table-1"
          entityType="table"
          format="openmetadata"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const file = new File([validOpenMetadataYaml], 'contract.yaml', {
        type: 'application/x-yaml',
      });

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Contract Preview')).toBeInTheDocument();
        expect(screen.getByText('Schema')).toBeInTheDocument();
        expect(screen.getByText('SLA')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('Semantics')).toBeInTheDocument();
      });
    });
  });
});
