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

import { render, screen } from '@testing-library/react';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { MetadataFormSection } from './MetadataFormSection';

jest.mock('@openmetadata/ui-core-components', () => {
  const Input = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    'data-testid'?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      'data-testid': dataTestId,
      isRequired,
      isDisabled,
    } = props;

    return (
      <div data-testid={dataTestId}>
        {label && (
          <>
            <label>{label}</label>
            {isRequired && <span> *</span>}
          </>
        )}
        <input
          disabled={isDisabled}
          role="textbox"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  };

  const TextArea = (props: {
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    'data-testid'?: string;
    placeholder?: string;
    rows?: number;
    isDisabled?: boolean;
  }) => {
    const {
      value = '',
      onChange,
      label,
      'data-testid': dataTestId,
      placeholder,
      rows,
      isDisabled,
    } = props;

    return (
      <div data-testid={dataTestId}>
        {label && <label>{label}</label>}
        <textarea
          disabled={isDisabled}
          placeholder={placeholder}
          rows={rows}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  };

  return { Input, TextArea };
});

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    palette: {
      allShades: {
        gray: {
          300: '#d1d5db',
          700: '#374151',
          900: '#111827',
        },
      },
      error: {
        main: '#ef4444',
      },
    },
  }),
}));

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  WorkflowModeProvider: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="workflow-mode-provider">{children}</div>
    )),
  useWorkflowModeContext: jest.fn(() => ({
    mode: 'edit',
    isEditMode: true,
    isViewMode: false,
    toggleMode: jest.fn(),
    setMode: jest.fn(),
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key, // Return the key as-is for testing
  }),
}));

const mockProps = {
  name: 'Test Workflow',
  description: 'Test workflow description',
  isStartNode: true,
  onNameChange: jest.fn(),
  onDescriptionChange: jest.fn(),
};

const renderWithProvider = (props = mockProps) => {
  return render(
    <WorkflowModeProvider>
      <MetadataFormSection {...props} />
    </WorkflowModeProvider>
  );
};

describe('MetadataFormSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form fields with correct labels for start node', () => {
    renderWithProvider();

    expect(screen.getByText('label.workflow-name')).toBeInTheDocument();
    expect(screen.getByText('label.workflow-description')).toBeInTheDocument();
  });

  it('should render form fields with correct labels for non-start node', () => {
    renderWithProvider({
      ...mockProps,
      isStartNode: false,
    });

    expect(screen.getByText('label.display-name')).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('should display required asterisk for name field', () => {
    renderWithProvider();

    const nameLabel = screen.getByText('label.workflow-name').parentElement;

    expect(nameLabel).toHaveTextContent('*');
  });

  it('should display current values in input fields', () => {
    renderWithProvider();

    const nameInput = screen.getByDisplayValue('Test Workflow');
    const descriptionInput = screen.getByDisplayValue(
      'Test workflow description'
    );

    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('should render both form fields (name and description)', () => {
    renderWithProvider();

    expect(screen.getByTestId('workflow-name-input')).toBeInTheDocument();
    expect(
      screen.getByTestId('workflow-description-input')
    ).toBeInTheDocument();
  });

  it('should render in view mode', () => {
    renderWithProvider(mockProps);

    expect(screen.getByText('label.workflow-name')).toBeInTheDocument();
    expect(screen.getByText('label.workflow-description')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-name-input')).toBeInTheDocument();
    expect(
      screen.getByTestId('workflow-description-input')
    ).toBeInTheDocument();
  });

  it('should render with very long text values', () => {
    const longName = 'A'.repeat(1000);
    const longDescription = 'B'.repeat(2000);

    renderWithProvider({
      ...mockProps,
      name: longName,
      description: longDescription,
    });

    expect(screen.getByDisplayValue(longName)).toBeInTheDocument();
    expect(screen.getByDisplayValue(longDescription)).toBeInTheDocument();
  });
});
