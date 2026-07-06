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
import { HookForm } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { Table } from '../../../../generated/entity/data/table';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
  getListTestCaseBySearch,
  getListTestDefinitions,
} from '../../../../rest/testAPI';
import TestCaseFormBody from './TestCaseFormBody';
import { FormValues, TestLevel } from './TestCaseFormV1.interface';

jest.mock('../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => <div data-testid="rich-text-editor" />),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn(),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getListTestDefinitions: jest.fn(),
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      ingestionPipeline: {
        Create: true,
      },
    },
  }),
}));

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    config: {
      limits: {
        config: {
          featureLimits: [
            {
              name: 'dataQuality',
              pipelineSchedules: [
                { displayName: 'Daily', cron: '0 0 * * *' },
                { displayName: 'Weekly', cron: '0 0 * * 0' },
              ],
            },
          ],
        },
      },
    },
  }),
}));

jest.mock(
  '../../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1',
  () =>
    jest.fn().mockImplementation(({ onChange }) => (
      <div data-testid="schedule-interval-v1">
        <button
          data-testid="schedule-change-btn"
          onClick={() => onChange?.('0 0 * * *')}>
          change
        </button>
      </div>
    ))
);

jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: jest.fn().mockImplementation(({ onChange }) => (
    <div data-testid="add-test-case-list">
      <button
        data-testid="add-test-case-btn"
        onClick={() =>
          onChange?.({
            selectAll: false,
            includeIds: ['test-case-1'],
            excludeIds: [],
            testCases: [{ id: 'test-case-1', name: 'tc1', type: 'testCase' }],
          })
        }>
        add
      </button>
    </div>
  )),
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockGetTableDetailsByFQN = getTableDetailsByFQN as jest.MockedFunction<
  typeof getTableDetailsByFQN
>;
const mockGetListTestDefinitions =
  getListTestDefinitions as jest.MockedFunction<typeof getListTestDefinitions>;
const mockGetListTestCaseBySearch =
  getListTestCaseBySearch as jest.MockedFunction<
    typeof getListTestCaseBySearch
  >;
const mockGetIngestionPipelines = getIngestionPipelines as jest.MockedFunction<
  typeof getIngestionPipelines
>;

const TEST_DEFINITION_FQN = 'columnValuesToBeBetween';

const TEST_DEFINITION = {
  id: 'def-1',
  name: 'columnValuesToBeBetween',
  fullyQualifiedName: TEST_DEFINITION_FQN,
  displayName: 'Column Values To Be Between',
  description: 'Validate column values lie within a range',
  parameterDefinition: [
    {
      name: 'minValue',
      displayName: 'Min',
      dataType: 'INT',
      required: true,
    },
  ],
} as unknown as TestDefinition;

const DYNAMIC_DEFINITION = {
  ...TEST_DEFINITION,
  supportsDynamicAssertion: true,
} as unknown as TestDefinition;

const ROW_LEVEL_DEFINITION = {
  ...TEST_DEFINITION,
  supportsRowLevelPassedFailed: true,
} as unknown as TestDefinition;

const TABLE_FQN = 'service.db.schema.customers';

const SEARCH_RESPONSE = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _source: {
          name: 'customers',
          fullyQualifiedName: TABLE_FQN,
        },
      },
    ],
  },
};

const SELECTED_TABLE = {
  id: 'table-id',
  name: 'customers',
  fullyQualifiedName: TABLE_FQN,
  columns: [
    { name: 'id', dataType: 'BIGINT' },
    { name: 'email', dataType: 'VARCHAR' },
  ],
} as Table;

const SELECTED_TABLE_WITH_SUITE = {
  ...SELECTED_TABLE,
  testSuite: {
    id: 'test-suite-id',
    fullyQualifiedName: `${TABLE_FQN}.testSuite`,
  },
} as Table;

let formRef: UseFormReturn<FormValues> | undefined;

const renderBody = (
  props: Partial<Parameters<typeof TestCaseFormBody>[0]> = {}
) => {
  const Wrapper = () => {
    const form = useForm<FormValues>({
      defaultValues: { testLevel: TestLevel.TABLE },
    });
    formRef = form;

    return (
      <HookForm form={form} onSubmit={jest.fn()}>
        <TestCaseFormBody form={form} {...props} />
      </HookForm>
    );
  };

  return render(<Wrapper />);
};

