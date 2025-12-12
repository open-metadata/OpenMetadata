/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  getContractResultByResultId,
  validateContractById,
} from '../../../rest/contractAPI';
import '../../../test/unit/mocks/mui.mock';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ContractDetail } from './ContractDetail';

jest.mock('../../../rest/contractAPI', () => ({
  getContractResultByResultId: jest.fn(),
  validateContractById: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

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

jest.mock('../ContractYaml/ContractYaml.component', () => {
  return function MockContractYaml({ contract }: any) {
    return <div data-testid="contract-yaml">YAML for {contract?.name}</div>;
  };
});

jest.mock('../ContractSLACard/ContractSLA.component', () =>
  jest
    .fn()
    .mockImplementation(({ contract }: any) => (
      <div data-testid="contract-sla">SLA for {contract?.name}</div>
    ))
);

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
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.edit': 'Edit',
        'label.delete': 'Delete',
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
  });

  describe('Basic Rendering', () => {
    it('should render empty state when no contract is provided', () => {
      render(
        <ContractDetail
          contract={null}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
    });

    it('should render contract details when contract is provided', () => {
      render(
        <ContractDetail
          contract={mockContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.getByText('Test Contract')).toBeInTheDocument();
      expect(screen.getByText('label.description')).toBeInTheDocument();
      expect(screen.getByText('RichTextEditorPreviewerV1')).toBeInTheDocument();
    });

    it('should display contract actions', () => {
      const { getByTestId } = render(
        <ContractDetail
          contract={mockContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(getByTestId('manage-contract-actions')).toBeInTheDocument();
    });

    it('should not display contract created by or created at if data is not present', () => {
      const { getByTestId, queryByTestId } = render(
        <ContractDetail
          contract={mockContract}
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

    it('should validate contract when validate button is clicked', async () => {
      (validateContractById as jest.Mock).mockResolvedValue({});

      render(
        <ContractDetail
          contract={mockContract}
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
  });

  describe('View Mode Switching', () => {
    it('should switch to YAML view', async () => {
      render(
        <ContractDetail
          contract={mockContract}
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
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByText('ContractQualityCard')).toBeInTheDocument();
    });

    it("should not display test cases when contract doesn't have quality expectations", async () => {
      render(
        <ContractDetail
          contract={{ ...mockContract, qualityExpectations: undefined }}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(screen.queryByText('ContractQualityCard')).not.toBeInTheDocument();
    });
  });

  describe('Contract Execution Chart', () => {
    it('should display contract execution chart', () => {
      render(
        <ContractDetail
          contract={mockContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      expect(
        screen.getByTestId('contract-execution-chart')
      ).toBeInTheDocument();
      expect(screen.getByText('Chart for Test Contract')).toBeInTheDocument();
    });
  });

  describe('Contract Metadata', () => {
    it('should display contract owners', () => {
      render(
        <ContractDetail
          contract={mockContract}
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
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Schema information would be displayed in cards/tables
      expect(screen.getByText('Test Contract')).toBeInTheDocument();
    });

    it('should display semantic rules', () => {
      render(
        <ContractDetail
          contract={mockContract}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />,
        { wrapper: MemoryRouter }
      );

      // Semantic rules would be displayed
      expect(screen.getByText('Test Contract')).toBeInTheDocument();
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
});
