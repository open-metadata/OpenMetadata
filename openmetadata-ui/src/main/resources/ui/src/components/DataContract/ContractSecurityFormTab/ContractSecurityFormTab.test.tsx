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
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  Policy,
} from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { ContractSecurityFormTab } from './ContractSecurityFormTab';

// const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(() => ({ entityType: EntityType.TABLE })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ entityType: EntityType.TABLE })),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-1',
      fullyQualifiedName: 'service.database.schema.table',
      name: 'test-table',
      columns: [
        {
          name: 'column1',
          dataType: 'STRING',
          fullyQualifiedName: 'service.database.schema.table.column1',
        },
        {
          name: 'column2',
          dataType: 'INT',
          fullyQualifiedName: 'service.database.schema.table.column2',
        },
      ] as Column[],
    },
  })),
}));

jest.mock('../../common/ExpandableCard/ExpandableCard', () => {
  return function MockExpandableCard({
    children,
    cardProps,
    defaultExpanded,
  }: {
    children: React.ReactNode;
    cardProps: { title: React.ReactNode; className: string };
    defaultExpanded: boolean;
  }) {
    return (
      <div
        className={cardProps.className}
        data-expanded={defaultExpanded}
        data-testid="expandable-card">
        <div data-testid="card-title">{cardProps.title}</div>
        <div data-testid="card-content">{children}</div>
      </div>
    );
  };
});

jest.mock('../../common/IconButtons/EditIconButton', () => ({
  EditIconButton: ({
    onClick,
    'data-testid': dataTestId,
  }: {
    onClick: () => void;
    'data-testid': string;
  }) => (
    <button data-testid={dataTestId} onClick={onClick}>
      Edit
    </button>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'label.security': 'Security',
        'message.data-contract-security-description':
          'Define security policies',
        'label.data-classification': 'Data Classification',
        'label.please-enter-entity-name': `Please enter ${options?.entity}`,
        'label.policy-plural': 'Policies',
        'message.contract-security-consume-description':
          'Define access policies',
        'label.add-entity': `Add ${options?.entity}`,
        'label.policy': 'Policy',
        'label.untitled': 'Untitled',
        'label.access-policy': 'Access Policy',
        'label.identities': 'Identities',
        'label.please-enter-value': `Please enter ${options?.name}`,
        'label.row-filter-plural': 'Row Filters',
        'label.row-filter': 'Row Filter',
        'label.column-name': 'Column Name',
        'label.column': 'Column',
        'label.value-plural': 'Values',
        'label.column-plural': 'Columns',
        'label.cancel': 'Cancel',
        'label.save': 'Save',
        'label.previous': 'Previous',
        'label.next': 'Next',
      };

      return translations[key] || key;
    },
  }),
}));

const mockOnChange = jest.fn();
const mockOnNext = jest.fn();
const mockOnPrev = jest.fn();

const commonProps = {
  onChange: mockOnChange,
  onNext: mockOnNext,
  onPrev: mockOnPrev,
  buttonProps: {
    nextLabel: 'Custom Next',
    prevLabel: 'Custom Previous',
    isNextVisible: true,
  },
};

const mockInitialValues: Partial<DataContract> = {
  security: {
    dataClassification: 'Confidential',
    policies: [
      {
        accessPolicy: 'Test Policy 1',
        identities: ['user1', 'user2'],
        rowFilters: [
          {
            columnName: 'column1',
            values: ['value1', 'value2'],
          },
        ],
      },
      {
        accessPolicy: 'Test Policy 2',
        identities: ['user3'],
        rowFilters: [
          {
            columnName: 'column2',
            values: ['value3'],
          },
        ],
      },
    ] as Policy[],
  },
};

