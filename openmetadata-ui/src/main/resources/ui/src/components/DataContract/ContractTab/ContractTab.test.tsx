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
// DataContractTabMode imported but used in component implementation
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { EntityReference } from '../../../generated/entity/type';
import {
  deleteContractById,
  getContractByEntityId,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ContractTab } from './ContractTab';

jest.mock('../../../rest/contractAPI', () => ({
  getContractByEntityId: jest.fn(),
  deleteContractById: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-1',
      name: 'test-table',
    },
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

jest.mock('../../common/Loader/Loader', () => {
  return function MockLoader() {
    return <div data-testid="loader">Loading...</div>;
  };
});

jest.mock('../../common/DeleteWidget/DeleteWidgetModal', () => {
  return function MockDeleteWidgetModal({
    visible,
    onCancel,
    onDelete,
    entityName,
    entityType,
  }: any) {
    if (!visible) {
      return null;
    }

    return (
      <div data-testid="delete-modal">
        <div>
          Delete {entityType}: {entityName}
        </div>
        <button data-testid="cancel-delete" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="confirm-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    );
  };
});

jest.mock('../AddDataContract/AddDataContract', () => {
  return function MockAddDataContract({ onCancel, onSave, contract }: any) {
    return (
      <div data-testid="add-data-contract">
        <div>Contract: {contract?.name || 'New Contract'}</div>
        <button data-testid="cancel-contract" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="save-contract" onClick={onSave}>
          Save
        </button>
      </div>
    );
  };
});

jest.mock('../ContractDetailTab/ContractDetail', () => ({
  ContractDetail: ({ contract, onEdit, onDelete }: any) => (
    <div data-testid="contract-detail">
      <div>Contract: {contract?.name || 'No Contract'}</div>
      <button data-testid="edit-contract" onClick={onEdit}>
        Edit
      </button>
      <button data-testid="delete-contract" onClick={onDelete}>
        Delete
      </button>
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'server.entity-deleted-successfully': `${options?.entity} deleted successfully`,
        'label.contract': 'Contract',
      };

      return translations[key] || key;
    },
  }),
}));

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
  owners: [] as EntityReference[],
  entity: { id: 'table-1', type: EntityType.TABLE } as EntityReference,
};

describe('ContractTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getContractByEntityId as jest.Mock).mockResolvedValue(mockContract);
  });

  describe('Basic Rendering', () => {
    it('should render loading state initially', async () => {
      (getContractByEntityId as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractTab />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render contract detail after loading', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      expect(screen.getByText('Contract: Test Contract')).toBeInTheDocument();
    });

    it('should render no contract state when contract not found', async () => {
      (getContractByEntityId as jest.Mock).mockRejectedValue(
        new Error('Not found')
      );

      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      expect(screen.getByText('Contract: No Contract')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch contract on component mount', async () => {
      render(<ContractTab />);

      expect(getContractByEntityId).toHaveBeenCalledWith(
        'table-1',
        EntityType.TABLE,
        ['owners']
      );

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      (getContractByEntityId as jest.Mock).mockRejectedValue(mockError);

      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      // Should render empty state without crashing
      expect(screen.getByText('Contract: No Contract')).toBeInTheDocument();
    });
  });

  describe('Tab Mode Management', () => {
    it('should switch to add mode when edit is clicked', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-contract');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('add-data-contract')).toBeInTheDocument();
    });

    it('should switch back to view mode when add contract is cancelled', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-contract');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('add-data-contract')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('cancel-contract');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
    });

    it('should refetch contract and switch to view mode after save', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-contract');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByTestId('save-contract');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(getContractByEntityId).toHaveBeenCalledTimes(2); // Initial + refetch
      expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
    });
  });

  describe('Contract Deletion', () => {
    it('should show delete modal when delete is clicked', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-contract');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      expect(
        screen.getByText('Delete dataContract: Test Contract')
      ).toBeInTheDocument();
    });

    it('should cancel delete operation', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-contract');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      const cancelButton = screen.getByTestId('cancel-delete');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });

    it('should delete contract successfully', async () => {
      (deleteContractById as jest.Mock).mockResolvedValue({});

      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-contract');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByTestId('confirm-delete');

      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(deleteContractById).toHaveBeenCalledWith('contract-1');
      expect(showSuccessToast).toHaveBeenCalledWith(
        'Contract deleted successfully'
      );
      expect(getContractByEntityId).toHaveBeenCalledTimes(2); // Initial + refetch
    });

    it('should handle delete errors', async () => {
      const mockError = new AxiosError('Delete failed');
      (deleteContractById as jest.Mock).mockRejectedValue(mockError);

      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-contract');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByTestId('confirm-delete');

      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });

    it('should not show delete modal when contract has no ID', async () => {
      const contractWithoutId = { ...mockContract, id: undefined };
      (getContractByEntityId as jest.Mock).mockResolvedValue(contractWithoutId);

      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-contract');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
    });
  });

  describe('Context Dependency', () => {
    it('should use entity ID from context', async () => {
      render(<ContractTab />);

      expect(getContractByEntityId).toHaveBeenCalledWith(
        'table-1',
        EntityType.TABLE,
        ['owners']
      );
    });

    it('should refetch contract when entity ID changes', async () => {
      const mockUseGenericContext = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      ).useGenericContext;

      const { rerender } = render(<ContractTab />);

      mockUseGenericContext.mockReturnValue({
        data: { id: 'table-2', name: 'different-table' },
      });

      rerender(<ContractTab />);

      expect(getContractByEntityId).toHaveBeenCalledWith(
        'table-2',
        EntityType.TABLE,
        ['owners']
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entity context', () => {
      const mockUseGenericContext = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      ).useGenericContext;
      mockUseGenericContext.mockReturnValue({ data: undefined });

      expect(() => {
        render(<ContractTab />);
      }).not.toThrow();
    });
  });

  describe('Loading States', () => {
    it('should show loading during initial data fetch', () => {
      (getContractByEntityId as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractTab />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should hide loading after data is fetched', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should pass contract data to ContractDetail component', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByText('Contract: Test Contract')).toBeInTheDocument();
      });
    });

    it('should pass contract data to AddDataContract component in edit mode', async () => {
      render(<ContractTab />);

      await waitFor(() => {
        expect(screen.getByTestId('contract-detail')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-contract');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByText('Contract: Test Contract')).toBeInTheDocument();
    });
  });
});
