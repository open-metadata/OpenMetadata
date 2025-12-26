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
import { DataContract } from '../../../generated/entity/data/dataContract';
import { EntityReference } from '../../../generated/entity/type';
import { ContractDetailFormTab } from './ContractDetailFormTab';

jest.mock('../../../utils/formUtils', () => ({
  generateFormFields: jest.fn((fields) =>
    fields.map((field: any) => (
      <div data-testid={field.props?.['data-testid']} key={field.name}>
        <label>{field.label}</label>
        <input data-testid={field.props?.['data-testid']} name={field.name} />
      </div>
    ))
  ),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.contract-title': 'Contract Title',
        'label.owner-plural': 'Owners',
        'label.description': 'Description',
        'label.contract-detail-plural': 'Contract Details',
        'message.contract-detail-plural-description': 'Enter contract details',
        'label.next': 'Next',
      };

      return translations[key] || key;
    },
  }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

const mockOnNext = jest.fn();
const mockOnChange = jest.fn();

const mockInitialValues: Partial<DataContract> = {
  name: 'Test Contract',
  description: 'Test Description',
  owners: [
    { id: 'user-1', name: 'Test User', type: 'user' },
  ] as EntityReference[],
};

const commonProps = {
  onChange: mockOnChange,
  onNext: mockOnNext,
  buttonProps: {
    nextLabel: 'Custom Next',
    prevLabel: 'Custom Previous',
    isNextVisible: true,
  },
};

describe('ContractDetailFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      expect(screen.getByText('Enter contract details')).toBeInTheDocument();
      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Owners')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should render with custom nextLabel', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      expect(screen.getByText('Custom Next')).toBeInTheDocument();
    });

    it('should render with initial values', () => {
      render(
        <ContractDetailFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should display all required form fields', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      expect(screen.getByText('Contract Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Owners')).toBeInTheDocument();
    });

    it('should set form values when initial values are provided', () => {
      const { container } = render(
        <ContractDetailFormTab
          initialValues={mockInitialValues}
          {...commonProps}
        />
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should handle form submission', async () => {
      render(<ContractDetailFormTab {...commonProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });

      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should display the correct navigation buttons', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should call onNext when next button is clicked', async () => {
      render(<ContractDetailFormTab {...commonProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });

      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalled();
    });

    it('should display custom next label when provided', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      expect(
        screen.getByText(commonProps.buttonProps.nextLabel)
      ).toBeInTheDocument();
    });
  });

  describe('Form Layout', () => {
    it('should have correct CSS classes', () => {
      const { container } = render(<ContractDetailFormTab {...commonProps} />);

      expect(container.querySelector('.new-form-style')).toBeInTheDocument();
      expect(
        container.querySelector('.contract-detail-form')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.contract-form-content-container')
      ).toBeInTheDocument();
    });

    it('should have vertical form layout', () => {
      const { container } = render(<ContractDetailFormTab {...commonProps} />);

      const form = container.querySelector('.ant-form-vertical');

      expect(form).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined initial values', () => {
      expect(() => {
        render(
          <ContractDetailFormTab initialValues={undefined} {...commonProps} />
        );
      }).not.toThrow();
    });

    it('should handle empty initial values', () => {
      expect(() => {
        render(<ContractDetailFormTab initialValues={{}} {...commonProps} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<ContractDetailFormTab {...commonProps} />);

      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveAttribute('type', 'submit');
    });

    it('should have proper form structure', () => {
      const { container } = render(<ContractDetailFormTab {...commonProps} />);

      const form = container.querySelector('form');

      expect(form).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should integrate with form utilities correctly', () => {
      const generateFormFields = jest.requireMock(
        '../../../utils/formUtils'
      ).generateFormFields;

      render(<ContractDetailFormTab {...commonProps} />);

      expect(generateFormFields).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            label: 'Contract Title',
            required: true,
          }),
          expect.objectContaining({
            name: 'owners',
            label: 'Owners',
          }),
          expect.objectContaining({
            name: 'description',
            label: 'Description',
          }),
        ])
      );
    });
  });
});
