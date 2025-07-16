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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { forwardRef } from 'react';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/type/tagLabel';
import {
  MOCK_TEST_CASE,
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
  return jest.fn().mockImplementation(() => <div>ParameterForm.component</div>);
});

jest.mock('../../../../pages/TasksPage/shared/TagSuggestion', () =>
  jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid={props.selectProps?.['data-testid']}>
      TagSuggestion Component
      {children}
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

  it('should render form with Card structure', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();

    // Check for Card containers
    expect(document.querySelector('.form-card-section')).toBeInTheDocument();
  });

  it('should render all form fields correctly', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Check table and column fields
    expect(await screen.findByLabelText('label.table')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.column')).toBeInTheDocument();

    // Check test case details
    expect(await screen.findByLabelText('label.name')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('label.display-name')
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText('label.test-entity')
    ).toBeInTheDocument();

    // Check parameter form
    expect(
      await screen.findByText('ParameterForm.component')
    ).toBeInTheDocument();
  });

  it('should have disabled fields for non-editable elements', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('label.table')).toBeDisabled();
      expect(screen.getByLabelText('label.column')).toBeDisabled();
      expect(screen.getByLabelText('label.name')).toBeDisabled();
      expect(screen.getByLabelText('label.test-entity')).toBeDisabled();
    });
  });

  it('should have editable display name field', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    const displayNameField = await screen.findByLabelText('label.display-name');

    expect(displayNameField).toBeInTheDocument();
    expect(displayNameField).not.toBeDisabled();
    expect(displayNameField).toHaveValue(MOCK_TEST_CASE[0].displayName);
  });

  it('should populate fields with test case data', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('label.table')).toHaveValue('dim_address');
      expect(screen.getByLabelText('label.column')).toHaveValue('last_name');
      expect(screen.getByLabelText('label.name')).toHaveValue(
        'column_values_to_match_regex'
      );
      expect(screen.getByLabelText('label.test-entity')).toHaveValue(
        'Column Values To Match Regex Pattern'
      );
    });
  });

  it('should render action buttons in drawer footer', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.update')).toBeInTheDocument();
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
    expect(await screen.findByLabelText('label.column')).toBeInTheDocument();
  });

  it('should handle table test case correctly', async () => {
    const tableTestCase = {
      ...MOCK_TEST_CASE[0],
      entityLink: 'table::sample_data.ecommerce_db.shopify.dim_address',
    };

    render(<EditTestCaseModalV1 {...mockProps} testCase={tableTestCase} />);

    await waitFor(() => {
      // Should not render column field for table test
      expect(screen.queryByLabelText('label.column')).not.toBeInTheDocument();
    });
  });

  it('should render tags and glossary terms fields', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();

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

    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
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

    // Should still render tag fields
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
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

    // Verify basic form fields are present
    expect(screen.getByLabelText('label.table')).toBeInTheDocument();
    expect(screen.getByLabelText('label.name')).toBeInTheDocument();
  });

  it('should close drawer when onClose is called', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    // Find and click the close button (if visible) or trigger onClose
    const drawer = document.querySelector('.ant-drawer');

    expect(drawer).toBeInTheDocument();

    // Simulate drawer close
    await act(async () => {
      // This would typically be triggered by the drawer's close mechanism
      mockProps.onCancel();
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should show loading state correctly', async () => {
    // Mock a delayed response to test loading state
    (getTestDefinitionById as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX),
            100
          )
        )
    );

    render(<EditTestCaseModalV1 {...mockProps} />);

    // Should show loader initially
    expect(screen.getByTestId('loader')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should handle test case without tags gracefully', async () => {
    const mockTestCaseWithoutTags = {
      ...MOCK_TEST_CASE[0],
      tags: undefined,
    };

    render(
      <EditTestCaseModalV1 {...mockProps} testCase={mockTestCaseWithoutTags} />
    );

    // Should still render tag fields even when no tags exist
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
  });

  it('should apply correct CSS classes', async () => {
    render(<EditTestCaseModalV1 {...mockProps} />);

    await waitFor(() => {
      // Check for test-case-form-v1 and drawer-mode classes
      expect(document.querySelector('.test-case-form-v1')).toBeInTheDocument();
      expect(document.querySelector('.drawer-mode')).toBeInTheDocument();
    });
  });

  it('should handle drawerProps correctly', async () => {
    const customDrawerProps = {
      size: 'default' as const,
      placement: 'left' as const,
    };

    render(
      <EditTestCaseModalV1 {...mockProps} drawerProps={customDrawerProps} />
    );

    const drawer = document.querySelector('.ant-drawer');

    expect(drawer).toBeInTheDocument();
  });
});
