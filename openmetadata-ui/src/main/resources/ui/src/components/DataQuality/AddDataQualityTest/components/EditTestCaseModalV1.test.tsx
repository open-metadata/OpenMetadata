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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act, forwardRef } from 'react';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import {
  MOCK_TEST_CASE,
  MOCK_TEST_CASE_WITH_BOOLEAN_PARAM,
  MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_BE_IN_SET,
  MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
} from '../../../../mocks/TestSuite.mock';
import { getTestDefinitionById } from '../../../../rest/testAPI';
import { EditTestCaseModalProps } from './EditTestCaseModal.interface';
import EditTestCaseModalV1 from './EditTestCaseModalV1';

const mockProps: EditTestCaseModalProps = {
  open: true,
  testCase: MOCK_TEST_CASE[0],
  onCancel: jest.fn(),
  onUpdate: jest.fn(),
};

jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => {
  return {
    createTestCaseParameters: jest.fn().mockImplementation(() => []),
  };
});

jest.mock('../../../common/RichTextEditor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(() => <div>RichTextEditor.component</div>)
  );
});

jest.mock('./ParameterForm', () => {
  const { Form } = require('antd');

  function ParameterFormMock({
    definition,
  }: Readonly<{
    definition?: {
      parameterDefinition?: Array<{ name: string; dataType: string }>;
    };
  }>) {
    let params: Record<string, unknown> = {};

    try {
      const form = Form.useFormInstance();
      params = form.getFieldValue('params') ?? {};
    } catch {
      // no form context
    }

    const booleanParams = (definition?.parameterDefinition ?? []).filter(
      (param) => param.dataType === 'BOOLEAN'
    );

    return (
      <div>
        ParameterForm.component
        {booleanParams.map((param) => (
          <button
            aria-checked={params[param.name] ? 'true' : 'false'}
            key={param.name}
            role="switch"
          />
        ))}
      </div>
    );
  }

  return jest.fn().mockImplementation(ParameterFormMock);
});

jest.mock('../../../../pages/TasksPage/shared/TagSuggestion', () =>
  jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid={props.selectProps?.['data-testid']}>
      TagSuggestion Component
      {children}
    </div>
  ))
);

// Mock ServiceDocPanel component
jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest
    .fn()
    .mockImplementation(({ activeField }) => (
      <div data-testid="service-doc-panel">
        ServiceDocPanel Component - Active Field: {activeField}
      </div>
    ))
);

// Mock AlertBar component
jest.mock('../../../AlertBar/AlertBar', () => ({
  __esModule: true,
  default: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

// Mock ToastUtils and getIconAndClassName function
jest.mock('../../../../utils/ToastUtils', () => ({
  getIconAndClassName: jest.fn().mockReturnValue({
    icon: null,
    className: 'error',
    type: 'error',
  }),
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../rest/tableAPI', () => {
  return {
    getTableDetailsByFQN: jest.fn().mockImplementation(() =>
      Promise.resolve({
        id: 'table-id',
        name: 'dim_address',
        columns: [{ name: 'last_name', dataType: 'VARCHAR' }],
      })
    ),
  };
});

jest.mock('../../../../rest/testAPI', () => {
  return {
    getTestDefinitionById: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX)
      ),
    updateTestCaseById: jest
      .fn()
      .mockImplementation(() => Promise.resolve(MOCK_TEST_CASE[0])),
  };
});

// Mock translations
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'label.edit' && params?.entity) {
        return `Edit ${params.entity}`;
      }

      return key;
    },
  })),
}));

