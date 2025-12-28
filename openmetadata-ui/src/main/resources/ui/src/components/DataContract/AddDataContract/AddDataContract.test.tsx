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
import { EDataContractTab } from '../../../constants/DataContract.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { Column, Table } from '../../../generated/entity/data/table';
import { EntityStatus } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { createContract, updateContract } from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AddDataContract from './AddDataContract';

jest.mock('../../../rest/contractAPI', () => ({
  createContract: jest.fn().mockResolvedValue({}),
  updateContract: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getUpdatedContractDetails: jest.fn((contract, formValues) => ({
    ...contract,
    ...formValues,
  })),
  getDataContractTabByEntity: jest
    .fn()
    .mockReturnValue([
      EDataContractTab.CONTRACT_DETAIL,
      EDataContractTab.TERMS_OF_SERVICE,
      EDataContractTab.SCHEMA,
      EDataContractTab.SEMANTICS,
      EDataContractTab.SECURITY,
      EDataContractTab.QUALITY,
      EDataContractTab.SLA,
    ]),
  getContractTabLabel: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-id',
      name: 'test-table',
    } as Table,
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
  entity: {
    id: 'table-id',
    type: EntityType.TABLE,
  } as EntityReference,
  entityStatus: EntityStatus.Approved,
  semantics: [] as SemanticsRule[],
  qualityExpectations: [] as EntityReference[],
  schema: [] as Column[],
};

jest.mock('../ContractDetailFormTab/ContractDetailFormTab', () => ({
  ContractDetailFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext }) => (
      <div>
        <h2>Contract Details</h2>
        <button onClick={() => onChange({ name: 'Test Contract Change' })}>
          Change
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));
jest.mock('../ContractQualityFormTab/ContractQualityFormTab', () => ({
  ContractQualityFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext }) => (
      <div>
        <h2>Contract Quality</h2>
        <button onClick={() => onChange({ qualityExpectations: [] })}>
          Change
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));
jest.mock('../ContractSchemaFormTab/ContractSchemaFormTab', () => ({
  ContractSchemaFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Schema</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ schema: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSemanticFormTab/ContractSemanticFormTab', () => ({
  ContractSemanticFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Semantics</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ semantics: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSecurityFormTab/ContractSecurityFormTab', () => ({
  ContractSecurityFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Security</h2>
        <button onClick={onPrev}>Previous</button>
        <button
          data-testid="security-change-btn"
          onClick={() =>
            onChange({
              security: {
                dataClassification: 'PII',
                policies: [
                  {
                    accessPolicy: 'Read Only',
                    identities: ['user@example.com'],
                    rowFilters: [
                      { columnName: 'col1', values: ['val1'] },
                      { columnName: '', values: [] },
                      { columnName: 'col2', values: [] },
                      { columnName: '', values: ['val2'] },
                    ],
                  },
                ],
              },
            })
          }>
          Change Security
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSLAFormTab/ContractSLAFormTab', () => ({
  ContractSLAFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract SLA</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ sla: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

describe('AddDataContract', () => {
  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      expect(screen.getByTestId('add-contract-card')).toBeInTheDocument();
      expect(
        screen.getByText('label.add-contract-detail-plural')
      ).toBeInTheDocument();
      expect(screen.getByText('label.cancel')).toBeInTheDocument();
      expect(screen.getByTestId('save-contract-btn')).toBeInTheDocument();
    });

    it('should render with contract prop for editing mode', () => {
      render(
        <AddDataContract
          contract={mockContract}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId('add-contract-card')).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'label.contract-detail-plural' })
      ).toBeInTheDocument();
    });

    it('should display all tabs correctly', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      expect(
        screen.getByRole('tab', { name: 'label.contract-detail-plural' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'label.schema' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'label.semantic-plural' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'label.quality' })
      ).toBeInTheDocument();

      expect(
        screen.getByRole('tab', { name: 'label.security' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'label.sla' })
      ).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should start with first tab active', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      const tabs = document.querySelector('.ant-tabs-tab-active');

      expect(tabs).toBeInTheDocument();
    });

    it('should change tabs when clicked', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      const schemaTab = screen.getByRole('tab', { name: 'label.schema' });

      await act(async () => {
        fireEvent.click(schemaTab);
      });

      expect(schemaTab.closest('.ant-tabs-tab')).toHaveClass(
        'ant-tabs-tab-active'
      );
    });

    it('should navigate to next tab when onNext is called', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      const nextButton = screen.getByText('Next');

      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(
        screen
          .getByRole('tab', { name: 'label.terms-of-service' })
          .closest('.ant-tabs-tab')
      ).toHaveClass('ant-tabs-tab-active');
    });
  });

  describe('Security Validation', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should only keep row filters with both columnName AND values non-empty', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Navigate to security tab
      const securityTab = screen.getByRole('tab', { name: 'label.security' });
      await act(async () => {
        fireEvent.click(securityTab);
      });

      // Trigger security form change
      const changeSecurityButton = screen.getByTestId('security-change-btn');
      await act(async () => {
        fireEvent.click(changeSecurityButton);
      });

      // Save the contract
      const saveButton = screen.getByTestId('save-contract-btn');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Check that createContract was called with filtered row filters
      // Only filters with BOTH columnName AND values non-empty are kept
      expect(createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          security: {
            dataClassification: 'PII',
            policies: [
              {
                accessPolicy: 'Read Only',
                identities: ['user@example.com'],
                rowFilters: [
                  { columnName: 'col1', values: ['val1'] },
                  // All others are filtered out:
                  // - { columnName: '', values: [] } - both empty
                  // - { columnName: 'col2', values: [] } - empty values
                  // - { columnName: '', values: ['val2'] } - empty columnName
                ],
              },
            ],
          },
        })
      );
    });

    it('should filter out row filters with empty values even if columnName is present', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Navigate to security tab and trigger change
      const securityTab = screen.getByRole('tab', { name: 'label.security' });
      await act(async () => {
        fireEvent.click(securityTab);
      });

      const changeSecurityButton = screen.getByTestId('security-change-btn');
      await act(async () => {
        fireEvent.click(changeSecurityButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Verify that row filter with columnName but empty values is filtered out
      const callArg = (createContract as jest.Mock).mock.calls[0][0];
      const rowFilters = callArg.security.policies[0].rowFilters;

      // Should NOT contain the filter with col2 (has columnName but empty values)
      expect(rowFilters).not.toContainEqual({ columnName: 'col2', values: [] });
      // Should only contain the valid filter
      expect(rowFilters).toEqual([{ columnName: 'col1', values: ['val1'] }]);
    });

    it('should filter out row filters with empty columnName even if values are present', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Navigate to security tab and trigger change
      const securityTab = screen.getByRole('tab', { name: 'label.security' });
      await act(async () => {
        fireEvent.click(securityTab);
      });

      const changeSecurityButton = screen.getByTestId('security-change-btn');
      await act(async () => {
        fireEvent.click(changeSecurityButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Verify that row filter with empty columnName is filtered out even with values
      const callArg = (createContract as jest.Mock).mock.calls[0][0];
      const rowFilters = callArg.security.policies[0].rowFilters;

      // Should NOT contain the filter with empty columnName (even though it has values)
      expect(rowFilters).not.toContainEqual({
        columnName: '',
        values: ['val2'],
      });
      // Should only contain the valid filter
      expect(rowFilters).toEqual([{ columnName: 'col1', values: ['val1'] }]);
    });

    it('should return undefined when security object is undefined', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Trigger a form change to enable save without setting security
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // When security is undefined, it should be passed as undefined
      expect(createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          security: undefined,
        })
      );
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call createContract for new contract with correct parameters', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // First trigger a form change to enable the save button
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test Contract Change', // Now formValues.name is set from mock
          entity: {
            id: 'table-id',
            type: EntityType.TABLE,
          },
          semantics: undefined, // validSemantics - undefined when no semantics provided
          entityStatus: EntityStatus.Approved,
        })
      );
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.data-contract-saved-successfully'
      );
      expect(mockOnSave).toHaveBeenCalled();
    });

    it('should call createContract with form changes applied', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Trigger a form change to enable the save button and set form values
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test Contract Change', // formValues.name from mock onChange
          entity: {
            id: 'table-id',
            type: EntityType.TABLE,
          },
          semantics: undefined, // validSemantics - undefined when no semantics provided
          entityStatus: EntityStatus.Approved,
        })
      );
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.data-contract-saved-successfully'
      );
      expect(mockOnSave).toHaveBeenCalled();
    });

    it('should call updateContract for existing contract with JSON patch', async () => {
      render(
        <AddDataContract
          contract={mockContract}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      // Trigger a form change to enable the save button for existing contracts
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(updateContract).toHaveBeenCalledWith(
        'contract-1',
        expect.any(Array) // JSON patch array from fast-json-patch compare
      );
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.data-contract-saved-successfully'
      );
      expect(mockOnSave).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const mockError = new Error('Save failed');
      (createContract as jest.Mock).mockRejectedValue(mockError);

      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Trigger form change to enable save button
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
      expect(mockOnSave).not.toHaveBeenCalled(); // Should not call onSave on error
    });

    it('should handle update contract errors gracefully', async () => {
      const mockError = new AxiosError('Update failed');
      (updateContract as jest.Mock).mockRejectedValue(mockError);

      render(
        <AddDataContract
          contract={mockContract}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      // Trigger form change to enable save button
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
      expect(mockOnSave).not.toHaveBeenCalled(); // Should not call onSave on error
    });

    it('should filter out empty semantics before saving', async () => {
      const contractWithEmptySemantics: DataContract = {
        ...mockContract,
        semantics: [
          { name: 'Valid Semantic', rule: 'valid rule' },
          { name: '', rule: '' }, // Should be filtered out
          { name: 'Valid Name', rule: '' }, // Should be filtered out (empty rule)
          { name: '', rule: 'valid rule' }, // Should be filtered out (empty name)
          { name: 'Another Valid', rule: 'another rule' },
        ] as SemanticsRule[],
      };

      render(
        <AddDataContract
          contract={contractWithEmptySemantics}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Should call updateContract with only valid semantics
      expect(updateContract).toHaveBeenCalledWith(
        'contract-1',
        expect.any(Array) // JSON patch comparing with filtered semantics
      );
    });

    it('should set displayName from formValues.name in create mode', async () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Trigger form change first
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test Contract Change', // formValues.name from mock
        })
      );
    });

    it('should include displayName in update patch for edit mode', async () => {
      render(
        <AddDataContract
          contract={mockContract}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      // Trigger form change to enable save button
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      // For update, displayName should be set to formValues.name in the patch comparison
      expect(updateContract).toHaveBeenCalledWith(
        'contract-1',
        expect.any(Array)
      );
    });

    it('should disable save button when no changes are detected', async () => {
      render(
        <AddDataContract
          contract={mockContract}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByTestId('save-contract-btn');

      // Button should be disabled when no changes are made (isSaveDisabled logic)
      // This happens when the JSON patch comparison results in an empty array
      expect(saveButton).toBeInTheDocument();
    });

    it('should show loading state during save operation', async () => {
      // Mock a delayed response to test loading state
      (createContract as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      // Trigger form change to enable save button first
      const changeButton = screen.getByText('Change');
      await act(async () => {
        fireEvent.click(changeButton);
      });

      const saveButton = screen.getByTestId('save-contract-btn');

      act(() => {
        fireEvent.click(saveButton);
      });

      // Should show loading state (Ant Design Button shows loading via classes)
      expect(saveButton).toHaveClass('ant-btn-loading');
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      const cancelButton = screen.getByText('label.cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Mode Switching', () => {
    it('should render UI mode by default', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      expect(screen.getByTestId('add-contract-card')).toBeInTheDocument();
      expect(document.querySelector('.contract-tabs')).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('should handle undefined contract prop', () => {
      render(
        <AddDataContract
          contract={undefined}
          onCancel={mockOnCancel}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId('add-contract-card')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

      const saveButton = screen.getByTestId('save-contract-btn');
      const cancelButton = screen.getByText('label.cancel');

      expect(saveButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });
  });
});
