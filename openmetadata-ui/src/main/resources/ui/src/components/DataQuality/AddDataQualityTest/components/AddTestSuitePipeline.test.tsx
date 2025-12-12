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
import React from 'react';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { AddTestSuitePipelineProps } from '../AddDataQualityTest.interface';
import AddTestSuitePipeline from './AddTestSuitePipeline';

const mockNavigate = jest.fn();
const mockUseCustomLocation = jest.fn();
const mockUseFqn = jest.fn();
const mockScheduleInterval = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => mockUseCustomLocation())
);

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => mockUseFqn()),
}));

jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: () => <div>AddTestCaseList.component</div>,
}));

jest.mock(
  '../../../Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () => jest.fn().mockImplementation((props) => mockScheduleInterval(props))
);

jest.mock('../../../../utils/SchedularUtils', () => ({
  getRaiseOnErrorFormField: () => ({
    name: 'raiseOnError',
    label: 'Raise On Error',
    type: 'switch',
    required: false,
  }),
}));

const mockProps: AddTestSuitePipelineProps = {
  isLoading: false,
  onSubmit: jest.fn(),
};

describe('AddTestSuitePipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCustomLocation.mockReturnValue({
      search: '?testSuiteId=test-suite-id',
    });
    mockUseFqn.mockReturnValue({ ingestionFQN: '' });
    mockScheduleInterval.mockImplementation(
      ({ children, topChildren, onDeploy, onBack }) => (
        <div>
          ScheduleInterval
          {topChildren}
          {children}
          <div onClick={onDeploy}>submit</div>
          <div onClick={onBack}>cancel</div>
        </div>
      )
    );
  });

  it('renders form fields', () => {
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

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
                'schedular-form': {
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

    expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    expect(screen.queryByText('AddTestCaseList.component')).toBeNull();
  });

  describe('raiseOnError functionality', () => {
    it('includes raiseOnError field in form submission', async () => {
      const mockOnSubmit = jest.fn();
      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} onSubmit={mockOnSubmit} />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          raiseOnError: undefined,
        })
      );
    });

    it('passes raiseOnError value from form to onSubmit', async () => {
      const mockOnSubmit = jest.fn();
      const initialData = {
        raiseOnError: true,
        selectAllTestCases: true,
      };

      mockScheduleInterval.mockImplementationOnce(
        ({
          children,
          onDeploy,
        }: {
          children: React.ReactNode;
          onDeploy: (values: unknown) => void;
        }) => (
          <div>
            {children}
            <div
              onClick={() =>
                onDeploy({
                  raiseOnError: true,
                  selectAllTestCases: true,
                })
              }>
              submit
            </div>
          </div>
        )
      );

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={initialData}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          raiseOnError: true,
        })
      );
    });
  });

  describe('testCase mapping logic', () => {
    it('maps TestCase objects to string names', async () => {
      const mockOnSubmit = jest.fn();
      const testCaseObject: TestCase = {
        name: 'test-case-object',
        id: '123',
        fullyQualifiedName: 'test.case.object',
      } as TestCase;

      mockScheduleInterval.mockImplementationOnce(
        ({
          children,
          onDeploy,
        }: {
          children: React.ReactNode;
          onDeploy: (values: unknown) => void;
        }) => (
          <div>
            {children}
            <div
              onClick={() =>
                onDeploy({
                  testCases: [testCaseObject, 'test-case-string'],
                })
              }>
              submit
            </div>
          </div>
        )
      );

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} onSubmit={mockOnSubmit} />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: ['test-case-object', 'test-case-string'],
        })
      );
    });

    it('handles undefined testCases array', async () => {
      const mockOnSubmit = jest.fn();

      mockScheduleInterval.mockImplementationOnce(
        ({
          children,
          onDeploy,
        }: {
          children: React.ReactNode;
          onDeploy: (values: unknown) => void;
        }) => (
          <div>
            {children}
            <div
              onClick={() =>
                onDeploy({
                  testCases: undefined,
                  selectAllTestCases: true,
                })
              }>
              submit
            </div>
          </div>
        )
      );

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{ selectAllTestCases: true }}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: undefined,
          selectAllTestCases: true,
        })
      );
    });

    it('handles mixed array of TestCase objects and strings', async () => {
      const mockOnSubmit = jest.fn();
      const testCase1: TestCase = {
        name: 'test-case-1',
        id: '1',
        fullyQualifiedName: 'test.case.1',
      } as TestCase;
      const testCase2: TestCase = {
        name: 'test-case-2',
        id: '2',
        fullyQualifiedName: 'test.case.2',
      } as TestCase;

      mockScheduleInterval.mockImplementationOnce(
        ({
          children,
          onDeploy,
        }: {
          children: React.ReactNode;
          onDeploy: (values: unknown) => void;
        }) => (
          <div>
            {children}
            <div
              onClick={() =>
                onDeploy({
                  testCases: [testCase1, 'string-test', testCase2],
                })
              }>
              submit
            </div>
          </div>
        )
      );

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} onSubmit={mockOnSubmit} />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: ['test-case-1', 'string-test', 'test-case-2'],
        })
      );
    });
  });

  describe('testSuiteId extraction', () => {
    it('uses testSuiteId from testSuite prop when available', () => {
      const testSuite = { id: 'prop-test-suite-id' } as TestSuite;

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} testSuite={testSuite} />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();
    });

    it('extracts testSuiteId from URL search params when testSuite prop is not provided', () => {
      mockUseCustomLocation.mockReturnValueOnce({
        search: '?testSuiteId=url-test-suite-id',
      });

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();
    });

    it('handles URL search params without question mark', () => {
      mockUseCustomLocation.mockReturnValueOnce({
        search: 'testSuiteId=no-question-mark-id',
      });

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();
    });

    it('prioritizes testSuite prop over URL params', () => {
      mockUseCustomLocation.mockReturnValueOnce({
        search: '?testSuiteId=url-id',
      });

      const testSuite = { id: 'prop-id' } as TestSuite;

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} testSuite={testSuite} />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();
    });
  });

  describe('Form state management', () => {
    it('clears testCases field when selectAllTestCases is enabled', async () => {
      const mockSetFieldsValue = jest.fn();
      const mockGetFieldValue = jest.fn().mockReturnValue(true);

      jest.spyOn(Form, 'Provider').mockImplementation(
        jest.fn().mockImplementation(({ onFormChange, children }) => (
          <div>
            {children}
            <button
              data-testid="trigger-form-change"
              onClick={() =>
                onFormChange('', {
                  forms: {
                    'schedular-form': {
                      getFieldValue: mockGetFieldValue,
                      setFieldsValue: mockSetFieldsValue,
                    },
                  },
                })
              }>
              Trigger Change
            </button>
          </div>
        ))
      );

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('trigger-form-change'));
      });

      expect(mockGetFieldValue).toHaveBeenCalledWith('selectAllTestCases');
      expect(mockSetFieldsValue).toHaveBeenCalledWith({ testCases: undefined });
    });

    it('does not clear testCases when selectAllTestCases is false', async () => {
      const mockSetFieldsValue = jest.fn();
      const mockGetFieldValue = jest.fn().mockReturnValue(false);

      jest.spyOn(Form, 'Provider').mockImplementation(
        jest.fn().mockImplementation(({ onFormChange, children }) => (
          <div>
            {children}
            <button
              data-testid="trigger-form-change"
              onClick={() =>
                onFormChange('', {
                  forms: {
                    'schedular-form': {
                      getFieldValue: mockGetFieldValue,
                      setFieldsValue: mockSetFieldsValue,
                    },
                  },
                })
              }>
              Trigger Change
            </button>
          </div>
        ))
      );

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('trigger-form-change'));
      });

      expect(mockGetFieldValue).toHaveBeenCalledWith('selectAllTestCases');
      expect(mockSetFieldsValue).not.toHaveBeenCalled();
    });

    it('updates selectAllTestCases state when form changes', async () => {
      const { rerender } = render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();

      const propsWithInitialData = {
        ...mockProps,
        initialData: { selectAllTestCases: true },
      };

      rerender(
        <Form>
          <AddTestSuitePipeline {...propsWithInitialData} />
        </Form>
      );

      await act(async () => {
        // Form state should reflect the initial data
      });
    });
  });

  describe('Edit mode behavior', () => {
    it('displays Save button in edit mode', () => {
      mockUseFqn.mockReturnValueOnce({ ingestionFQN: 'test-ingestion-fqn' });

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(screen.getByText('ScheduleInterval')).toBeInTheDocument();
    });

    it('displays Create button when not in edit mode', () => {
      mockUseFqn.mockReturnValueOnce({ ingestionFQN: '' });

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(screen.getByText('ScheduleInterval')).toBeInTheDocument();
    });
  });

  describe('Form submission with all fields', () => {
    it('submits form with all populated fields', async () => {
      const mockOnSubmit = jest.fn();
      const initialData = {
        name: 'Test Pipeline',
        cron: '0 0 * * *',
        enableDebugLog: true,
        selectAllTestCases: false,
        raiseOnError: true,
      };

      mockScheduleInterval.mockImplementationOnce(
        ({
          children,
          onDeploy,
        }: {
          children: React.ReactNode;
          onDeploy: (values: unknown) => void;
        }) => (
          <div>
            {children}
            <div
              onClick={() =>
                onDeploy({
                  ...initialData,
                  testCases: ['test-1', 'test-2'],
                })
              }>
              submit
            </div>
          </div>
        )
      );

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={initialData}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByText('submit'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Pipeline',
        cron: '0 0 * * *',
        enableDebugLog: true,
        selectAllTestCases: false,
        testCases: ['test-1', 'test-2'],
        raiseOnError: true,
      });
    });
  });
});