describe('EditTestCaseModalV1 Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset getTestDefinitionById to default behavior
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX
    );
  });

  it('should render drawer with correct props', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    // Check if drawer is rendered
    expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
    expect(document.querySelector('.custom-drawer-style')).toBeInTheDocument();

    // Check drawer title
    await waitFor(() => {
      expect(screen.getByText('label.edit-entity')).toBeInTheDocument();
    });
  });

  it('should render all form fields correctly', async () => {
    act(() => {
      render(<EditTestCaseModalV1 {...mockProps} />);
    });

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Check table and column fields using text content
    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getByText('label.column')).toBeInTheDocument();

    // Check test case details
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.display-name')).toBeInTheDocument();
    expect(screen.getByText('label.test-entity')).toBeInTheDocument();

    // Check parameter form
    expect(
      await screen.findByText('ParameterForm.component')
    ).toBeInTheDocument();
  });

  it('should have disabled fields for non-editable elements', async () => {
    act(() => {
      render(<EditTestCaseModalV1 {...mockProps} />);
    });

    await waitFor(() => {
      const disabledInputs = document.querySelectorAll('input[disabled]');

      expect(disabledInputs.length).toBeGreaterThanOrEqual(3); // table, column, name, test-entity fields
    });
  });

  it('should have editable display name field', async () => {
    act(() => {
      render(<EditTestCaseModalV1 {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const displayNameField = document.querySelector(
      'input[id="root/displayName"]'
    );

    expect(displayNameField).toBeInTheDocument();
    expect(displayNameField).not.toBeDisabled();
  });

  it('should populate fields with test case data', async () => {
    act(() => {
      render(<EditTestCaseModalV1 {...mockProps} />);
    });

    await waitFor(() => {
      const tableField = document.querySelector(
        'input[id="root/selected-entity"]'
      );
      const nameField = document.querySelector('input[id="root/name"]');

      expect(tableField).toHaveValue('dim_address');
      expect(nameField).toHaveValue('column_values_to_match_regex');
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    const cancelBtn = await screen.findByText('label.cancel');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should call onUpdate when update button is clicked', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    // Wait for form to be fully loaded first
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const updateBtn = await screen.findByText('label.update');

    await act(async () => {
      fireEvent.click(updateBtn);
    });

    await waitFor(
      () => {
        expect(mockProps.onUpdate).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it('should handle column test case correctly', async () => {
    const columnTestCase = {
      ...MOCK_TEST_CASE[0],
      entityLink:
        'table::sample_data.ecommerce_db.shopify.dim_address::columns::last_name',
    };

    render(<EditTestCaseModalV1 {...mockProps} testCase={columnTestCase} />);

    // Should render column field for column test
    await waitFor(() => {
      expect(screen.getByText('label.column')).toBeInTheDocument();
      expect(
        document.querySelector('input[id="root/column"]')
      ).toBeInTheDocument();
    });
  });

  it('should handle table test case correctly', async () => {
    const tableTestCase = {
      ...MOCK_TEST_CASE[0],
      entityLink: 'table::sample_data.ecommerce_db.shopify.dim_address',
    };

    render(<EditTestCaseModalV1 {...mockProps} testCase={tableTestCase} />);

    await waitFor(() => {
      // Should not render column field for table test
      expect(screen.queryByText('label.column')).not.toBeInTheDocument();
      expect(
        document.querySelector('input[id="root/column"]')
      ).not.toBeInTheDocument();
    });
  });

  it('should render tags and glossary terms fields', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tags-selector')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-terms-selector')).toBeInTheDocument();

    // Verify TagSuggestion components are rendered
    const tagComponents = screen.getAllByText('TagSuggestion Component');

    expect(tagComponents).toHaveLength(2); // One for tags, one for glossary terms
  });

  it('should handle test case with tags correctly', async () => {
    const mockTestCaseWithTags = {
      ...MOCK_TEST_CASE[0],
      tags: [
        {
          tagFQN: 'PII.Sensitive',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'PersonalData.Email',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    };

    render(
      <EditTestCaseModalV1 {...mockProps} testCase={mockTestCaseWithTags} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tags-selector')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-terms-selector')).toBeInTheDocument();
  });

  it('should filter out tier tags correctly', async () => {
    const mockTestCaseWithTierTag = {
      ...MOCK_TEST_CASE[0],
      tags: [
        {
          tagFQN: 'Tier.Tier1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'PII.Sensitive',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    };

    render(
      <EditTestCaseModalV1 {...mockProps} testCase={mockTestCaseWithTierTag} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Should still render tag fields
    expect(screen.getByTestId('tags-selector')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-terms-selector')).toBeInTheDocument();
  });

  it('should handle showOnlyParameter mode correctly', async () => {
    render(<EditTestCaseModalV1 {...mockProps} showOnlyParameter />);

    await waitFor(() => {
      // Should not render Cards when showOnlyParameter is true
      expect(
        document.querySelector('.form-card-section')
      ).not.toBeInTheDocument();

      // Should not render tags and other fields
      expect(screen.queryByTestId('tags-selector')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('glossary-terms-selector')
      ).not.toBeInTheDocument();
    });

    // Should still render parameter form
    expect(
      await screen.findByText('ParameterForm.component')
    ).toBeInTheDocument();
  });

  it('should not show parameter form when useDynamicAssertion is true', async () => {
    const mockTestCaseWithDynamicAssertion = {
      ...MOCK_TEST_CASE[0],
      useDynamicAssertion: true,
    };

    render(
      <EditTestCaseModalV1
        {...mockProps}
        testCase={mockTestCaseWithDynamicAssertion}
      />
    );

    await waitFor(() => {
      expect(
        screen.queryByText('ParameterForm.component')
      ).not.toBeInTheDocument();
    });
  });

  it('should load test definition and render form correctly', async () => {
    // Mock test definition
    const mockTestDefinition = {
      ...MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
      supportsRowLevelPassedFailed: true,
    };

    // Set up the mock BEFORE rendering
    (getTestDefinitionById as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockTestDefinition)
    );

    await act(async () => {
      render(<EditTestCaseModalV1 {...mockProps} />);
    });

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Wait for component to finish loading
    await waitFor(() => {
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    // Verify test definition was loaded
    expect(getTestDefinitionById).toHaveBeenCalledWith(
      MOCK_TEST_CASE[0].testDefinition.id
    );

    // Check that form cards are rendered
    const cards = document.querySelectorAll('.form-card-section');

    expect(cards.length).toBeGreaterThan(0);

    // Verify basic form fields are present using text content
    expect(screen.getByText('label.table')).toBeInTheDocument();
    expect(screen.getByText('label.name')).toBeInTheDocument();
  });

  // =============================================
  // NEW FEATURE TESTS
  // =============================================

  it('should render ServiceDocPanel with correct props', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
      expect(
        screen.getByText(/ServiceDocPanel Component - Active Field:/)
      ).toBeInTheDocument();
    });
  });

  it('should update activeField when field receives focus', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const displayNameField = document.querySelector(
      'input[id="root/displayName"]'
    );

    expect(displayNameField).toBeInTheDocument();

    expect(displayNameField).toBeTruthy();

    if (displayNameField) {
      fireEvent.focus(displayNameField);
    }

    // ActiveField should be updated in ServiceDocPanel
    await waitFor(() => {
      expect(
        screen.getByText(/Active Field: root\/displayName/)
      ).toBeInTheDocument();
    });
  });

  it('should handle field focus for valid root patterns only', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const tableField = document.querySelector(
      'input[id="root/selected-entity"]'
    );

    expect(tableField).toBeInTheDocument();

    expect(tableField).toBeTruthy();

    if (tableField) {
      fireEvent.focus(tableField);
    }

    // ActiveField should be updated for root/selected-entity pattern
    await waitFor(() => {
      expect(
        screen.getByText(/Active Field: root\/selected-entity/)
      ).toBeInTheDocument();
    });
  });

  it('should render drawer with dual-pane layout', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(
        document.querySelector('.drawer-content-wrapper')
      ).toBeInTheDocument();
      expect(
        document.querySelector('.drawer-form-content')
      ).toBeInTheDocument();
      expect(document.querySelector('.drawer-doc-panel')).toBeInTheDocument();
    });
  });

  it('should allow editing display name field', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const displayNameField = document.querySelector(
      'input[id="root/displayName"]'
    );

    expect(displayNameField).toBeInTheDocument();
    expect(displayNameField).not.toBeDisabled();

    expect(displayNameField).toBeTruthy();

    if (displayNameField) {
      fireEvent.change(displayNameField, {
        target: { value: 'New Display Name' },
      });
    }

    expect(displayNameField).toHaveValue('New Display Name');
  });

  it('should submit form with updated display name', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const displayNameField = document.querySelector(
      'input[id="root/displayName"]'
    );

    expect(displayNameField).toBeInTheDocument();

    expect(displayNameField).toBeTruthy();

    if (displayNameField) {
      fireEvent.change(displayNameField, {
        target: { value: 'Updated Display Name' },
      });
    }

    const updateBtn = await screen.findByText('label.update');

    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });
  });

  it('should handle parameter form click to update activeField', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const parameterForm = screen.getByText('ParameterForm.component');

    fireEvent.click(parameterForm);

    // Should update activeField for parameter definition
    await waitFor(() => {
      expect(
        screen.getByText(/Active Field: root\/columnValuesToMatchRegex/)
      ).toBeInTheDocument();
    });
  });

  it('should preserve display name when showOnlyParameter is true', async () => {
    render(<EditTestCaseModalV1 {...mockProps} showOnlyParameter />);

    await waitFor(() => {
      expect(screen.getByText('ParameterForm.component')).toBeInTheDocument();
    });

    const updateBtn = screen.getByText('label.update');

    fireEvent.click(updateBtn);

    // Since showOnlyParameter mode preserves the original displayName from testCase
    await waitFor(() => {
      expect(mockProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: MOCK_TEST_CASE[0].displayName,
        })
      );
    });
  });

  it('should render form cards in correct structure', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    // Wait for loading to complete and form to render
    await waitFor(
      () => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    const formCards = document.querySelectorAll('.form-card-section');

    expect(formCards).toHaveLength(3); // Table/Column card, Test config card, Test details card
  });

  it('should handle drawer footer actions correctly', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(
        document.querySelector('.drawer-footer-actions')
      ).toBeInTheDocument();
    });

    const cancelBtn = await screen.findByTestId('cancel-btn');
    const updateBtn = await screen.findByTestId('update-btn');

    expect(cancelBtn).toBeInTheDocument();
    expect(updateBtn).toBeInTheDocument();
  });

  it('should handle focus events that do not match root pattern', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Verify ServiceDocPanel shows no active field initially
    expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
    expect(
      screen.getByText('ServiceDocPanel Component - Active Field:')
    ).toBeInTheDocument();

    // Create an element with non-root pattern id and focus it
    const testElement = document.createElement('input');
    testElement.id = 'invalid-pattern';
    document.body.appendChild(testElement);

    fireEvent.focus(testElement);

    // ActiveField should remain empty for invalid patterns
    await waitFor(() => {
      expect(
        screen.getByText('ServiceDocPanel Component - Active Field:')
      ).toBeInTheDocument();
    });

    // Cleanup
    testElement.remove();
  });

  it('should correctly convert boolean parameter values from string to boolean', async () => {
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_BE_IN_SET
    );

    const testCaseWithBooleanFalse = {
      ...MOCK_TEST_CASE_WITH_BOOLEAN_PARAM,
      parameterValues: [
        {
          name: 'allowedValues',
          value: '["active","inactive","pending"]',
        },
        {
          name: 'matchEnum',
          value: 'false',
        },
      ],
    };

    render(
      <EditTestCaseModalV1 {...mockProps} testCase={testCaseWithBooleanFalse} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const switchElement = await waitFor(() => {
      const el = document.querySelector('button[role="switch"]');

      expect(el).toBeInTheDocument();

      return el as HTMLButtonElement;
    });

    expect(switchElement.getAttribute('aria-checked')).toBe('false');
  });

  it('should correctly convert boolean parameter values when value is "true"', async () => {
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_BE_IN_SET
    );

    const testCaseWithBooleanTrue = {
      ...MOCK_TEST_CASE_WITH_BOOLEAN_PARAM,
      parameterValues: [
        {
          name: 'allowedValues',
          value: '["active","inactive","pending"]',
        },
        {
          name: 'matchEnum',
          value: 'true',
        },
      ],
    };

    render(
      <EditTestCaseModalV1 {...mockProps} testCase={testCaseWithBooleanTrue} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    const switchElement = await waitFor(() => {
      const el = document.querySelector('button[role="switch"]');

      expect(el).toBeInTheDocument();

      return el as HTMLButtonElement;
    });

    expect(switchElement.getAttribute('aria-checked')).toBe('true');
  });
});