describe('TestCaseFormBody', () => {
  beforeEach(() => {
    formRef = undefined;
    mockSearchQuery.mockResolvedValue(SEARCH_RESPONSE as never);
    mockGetTableDetailsByFQN.mockResolvedValue(SELECTED_TABLE as never);
    mockGetListTestDefinitions.mockResolvedValue({
      data: [TEST_DEFINITION],
      paging: { total: 1 },
    } as never);
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    } as never);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    } as never);
  });

  it('renders the three test level cards', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.getByText('label.table-level')).toBeInTheDocument();
    expect(screen.getByText('label.column-level')).toBeInTheDocument();
    expect(screen.getByText('label.dimension-level')).toBeInTheDocument();
  });

  it('renders the table async select', async () => {
    await act(async () => {
      renderBody();
    });

    expect(await screen.findByTestId('selectedTable')).toBeInTheDocument();
  });

  it('does not render the column select at table level', async () => {
    await act(async () => {
      renderBody();
    });

    expect(screen.queryByTestId('selectedColumn')).not.toBeInTheDocument();
  });

  it('reveals the column select when test level is column', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('testLevel', TestLevel.COLUMN);
    });

    expect(await screen.findByTestId('selectedColumn')).toBeInTheDocument();
  });

  it('disables column select and dimension columns select when no table is selected', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('testLevel', TestLevel.COLUMN);
    });

    const columnSelect = await screen.findByTestId('selectedColumn');
    const columnButton = columnSelect.querySelector('button');

    expect(columnButton).toBeDisabled();

    await act(async () => {
      formRef?.setValue('testLevel', TestLevel.COLUMN_DIMENSION);
    });

    const dimensionSelect = await screen.findByTestId('dimensionColumns');
    const dimensionInput = dimensionSelect.querySelector('input');

    expect(dimensionInput).toBeDisabled();
  });

  it('reveals dimension columns and top dimensions when test level is column-dimension', async () => {
    await act(async () => {
      renderBody();
    });

    await act(async () => {
      formRef?.setValue('testLevel', TestLevel.COLUMN_DIMENSION);
    });

    expect(await screen.findByTestId('dimensionColumns')).toBeInTheDocument();
    expect(await screen.findByTestId('topDimensions')).toBeInTheDocument();
  });

  it('renders the inline error alert and dismisses it', async () => {
    const onErrorDismiss = jest.fn();
    await act(async () => {
      renderBody({ errorMessage: 'Something went wrong', onErrorDismiss });
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('alert-close-button'));

    await waitFor(() => {
      expect(onErrorDismiss).toHaveBeenCalled();
    });
  });

  it('disables the table select and defaults the value when table prop is provided', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    const tableSelect = await screen.findByTestId('selectedTable');

    expect(formRef?.getValues('selectedTable')).toBeDefined();

    const input = tableSelect.querySelector('input');

    expect(input).toBeDisabled();
  });

  it('renders the parameter fields once a test type is selected', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    await act(async () => {
      formRef?.setValue('testTypeId', {
        id: TEST_DEFINITION_FQN,
        label: 'Column Values To Be Between',
      } as never);
    });

    expect(await screen.findByTestId('parameter-minValue')).toBeInTheDocument();
  });

  it('hides the parameter fields when dynamic assertion is enabled', async () => {
    mockGetListTestDefinitions.mockResolvedValue({
      data: [DYNAMIC_DEFINITION],
      paging: { total: 1 },
    } as never);

    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    await act(async () => {
      formRef?.setValue('testTypeId', {
        id: TEST_DEFINITION_FQN,
        label: 'Column Values To Be Between',
      } as never);
    });

    expect(
      await screen.findByTestId('use-dynamic-assertion')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('parameter-minValue')).toBeInTheDocument();

    await act(async () => {
      formRef?.setValue('useDynamicAssertion', true);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('parameter-minValue')
      ).not.toBeInTheDocument();
    });
  });

  it('shows the compute-row-count switch only when the definition supports it', async () => {
    mockGetListTestDefinitions.mockResolvedValue({
      data: [ROW_LEVEL_DEFINITION],
      paging: { total: 1 },
    } as never);

    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId('compute-passed-failed-row-count')
    ).not.toBeInTheDocument();

    await act(async () => {
      formRef?.setValue('testTypeId', {
        id: TEST_DEFINITION_FQN,
        label: 'Column Values To Be Between',
      } as never);
    });

    expect(
      await screen.findByTestId('compute-passed-failed-row-count')
    ).toBeInTheDocument();
  });

  it('renders the test details fields (name, description, tags, glossary)', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    expect(await screen.findByTestId('test-case-name')).toBeInTheDocument();
    expect(await screen.findByTestId('description')).toBeInTheDocument();
    expect(await screen.findByTestId('tags-selector')).toBeInTheDocument();
    expect(
      await screen.findByTestId('glossary-terms-selector')
    ).toBeInTheDocument();
  });

  it('auto-generates the test name when definition, table and level are set', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    await act(async () => {
      formRef?.setValue('testTypeId', {
        id: TEST_DEFINITION_FQN,
        label: 'Column Values To Be Between',
      } as never);
    });

    await waitFor(() => {
      expect(formRef?.getValues('testName')).toBeTruthy();
    });

    expect(formRef?.getValues('testName')).toContain('customers');
  });

  it('does not override the test name once the user has edited it', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    const nameField = await screen.findByTestId('test-case-name');
    const nameInput = nameField.querySelector('input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'my_custom_name' } });
    });

    await act(async () => {
      formRef?.setValue('testTypeId', {
        id: TEST_DEFINITION_FQN,
        label: 'Column Values To Be Between',
      } as never);
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    expect(formRef?.getValues('testName')).toBe('my_custom_name');
  });

  it('renders the scheduler section when a table is selected and a pipeline can be created', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    expect(await screen.findByTestId('pipeline-name')).toBeInTheDocument();
    expect(
      await screen.findByTestId('schedule-interval-v1')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('enable-debug-log')).toBeInTheDocument();
    expect(await screen.findByTestId('raise-on-error')).toBeInTheDocument();
  });

  it('does not render the scheduler section when a pipeline already exists', async () => {
    mockGetIngestionPipelines.mockResolvedValue({
      data: [{ id: 'pipeline-1' }],
      paging: { total: 1 },
    } as never);

    await act(async () => {
      renderBody({ table: SELECTED_TABLE_WITH_SUITE });
    });

    await waitFor(() => {
      expect(mockGetIngestionPipelines).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('pipeline-name')).not.toBeInTheDocument();
  });

  it('renders the select-all switch and AddTestCaseList when table has a test suite', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE_WITH_SUITE });
    });

    expect(
      await screen.findByTestId('select-all-test-cases')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-test-case-list')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-test-case-btn'));
    });

    await waitFor(() => {
      expect(formRef?.getValues('testCases')).toHaveLength(1);
    });
  });

  it('toggles the custom-query section at table level', async () => {
    await act(async () => {
      renderBody({ table: SELECTED_TABLE });
    });

    await waitFor(() => {
      expect(mockGetListTestDefinitions).toHaveBeenCalled();
    });

    expect(await screen.findByTestId('test-type')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('custom-query'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('test-type')).not.toBeInTheDocument();
    });

    expect(formRef?.getValues('testTypeId')).toEqual({
      id: 'tableCustomSQLQuery',
      label: 'tableCustomSQLQuery',
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-type-btn'));
    });

    expect(await screen.findByTestId('test-type')).toBeInTheDocument();
    expect(formRef?.getValues('testTypeId')).toBeUndefined();
  });

  it('invokes onContextChange with the current selection context', async () => {
    const onContextChange = jest.fn();
    await act(async () => {
      renderBody({ table: SELECTED_TABLE, onContextChange });
    });

    await waitFor(() => {
      expect(onContextChange).toHaveBeenCalled();
    });

    const lastCall =
      onContextChange.mock.calls[onContextChange.mock.calls.length - 1][0];

    expect(lastCall.selectedTestLevel).toBe(TestLevel.TABLE);
    expect(typeof lastCall.generateName).toBe('function');
    expect(lastCall.canCreatePipeline).toBe(true);
  });
});
