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
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MOCK_TEST_CASE,
  MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX,
} from 'mocks/TestSuite.mock';
import React, { forwardRef } from 'react';
import { EditTestCaseModalProps } from './AddDataQualityTest.interface';
import EditTestCaseModal from './EditTestCaseModal';

const mockProps: EditTestCaseModalProps = {
  visible: true,
  testCase: MOCK_TEST_CASE[0],
  onCancel: jest.fn(),
  onUpdate: jest.fn(),
};

jest.mock('../common/rich-text-editor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(() => <div>RichTextEditor.component</div>)
  );
});
jest.mock('./components/ParameterForm', () => {
  return jest.fn().mockImplementation(() => <div>ParameterForm.component</div>);
});
jest.mock('rest/testAPI', () => {
  return {
    getTestDefinitionById: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(MOCK_TEST_DEFINITION_COLUMN_VALUES_TO_MATCH_REGEX)
      ),
    updateTestCaseById: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});

describe('EditTestCaseModal Component', () => {
  it('component should render', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByTestId('edit-test-form')).toBeInTheDocument();
    expect(await screen.findByTestId('table-name')).toBeInTheDocument();
    expect(await screen.findByTestId('column-name')).toBeInTheDocument();
    expect(await screen.findByTestId('test-name')).toBeInTheDocument();
    expect(await screen.findByTestId('test-display-name')).toBeInTheDocument();
    expect(await screen.findByTestId('test-definition')).toBeInTheDocument();
    expect(
      await screen.findByText('RichTextEditor.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ParameterForm.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.submit')).toBeInTheDocument();
  });

  it('table, name, test definition, should be disabled', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByTestId('table-name')).toBeDisabled();
    expect(await screen.findByTestId('column-name')).toBeDisabled();
    expect(await screen.findByTestId('test-name')).toBeDisabled();
    expect(await screen.findByTestId('test-definition')).toBeDisabled();
  });

  it('fields should have data based on testCase value', async () => {
    render(<EditTestCaseModal {...mockProps} />);

    expect(await screen.findByTestId('table-name')).toHaveValue('dim_address');
    expect(await screen.findByTestId('column-name')).toHaveValue('last_name');
    expect(await screen.findByTestId('test-name')).toHaveValue(
      'column_values_to_match_regex'
    );
    expect(await screen.findByTestId('test-definition')).toHaveValue(
      'columnValuesToMatchRegex'
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

    const submitBtn = await screen.findByText('label.submit');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockProps.onUpdate).toHaveBeenCalled();
  });
});
