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

const mockAddTestCaseList = jest
  .fn()
  .mockImplementation(() => <div>AddTestCaseList.component</div>);
jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: (props: Record<string, unknown>) =>
    mockAddTestCaseList(props),
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
    mockScheduleInterval.mockImplementation(({ onChange }) => (
      <div>
        ScheduleInterval
        <button type="button" onClick={() => onChange('0 12 * * *')}>
          Change schedule
        </button>
      </div>
    ));
  });

  it('renders form fields', () => {
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} />
      </Form>
    );

    expect(screen.getByTestId('pipeline-name')).toBeInTheDocument();
    expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    expect(screen.getByTestId('deploy-button')).toBeInTheDocument();
    expect(screen.getByTestId('back-button')).toBeInTheDocument();
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
      fireEvent.click(screen.getByText('Change schedule'));
      fireEvent.click(screen.getByTestId('deploy-button'));
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 12 * * *' })
    );
  });

  it('calls onCancel when cancel button is clicked and onCancel button is provided', async () => {
    const mockOnCancel = jest.fn();
    render(
      <Form>
        <AddTestSuitePipeline {...mockProps} onCancel={mockOnCancel} />
      </Form>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('back-button'));
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
      fireEvent.click(screen.getByTestId('back-button'));
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('Hide AddTestCaseList after clicking on select-all-test-cases switch', async () => {
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
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{ selectAllTestCases: true }}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('deploy-button'));
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
        fireEvent.click(screen.getByTestId('deploy-button'));
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

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{
              selectAllTestCases: false,
              testCases: [
                testCaseObject,
                'test-case-string',
              ] as unknown as string[],
            }}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('deploy-button'));
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          testCases: ['test-case-object', 'test-case-string'],
        })
      );
    });

    it('handles undefined testCases array', async () => {
      const mockOnSubmit = jest.fn();

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
        fireEvent.click(screen.getByTestId('deploy-button'));
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

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{
              selectAllTestCases: false,
              testCases: [
                testCase1,
                'string-test',
                testCase2,
              ] as unknown as string[],
            }}
            onSubmit={mockOnSubmit}
          />
        </Form>
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('deploy-button'));
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

  describe('table-scoped filters when test suite is executable (basic) with table', () => {
    beforeEach(() => {
      mockUseCustomLocation.mockReturnValue({ search: '' });
    });

    it('passes hideTableFilter and columnFilters when testSuite is basic with table basicEntityReference', () => {
      const tableFqn = 'service.db.schema.my_table';
      const testSuite = {
        basic: true,
        basicEntityReference: {
          fullyQualifiedName: tableFqn,
          type: 'table',
        },
      } as TestSuite;

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{ selectAllTestCases: false }}
            testSuite={testSuite}
          />
        </Form>
      );

      expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();

      const lastCall =
        mockAddTestCaseList.mock.calls[
          mockAddTestCaseList.mock.calls.length - 1
        ];
      const props = lastCall[0] as {
        hideTableFilter?: boolean;
        columnFilters?: string;
        testCaseParams?: Record<string, unknown>;
      };

      expect(props.hideTableFilter).toBe(true);
      expect(props.columnFilters).toBe(`fullyQualifiedName:"${tableFqn}"`);
      // Issue #31077: the picker's `q` is free text, so the suite scope must travel as first-class
      // filter params. Without these the basic-suite picker lists every test case in the instance.
      expect(props.testCaseParams).toEqual({
        testSuiteId: undefined,
        entityLink: `<#E::table::${tableFqn}>`,
        includeAllTests: true,
      });
    });

    it('does not pass hideTableFilter or columnFilters when testSuite is logical (not basic)', () => {
      const testSuite = { id: 'logical-suite-id', basic: false } as TestSuite;

      render(
        <Form>
          <AddTestSuitePipeline
            {...mockProps}
            initialData={{ selectAllTestCases: false }}
            testSuite={testSuite}
          />
        </Form>
      );

      const lastCall =
        mockAddTestCaseList.mock.calls[
          mockAddTestCaseList.mock.calls.length - 1
        ];
      const props = lastCall[0] as {
        hideTableFilter?: boolean;
        columnFilters?: string;
        testCaseParams?: Record<string, unknown>;
      };

      expect(props.hideTableFilter).toBe(false);
      expect(props.columnFilters).toBeUndefined();
      // A logical suite scopes by id; no entityLink, since it is not bound to one table.
      expect(props.testCaseParams).toEqual({ testSuiteId: 'logical-suite-id' });
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

      expect(
        screen.getByRole('button', { name: 'label.save' })
      ).toBeInTheDocument();
    });

    it('displays Create button when not in edit mode', () => {
      mockUseFqn.mockReturnValueOnce({ ingestionFQN: '' });

      render(
        <Form>
          <AddTestSuitePipeline {...mockProps} />
        </Form>
      );

      expect(
        screen.getByRole('button', { name: 'label.create' })
      ).toBeInTheDocument();
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
        testCases: ['test-1', 'test-2'],
      };

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
        fireEvent.click(screen.getByTestId('deploy-button'));
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
