/*
 *  Copyright 2026 Collate.
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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TEST_CASE_DELETION_MODE } from '../../../constants/DataQuality.constants';
import { SORT_ORDER } from '../../../enums/common.enum';
import { TestCase } from '../../../generated/tests/testCase';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import TestDefinitionDetailsPanel, {
  TestDefinitionDetailsPanelProps,
} from './TestDefinitionDetailsPanel';

const TEST_DEFINITION = {
  id: 'def-1',
  name: 'columnValuesToBeNotNull',
  fullyQualifiedName: 'columnValuesToBeNotNull',
  displayName: 'Column Values To Be Not Null',
  description: 'Ensures that all values in a column are not null',
  entityType: 'COLUMN',
  testPlatforms: ['OpenMetadata'],
  dataQualityDimension: 'Completeness',
  parameterDefinition: [
    {
      name: 'allowedNulls',
      displayName: 'Allowed Nulls',
      dataType: 'INT',
      required: false,
    },
  ],
} as unknown as TestDefinition;

const TEST_CASES = [
  { id: 'tc-1', name: 'orders_id_not_null' },
  { id: 'tc-2', name: 'customers_id_not_null' },
] as TestCase[];

jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

const mockDataQualityTab = jest.fn();

jest.mock('../../Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: (props: { testCases: TestCase[] }) => {
    mockDataQualityTab(props);

    return (
      <ul data-testid="linked-test-cases">
        {props.testCases.map((testCase) => (
          <li key={testCase.id}>{testCase.name}</li>
        ))}
      </ul>
    );
  },
}));

const lastTabProps = () => mockDataQualityTab.mock.calls.at(-1)[0];

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <span>{markdown}</span>,
}));

const renderPanel = (props: Partial<TestDefinitionDetailsPanelProps> = {}) =>
  renderWithQueryClient(
    <MemoryRouter>
      <TestDefinitionDetailsPanel
        canEdit
        testDefinition={TEST_DEFINITION}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('TestDefinitionDetailsPanel', () => {
  beforeEach(() => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: TEST_CASES,
      paging: { total: TEST_CASES.length },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show the definition and the test cases that use it', async () => {
    renderPanel();

    expect(
      screen.getByTestId('test-definition-details-name')
    ).toHaveTextContent('Column Values To Be Not Null');
    expect(
      screen.getByText(TEST_DEFINITION.description as string)
    ).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Allowed Nulls')).toBeInTheDocument();
    expect(await screen.findByText('orders_id_not_null')).toBeInTheDocument();
    expect(screen.getByText('customers_id_not_null')).toBeInTheDocument();
    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'columnValuesToBeNotNull',
        offset: 0,
      })
    );
  });

  it('should stay closed and fetch nothing without a definition', () => {
    renderPanel({ testDefinition: undefined });

    expect(
      screen.queryByTestId('test-definition-overview')
    ).not.toBeInTheDocument();
    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should hand the definition to onEdit from the edit action', () => {
    const onEdit = jest.fn();
    renderPanel({ onEdit });

    fireEvent.click(screen.getByTestId('edit-test-definition-button'));

    expect(onEdit).toHaveBeenCalledWith(TEST_DEFINITION);
  });

  it('should hide the edit action without edit permission', () => {
    renderPanel({ canEdit: false });

    expect(
      screen.queryByTestId('edit-test-definition-button')
    ).not.toBeInTheDocument();
  });

  it('should report a failed test case load instead of showing no test cases', async () => {
    (getListTestCaseBySearch as jest.Mock).mockRejectedValue({
      response: { status: 500 },
    });
    renderPanel();

    expect(
      await screen.findByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('linked-test-cases')).not.toBeInTheDocument();
  });

  it('should soft delete so linked test cases can be restored', async () => {
    renderPanel();

    await screen.findByText('orders_id_not_null');

    expect(lastTabProps().deletionMode).toBe(TEST_CASE_DELETION_MODE.SOFT);
  });

  it('should sort linked test cases on the server from the first page', async () => {
    renderPanel();
    await screen.findByText('orders_id_not_null');

    await act(() =>
      lastTabProps().pagingData.pagingHandler({ currentPage: 2 })
    );
    await act(() =>
      lastTabProps().fetchTestCases({
        sortField: 'name.keyword',
        sortType: SORT_ORDER.DESC,
      })
    );

    await waitFor(() =>
      expect(getListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sortField: 'name.keyword',
          sortType: SORT_ORDER.DESC,
          offset: 0,
        })
      )
    );
  });

  it('should step back when a delete empties the last page', async () => {
    renderPanel();
    await screen.findByText('orders_id_not_null');

    (getListTestCaseBySearch as jest.Mock).mockImplementation(
      ({ offset }: { offset: number }) =>
        Promise.resolve(
          offset === 0
            ? { data: TEST_CASES, paging: { total: TEST_CASES.length } }
            : { data: [], paging: { total: TEST_CASES.length } }
        )
    );
    await act(() =>
      lastTabProps().pagingData.pagingHandler({ currentPage: 2 })
    );

    await waitFor(() => expect(lastTabProps().pagingData.currentPage).toBe(1));

    expect(lastTabProps().testCases).toEqual(TEST_CASES);
  });
});
