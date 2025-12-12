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

import { Actions, JsonTree } from '@react-awesome-query-builder/antd';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { ContractSemanticFormTab } from './ContractSemanticFormTab';

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getSematicRuleFields: jest.fn(() => ({
    testField: {
      label: 'Test Field',
      type: 'text',
    },
  })),
}));

jest.mock('../../common/QueryBuilderWidgetV1/QueryBuilderWidgetV1', () => {
  return function MockQueryBuilderWidgetV1({
    onChange,
    getQueryActions,
    value,
    readonly,
  }: any) {
    return (
      <div data-testid="query-builder-widget">
        <span>Query Builder Widget</span>
        <span>Value: {value}</span>
        <span>Readonly: {readonly ? 'true' : 'false'}</span>
        <button
          data-testid="mock-query-change"
          onClick={() => {
            onChange?.('{"and":[{"==":[{"var":"name"},"10"]}]}', {
              type: 'group',
            } as JsonTree);
            getQueryActions?.({ addRule: jest.fn() } as unknown as Actions);
          }}>
          Change Query
        </button>
      </div>
    );
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'label.semantic-plural': 'Semantics',
        'message.semantics-description': 'Configure semantic rules',
        'label.add-entity': `Add ${options?.entity}`,
        'label.name': 'Name',
        'label.description': 'Description',
        'label.rule': 'Rule',
        'label.untitled': 'Untitled',
        'label.no-description': 'No description',
        'label.cancel': 'Cancel',
        'label.save': 'Save',
        'label.previous': 'Previous',
        'label.next': 'Next',
        'label.add-new-entity': `Add New ${options?.entity}`,
        'message.field-text-is-required': `${options?.fieldText} is required`,
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
  onPrev: mockOnPrev,
  onNext: mockOnNext,
  buttonProps: {
    nextLabel: 'Custom Next',
    prevLabel: 'Custom Previous',
    isNextVisible: true,
  },
};

const mockInitialValues: Partial<DataContract> = {
  semantics: [
    {
      name: 'Test Semantic',
      description: 'Test Description',
      rule: 'test rule',
      enabled: true,
      jsonTree: '{"type": "group"}',
    },
  ] as any,
};

describe('ContractSemanticFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      expect(screen.getByText('Semantics')).toBeInTheDocument();
      expect(screen.getByText('Configure semantic rules')).toBeInTheDocument();
      expect(screen.getByTestId('add-semantic-button')).toBeInTheDocument();
    });

    it('should render with initial values', () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      expect(screen.getByDisplayValue('Test Semantic')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    });

    it('should render with custom labels', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      expect(screen.getByText('Custom Next')).toBeInTheDocument();
      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });
  });

  describe('Semantic Rule Management', () => {
    it('should add new semantic rule when add button is clicked', async () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-semantic-button');

      await act(async () => {
        fireEvent.click(addButton);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('should delete semantic rule when delete button is clicked', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const deleteButton = screen.getByTestId('delete-semantic-0');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith({ semantics: [] });
    });

    it('should enable editing when edit button is clicked', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByDisplayValue('Test Semantic')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Saving', () => {
    it('should validate required fields when saving', async () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-semantic-button');

      await act(async () => {
        fireEvent.click(addButton);
      });

      const saveButton = screen.getByTestId('save-semantic-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should save semantic rule with valid data', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const nameInput = screen.getByDisplayValue('Test Semantic');

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Updated Semantic' } });
      });

      const saveButton = screen.getByTestId('save-semantic-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.queryByDisplayValue('Updated Semantic')
        ).not.toBeInTheDocument();
      });
    });

    it('should cancel editing when cancel button is clicked', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const cancelButton = screen.getByText('Cancel');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(
        screen.queryByDisplayValue('Test Semantic')
      ).not.toBeInTheDocument();
    });
  });

  describe('Query Builder Integration', () => {
    it('should render QueryBuilderWidgetV1 in edit mode', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('query-builder-widget')).toBeInTheDocument();
      expect(screen.getByText('Readonly: false')).toBeInTheDocument();
    });

    it('should render QueryBuilderWidgetV1 in readonly mode', () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Readonly: true')).toBeInTheDocument();
    });

    it('should handle query builder changes', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      expect(
        screen.getByText('Value: {"and":[{"==":[{"var":"name"},"10"]}]}')
      ).toBeInTheDocument();
    });

    it('should enable add rule button when query actions are available', async () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const editButton = screen.getByTestId('edit-semantic-0');

      await act(async () => {
        fireEvent.click(editButton);
      });

      const changeButton = screen.getByTestId('mock-query-change');

      await act(async () => {
        fireEvent.click(changeButton);
      });

      const addRuleButton = screen.getByText('Add New Rule');

      expect(addRuleButton).not.toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should display navigation buttons', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
      expect(screen.getByText('Custom Next')).toBeInTheDocument();
    });

    it('should call onNext when next button is clicked', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      const nextButton = screen.getByText('Custom Next');
      fireEvent.click(nextButton);

      expect(mockOnNext).toHaveBeenCalled();
    });

    it('should call onPrev when previous button is clicked', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      const prevButton = screen.getByText('Custom Previous');
      fireEvent.click(prevButton);

      expect(mockOnPrev).toHaveBeenCalled();
    });
  });

  describe('Switch Component', () => {
    it('should display enabled/disabled switch for each semantic rule', () => {
      render(
        <ContractSemanticFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      const switchElement = document.querySelector('.ant-switch');

      expect(switchElement).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ContractSemanticFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-semantic-button');

      await act(async () => {
        fireEvent.click(addButton);
      });

      const saveButton = screen.getByTestId('save-semantic-button');

      await act(async () => {
        fireEvent.click(saveButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Validation failed:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty initial values', () => {
      expect(() => {
        render(
          <ContractSemanticFormTab
            initialValues={{ semantics: [] }}
            {...commonProps}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and attributes', () => {
      render(<ContractSemanticFormTab {...commonProps} />);

      const addButton = screen.getByTestId('add-semantic-button');

      expect(addButton).toHaveAttribute('type', 'button');

      const nextButton = screen.getByRole('button', { name: 'Custom Next' });

      expect(nextButton).toHaveAttribute('type', 'button');
    });
  });
});
