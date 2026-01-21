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
import { MemoryRouter } from 'react-router-dom';
import { DataContractMode } from '../../../constants/DataContract.constants';
import {
  ContractExecutionStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import {
  exportContractToODCSYaml,
  getContractResultByResultId,
  validateContractById,
} from '../../../rest/contractAPI';
import '../../../test/unit/mocks/mui.mock';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import {
  downloadContractAsODCSYaml,
  downloadContractYamlFile,
  getConstraintStatus,
} from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ContractDetail } from './ContractDetail';

jest.mock('../../../rest/contractAPI', () => ({
  exportContractToODCSYaml: jest.fn(),
  getContractResultByResultId: jest.fn(),
  validateContractById: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  downloadContractAsODCSYaml: jest.fn(),
  downloadContractYamlFile: jest.fn(),
  getConstraintStatus: jest.fn(),
}));

jest.mock('../../../utils/BlockEditorUtils', () => ({
  isDescriptionContentEmpty: jest.fn(),
  formatContent: jest.fn().mockReturnValue('formatted content'),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: function MockOwnerLabel({ owners }: { owners: unknown[] }) {
    return (
      <div data-testid="owner-label">
        {owners?.length ? `${owners.length} owner(s)` : 'No owners'}
      </div>
    );
  },
}));

jest.mock('../../AlertBar/AlertBar', () => {
  return function MockAlertBar({ message }: any) {
    return <div data-testid="alert-bar">{message}</div>;
  };
});

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return function MockErrorPlaceHolder({ type, children }: any) {
    return (
      <div data-testid="error-placeholder" data-type={type}>
        {children}
      </div>
    );
  };
});

jest.mock('../ContractExecutionChart/ContractExecutionChart.component', () => {
  return function MockContractExecutionChart({ contract }: any) {
    return (
      <div data-testid="contract-execution-chart">
        Chart for {contract?.name}
      </div>
    );
  };
});

jest.mock('../ContractQualityCard/ContractQualityCard.component', () => {
  return jest.fn().mockImplementation(() => <p>ContractQualityCard</p>);
});

jest.mock('../ContractSecurity/ContractSecurityCard.component', () => {
  return function MockContractSecurityCard({ security }: any) {
    return (
      <div data-testid="contract-security-card">
        ContractSecurityCard - {security?.dataClassification}
      </div>
    );
  };
});

jest.mock('../ContractViewSwitchTab/ContractViewSwitchTab.component', () => {
  return function MockContractViewSwitchTab({ handleModeChange }: any) {
    return (
      <div data-testid="contract-view-switch-tab">
        <button
          data-testid="switch-to-yaml"
          onClick={() =>
            handleModeChange({ target: { value: DataContractMode.YAML } })
          }>
          YAML
        </button>
      </div>
    );
  };
});

jest.mock('../ODCSImportModal', () => {
  return function MockContractImportModal({
    format,
    visible,
    onSuccess,
    onClose,
  }: {
    format: string;
    visible: boolean;
    onSuccess: () => void;
    onClose: () => void;
  }) {
    return (
      <div data-testid="contract-import-modal">
        <span data-testid="import-modal-format">{format}</span>
        <span data-testid="import-modal-visible">
          {visible ? 'true' : 'false'}
        </span>
        <button
          data-testid="mock-import-success"
          onClick={() => onSuccess && onSuccess()}>
          Import Success
        </button>
        <button
          data-testid="mock-import-close"
          onClick={() => onClose && onClose()}>
          Close
        </button>
      </div>
    );
  };
});

jest.mock('../ContractYaml/ContractYaml.component', () => {
  return function MockContractYaml({ contract }: any) {
    return <div data-testid="contract-yaml">YAML for {contract?.name}</div>;
  };
});

jest.mock('../ContractSLACard/ContractSLA.component', () =>
  jest
    .fn()
    .mockImplementation(({ contract }: { contract: { name?: string } }) => (
      <div data-testid="contract-sla">SLA for {contract?.name}</div>
    ))
);

jest.mock('../ContractSchemaTable/ContractSchemaTable.component', () => {
  return function MockContractSchemaTable() {
    return <div data-testid="contract-schema-table">ContractSchemaTable</div>;
  };
});

jest.mock('../ContractSemantics/ContractSemantics.component', () => {
  return function MockContractSemantics() {
    return <div data-testid="contract-semantics">ContractSemantics</div>;
  };
});

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockImplementation(() => {
    return <div>RichTextEditorPreviewerV1</div>;
  });
});

