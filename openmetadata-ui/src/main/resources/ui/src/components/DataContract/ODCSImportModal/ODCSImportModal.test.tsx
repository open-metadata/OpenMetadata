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
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  createOrUpdateContractFromODCSYaml,
  deleteContractById,
  importContractFromODCSYaml,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ContractImportModal from './ODCSImportModal.component';

jest.mock('../../../rest/contractAPI', () => ({
  createOrUpdateContractFromODCSYaml: jest.fn(),
  deleteContractById: jest.fn(),
  importContractFromODCSYaml: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
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
        'message.supports-yaml-format': 'Supports YAML format',
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

describe('ContractImportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(
        screen.getByText('Drag and drop ODCS file here')
      ).toBeInTheDocument();
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
        expect(screen.getByText('Contract Preview:')).toBeInTheDocument();
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
        expect(screen.getByText(/Schema/)).toBeInTheDocument();
        expect(screen.getByText(/SLA/)).toBeInTheDocument();
        expect(screen.getByText(/Security/)).toBeInTheDocument();
        expect(screen.getByText(/Team/)).toBeInTheDocument();
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
          screen.getByText('Invalid ODCS contract format')
        ).toBeInTheDocument();
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
        expect(screen.getByText('Choose import mode:')).toBeInTheDocument();
        expect(screen.getByText('Merge with existing')).toBeInTheDocument();
        expect(screen.getByText('Replace existing')).toBeInTheDocument();
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
        const mergeRadio = screen.getByRole('radio', {
          name: /Merge with existing/i,
        });

        expect(mergeRadio).toBeChecked();
      });
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
        expect(screen.getByText('What will happen:')).toBeInTheDocument();
        expect(
          screen.getByText('Preserve existing contract ID')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Update fields from imported contract')
        ).toBeInTheDocument();
      });
    });

    it('should show replace description when replace mode is selected', async () => {
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
        const replaceRadio = screen.getByRole('radio', {
          name: /Replace existing/i,
        });
        fireEvent.click(replaceRadio);
      });

      await waitFor(() => {
        expect(
          screen.getByText('All contract fields will be overwritten')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Contract ID will be preserved')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Execution history will be preserved')
        ).toBeInTheDocument();
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
        const importButton = screen.getByRole('button', { name: 'Import' });
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(importContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table'
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
        const importButton = screen.getByRole('button', { name: 'Import' });
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(createOrUpdateContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table',
          'merge'
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
        const replaceRadio = screen.getByRole('radio', {
          name: /Replace existing/i,
        });
        fireEvent.click(replaceRadio);
      });

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import' });
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(createOrUpdateContractFromODCSYaml).toHaveBeenCalledWith(
          validODCSYaml,
          'table-1',
          'table',
          'replace'
        );
        expect(deleteContractById).not.toHaveBeenCalled();
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
        const importButton = screen.getByRole('button', { name: 'Import' });
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
        const importButton = screen.getByRole('button', { name: 'Import' });
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
        const importButton = screen.getByRole('button', { name: 'Import' });
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
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

      expect(
        screen.getByText('Drag and drop ODCS file here')
      ).toBeInTheDocument();
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
        expect(screen.getByText(/None/)).toBeInTheDocument();
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
        expect(
          screen.getByText('Invalid ODCS contract format')
        ).toBeInTheDocument();
      });
    });
  });
});
