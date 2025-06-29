/*
 *  Copyright 2024 Collate.
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
import { Form } from 'antd';
import { AddTestSuitePipelineProps } from '../AddDataQualityTest.interface';
import AddTestSuitePipeline from './AddTestSuitePipeline';

const mockNavigate = jest.fn();

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: `?testSuiteId=test-suite-id`,
  }));
});
jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-suite-fqn' }),
}));
jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: jest
    .fn()
    .mockImplementation(() => <div>AddTestCaseList.component</div>),
}));
jest.mock(
  '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () =>
    jest
      .fn()
      .mockImplementation(({ children, topChildren, onDeploy, onBack }) => (
        <div>
          ScheduleInterval
          {topChildren}
          {children}
          <div onClick={onDeploy}>submit</div>
          <div onClick={onBack}>cancel</div>
        </div>
      ))
);
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../../utils/SchedularUtils', () => ({
  getRaiseOnErrorFormField: jest.fn().mockReturnValue({}),
}));

const mockProps: AddTestSuitePipelineProps = {
  isLoading: false,
  onSubmit: jest.fn(),
};

describe('AddTestSuitePipeline', () => {
  it('renders form fields', () => {
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

    // Assert that the form fields are rendered
    expect(screen.getByTestId('pipeline-name')).toBeInTheDocument();
    expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    expect(screen.getByText('submit')).toBeInTheDocument();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('calls onSubmit when submit button is clicked', async () => {
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

    fireEvent.change(screen.getByTestId('pipeline-name'), {
      target: { value: 'Test Suite pipeline' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('submit'));
    });

    // Assert that onSubmit is called with the correct values
    expect(mockProps.onSubmit).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked and onCancel button is provided', async () => {
    const mockOnCancel = jest.fn();
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} onCancel={mockOnCancel} />
      </Form>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('cancel'));
    });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls navigate(-1) when cancel button is clicked and onCancel button is not provided', async () => {
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('cancel'));
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('Hide AddTestCaseList after clicking on select-all-test-cases switch', async () => {
    jest.spyOn(Form, 'Provider').mockImplementation(
      jest.fn().mockImplementation(({ onFormChange, children }) => (
        <div
          onClick={() =>
            onFormChange('', {
              forms: {
                ['schedular-form']: {
                  getFieldValue: jest.fn().mockImplementation(() => true),
                  setFieldsValue: jest.fn(),
                },
              },
            })
          }>
          {children}
        </div>
      ))
    );
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

    // Assert that AddTestCaseList.component is now visible
    expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();

    // Click on the select-all-test-cases switch
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    // Assert that AddTestCaseList.component is not initially visible
    expect(screen.queryByText('AddTestCaseList.component')).toBeNull();
  });
});
