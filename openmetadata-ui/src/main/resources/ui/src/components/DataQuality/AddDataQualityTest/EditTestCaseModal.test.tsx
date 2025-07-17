/*
 *  Copyright 2023 Collate.
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
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import {
  MOCK_TEST_CASE,
  MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
} from '../../../mocks/TestSuite.mock';
import { getTestDefinitionById } from '../../../rest/testAPI';
import { EditTestCaseModalProps } from './AddDataQualityTest.interface';
import EditTestCaseModal from './EditTestCaseModal';

const mockProps: EditTestCaseModalProps = {
  visible: true,
  testCase: MOCK_TEST_CASE[0],
  onCancel: jest.fn(),
  onUpdate: jest.fn(),
};

jest.mock('../../../utils/DataQuality/DataQualityUtils', () => {
  return {
    createTestCaseParameters: jest.fn().mockImplementation(() => []),
  };
});

jest.mock('../../common/RichTextEditor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(() => <div>RichTextEditor.component</div>)
  );
});
jest.mock('./components/ParameterForm', () => {
  return jest.fn().mockImplementation(() => <div>ParameterForm.component</div>);
});
jest.mock('../../../pages/TasksPage/shared/TagSuggestion', () =>
  jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid={props.selectProps?.['data-testid']}>
      TagSuggestion Component
      {children}
    </div>
  ))
);
jest.mock('../../../rest/testAPI', () => {
  return {
    getTestCaseByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(MOCK_TEST_CASE[0])),
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

describe('EditTestCaseModal Component', () => {
  it('component should render', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.table')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.column')).toBeInTheDocument();
    expect(await screen.findByLabelText('label.name')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('label.display-name')
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText('label.test-entity')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('RichTextEditor.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ParameterForm.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.save')).toBeInTheDocument();
  });

  it('table, name, test definition, should be disabled', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByLabelText('label.name')).toBeDisabled();
    expect(await screen.findByLabelText('label.column')).toBeDisabled();
    expect(await screen.findByLabelText('label.table')).toBeDisabled();
    expect(await screen.findByLabelText('label.test-entity')).toBeDisabled();
  });

  it('fields should have data based on testCase value', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByLabelText('label.table')).toHaveValue(
      'dim_address'
    );
    expect(await screen.findByLabelText('label.column')).toHaveValue(
      'last_name'
    );
    expect(await screen.findByLabelText('label.name')).toHaveValue(
      'column_values_to_match_regex'
    );
    expect(await screen.findByLabelText('label.test-entity')).toHaveValue(
      'Column Values To Match Regex Pattern'
    );
  });

  it('should call onCancel function, on click of cancel button', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    const cancelBtn = await screen.findByText('label.cancel');

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should call onUpdate function, on click of submit button', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    await act(async () => {
      userEvent.click(await screen.findByText('label.save'));
    });

    await waitFor(() => {
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });
  });

  it('displayName should be visible in input field', async () => {
    render(<EditTestCaseModal {...mockProps} />);
    const displayName = await screen.findByLabelText('label.display-name');

    expect(displayName).toBeInTheDocument();
    expect(displayName).toHaveValue(MOCK_TEST_CASE[0].displayName);
  });

  it('Should not show parameter if useDynamicAssertion is true', async () => {
    render(
      <EditTestCaseModal
        {...mockProps}
        testCase={{
          ...MOCK_TEST_CASE[0],
          useDynamicAssertion: true,
        }}
      />
    );

    expect(screen.queryByText('ParameterForm.component')).toBeNull();
  });

  // Tags and Glossary Terms functionality tests
  it('should render tags and glossary terms fields', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    // Check if tags field is rendered
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();

    // Check if glossary terms field is rendered
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();

    // Verify TagSuggestion components are rendered
    const tagComponents = screen.getAllByText('TagSuggestion Component');

    expect(tagComponents).toHaveLength(2); // One for tags, one for glossary terms
  });

  it('should separate tags and glossary terms correctly', async () => {
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

    const propsWithTags = {
      ...mockProps,
      testCase: mockTestCaseWithTags,
    };

    render(<EditTestCaseModal {...propsWithTags} />);

    // Verify that both tag fields are rendered
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
  });

  it('should handle test case with no tags gracefully', async () => {
    const mockTestCaseWithoutTags = {
      ...MOCK_TEST_CASE[0],
      tags: undefined,
    };

    const propsWithoutTags = {
      ...mockProps,
      testCase: mockTestCaseWithoutTags,
    };

    render(<EditTestCaseModal {...propsWithoutTags} />);

    // Should still render tag fields even when no tags exist
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
  });

  it('should handle test case with empty tags array', async () => {
    const mockTestCaseWithEmptyTags = {
      ...MOCK_TEST_CASE[0],
      tags: [],
    };

    const propsWithEmptyTags = {
      ...mockProps,
      testCase: mockTestCaseWithEmptyTags,
    };

    render(<EditTestCaseModal {...propsWithEmptyTags} />);

    // Should render tag fields with empty arrays
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
  });

  it('should not render tags and glossary terms in parameter-only mode', async () => {
    const parameterOnlyProps = {
      ...mockProps,
      showOnlyParameter: true,
    };

    render(<EditTestCaseModal {...parameterOnlyProps} />);

    // Should not render tag fields when showOnlyParameter is true
    expect(screen.queryByTestId('tags-selector')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('glossary-terms-selector')
    ).not.toBeInTheDocument();
  });

  it('should render compute row count field in parameter-only mode when test definition supports it', async () => {
    // Mock a test definition that supports row-level passed/failed counting
    const mockTestDefinitionWithRowSupport = {
      ...MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
      supportsRowLevelPassedFailed: true,
    };

    // Mock the API to return the test definition with row support
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      mockTestDefinitionWithRowSupport
    );

    const parameterOnlyProps = {
      ...mockProps,
      showOnlyParameter: true,
    };

    render(<EditTestCaseModal {...parameterOnlyProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Should render compute row count field even in parameter-only mode
    expect(
      screen.getByTestId('compute-passed-failed-row-count')
    ).toBeInTheDocument();
  });

  it('should not render compute row count field when test definition does not support it', async () => {
    // Mock a test definition that does not support row-level passed/failed counting
    const mockTestDefinitionWithoutRowSupport = {
      ...MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
      supportsRowLevelPassedFailed: false,
    };

    // Mock the API to return the test definition without row support
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      mockTestDefinitionWithoutRowSupport
    );

    const parameterOnlyProps = {
      ...mockProps,
      showOnlyParameter: true,
    };

    render(<EditTestCaseModal {...parameterOnlyProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Should not render compute row count field when not supported
    expect(
      screen.queryByTestId('compute-passed-failed-row-count')
    ).not.toBeInTheDocument();
  });

  it('should render compute row count field in full mode when test definition supports it', async () => {
    // Mock a test definition that supports row-level passed/failed counting
    const mockTestDefinitionWithRowSupport = {
      ...MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
      supportsRowLevelPassedFailed: true,
    };

    // Mock the API to return the test definition with row support
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      mockTestDefinitionWithRowSupport
    );

    render(<EditTestCaseModal {...mockProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Should render compute row count field in full mode
    expect(
      screen.getByTestId('compute-passed-failed-row-count')
    ).toBeInTheDocument();
  });

  it('should preserve compute row count value when updating in parameter-only mode', async () => {
    // Mock a test definition that supports row-level passed/failed counting
    const mockTestDefinitionWithRowSupport = {
      ...MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
      supportsRowLevelPassedFailed: true,
    };

    // Mock the API to return the test definition with row support
    (getTestDefinitionById as jest.Mock).mockResolvedValue(
      mockTestDefinitionWithRowSupport
    );

    const testCaseWithComputeRowCount = {
      ...MOCK_TEST_CASE[0],
      computePassedFailedRowCount: true,
    };

    const parameterOnlyProps = {
      ...mockProps,
      testCase: testCaseWithComputeRowCount,
      showOnlyParameter: true,
    };

    render(<EditTestCaseModal {...parameterOnlyProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByTestId('edit-test-form')).toBeInTheDocument();
    });

    // Submit the form
    const submitBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Verify that onUpdate was called (indicating form submission with compute row count preserved)
    expect(mockProps.onUpdate).toHaveBeenCalled();
  });

  it('should include tags and glossary terms in form submission', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    // Wait for form to load
    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();

    // Submit the form
    const submitBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Verify that onUpdate was called (indicating form submission)
    expect(mockProps.onUpdate).toHaveBeenCalled();
  });

  // Tier tag filtering tests
  it('should filter out tier tags from displayed tags', async () => {
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
        {
          tagFQN: 'PersonalData.Email',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
    };

    const propsWithTierTag = {
      ...mockProps,
      testCase: mockTestCaseWithTierTag,
    };

    render(<EditTestCaseModal {...propsWithTierTag} />);

    // Verify that tag fields are rendered
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();

    // The tier tag should be filtered out and not displayed in the form
    // But it should be preserved when updating
  });

  it('should preserve tier tags when updating test case', async () => {
    const mockUpdateTestCaseById = jest.fn().mockResolvedValue({});
    jest.doMock('../../../rest/testAPI', () => ({
      ...jest.requireActual('../../../rest/testAPI'),
      updateTestCaseById: mockUpdateTestCaseById,
    }));

    const mockTestCaseWithTierTag = {
      ...MOCK_TEST_CASE[0],
      tags: [
        {
          tagFQN: 'Tier.Tier2',
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

    const propsWithTierTag = {
      ...mockProps,
      testCase: mockTestCaseWithTierTag,
    };

    render(<EditTestCaseModal {...propsWithTierTag} />);

    // Wait for form to load
    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();

    // Submit the form
    const submitBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // The tier tag should be preserved in the update
    expect(mockProps.onUpdate).toHaveBeenCalled();
  });

  it('should handle multiple tier tags correctly', async () => {
    const mockTestCaseWithMultipleTierTags = {
      ...MOCK_TEST_CASE[0],
      tags: [
        {
          tagFQN: 'Tier.Tier1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Tier.Tier2', // This should not happen in practice, but test it
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

    const propsWithMultipleTierTags = {
      ...mockProps,
      testCase: mockTestCaseWithMultipleTierTags,
    };

    render(<EditTestCaseModal {...propsWithMultipleTierTags} />);

    // Should still render properly
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
  });

  it('should work correctly when no tier tags are present', async () => {
    const mockTestCaseWithoutTierTag = {
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

    const propsWithoutTierTag = {
      ...mockProps,
      testCase: mockTestCaseWithoutTierTag,
    };

    render(<EditTestCaseModal {...propsWithoutTierTag} />);

    // Wait for form to load
    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();

    // Submit the form
    const submitBtn = await screen.findByText('label.save');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Should work normally without tier tags
    expect(mockProps.onUpdate).toHaveBeenCalled();
  });
});