jest.mock('../../common/Table/Table', () => {
  return function MockTable({ dataSource, loading }: any) {
    return (
      <div data-testid="mock-table">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Data Length: {dataSource?.length || 0}</div>
        {dataSource?.map((item: any) => (
          <div data-testid={`table-row-${item.id}`} key={item.id}>
            {item.name}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'label.edit': 'Edit',
        'label.delete': 'Delete',
        'message.inherited-contract-cannot-be-deleted':
          'Inherited contracts cannot be deleted',
        'label.validate': 'Validate',
        'label.download': 'Download',
        'label.contract': 'Contract',
        'label.no-contract-found': 'No contract found',
        'message.contract-validated-successfully':
          'Contract validated successfully',
        'label.test-case-plural': 'Test Cases',
        'label.execution-summary': 'Execution Summary',
        'label.last-execution': 'Last Execution',
        'message.no-test-case-found': 'No test cases found',
        'label.security': 'Security',
        'label.import-odcs': 'Import from ODCS',
        'label.odcs-contract': 'ODCS Contract',
        'message.entity-imported-successfully': `${options?.entity} imported successfully`,
      };

      return translations[key] || key;
    },
    i18n: {
      dir: () => 'ltr',
    },
  }),
}));

jest.mock('@melloware/react-logviewer', () => {
  return {
    Loading: () => <div data-testid="loading">Loading...</div>,
  };
});

const mockOnEdit = jest.fn();
const mockOnDelete = jest.fn();

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
  owners: [{ id: 'user-1', name: 'Test User', type: 'user' }],
  schema: [
    { name: 'id', dataType: 'BIGINT' },
    { name: 'name', dataType: 'VARCHAR' },
  ] as Column[],
  entity: { id: 'table-1', type: 'table' },
  qualityExpectations: [{ id: 'test-1', name: 'Test Case 1', type: 'test' }],
  testSuite: {
    id: 'suite-1',
    name: 'Test Suite 1',
    fullyQualifiedName: 'suite.1',
    type: 'testSuite',
  },
  semantics: [
    {
      name: 'Semantic Rule',
      rule: 'test rule',
      description: 'Test description',
      enabled: true,
    },
  ],
  latestResult: {
    resultId: 'resultId',
    status: ContractExecutionStatus.Success,
    timestamp: 1640995200000,
  },
};

const mockContractResults: DataContractResult = {
  dataContractFQN: 'test.contract',
  id: 'result-1',
  timestamp: 1640995200000,
  schemaValidation: {
    passed: 1,
    failed: 0,
    total: 1,
  },
  contractExecutionStatus: ContractExecutionStatus.Success,
};