describe('ContractSecurityFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Define security policies')).toBeInTheDocument();
      expect(screen.getByText('Policies')).toBeInTheDocument();
    });

    it('should render data classification input', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByText('Data Classification')).toBeInTheDocument();
      expect(
        screen.getByTestId('data-classification-input')
      ).toBeInTheDocument();
    });

    it('should render with initial values', () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should render add policy button', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('add-policy-button')).toBeInTheDocument();
    });
  });

  describe('Navigation Buttons', () => {
    it('should render previous and next buttons', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
      expect(screen.getByText('Custom Next')).toBeInTheDocument();
    });

    it('should call onPrev when previous button is clicked', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const prevButton = screen.getByText('Custom Previous');
      fireEvent.click(prevButton);

      expect(mockOnPrev).toHaveBeenCalled();
    });

    it('should call onNext when next button is clicked', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const nextButton = screen.getByText('Custom Next');
      fireEvent.click(nextButton);

      expect(mockOnNext).toHaveBeenCalled();
    });

    it('should use default labels when not provided', () => {
      render(
        <ContractSecurityFormTab
          {...commonProps}
          buttonProps={{ isNextVisible: true }}
        />
      );

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  describe('Data Classification Field', () => {
    it('should render data classification input field', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const input = screen.getByTestId('data-classification-input');

      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute(
        'placeholder',
        'Please enter Data Classification'
      );
    });

    it('should call onChange when data classification is updated', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const input = screen.getByTestId('data-classification-input');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Public' } });
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          security: expect.objectContaining({
            dataClassification: 'Public',
          }),
        })
      );
    });
  });

  describe('Policy Management', () => {
    it('should render initial policy when no initial values provided', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('expandable-card')).toBeInTheDocument();
    });

    it('should render multiple policies from initial values', () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      const expandableCards = screen.getAllByTestId('expandable-card');

      expect(expandableCards).toHaveLength(2);
    });

    it('should add new policy when add button is clicked', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-policy-button');

      await act(async () => {
        fireEvent.click(addButton);
      });

      const expandableCards = screen.getAllByTestId('expandable-card');

      expect(expandableCards.length).toBeGreaterThan(0);
    });

    it('should disable add policy button when editing', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-policy-button');

      expect(addButton).toBeDisabled();
    });
  });

  describe('Policy Editing', () => {
    it('should render access policy input when editing', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('access-policy-input-0')).toBeInTheDocument();
    });

    it('should render identities input when editing', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('identities-input-0')).toBeInTheDocument();
    });

    it('should render save and cancel buttons when editing', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('save-policy-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-policy-button')).toBeInTheDocument();
    });

    it('should close editing mode when cancel is clicked', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const cancelButton = screen.getByTestId('cancel-policy-button');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(
        screen.queryByTestId('save-policy-button')
      ).not.toBeInTheDocument();
    });

    it('should close editing mode when save is clicked', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const saveButton = screen.getByTestId('save-policy-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(
        screen.queryByTestId('save-policy-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('Policy Deletion', () => {
    it('should render delete button for policies in collapsed view', async () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      await act(async () => {
        const cancelButton = screen.getByTestId('cancel-policy-button');
        fireEvent.click(cancelButton);
      });

      expect(screen.getByTestId('delete-policy-0')).toBeInTheDocument();
    });

    it('should delete policy when delete button is clicked', async () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      await act(async () => {
        const cancelButton = screen.getByTestId('cancel-policy-button');
        fireEvent.click(cancelButton);
      });

      const deleteButton = screen.getByTestId('delete-policy-0');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Row Filters for Supported Entities', () => {
    it('should render row filters section for table entity', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByText('Row Filters')).toBeInTheDocument();
    });

    it('should render add row filter button', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('add-row-filter-button-0')).toBeInTheDocument();
    });

    it('should render column name select field', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('columnName-input-0-0')).toBeInTheDocument();
    });

    it('should render values select field', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByTestId('values-0-0')).toBeInTheDocument();
    });

    it('should add new row filter when add button is clicked', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const addRowFilterButton = screen.getByTestId('add-row-filter-button-0');

      await act(async () => {
        fireEvent.click(addRowFilterButton);
      });

      expect(screen.getByTestId('columnName-input-0-1')).toBeInTheDocument();
    });
  });

  describe('Row Filters for Unsupported Entities', () => {
    it('should not render row filters section for unsupported entity types', () => {
      const mockUseRequiredParams = jest.requireMock(
        '../../../utils/useRequiredParams'
      ).useRequiredParams;
      mockUseRequiredParams.mockReturnValue({
        entityType: EntityType.DASHBOARD,
      });

      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.queryByText('Row Filters')).not.toBeInTheDocument();
    });
  });

  describe('Policy Title Display', () => {
    it('should display policy access policy as title when not editing', async () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      await act(async () => {
        const cancelButton = screen.getByTestId('cancel-policy-button');
        fireEvent.click(cancelButton);
      });

      expect(screen.getByText('Test Policy 1')).toBeInTheDocument();
    });

    it('should display "Untitled" when policy has no access policy', async () => {
      const emptyPolicyValues = {
        security: {
          policies: [
            {
              accessPolicy: '',
              identities: [],
              rowFilters: [],
            },
          ] as Policy[],
        },
      };

      render(
        <ContractSecurityFormTab
          initialValues={emptyPolicyValues}
          {...commonProps}
        />
      );

      await act(async () => {
        const cancelButton = screen.getByTestId('cancel-policy-button');
        fireEvent.click(cancelButton);
      });

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('Form Layout and Styling', () => {
    it('should have correct CSS classes', () => {
      const { container } = render(
        <ContractSecurityFormTab {...commonProps} />
      );

      expect(
        container.querySelector('.contract-security-form-container')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.contract-security-form')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.contract-form-content-container')
      ).toBeInTheDocument();
    });

    it('should have vertical form layout', () => {
      const { container } = render(
        <ContractSecurityFormTab {...commonProps} />
      );

      const form = container.querySelector('.ant-form-vertical');

      expect(form).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined initial values', () => {
      expect(() => {
        render(
          <ContractSecurityFormTab initialValues={undefined} {...commonProps} />
        );
      }).not.toThrow();
    });

    it('should handle empty initial values', () => {
      expect(() => {
        render(<ContractSecurityFormTab initialValues={{}} {...commonProps} />);
      }).not.toThrow();
    });

    it('should handle empty security object in initial values', () => {
      expect(() => {
        render(
          <ContractSecurityFormTab
            initialValues={{ security: {} }}
            {...commonProps}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const prevButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('should have proper form structure', () => {
      const { container } = render(
        <ContractSecurityFormTab {...commonProps} />
      );

      const form = container.querySelector('form');

      expect(form).toBeInTheDocument();
    });

    it('should have proper labels for form fields', () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      expect(screen.getByText('Data Classification')).toBeInTheDocument();
      expect(screen.getByText('Access Policy')).toBeInTheDocument();
      expect(screen.getByText('Identities')).toBeInTheDocument();
    });
  });

  describe('Form Value Changes', () => {
    it('should call onChange when form values change', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const input = screen.getByTestId('data-classification-input');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Restricted' } });
      });

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update policies when access policy changes', async () => {
      render(<ContractSecurityFormTab {...commonProps} />);

      const accessPolicyInput = screen.getByTestId('access-policy-input-0');

      await act(async () => {
        fireEvent.change(accessPolicyInput, {
          target: { value: 'New Policy' },
        });
      });

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Edit Mode Toggle', () => {
    it('should open edit mode when edit button is clicked', async () => {
      render(
        <ContractSecurityFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      await act(async () => {
        const cancelButton = screen.getByTestId('cancel-policy-button');
        fireEvent.click(cancelButton);
      });

      const editButton = screen.getByTestId('edit-policy-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('save-policy-button')).toBeInTheDocument();
    });
  });
});