describe('ContractDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getContractResultByResultId as jest.Mock).mockResolvedValue(
      mockContractResults
    );
    (getConstraintStatus as jest.Mock).mockReturnValue({
      schema: 'schema-status',
      semantic: 'semantic-status',
      quality: 'quality-status',
    });
    (isDescriptionContentEmpty as jest.Mock).mockReturnValue(false);
  });

  describe('Basic Rendering', () => {
    it('should render empty state when no contract is provided', () => {
      render(
        <ContractDetail
          contract={null}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
    });

    it('should render contract details when contract is provided', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.getByText('Test Contract')).toBeInTheDocument();
      expect(screen.getByText('label.description')).toBeInTheDocument();
      expect(
        screen.getAllByText('RichTextEditorPreviewerV1').length
      ).toBeGreaterThan(0);
    });

    it('should display contract actions', () => {
      const { getByTestId } = render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(getByTestId('manage-contract-actions')).toBeInTheDocument();
    });

    it('should not render description and terms when content is empty', () => {
      (isDescriptionContentEmpty as jest.Mock).mockReturnValue(true);

      render(
        <ContractDetail
          contract={{ ...mockContract, description: '', termsOfUse: '' }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByText('label.description')).not.toBeInTheDocument();
    });

    it('should not display contract created by or created at if data is not present', () => {
      const { getByTestId, queryByTestId } = render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(
        queryByTestId('contract-created-by-label')
      ).not.toBeInTheDocument();

      expect(
        queryByTestId('contract-created-at-label')
      ).not.toBeInTheDocument();

      expect(getByTestId('manage-contract-actions')).toBeInTheDocument();
    });

    it('should display contract created by or created at if data is present', () => {
      const { getByTestId, queryByTestId } = render(
        <ContractDetail
          contract={{
            ...mockContract,
            createdBy: 'admin',
            createdAt: 1758556706799,
          }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(queryByTestId('contract-created-by-label')).toBeInTheDocument();

      expect(queryByTestId('contract-created-at-label')).toBeInTheDocument();

      expect(getByTestId('manage-contract-actions')).toBeInTheDocument();
    });
  });

  describe('Contract Actions', () => {
    it('should call onEdit when edit button is clicked', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));

      const editButton = screen.getByTestId('contract-edit-button');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should call onDelete when delete button is clicked', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const deleteButton = screen.getByTestId('delete-contract-button');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('should disable delete button for inherited contracts', () => {
      const inheritedContract: DataContract = {
        ...mockContract,
        inherited: true,
      };

      render(
        <ContractDetail
          contract={inheritedContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const deleteButton = screen.getByTestId('delete-contract-button');

      // The delete menu item should have disabled class
      expect(deleteButton).toHaveClass('disabled');

      // Clicking should not call onDelete since the menu item is disabled
      mockOnDelete.mockClear();
      fireEvent.click(deleteButton);

      // Note: The actual click prevention is handled by antd's Menu disabled prop,
      // but we verify the disabled class is applied
      expect(deleteButton.closest('[class*="disabled"]')).toBeTruthy();
    });

    it('should not disable delete button for non-inherited contracts', () => {
      const nonInheritedContract: DataContract = {
        ...mockContract,
        inherited: false,
      };

      render(
        <ContractDetail
          contract={nonInheritedContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const deleteButton = screen.getByTestId('delete-contract-button');

      // The delete menu item should NOT have disabled class
      expect(deleteButton).not.toHaveClass('disabled');
    });

    it('should validate contract when validate button is clicked', async () => {
      (validateContractById as jest.Mock).mockResolvedValue({});

      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const validateButton = screen.getByTestId('contract-run-now-button');

      await act(async () => {
        fireEvent.click(validateButton);
      });

      expect(validateContractById).toHaveBeenCalledWith('contract-1');
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.contract-validation-trigger-successfully'
      );
    });

    it('should handle validation errors', async () => {
      const mockError = new AxiosError('Validation failed');
      (validateContractById as jest.Mock).mockRejectedValue(mockError);

      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const validateButton = screen.getByTestId('contract-run-now-button');

      await act(async () => {
        fireEvent.click(validateButton);
      });

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });

    it('should not validate when contract id is missing', async () => {
      const contractWithoutId = { ...mockContract, id: '' } as DataContract;

      render(
        <ContractDetail
          contract={contractWithoutId}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const validateButton = screen.getByTestId('contract-run-now-button');

      await act(async () => {
        fireEvent.click(validateButton);
      });

      expect(validateContractById).not.toHaveBeenCalled();
    });

    it('should export contract as YAML when export action is clicked', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const exportButton = screen.getByTestId('export-contract-button');

      await act(async () => {
        fireEvent.click(exportButton);
      });

      expect(downloadContractYamlFile).toHaveBeenCalledWith(mockContract);
    });

    it('should export contract to ODCS successfully', async () => {
      (exportContractToODCSYaml as jest.Mock).mockResolvedValue('yaml-content');

      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const exportOdcsButton = screen.getByTestId(
        'export-odcs-contract-button'
      );

      await act(async () => {
        fireEvent.click(exportOdcsButton);
      });

      await waitFor(() => {
        expect(exportContractToODCSYaml).toHaveBeenCalledWith('contract-1');
        expect(downloadContractAsODCSYaml).toHaveBeenCalledWith(
          'yaml-content',
          'Test Contract'
        );
        expect(showSuccessToast).toHaveBeenCalled();
      });
    });

    it('should show error toast when ODCS export fails', async () => {
      const error = new AxiosError('Export failed');
      (exportContractToODCSYaml as jest.Mock).mockRejectedValue(error);

      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      const exportOdcsButton = screen.getByTestId(
        'export-odcs-contract-button'
      );

      await act(async () => {
        fireEvent.click(exportOdcsButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to YAML view', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      const switchButton = screen.getByTestId('switch-to-yaml');

      await act(async () => {
        fireEvent.click(switchButton);
      });

      expect(await screen.findByTestId('contract-yaml')).toBeInTheDocument();
    });

    it('should render view switch tab', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(
        screen.getByTestId('contract-view-switch-tab')
      ).toBeInTheDocument();
    });
  });

  describe('Test Cases Display', () => {
    it('should display test cases when contract has quality expectations', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByText('ContractQualityCard')).toBeInTheDocument();
    });

    it('should not display test cases when contract has quality expectations', async () => {
      render(
        <ContractDetail
          contract={{ ...mockContract, testSuite: undefined }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByText('ContractQualityCard')).not.toBeInTheDocument();
    });
  });

  describe('Contract Execution Chart', () => {
    it('should display contract execution chart and compute constraint status', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(
        screen.getByTestId('contract-execution-chart')
      ).toBeInTheDocument();
      expect(screen.getByText('Chart for Test Contract')).toBeInTheDocument();

      await waitFor(() => {
        expect(getConstraintStatus).toHaveBeenCalledWith(mockContractResults);
      });
    });

    it('should not fetch results when latestResult is not present', async () => {
      render(
        <ContractDetail
          contract={{ ...mockContract, latestResult: undefined }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(getContractResultByResultId).not.toHaveBeenCalled();
    });
  });

  describe('Contract Metadata', () => {
    it('should display contract owners', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Owner component would be rendered
      expect(screen.getByText('Test Contract')).toBeInTheDocument();
    });

    it('should display contract schema information', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Schema information would be displayed in cards/tables
      expect(screen.getByText('Test Contract')).toBeInTheDocument();
    });

    it('should not render schema table card when schema is empty', () => {
      render(
        <ContractDetail
          contract={{ ...mockContract, schema: [] }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(
        screen.queryByTestId('contract-schema-table')
      ).not.toBeInTheDocument();
    });

    it('should display semantic rules', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Semantic rules would be displayed
      expect(screen.getByText('Test Contract')).toBeInTheDocument();
    });

    it('should not render semantics card when semantics are empty', () => {
      render(
        <ContractDetail
          contract={{ ...mockContract, semantics: [] }}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByTestId('semantics-card')).not.toBeInTheDocument();
    });
  });

  describe('Contract Security', () => {
    it('should display security section when contract has security data', () => {
      const contractWithSecurity: DataContract = {
        ...mockContract,
        security: {
          dataClassification: 'PII,Sensitive',
          policies: [
            {
              accessPolicy: 'Read Only',
              identities: ['user1@example.com'],
              rowFilters: [],
            },
          ],
        },
      };

      render(
        <ContractDetail
          contract={contractWithSecurity}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Check that the security card is rendered
      expect(screen.getByTestId('security-card')).toBeInTheDocument();
      expect(screen.getByTestId('contract-security-card')).toBeInTheDocument();

      // Check the content
      expect(
        screen.getByText('ContractSecurityCard - PII,Sensitive')
      ).toBeInTheDocument();
    });

    it('should not display security section when contract has no security data', () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByTestId('security-card')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('contract-security-card')
      ).not.toBeInTheDocument();
    });

    it('should render security card even with empty dataClassification and policies', () => {
      const contractWithEmptySecurity: DataContract = {
        ...mockContract,
        security: {
          dataClassification: '',
          policies: [],
        },
      };

      render(
        <ContractDetail
          contract={contractWithEmptySecurity}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // isEmpty returns false for objects with properties, even if values are empty
      // So the security section will be displayed
      expect(screen.getByTestId('security-card')).toBeInTheDocument();
      expect(screen.getByTestId('contract-security-card')).toBeInTheDocument();
      expect(screen.getByText('ContractSecurityCard -')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined contract gracefully', () => {
      render(
        <ContractDetail
          contract={undefined}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state for various operations', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="test-entity-id"
          entityType="table"
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Various loading states would be tested here
      expect(
        screen.getByTestId('contract-execution-chart')
      ).toBeInTheDocument();
    });
  });

  describe('ODCS Import', () => {
    const mockOnContractUpdated = jest.fn();

    it('should show import ODCS option in dropdown menu', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));

      expect(
        screen.getByTestId('import-odcs-contract-button')
      ).toBeInTheDocument();
    });

    it('should show import OpenMetadata option in dropdown menu', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));

      expect(
        screen.getByTestId('import-openmetadata-contract-button')
      ).toBeInTheDocument();
    });

    it('should open import modal with ODCS format from contract actions', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      fireEvent.click(screen.getByTestId('import-odcs-contract-button'));

      expect(screen.getByTestId('import-modal-format')).toHaveTextContent(
        'odcs'
      );
      expect(screen.getByTestId('import-modal-visible')).toHaveTextContent(
        'true'
      );
    });

    it('should open import modal with OpenMetadata format from contract actions', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      fireEvent.click(
        screen.getByTestId('import-openmetadata-contract-button')
      );

      expect(screen.getByTestId('import-modal-format')).toHaveTextContent(
        'openmetadata'
      );
      expect(screen.getByTestId('import-modal-visible')).toHaveTextContent(
        'true'
      );
    });

    it('should call onContractUpdated on successful import', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      fireEvent.click(screen.getByTestId('import-odcs-contract-button'));

      fireEvent.click(screen.getByTestId('mock-import-success'));

      expect(mockOnContractUpdated).toHaveBeenCalled();
      expect(screen.getByTestId('import-modal-visible')).toHaveTextContent(
        'false'
      );
    });

    it('should handle add contract menu actions in empty state', async () => {
      render(
        <ContractDetail
          contract={null}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('add-contract-button'));

      fireEvent.click(screen.getByTestId('create-contract-button'));

      expect(mockOnEdit).toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('add-contract-button'));
      fireEvent.click(screen.getByTestId('import-odcs-contract-button'));

      expect(screen.getByTestId('import-modal-format')).toHaveTextContent(
        'odcs'
      );

      fireEvent.click(screen.getByTestId('add-contract-button'));
      fireEvent.click(
        screen.getByTestId('import-openmetadata-contract-button')
      );

      expect(screen.getByTestId('import-modal-format')).toHaveTextContent(
        'openmetadata'
      );
    });

    it('should show alert bar when latest result has failed status', async () => {
      (getContractResultByResultId as jest.Mock).mockResolvedValue({
        ...mockContractResults,
        result: 'Failure message',
        contractExecutionStatus: ContractExecutionStatus.Failed,
      });

      render(
        <ContractDetail
          contract={{
            ...mockContract,
            latestResult: {
              ...mockContract.latestResult!,
              status: ContractExecutionStatus.Failed,
            },
          }}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(await screen.findByTestId('alert-bar')).toHaveTextContent(
        'Failure message'
      );
    });

    it('should show alert bar when latest result has aborted status', async () => {
      (getContractResultByResultId as jest.Mock).mockResolvedValue({
        ...mockContractResults,
        result: 'Aborted message',
        contractExecutionStatus: ContractExecutionStatus.Aborted,
      });

      render(
        <ContractDetail
          contract={{
            ...mockContract,
            latestResult: {
              ...mockContract.latestResult!,
              status: ContractExecutionStatus.Aborted,
            },
          }}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(await screen.findByTestId('alert-bar')).toHaveTextContent(
        'Aborted message'
      );
    });

    it('should handle error when fetching latest contract results fails', async () => {
      const mockError = new AxiosError('Fetch failed');
      (getContractResultByResultId as jest.Mock).mockRejectedValue(mockError);

      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should handle mouse hover states on add contract menu items', async () => {
      render(
        <ContractDetail
          contract={null}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('add-contract-button'));

      const createButton = screen.getByTestId('create-contract-button');
      const importODCSButton = screen.getByTestId(
        'import-odcs-contract-button'
      );

      await act(async () => {
        fireEvent.mouseEnter(createButton);
      });

      await act(async () => {
        fireEvent.mouseLeave(createButton);
      });

      await act(async () => {
        fireEvent.mouseEnter(importODCSButton);
      });

      await act(async () => {
        fireEvent.mouseLeave(importODCSButton);
      });

      expect(createButton).toBeInTheDocument();
    });

    it('should close import modal when close is clicked', async () => {
      render(
        <ContractDetail
          contract={mockContract}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      fireEvent.click(screen.getByTestId('import-odcs-contract-button'));

      expect(screen.getByTestId('import-modal-visible')).toHaveTextContent(
        'true'
      );

      fireEvent.click(screen.getByTestId('mock-import-close'));

      expect(screen.getByTestId('import-modal-visible')).toHaveTextContent(
        'false'
      );
    });

    it('should not export ODCS contract when contract id is missing', async () => {
      const contractWithoutId = {
        ...mockContract,
        id: undefined,
      } as unknown as DataContract;

      render(
        <ContractDetail
          contract={contractWithoutId}
          entityId="table-1"
          entityType="table"
          onContractUpdated={mockOnContractUpdated}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      fireEvent.click(screen.getByTestId('manage-contract-actions'));
      fireEvent.click(screen.getByTestId('export-odcs-contract-button'));

      await waitFor(() => {
        expect(exportContractToODCSYaml).not.toHaveBeenCalled();
      });
    });
  });
});
